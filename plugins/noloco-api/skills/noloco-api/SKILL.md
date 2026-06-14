---
name: noloco-api
description: Work with Noloco's per-app GraphQL data API. Use when building or debugging Noloco API queries, mutations, CRUD operations, schema introspection, record pagination, API authentication, data sync jobs, or integrations such as syncing Noloco tables with WordPress posts, custom post types, users, taxonomies, or metadata.
---

# Noloco API

## Overview

Use this skill to work with Noloco's app data API safely and efficiently. Noloco exposes a dynamic GraphQL endpoint per app, so first discover the app schema, then build precise queries or mutations for the target table.

## Quick Workflow

1. Confirm the app name and API key source. Prefer `NOLOCO_API_KEY` in the environment and never write keys into source files, logs, screenshots, or examples.
2. Build the endpoint as `https://api.portals.noloco.io/data/<app_name>` unless the user provides a custom endpoint.
3. Use GraphiQL in Noloco settings or GraphQL introspection to discover exact table, field, argument, enum, and relationship names before generating final queries.
4. For reads, query `<tableName>Collection` and request `edges { node { ... } }` plus `pageInfo { hasNextPage endCursor }`.
5. For single-record reads, query the table field directly with a unique argument such as `id`, `uuid`, or another unique field.
6. For writes, use the table-specific mutations `create<tableName>`, `update<tableName>`, and `delete<tableName>` after verifying exact names in the schema.
7. Handle GraphQL `errors`, HTTP errors, empty data, pagination, and partial failures explicitly.

## Reference Selection

Read `references/graphql-patterns.md` when you need concrete query/mutation patterns, pagination loops, introspection examples, WordPress sync advice, or links to the official Noloco docs used to build this skill.

Use `scripts/noloco_graphql.py` when you need to run a Noloco GraphQL request from the command line without writing one-off HTTP code.

## Request Pattern

Send requests as JSON `POST` bodies with `query`, optional `variables`, and optional `operationName`.

```bash
export NOLOCO_API_KEY="..."
python "${CLAUDE_PLUGIN_ROOT}/skills/noloco-api/scripts/noloco_graphql.py" \
  --app-name my-app \
  --query-file query.graphql \
  --variables-file variables.json
```

Use variables for user input and dynamic values whenever the schema supports them. If Noloco rejects variables for a generated operation, inspect the app schema and adjust the mutation/query shape rather than string-concatenating untrusted values.

## Integration Guardrails

- Treat Noloco IDs as external IDs. Store them separately from local primary keys, for example WordPress post meta such as `_noloco_id`.
- For imports, make sync idempotent: fetch, map, upsert, then record the source record ID and sync timestamp.
- For updates, send only changed fields when calling update mutations. Noloco supports partial updates, and this reduces unintended overwrites.
- For deletes, require an explicit product decision before destructive propagation. In WordPress integrations, default to trashing or marking records stale rather than hard-deleting.
- For schema mapping UIs, rely on live introspection or GraphiQL instead of hard-coded table assumptions.
- For scheduled syncs, page through all results and resume from cursors or timestamps where possible.
