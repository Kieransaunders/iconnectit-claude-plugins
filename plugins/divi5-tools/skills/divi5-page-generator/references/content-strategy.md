# Content Strategy (multi-page planning)

The layer *above* single-page generation. `SKILL.md` builds one page well; this
reference decides **which pages to build, what each one targets, and how they link**
— the difference between a one-off landing page and a cluster that builds topical
authority and ranks. Adapted from the SearchFit content-strategy framework for the
divi5-tools pipeline, Divi 5 / WordPress, and UK English.

Use this when the brief is broader than one page: "market the new features",
"build out the product site", "hub + spokes", "rank for <broad term>", or any time
the answer to "how many pages?" is "more than one".

On-page rules (titles, meta, headings, keyword placement, schema) stay in
[seo.md](seo.md) — this file does not repeat them. Design judgement stays in
[taste.md](taste.md).

---

## Where it sits in the pipeline

```
content-strategy.md   →  decide the page set + keyword per page + link map   (this file)
  └─ keyword-cluster   →  group a raw keyword list into page-sized clusters   (searchfit-seo, optional)
  └─ content-brief     →  per-page brief: angle, sections, intent             (searchfit-seo, optional)
      └─ landing-page   →  generate each page's Divi 5 JSON + seo-meta + schema (SKILL.md)
          └─ design-review → audit each generated export                       (design-review skill)
```

You can run the whole thing inside this plugin; the searchfit-seo steps are
optional accelerators for keyword grouping and per-article briefs.

---

## Step 1 — Inputs (gather or infer, don't block on them)

1. **What the product/service does** and who it's for (roles, pain, buying stage).
2. **Seed keywords / core topic** — the one broad term the site should own.
3. **Competitors** — 2–3 who already rank for that term.
4. **Existing pages** — what's already published (avoid cannibalising).

If a brief is supplied, infer the rest and proceed — surface assumptions, don't
interrogate.

---

## Step 2 — Topical authority map → hub + spokes

Build a topic hierarchy, then map it straight onto WordPress pages:

```
Pillar / Hub      → one comprehensive page on the core topic        (the broad keyword)
├── Cluster 1     → a spoke page on a sub-topic / feature           (a specific long-tail term)
├── Cluster 2     → a spoke page on a sub-topic / feature
└── Cluster 3     → a spoke page on a sub-topic / feature
```

- **Hub** = the money page. Broadest intent, links *down* to every spoke, 2,000–4,000
  words of real depth. Usually the homepage or a `/<core-topic>/` page.
- **Spoke** = one page per feature / use-case / comparison. Narrower, higher-intent
  keyword. Links *back up* to the hub and *sideways* to sibling spokes where relevant.
- One primary keyword **per page** — never two pages chasing the same term
  (keyword cannibalisation splits your own ranking signal).

This is the structure to reach for whenever the user picks "hub + spokes".

### Topic ideation — finding spoke candidates

When the spokes aren't obvious, generate candidates from the seed using these
angles, then keep only the ones that map to a real page someone would search for
(most landing-page work lives in the first four; the rest are blog formats — use
only if the site is genuinely expanding into content marketing):

- **How-to / guide** — "how to \<do the job the product does>"
- **Use-case** — the product applied to one audience or scenario
- **Comparison** — "\<product> vs \<alternative>", "alternatives to \<X>"
- **Feature deep-dive** — one capability as its own intent-rich page
- *(blog-only)* listicle, mistakes/myths, trends, templates, data study

Layer **funnel stage** on top of intent to balance the cluster — don't build only
bottom-of-funnel pages:

| Stage | Visitor is… | Typical spoke |
|-------|-------------|---------------|
| TOFU | learning the problem exists | how-to / guide (informational) |
| MOFU | comparing solutions | comparison / "best" (commercial) |
| BOFU | ready to act | pricing / signup (transactional) |

For each surviving candidate, sanity-check the **unique angle**: what does this page
say that the competitors ranking for the term don't? No angle → no page.

