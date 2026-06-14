# iConnectIT Claude Plugins

A marketplace of [Claude Code](https://docs.claude.com/en/docs/claude-code) and Cowork plugins by [iConnectIT](https://iconnectit.co.uk), focused on WordPress, Divi 5, Noloco, and web delivery.

One marketplace, multiple plugins — install only what you need.

## Plugins

| Plugin | Skills | What it does |
|--------|--------|--------------|
| **divi5-tools** | `landing-page`, `design-review`, `style-variables`, `import-to-local` | Generate, review, and import SEO-optimised Divi 5 landing pages. |
| **wp-dev-tools** | `wp-plugin-marketing`, `wp-plugin-submission-check` | Market a WordPress plugin/theme and audit it for WordPress.org submission. |
| **noloco-api** | `noloco-api` | Work with Noloco's per-app GraphQL data API — introspection, CRUD, pagination, WordPress sync. |

### divi5-tools

Production-ready Divi 5 work, end to end.

- **landing-page** — generates complete, importable Divi 5 JSON via a Node builder library (no hand-written escaped JSON), with five aesthetic presets, an HTML preview approval gate, and a deterministic SEO report card.
- **design-review** — audits any Divi 5 export against structural rules, SEO requirements, and a professional design checklist.
- **style-variables** — turns a brand guide or design tokens into an importable Divi 5 Global Variables JSON.
- **import-to-local** — imports a generated page into a running [Local](https://localwp.com) site as a draft, previews it, and publishes only on explicit accept.

Requires Node.js in the working environment.

### wp-dev-tools

The two workflows either side of a WordPress release.

- **wp-plugin-marketing** — produces finished go-to-market assets: tagline, descriptions, `readme.txt`, WordPress.org listing copy, landing/docs/About pages, blog posts, email sequences, social posts, case studies, an ICP, and a roadmap/KPI plan. UK English by default.
- **wp-plugin-submission-check** — audits a plugin directory for WordPress.org Plugin Directory readiness: Plugin Check (PCP) issues, guideline compliance, `readme.txt` validation, header checks, and a pre-release security pass.

### noloco-api

- **noloco-api** — schema introspection, CRUD queries and mutations, cursor pagination, and WordPress sync patterns for Noloco's per-app GraphQL API. Includes a dependency-free Python CLI helper for authenticated GraphQL requests. Set `NOLOCO_API_KEY` before use.

## Install

Add the marketplace, then install the plugins you want:

```bash
# In Claude Code
/plugin marketplace add Kieransaunders/iconnectit-claude-plugins
/plugin install divi5-tools@iconnectit-claude-plugins
/plugin install wp-dev-tools@iconnectit-claude-plugins
/plugin install noloco-api@iconnectit-claude-plugins
```

Run `/plugin` to browse and toggle installed plugins.

### Test locally without GitHub

```bash
/plugin marketplace add "/Volumes/External/iConnectIT claude plugins"
```

Or load a single plugin directly:

```bash
claude --plugin-dir "/Volumes/External/iConnectIT claude plugins/plugins/noloco-api"
```

## Repository layout

```
.
├── .claude-plugin/
│   └── marketplace.json        # marketplace manifest (lists all plugins)
├── plugins/
│   ├── divi5-tools/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/{landing-page,design-review,style-variables,import-to-local}/
│   ├── wp-dev-tools/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/{wp-plugin-marketing,wp-plugin-submission-check}/
│   └── noloco-api/
│       ├── .claude-plugin/plugin.json
│       └── skills/noloco-api/
├── setup-github.sh             # one-shot git init + publish to GitHub
├── LICENSE
└── README.md
```

## Adding a new plugin

1. Create `plugins/<your-plugin>/.claude-plugin/plugin.json` plus a `skills/` (and/or `commands/`, `agents/`) directory.
2. Add an entry to `.claude-plugin/marketplace.json` pointing at `./plugins/<your-plugin>`.
3. Commit and push. Users pull updates with `/plugin marketplace update iconnectit-claude-plugins`.

## Publishing

Run the bundled script from your own Terminal (not inside Cowork):

```bash
cd "/Volumes/External/iConnectIT claude plugins"
bash setup-github.sh
```

It runs `git init`, commits, and — with the [GitHub CLI](https://cli.github.com) authenticated — creates and pushes the `iconnectit-claude-plugins` repo. No `gh`? The script prints the manual remote/push steps.

## Licence

MIT — see [LICENSE](LICENSE). © 2026 Kieran, iConnectIT.
