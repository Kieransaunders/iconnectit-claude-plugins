# noloco-api plugin

Claude Code plugin for working with Noloco's per-app GraphQL data API: schema introspection, CRUD queries and mutations, cursor pagination, and WordPress sync patterns.

## What's included

- `skills/noloco-api/SKILL.md` — workflow and guardrails for Noloco API work (auto-invoked by Claude when relevant, or run `/noloco-api:noloco-api`)
- `skills/noloco-api/references/graphql-patterns.md` — verified query/mutation patterns, introspection examples, pagination loops, WordPress sync notes
- `skills/noloco-api/scripts/noloco_graphql.py` — CLI helper for sending authenticated GraphQL requests (stdlib only, no dependencies)

## Install

Part of the **iconnectit-claude-plugins** marketplace:

```shell
/plugin marketplace add Kieransaunders/iconnectit-claude-plugins
/plugin install noloco-api@iconnectit-claude-plugins
```

Or test locally without installing:

```bash
claude --plugin-dir "/path/to/iconnectit-claude-plugins/plugins/noloco-api"
```

## Usage

Set your App API key (from Noloco → Settings → Integrations & API Keys):

```bash
export NOLOCO_API_KEY="..."
```

Then ask Claude to build queries, debug mutations, or design sync jobs against your Noloco app. The skill triggers automatically on Noloco API work.

## Versioning

Bump `version` in `.claude-plugin/plugin.json` to push updates to installed users.
