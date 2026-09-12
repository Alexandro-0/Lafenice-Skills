# Plugin package contract

## Export request

```json
{
  "plugin": {
    "name": "customer-feedback",
    "version": "1.2.0",
    "source_plugin": "customer-feedback"
  },
  "include": {
    "collections": {"enabled": true, "keys": ["customer_feedback"]},
    "code": {"enabled": true, "module_keys": ["customer_feedback_api"]},
    "menu": {"enabled": true, "node_keys": ["customerFeedbackCategory", "customerFeedback"]},
    "roles": {"enabled": true, "names": ["customer-feedback-support"]},
    "language_pack": {"enabled": true, "keys": ["collection.customer_feedback"]},
    "schedulers": {"enabled": true, "ids": []},
    "app_env": {"enabled": true, "ids": [], "value_mode": "redacted"}
  }
}
```

Candidate endpoint:

```http
GET /plugin-export/candidates?section=code&plugin=customer-feedback
```

The `plugin.name` is package identity only. It does not automatically filter candidates. `source_plugin` is used only when a section omits explicit keys/ids. Prefer explicit selection. For menu export, include the owned category key and each owned leaf route key explicitly, and compare the preview count with the flattened selected subtree rather than assuming the parent implies its children.

## Archive layout

```text
manifest.json
payload/collections.json
payload/code_modules.json
payload/code_versions.json
payload/menu_routes.json
payload/roles.json
payload/language_pack.json
payload/schedulers.json
payload/app_env.json
payload/gateway_routes.json
code/{module_key}/latest.py
code/{module_key}/latest.html
README.md
checksums.json
```

`manifest.schema_version` is currently `1`. `checksums.json` maps each included file path except itself to the SHA-256 of its UTF-8 bytes.

## Export boundary

Included:

- Collection metadata, not business rows.
- Latest code source snapshots and module metadata.
- Selected menu subtree, custom roles, Language Pack rows, scheduler definitions, and App Env metadata.
- Gateway methods whose `plugin` matches `source_plugin` or whose handler points to a selected generated module.

Excluded:

- Business records, users and assignments, uploaded file bytes, scheduler run history, execution logs, and runtime locks/state.
- Product-managed skills and tools, despite their optional plugin metadata.

App Env values are redacted by default. Redacted entries import as skipped because no value is available. Plain values are encrypted on import.

## Warning semantics

Preview warnings do not technically block download, but the workflow must block on any unexplained warning. Resolve or explicitly accept warnings for:

- A selected collection referencing unselected API/page modules.
- A selected collection referencing unselected Language Pack keys.
- An HTML module lacking a selected menu route.
- A selected code module lacking a latest saved version.

An exact warning set may be accepted as a deployed-version false positive only when all of the following evidence is true:

1. Preview counts match the explicit collection/code/menu/role/language/scheduler/App Env selections.
2. The selected menu keys include the plugin category and every owned leaf; the menu count matches the expected flattened nodes.
3. Every HTML module has a saved latest version, its `gateway.menu_key` exactly matches the intended leaf key, and the corresponding HTML Gateway method is materialized.
4. The final Access Control tree contains the intended category/routes without plugin-owned duplicates, and every UI route opens successfully in the exact deployed App Shell.
5. The warning text and affected module set are recorded verbatim enough to compare without exposing source/secrets, together with the acceptance reason, in the requirements document.

For example, some deployed previews may still emit `HTML code module ... has no selected menu route` after explicit category/leaf selection and exact `gateway.menu_key` binding. Treat this as acceptable only if the evidence above passes for every named module. A different module, count mismatch, missing route, missing version, or any new warning remains blocking. The local archive inspector may reproduce the accepted manifest warnings; compare sets and report them rather than editing the archive to hide them.

## Import behavior

- Existing resources are skipped by default.
- `overwrite=true` updates conflicts.
- Intended behavior is to activate imported code versions through Code Registry, materializing Python/HTML handlers.
- Gateway routes merge into active config and publish a reload event.
- Menu routes merge into the configurable Access Control tree.
- System roles are skipped; custom roles are recreated.
- Schedulers receive fresh owner, next-run, lock, and run-state fields.
- Redacted App Env entries are skipped.

### Deployed-version compatibility caveat

Some deployed versions may create Code Registry module metadata without restoring executable/page source and report `Code module '<key>' has no version payload.` Treat this as an observable API compatibility problem; do not require backend source or container access to diagnose it.

Always verify every module's latest version after import. On an affected target, either:

1. Stop, record the target URL/API version and non-sensitive warning in the requirements document, and ask the user to upgrade or repair the deployment before re-preview/re-apply; or
2. If the user already authorized the code import and the target role: `ai` JWT is available, read the untouched `payload/code_versions.json` from the original archive and save each entry through `POST /_code/modules/{module_key}/versions`, then verify the published routes.

Never hand-edit the archive or silently report a partial code import as complete.

Do not rely on preview alone to detect every history dependency. When history generation is enabled, explicitly include and verify `api`, `page`, `history_api`, and `history_page` modules and endpoints.

Preview endpoints do not write:

```http
POST /plugin-export/preview
POST /plugin-export/import/preview
```

Apply/download endpoints:

```http
POST /plugin-export/download
POST /plugin-export/import/apply
```
