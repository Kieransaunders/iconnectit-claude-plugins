---
name: wp-plugin-submission-check
description: >-
  Audit a WordPress plugin for readiness to submit to the WordPress.org Plugin
  Directory (https://wordpress.org/plugins/developers/add/). Use this skill
  whenever the user wants to check, review, audit, or prepare a WordPress plugin
  for submission, asks "is my plugin ready for the .org repo / repository",
  mentions Plugin Check / PCP, the plugin review team, plugin guidelines,
  readme.txt validation, or wants a pre-submission / pre-release security and
  compliance pass on a WordPress plugin. Trigger even if they don't say
  "submission" — e.g. "will WordPress reject this plugin?", "review my plugin
  before I push to SVN", "check my readme and headers". Works on any plugin
  directory, not just the current project.
---

# WordPress.org plugin submission check

Audits a plugin directory against what the WordPress.org review team and the
official **Plugin Check (PCP)** tool enforce, then reports what must be fixed
before submission. The goal is a clean first review: the manual review queue is
1–10 days, and a rejection resets that clock, so catching issues locally is high
leverage.

## How to run it

1. **Identify the plugin root** — the folder containing the main plugin PHP file
   (the one with the `Plugin Name:` header) and `readme.txt`.

2. **Run the automated scan.** It is stdlib-only Python, no install:

   ```bash
   python3 scripts/check.py /path/to/plugin
   # JSON for tooling:   python3 scripts/check.py /path/to/plugin --json
   # Save the report:    python3 scripts/check.py /path/to/plugin --md report.md
   ```

   It prints a report card (Blockers / Fails / Warnings / Info / Pass) with each
   finding mapped to a guideline and a file:line. Exit code is non-zero when any
   BLOCKER/FAIL exists, so it drops straight into CI or a pre-commit hook.

3. **Triage the findings with the user.** The scanner is intentionally
   conservative and pattern-based — it surfaces candidates, it doesn't make the
   final call. Confirm each BLOCKER/FAIL, then walk the WARN items. For security
   findings, read `references/security.md` for the correct sanitise/escape/nonce
   pattern. Don't just suppress a warning — fix the underlying code or explain
   to the user why it's a false positive.

4. **Cover what the scanner can't see.** Static analysis can't judge licensing of
   bundled assets, trademark use in the slug, tracking consent, screenshots, or
   trialware. Work through `references/checklist.md` — it's the full manual
   checklist mapped to the 18 guidelines plus header/readme/security rules.

5. **Run the official Plugin Check (PCP).** This is the same tool .org runs on
   every new submission; its *Plugin Repo* category **blocks** submission on any
   error-level item. The local scan is a fast pre-filter, not a replacement.

   ```bash
   wp plugin install plugin-check --activate     # via WP-CLI
   wp plugin check <plugin-slug>
   ```

   Or in wp-admin: **Tools → Plugin Check**. Also validate the readme at
   https://wordpress.org/plugins/developers/readme-validator/.

6. **Summarise.** Give the user a short verdict (ready / not ready), the must-fix
   list, and the submission flow (see `references/checklist.md` → "Submission &
   SVN flow"). Offer to fix the blockers if they're in code you can edit.

## What the scanner checks (and the guideline behind it)

Header & readme: main file + `Plugin Name`/`Version`/`License`/`Text Domain`
present; GPL-compatible licence (g1); `readme.txt` present with `Stable tag`,
`Tested up to`, `Requires at least`; `Stable tag` not `trunk` and matching the
header `Version` (g3, g15); ≤5 tags (g12); short description ≤150 chars; readme
≤10KB; text domain matches slug.

Code & security: obfuscation / dynamic code — `eval`, `base64_decode`,
`gzinflate`, packer-style variable names (g4); web-reachable scripts that load
`wp-load.php` directly; missing `defined('ABSPATH')` guards; `$wpdb` queries
without `prepare()`; superglobals without sanitising; hardcoded secrets / leftover
placeholders; debug output (`var_dump`/`print_r`/`error_log`).

Distribution: bundled jQuery / common libraries that must come from WordPress
(g13); external CDN enqueues / remote code (g8); dev/build files that shouldn't
ship (and whether `.distignore` covers them); Freemius / SaaS use vs. the
trialware and tracking rules (g5, g6, g7, g11).

## Notes

- Treat the output as a worklist, not a verdict. A WARN can be a false positive
  (e.g. an `error_log` behind a `WP_DEBUG` check); explain rather than silently
  ignore.
- Re-run after fixes — it's cheap and confirms blockers are cleared.
- Guideline numbers refer to the WordPress.org Detailed Plugin Guidelines; the
  full text is summarised in `references/checklist.md`.