---

## Step 3 — Search intent → page type

Match format to intent. Wrong format = wrong page, no matter how good the copy.

| Intent | Page type | Divi build | Example |
|--------|-----------|-----------|---------|
| Informational | Guide / how-to / explainer | Long-form sections, FAQ, schema | "how to display Airtable on WordPress" |
| Commercial | Comparison / "best" / vs | Feature table, pros/cons, CTA band | "best Airtable WordPress plugin" |
| Transactional | Product / pricing / signup | Hero + pricing + strong CTA | "Airtable WordPress plugin" |
| Navigational | Brand / docs | Minimal, fast, internal links | "<brand> setup" |

The landing-page generator handles all of these — the strategy decides which one
each URL should be before a brief is written.

---

## Step 4 — Content gap analysis

If pages already exist:
1. List what's already covered well vs. thin/missing.
2. Find terms competitors rank for that the site doesn't address.
3. Prioritise gaps by search volume × business relevance (next step).

Don't rebuild pages that already work — extend the cluster around them.

---

## Step 5 — Prioritisation

Score each candidate page on: **search volume**, **competition**, **business value**
(does it attract the actual buyer?), and **cluster fit** (does it strengthen the hub?).

| | Low competition | High competition |
|---|---|---|
| **High business value** | **Quick win — build first** | **Big bet — invest in depth** |
| **Low business value** | Fill-in — batch later | Avoid — skip |

Sequence: quick wins → big bets (hub usually a big bet) → fill-ins. Skip the rest.

---

## Step 6 — Internal linking plan

Decide links *before* generating, so each page's copy can include them naturally
(the generator wants descriptive anchor text, never "click here"):

- Every spoke links **up** to the hub with keyword-rich anchor text.
- The hub links **down** to every spoke (a "features" or "guides" section).
- Spokes link **sideways** only where genuinely related.
- No orphan pages — every published page is reachable from the hub in one hop.

Record the map as a simple list (`Hub → Spoke A, Spoke B, …`; `Spoke A → Hub, Spoke B`)
and pass it into each page's brief.

---

## Step 7 — Cadence

A cluster doesn't need to ship at once:
- **Minimum** — hub + one spoke live, rest scheduled.
- **Growth** — full cluster (hub + 3–5 spokes) over a few weeks.
- Publish the hub first or alongside the first spokes so the links resolve.

---

## Output format

Deliver the strategy as a compact plan before any page is built:

```
## Content Strategy: <Brand>

### Audience
<one line>

### Hub + spokes
- Hub:   <page>  — primary keyword: <term>  — intent: <type>
- Spoke: <page>  — primary keyword: <term>  — intent: <type>
- Spoke: ...

### Priority queue
| # | Page | Primary keyword | Intent | Priority | Est. words |
|---|------|-----------------|--------|----------|------------|
| 1 | ...  | ...             | ...    | Quick win| 1500       |

### Internal linking
Hub → all spokes; each spoke → hub (+ siblings where related)

### Success metrics
- Organic traffic target, keyword rankings to track, pages live by <date>
```

Then run each page through the brief → landing-page → design-review pipeline.

---

## Worked example — Airloop (Airtable → WordPress)

```
Hub:   /airtable-to-wordpress/      kw: "Airtable to WordPress"          intent: informational/commercial
Spoke: /airtable-divi-loop-builder/ kw: "Airtable Divi loop builder"     intent: informational
Spoke: /airtable-wordpress-filtering/ kw: "filter Airtable on WordPress" intent: informational  (live AJAX user_filters)
Spoke: /airloop-pricing/            kw: "Airtable WordPress plugin pricing" intent: transactional (Free vs Pro)

Linking: hub → all 3 spokes; each spoke → hub; filtering ↔ loop-builder (related).
Build order: hub (big bet) → loop-builder + filtering (quick wins) → pricing.
```

This is the structure the divi5-tools pipeline generates against when the brief is
"market the new Airloop features as a hub + spokes".
