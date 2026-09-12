# LaFenice plugin contract

## Contents

1. Product model
2. Authentication boundary
3. Standard-versus-advanced decision
4. Python runtime boundary
5. Component and API map
6. Naming and ownership
7. Verification and transfer boundary
8. Production browser and deliverable contract

## Product model

A LaFenice plugin is a consistent set of plugin-tagged configuration and Code Registry snapshots. It is not a repository folder. This contract is written for a production deployment where application source code, containers, databases, and build outputs are unavailable to the agent. Use only the deployed HTTP APIs and App Shell URL; never require filesystem access to the running system.

Confirm the API base through `GET /ping`. If a documented route or shape is not supported by the deployment, treat it as a version/capability mismatch and report it instead of searching container files or guessing database writes.

Exportable sections are:

| Section | Identity | Typical producer |
| --- | --- | --- |
| Collections | `key` | Collection Config / MDC |
| Code | `module_key` | Generate Code or Code Registry |
| Menu | `key` or `path` | Generate Code or Access Control |
| Roles | `name` | Admin Roles |
| Language Pack | `key` | Generate Code or Language Pack |
| Schedulers | `id` | Scheduler |
| App Env | `id` | App Env |
| Gateway routes | endpoint + method | Included automatically from plugin metadata or selected generated modules |

Business records, users, uploaded file bytes, and scheduler run logs are not part of a plugin archive. Product-managed skills and tools have optional `plugin` metadata, but the current Plugin Export schema does not include them.

## Authentication boundary

Always obtain the exact project URL and the account/password of a user whose roles include `ai` before development. Fetch the current password public key, encrypt the UTF-8 password with RSA-OAEP/SHA-256, and log in with:

```http
GET  /auth-password-public-key
POST /auth-login
GET  /auth-me
POST /auth-refresh
```

```json
{
  "account": "<role-ai-account>",
  "password_ciphertext": "<base64-rsa-oaep-sha256-ciphertext>",
  "password_encryption": "RSA-OAEP-256"
}
```

Verify `/auth-me` includes `ai`, then send the resulting in-memory access token on protected calls as `Authorization: Bearer <ai_access_token>`. Never persist or print the password, ciphertext, access token, or refresh token. Refresh once through `/auth-refresh` on access-token expiry; if refresh fails, reauthenticate with user authorization.

Current authorization boundary:

| Operation | Credential/role |
| --- | --- |
| Collection, Generate Code, language, access-control, scheduler, and App Env | AI JWT |
| `/_code/...` Code Registry | AI JWT |
| `/plugin-export/...`, including code | AI JWT |
| `/_gateway/...` configuration | AI JWT |
| `/admin-roles/...` custom-role management | AI JWT |

The project workflow deliberately requires an account whose roles include `ai`, even if another role could perform a subset of operations. Do not substitute an API Key, an `admin`-only account, or a `super`-only account. The AI JWT can maintain custom role definitions for the plugin, but assigning those roles to users through `/admin-users` remains an explicitly authorized administrator workflow.

## Standard-versus-advanced decision

Prefer MDC plus Generate Code when the requirement is expressible as:

- CRUD with string, number, date, datetime, boolean, option, reference, embedded, JSON, HTML, rich-text, or file-id fields.
- Required/unique/length/range/pattern metadata.
- Collection and field access rules.
- List columns and title/search behavior.
- Generated maintenance and history pages.
- `has_many` master-detail navigation using the system-owned `master_col_id` foreign key.

Use custom Code Registry modules for calculations, aggregation, external integrations, non-CRUD workflows, or specialized UI. Prefer companion modules so regenerating the collection does not erase custom behavior. If editing a generated module, regenerate first, then customize and save a new version; do not regenerate again without reapplying/merging that customization.

## Python runtime boundary

Before designing any custom Python module, read the bundled `develop-plugin-code/references/python-runtime-contract.md` completely. It is the source-independent contract for baseline third-party packages, standard-library imports, Code Registry blocked imports, `ApiController`, `mongo_access`, process-local `cache_map`, App Env, outbound integrations, and save/test behavior.

Use `ApiController` for conventional MongoDB CRUD/history and bounded `mongo_access` helpers only for aggregation or specialized behavior. Use `cache_map` only as a bounded best-effort optimization for non-sensitive, tenant-neutral, reproducible values; never rely on it for persistence, authorization, tenant/user state, deduplication, locking, counters, or cross-worker correctness. Do not hardcode MongoDB connection information, accept raw query/pipeline/collection syntax from a request, install packages, probe arbitrary imports, load deployment files, or bypass Code Registry import restrictions. Record every custom module's packages/platform helpers and validation evidence in the requirements document.

