# Step 2 — WordPress.org listing & readme.txt

The public .org page **and** its search ranking inside the repository are
generated from `readme.txt`. It is the single highest-leverage marketing asset
for a free/freemium plugin because .org is where buyers search. Build it from
the MVC assets — don't re-write copy from scratch.

Output `readme.txt` as **plain text** using the WordPress readme markup below
(not Markdown). Themes use a similar `readme.txt`/style header — adapt the same
content.

## readme.txt anatomy

```
=== Plugin Name ===
Contributors: yourwporgusername
Tags: keyword1, keyword2, keyword3
Requires at least: 6.0
Tested up to: 6.x
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Short description here — max 150 characters, keyword-first, benefit-led.

== Description ==

Lead paragraph: the pain-point and the relief, in the buyer's words.

Benefit blocks (use this so it scans):

* **Benefit headline** — one line on the outcome, naming the feature as the how.
* **Benefit headline** — …
* **Benefit headline** — …

Who it's for / not for. Then a clear next step.

== Installation ==

Reuse the Setup cornerstone page, condensed to numbered steps.

== Frequently Asked Questions ==

= Question a real prospect asks =
Answer in 2–3 sentences. (Pull straight from the MVC objections asset.)

== Screenshots ==

1. Caption for screenshot-1.png — sells the benefit shown.
2. Caption for screenshot-2.png — …

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
First release.
```

## Markup notes

- The first short line under the header block is the **short description** (≤150
  chars) — this is what shows in search results and the listing header.
- Headings use `== Section ==`; sub-items (FAQ Qs, changelog versions) use
  `= Item =`.
- Bold is `**text**`, italics `*text*`, lists use `*` bullets. No raw HTML.
- `Tags:` — pick a small set (≈5) of the highest-intent search terms. .org now
  weights only a few tags; don't stuff. These materially affect ranking.
- Screenshot captions map by position to `screenshot-1.png`,
  `screenshot-2.png`, … in the plugin's `/assets` directory.

## SEO for the .org repository

The .org search engine indexes the readme. To rank:

- **Plugin title and short description carry the most weight** — put the primary
  search keyword in both, naturally.
- Repeat the primary keyword and close variants a few times across the
  description, in real sentences — never keyword-stuff.
- Choose tags as actual search terms, not internal feature names.
- Strong install count, recent "tested up to", active support threads, and good
  ratings all lift ranking — so the readme should explicitly invite reviews and
  show the product is maintained.
- Link to the product website from the .org page **with UTM parameters** so you
  can attribute .org → site traffic.

## Pre-submission checklist

- Product name spelled correctly and consistently everywhere.
- Product/website URL correct and using UTMs.
- Images are high quality and actually represent the product (show outcomes, not
  empty settings screens).
- FAQ covers the most common real support requests.
- `Tested up to` matches the current WordPress version.
- Short description is ≤150 characters and keyword-first.
- License block present and correct (GPL-compatible).

## Marketplaces

If selling via a paid marketplace (e.g. CodeCanyon/ThemeForest) as well, each
has its own submission rules and assets — but the MVC assets and this readme
content port across with light edits. Build .org first, reuse for the rest.
