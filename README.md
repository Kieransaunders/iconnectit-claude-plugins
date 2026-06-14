# iConnectIT Claude Plugins

A marketplace of [Claude Code](https://docs.claude.com/en/docs/claude-code) / Cowork plugins by [iConnectIT](https://iconnectit.co.uk), focused on WordPress, Divi 5, and web delivery.

## Plugins

| Plugin | What it does |
|--------|--------------|
| **divi5-tools** | Generate, review, and import SEO-optimised Divi 5 landing pages. Four skills: `landing-page`, `design-review`, `style-variables`, `import-to-local`. |
| **wp-dev-tools** | WordPress plugin/theme marketing asset generator (`wp-plugin-marketing`) and WordPress.org pre-submission auditor (`wp-plugin-submission-check`). |

## Install

Add this marketplace, then install the plugins you want.

```bash
# In Claude Code
/plugin marketplace add iconnectit/iconnectit-claude-plugins
/plugin install divi5-tools@iconnectit-claude-plugins
/plugin install wp-dev-tools@iconnectit-claude-plugins
```

Replace `iconnectit/iconnectit-claude-plugins` with this repo's `owner/repo` once it's pushed to GitHub. You can also point at a local clone:

```bash
/plugin marketplace add /path/to/iconnectit-claude-plugins
```

Run `/plugin` to browse and toggle installed plugins.

## Repository layout

```
.
├── .claude-plugin/
│   └── marketplace.json        # marketplace manifest (lists all plugins)
├── plugins/
│   ├── divi5-tools/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/…
│   └── wp-dev-tools/
│       ├── .claude-plugin/plugin.json
│       └── skills/…
└── README.md
```

## Adding a new plugin

1. Create `plugins/<your-plugin>/.claude-plugin/plugin.json` and a `skills/` (and/or `commands/`, `agents/`) directory.
2. Add an entry to `.claude-plugin/marketplace.json` pointing at `./plugins/<your-plugin>`.
3. Commit and push. Users update with `/plugin marketplace update iconnectit-claude-plugins`.

## Licence

MIT — see [LICENSE](LICENSE).