## Component and API map

All paths are relative to the confirmed API base.

| Capability | Read | Write/action |
| --- | --- | --- |
| Collections | `GET /collection-config`, `GET /collection-config/{key}` | `POST /collection-config`, replacement `PATCH /collection-config/{key}`, versioned `DELETE` |
| Generate Code | read collection first | `POST /collection-config/generate-code` |
| Code Registry | `GET /_code/modules...` | `POST/PATCH/DELETE /_code/modules...`, save/test versions |
| Language | `GET /language-pack` | `POST/PATCH /language-pack...` |
| Menu | `GET /access-control` | versioned replacement `PATCH /access-control` |
| Gateway | `GET /_gateway/config` | route upsert/delete/reload under `/_gateway` |
| Scheduler | `GET /scheduler...` | `POST /scheduler`, `PATCH /scheduler/{id}` |
| App Env | `GET /app-env...` | `POST/PATCH/DELETE /app-env...` |
| Roles | `GET /admin-roles...` | `POST/PATCH/DELETE /admin-roles...` |
| Package | candidates/preview | download/import preview/import apply under `/plugin-export` |

Generate Code request:

```json
{
  "key": "acme_feedback",
  "generate": {
    "data_management": true,
    "history": true
  }
}
```

It creates or updates four Code Registry modules from system templates: data API, maintenance page, history API, and history page. It creates only missing Gateway method entries and preserves existing routes. Generated data/history APIs require authentication; generated HTML delivery routes are public because the App Shell provides runtime authorization to the iframe.

Custom Python modules implement:

```python
def handle(*, method, query_params, resource_id, payload, header, uid, roles):
    ...
```

Custom HTML modules must request `lafenice:runtime-context` and consume `apiBaseUrl`, `accessToken`, `roles`, `locale`, `languagePack`, `themeMode`, and `theme`. Never read parent storage or put tokens in DOM, URLs, console output, localStorage, or sessionStorage.

## Naming and ownership

Choose one stable plugin value, for example `acme-feedback`, and reuse it exactly. Recommended resource names:

```text
collection: acme_feedback
modules:    acme_feedback_api, acme_feedback_page, acme_feedback_summary_api
endpoints:  acme-feedback-api, acme-feedback-page, acme-feedback-summary
language:   collection.acme_feedback.*, acmeFeedback.*
role:       acme-feedback-operator
scheduler:  acme-feedback-daily-summary
app env:    app=lafenice, name=acme_feedback.summary_window_days
```

Collection keys and module keys start with a lowercase letter, contain lowercase letters/numbers/underscores, and are at most 64 characters. Endpoints omit the leading slash. Keep the `plugin` field on collections, modules, Gateway routes, menu nodes, custom roles, Language Pack rows, schedulers, and App Env records.

## Verification and transfer boundary

Minimum checks:

1. Read back every written document and version.
2. Test saved Python versions before relying on their routes.
3. Exercise generated CRUD/history behavior with allowed and denied roles.
4. Confirm field-level read/write restrictions server-side.
5. Load HTML from the App Shell and test live auth refresh, localization, and theme changes.
6. Query Plugin Export candidates for every section, select explicit identities, and preview.
7. Explain every preview warning; include dependent code, language keys, menu routes, and Gateway routes.
8. Keep App Env redacted unless the user explicitly authorizes portable plain values and confirms they are not environment-specific secrets.

## Production browser and deliverable contract

Use the user-provided project URL as the App Shell entry point. For every plugin UI:

1. Verify the browser origin before entering the supplied credentials.
2. Sign in explicitly; do not rely on a pre-existing browser session.
3. Open the plugin through its actual menu route rather than loading only the raw HTML Gateway endpoint.
4. Test the primary workflow, validation and authorization errors, locale/Language Pack switching, theme behavior, and relevant viewport sizes.
5. Record concise evidence in the requirements document without screenshots containing credentials, tokens, or sensitive data.

Finish a build with two primary files sharing the same plugin/version stem:

```text
<plugin>-<version>.tar.gz
<plugin>-<version>-requirements.md
```

The tarball must be the unchanged `/plugin-export/download` response and must pass schema/checksum inspection. The requirements document must use the bundled template and contain the final deployed inventory, requirement ids, acceptance criteria, API/browser results, traceability, export counts/warnings, and archive SHA-256. Loose Code Registry source files are not a substitute for the export archive.
