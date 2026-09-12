# Requirement and plugin output examples

## Contents

1. Conventional MDC plugin
2. Advanced plugin extension
3. Transfer request
4. Required delivery pair
5. Concrete sample output pair

## Conventional MDC plugin

User requirement:

> Create a `customer-feedback` plugin. Signed-in users can submit a title, category, priority, description, and optional screenshot file id. Support staff can update status and assignee. Provide a management page and audit history in Traditional Chinese and English.

Expected plan:

- Plugin identity: `customer-feedback`.
- Collection: `customer_feedback`, with backend collection/field access separating submitter fields from support-only fields.
- Standard path: save MDC metadata, then Generate Code with both groups enabled.
- Generated modules: `customer_feedback_api`, `customer_feedback_page`, `customer_feedback_api_history`, `customer_feedback_page_history`.
- Generated endpoints: `customer-feedback-api`, `customer-feedback-page`, `customer-feedback-api-history`, `customer-feedback-page-history`.
- Language keys: `collection.customer_feedback`, column/option keys, and `.history` keys, all tagged `customer-feedback`.
- Menu route and custom `customer-feedback-support` role tagged with the same plugin.
- Export preview explicitly includes the collection, four modules, relevant menu nodes, role, and Language Pack rows.

Create and maintain `customer-feedback-support` with the verified AI JWT through `/admin-roles`. Assigning that role to user accounts is environment-specific and remains an administrator provisioning step through `/admin-users`.

No hand-written source is needed unless the requested behavior exceeds generated validation, access, and UI capabilities.

Expected delivery after implementation and testing:

```text
customer-feedback-1.2.0/
  customer-feedback-1.2.0.tar.gz
  customer-feedback-1.2.0-requirements.md
```

The Markdown file records these requirements as stable `REQ-*` ids, maps them to the deployed collection/modules/routes/menu/role/language resources, and records API plus browser acceptance evidence. The tarball is the unchanged `/plugin-export/download` response, not a folder of loose Python or HTML files.

## Advanced plugin extension

User requirement:

> Extend the feedback plugin with a dashboard that groups open feedback by priority, an endpoint for the dashboard, and a daily 09:00 Taipei-time refresh job. Keep everything in the same transferable plugin.

Expected output additions:

| Resource | Identity | Purpose |
| --- | --- | --- |
| Python module | `customer_feedback_summary_api` | Aggregate counts and accept `SCHEDULE` refresh calls |
| HTML module | `customer_feedback_dashboard_page` | Runtime-context dashboard consuming the summary API |
| Gateway | `GET customer-feedback-summary` | Authenticated route with explicit role checks in the handler |
| Menu | `customerFeedbackDashboard` | App Shell route for the dashboard |
| Scheduler | `customer-feedback-daily-summary` | Cron `0 9 * * *`, timezone `Asia/Taipei` |
| App Env | `customer_feedback.summary_window_days` | Non-secret window setting; secret values remain environment-local |
| Language | `customerFeedback.dashboard.*` | `name` and `enUS` copy |

All rows use `plugin: "customer-feedback"`. The summary module uses the declared platform `mongo_access.aggregate_documents` helper with a fixed collection, code-constructed pipeline, explicit `$limit`, and server-side role checks; it does not accept raw MongoDB syntax from the request. Record this dependency and the saved version's `validation.blocked_imports` in the requirements document. Prefer companion modules over editing generated CRUD modules. Test the Python version, call the routed API with the in-memory AI access token, then open the user's exact project URL in a browser, sign in explicitly, and load the HTML from the App Shell menu before exporting the expanded explicit selection.

## Transfer request

User requirement:

> Export version 1.2.0 and import it into staging without replacing staging-specific settings.

Expected execution:

1. Require source and target project URLs plus separate role: `ai` account/password credentials for each environment.
2. Perform encrypted login in each environment, verify `/auth-me` includes `ai`, and keep the two JWT sessions separate in memory.
3. Load candidates, select identities explicitly, use `app_env.value_mode: "redacted"`, and preview.
4. Download only after counts and warnings match expectations.
5. Inspect schema/checksums locally.
6. Preview on staging and apply with `overwrite=false`.
7. Report conflicts/skips and never overwrite staging settings implicitly.
8. Smoke-test imported protected runtime routes with the staging AI access token.
9. If the plugin has UI, open the exact staging URL, sign in explicitly, and test it from the App Shell; do not use an inherited browser session as API authorization.

## Required delivery pair

Every completed build returns exactly two primary artifacts in one versioned delivery folder:

1. `<plugin>-<version>.tar.gz`: the unchanged bytes returned by `/plugin-export/download`, with schema/checksums verified and SHA-256 recorded.
2. `<plugin>-<version>-requirements.md`: a version-matched delivery record created from `assets/plugin-requirements-template.md` containing scope, requirements, deployed inventory, acceptance tests, traceability, export counts/warnings, archive hash, assumptions, and limitations.

Never include passwords, password ciphertext, JWTs, App Env secret values, or sensitive screenshots in either artifact.

## Concrete sample output pair

The following two assets form one compact example delivery:

- `assets/lafenice-status-example-1.0.0.tar.gz`
- `assets/lafenice-status-example-1.0.0-requirements.md`

The archive contains two Code Registry modules, Gateway routes, a menu entry, a custom role, Language Pack rows, one scheduler, and one non-secret App Env value. It intentionally contains no business records or users. The companion Markdown shows how to describe requirements, trace every deployed resource, disclose that no live deployment/browser was available for the illustrative example, and record the archive SHA-256.

The bundled `lfx_example_status_page` HTML is a compact custom-page example, not a replacement for the generated MDC page. Its runtime-context handling, theme token mapping, loading/error states, safe DOM rendering, scrollable table wrapper, `table { width:max-content; }`, and non-truncated `updated_at_format` column follow `LaFeniceBackend/code_templates/metadata_collection_page.html`. Use that backend template as the baseline for collection pages and adapt only the business-specific fields and actions.

Inspect the archive with the `transfer-lafenice-plugin` archive inspection script and compare the result with its companion Markdown. Treat the pair as an archive-shape, ownership, and delivery-document example, not as a production-ready monitoring solution.
