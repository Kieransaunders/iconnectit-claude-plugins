---
name: wp-plugin-marketing
description: >-
  Market and sell WordPress plugins and themes — produces the finished marketing
  assets, not a strategy to execute. Use this skill whenever the user wants to
  promote, launch, grow, or sell a WordPress plugin or theme: writing a tagline,
  short/long description, readme.txt, WordPress.org listing copy, a product
  landing page, cornerstone/docs pages, an About page, blog posts, email
  sequences, social posts, case studies, an Ideal Customer Profile, or a
  marketing roadmap/KPI plan. Trigger even when the user doesn't say "marketing"
  — e.g. "help me launch my plugin", "write the .org page for my plugin",
  "nobody's downloading my plugin", "I need copy for my theme", "how do I get
  more installs", or "turn my plugin into a business". Defaults to UK English.
---

# WordPress Plugin & Theme Marketing

A skill for marketing and selling WordPress plugins and themes, built on the
inbound-marketing framework from Freemius' *Marketing Handbook for WordPress
Plugin and Theme Developers*.

## Core principle: ship finished assets, not homework

Developers usually avoid marketing because it feels uncertain and unrewarding.
The job of this skill is to remove that friction by **producing the actual
deliverable** — the tagline, the readme, the landing page copy, the email
sequence — ready to paste in. Never hand back a strategy, framework, or to-do
list for the user to execute themselves. If you genuinely lack a fact, write a
sensible draft with a clearly marked `[assumption: …]` and move on; the user
will redirect. Bias hard toward a working first draft.

All written deliverables are Markdown unless the target platform needs another
format (readme.txt is plain text; WordPress.org descriptions use their own
lightweight markup — see `references/wordpress-org.md`).

## The one idea that makes this easy: raw bits → assets

Every plugin/theme developer already owns three "raw bits" of marketing. You
don't invent marketing material from nothing — you mine these:

1. **The pain-point** — the specific problem your product solves for a specific
   segment. → Becomes case studies, tutorials, email sequences, webinars.
2. **Experience** — you know how to overcome that problem. → Becomes blog posts,
   landing pages, docs, FAQs, video walkthroughs.
3. **Unique approach** — your opinionated, different take on the market. →
   Becomes thought-leadership posts, interviews, podcast angles, social quotes.

Before writing any asset, anchor it to one of these three bits. It keeps the
copy concrete and stops it drifting into generic feature-listing.

## Inbound by default

Favour inbound (earn attention organically: SEO, content, docs, social,
community) over outbound (paid clicks/impressions/placements). Most plugin
businesses grow on inbound long before paid makes sense, and it costs time not
budget. Only reach for outbound tactics when the user explicitly has a budget
and a reason. The most effective marketing doesn't read as marketing — write
helpful, specific content that happens to feature the product, not ad copy.
See `references/channels.md` for the channel playbooks and the
inbound-vs-outbound split.

## What you need before writing (gather fast, assume the rest)

Get these in one quick pass — ideally from context, the user's vault/files, or a
single batched question. Don't interview at length; fill gaps with marked
assumptions.

- Product name + type (plugin / theme / both)
- What it does, in one plain sentence
- The pain-point and the target user (who, what they're trying to do)
- Free / freemium / paid, and price tiers if any
- Is it (going) on WordPress.org, a marketplace, and/or its own site?
- Existing URL, brand voice, or assets to match

If the user has a vault, brand guide, or existing copy, read it first and match
voice. For this user's stack and UK context, default to UK English, GBP, and
GDPR-aware language.

## Workflow — pick the entry point, don't force all four steps

This is a roadmap, not a gate. Jump straight to whatever the user asked for. The
four steps below are the natural build order for a product going from zero to a
marketed business; use them to decide what's missing if the user asks "what
should I do?".

### Step 1 — Minimum Viable Content (MVC) assets

The written foundation everything else reuses. When asked to "launch", "write
copy for", or "set up marketing for" a product and these don't exist, produce
them. Full templates and the quality checklist live in
`references/mvc-assets.md`. The set:

- Tagline (1 line, distinctive)
- Short description (≤150 characters)
- Long description (benefit-led, not feature-led)
- Top 5+ user concerns/objections, answered
- Annotated screenshot brief/captions
- 5 cornerstone pages: setup, how-to-use (the demo), + 3 concrete use cases
- About page that talks about the *customer*, not the founder
- Ideal Customer Profile (ICP)
- Clean `readme.txt` (see Step 2)

### Step 2 — WordPress.org listing

The .org page and its search ranking are generated from `readme.txt`. Reuse the
MVC assets to fill it, then SEO-optimise it. Templates, the field-by-field
guide, the SEO rules, and the pre-submission checklist are in
`references/wordpress-org.md`.

### Step 3 — Product website / landing page

Puts the user in full control of content and brand. Keep it a clean, flat
structure (Home, Features+Demo, Buy/Download, Support/Docs), lead with social
proof placed *next to* CTAs, and wire up lead capture + email sequences from day
one. Full page-by-page copy structure, social-proof placement, and the blog
decision are in `references/product-website.md`.

### Step 4 — Prioritisation system (make it repeatable)

Once the foundations exist, the question becomes "what do I do next and is it
worth it?". Set vision → goals → objectives → KPIs, pull the data into one
place, and prioritise by impact vs effort. Use this when the user asks how to
prioritise, what to measure, or how to keep marketing going consistently. The
pyramid, the KPI/data list, and the prioritisation matrices are in
`references/prioritisation.md`.

## Output conventions

- Lead with the finished asset. Keep preamble to one line.
- When producing multiple assets, save each as its own clearly named file so the
  user can grab them individually.
- Mark every guessed fact inline as `[assumption: …]` so the user can correct in
  seconds rather than re-reading.
- UK English, GBP, GDPR-aware by default; switch only if the product is clearly
  targeting another market.
- After delivering, offer the obvious next asset in one sentence (e.g. "Want the
  readme.txt built from this?") rather than a long menu.

## Reference files

Read the relevant one(s) before producing that deliverable:

- `references/mvc-assets.md` — Step 1. Templates + quality checklist for every
  MVC asset, including the ICP and About page.
- `references/wordpress-org.md` — Step 2. readme.txt anatomy, the .org markup,
  SEO optimisation, and pre-submission checklist.
- `references/product-website.md` — Step 3. Site structure, page-by-page copy,
  social-proof placement, lead/email flows, blog strategy.
- `references/prioritisation.md` — Step 4. Marketing pyramid, KPIs, the data
  audit list, and prioritisation matrices.
- `references/channels.md` — Inbound vs outbound, and a short playbook per
  channel (content, SEO, social, email, affiliate, influencer, paid).
