# Noloco GraphQL Patterns

Last verified against official Noloco guides on 2026-06-11.

Official docs:
- API overview: https://guides.noloco.io/api-documentation/api-overview
- Fetching records: https://guides.noloco.io/api-documentation/api-overview/fetching-records
- Fetching one record: https://guides.noloco.io/api-documentation/api-overview/fetching-a-record
- Creating records: https://guides.noloco.io/api-documentation/api-overview/creating-a-record
- Updating records: https://guides.noloco.io/api-documentation/api-overview/update-a-record
- Deleting records: https://guides.noloco.io/api-documentation/api-overview/deleting-a-record
- API keys: https://guides.noloco.io/settings/integrations-and-api-keys

## Core Facts

- Noloco's app data API is GraphQL.
- Each app has an endpoint: `https://api.portals.noloco.io/data/<app_name>`.
- Authenticate with `Authorization: Bearer <app_api_key>`.
- Find the App API key in Noloco's Integrations & API Keys settings.
- The schema is dynamic per app. Always inspect GraphiQL or introspection before finalizing table and field names.

## HTTP Shape

```http
POST /data/<app_name> HTTP/1.1
Host: api.portals.noloco.io
Content-Type: application/json
Authorization: Bearer <app_api_key>
```

```json
{
  "query": "query Example($first: Int) { projectsCollection(first: $first) { edges { node { id name } } pageInfo { hasNextPage endCursor } } }",
  "variables": {
    "first": 50
  }
}
```

## Discover the Schema

Use Noloco's GraphiQL API Explorer from app settings when available. For command-line checks, run an introspection query.

Minimal field discovery query:

```graphql
query IntrospectionTypes {
  __schema {
    queryType { fields { name description } }
    mutationType { fields { name description } }
  }
}
```

Detailed type lookup:

```graphql
query TypeLookup($name: String!) {
  __type(name: $name) {
    name
    kind
    fields {
      name
      args {
        name
        type { kind name ofType { kind name } }
      }
      type { kind name ofType { kind name ofType { kind name } } }
    }
  }
}
```

## Fetch a Collection

Collection queries are generally named `<tableName>Collection`. They use a connection pattern.

```graphql
query FetchProjects($first: Int!, $after: String) {
  projectsCollection(first: $first, after: $after) {
    edges {
      node {
        id
        name
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Supported arguments can vary by schema, but Noloco documents common arguments including `first`, `before`, `after`, `orderBy`, and `where`.

Common filtering shape:

```graphql
query ChangedProjects($first: Int!, $after: String, $since: DateTime) {
  projectsCollection(
    first: $first
    after: $after
    where: { updatedAt: { greaterThan: $since } }
    orderBy: { field: "updatedAt", direction: "ASC" }
  ) {
    edges { node { id name updatedAt } }
    pageInfo { hasNextPage endCursor }
  }
}
```

Verify scalar names such as `DateTime`, filter operators such as `greaterThan`, and order fields against the actual schema before using the query in production code.

## Fetch One Record

Single-record queries generally use the table field directly and accept a unique argument such as `id`, `uuid`, or a custom unique field.

```graphql
query FetchProject($id: Int!) {
  projects(id: $id) {
    id
    name
    description
    lead {
      id
      firstName
      lastName
      email
    }
  }
}
```

## Create a Record

Create mutations are generally named `create<tableName>`. Provide required unique fields and any optional fields needed by the workflow.

```graphql
mutation CreateProject($name: String!, $description: String) {
  createProjects(name: $name, description: $description) {
    id
    name
    createdAt
  }
}
```

## Update a Record

Update mutations are generally named `update<tableName>`. Include the integer `id` and only the fields that changed.

```graphql
mutation UpdateProject($id: Int!, $name: String) {
  updateProjects(id: $id, name: $name) {
    id
    name
    updatedAt
  }
}
```

Partial updates reduce accidental overwrites during two-way sync.

## Delete a Record

Delete mutations are generally named `delete<tableName>` and require the integer `id`.

```graphql
mutation DeleteProject($id: Int!) {
  deleteProjects(id: $id) {
    id
    name
  }
}
```

Return enough fields to log or confirm the deleted record. For user-facing integrations, require an explicit setting before propagating deletes.

## Pagination Loop

Use `pageInfo.hasNextPage` and `pageInfo.endCursor`.

Pseudocode:

```text
after = null
do:
  result = request(first: 100, after: after)
  process each edge.node
  after = result.collection.pageInfo.endCursor
while result.collection.pageInfo.hasNextPage
```

Keep the operation idempotent. If a sync crashes, rerunning it should update existing mapped records rather than duplicate them.

## WordPress Sync Notes

- Store app name, endpoint override, and encrypted or otherwise protected API key in WordPress options with autoload disabled.
- Send GraphQL requests with `wp_remote_post()`, JSON headers, bearer auth, and explicit timeout handling.
- Convert GraphQL errors into `WP_Error` objects and log the operation name plus sanitized variables.
- Store the Noloco record ID in post meta, for example `_noloco_id`.
- For imports, map Noloco fields to `post_title`, `post_content`, `post_excerpt`, `post_name`, taxonomies, post meta, featured images, and SEO plugin fields as configured.
- For two-way sync, hook into `save_post_{post_type}` and status/delete transitions, debounce recursive saves, and send only changed fields.
- Prefer soft delete or trash behavior until the user explicitly enables hard deletes back to Noloco.
- Build the field mapping UI from introspection so table-specific field names, relationship fields, and scalar types stay current.

## Common Failure Modes

- Wrong app name: endpoint resolves but returns authentication, routing, or schema errors.
- Account API key used instead of App API key: Noloco's data API needs the App API key.
- Table name mismatch: confirm exact singular/plural and capitalization through GraphiQL.
- Missing unique field on create: provide fields marked unique in the Noloco table schema.
- Assuming every table has `updatedAt`: inspect the schema and provide a fallback full sync.
- Treating `errors` as success because HTTP status is 200: GraphQL can return `errors` alongside HTTP 200.
