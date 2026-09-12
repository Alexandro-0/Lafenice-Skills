---
name: build-lafenice-plugin
description: Build, upload, test, and export a LaFenice product plugin against a deployed production system when no backend or frontend source repository is available. Use when Codex must turn requirements into one API-managed plugin containing MDC collections, generated CRUD/history code, custom Code Registry Python or HTML, Gateway routes, menu entries, roles, Language Pack entries, schedulers, or App Env settings. Requires the deployed project URL and role-ai account/password, and must deliver an untouched plugin export archive plus a requirements document.
---

# Build a Production LaFenice Plugin

## Use the production-only operating model

Assume the agent has only this skill bundle, the user's requirements, network access to the deployed system, and optional browser control. Do not require or inspect application source code, a Git repository, Docker image contents, container volumes, source maps, build artifacts, database access, or deployment configuration.

Treat the API contracts and examples bundled with these skills as the development specification. Perform every inventory, create, edit, Generate Code, test, and export operation through the deployed LaFenice APIs. If the deployed API rejects a documented endpoint or response shape, stop that operation, record the compatibility mismatch in the requirements document, and do not guess an undocumented storage or filesystem workaround.

## Enforce the connection gate

Do not inspect remote state, create the requirements artifact, generate code, edit code, or mutate the deployment until all values are available:

1. The exact deployed project URL for the intended environment.
2. A LaFenice account whose roles include `ai`.
3. That account's password through approved secure input or process-scoped `LAFENICE_AI_ACCOUNT` and `LAFENICE_AI_PASSWORD` environment variables.

If any value is missing, ask the user and stop. Do not substitute localhost, a repository URL, an API Key, default credentials, another environment, or an inherited browser session. Keep credentials and tokens out of files, URLs, logs, screenshots, commands, code, archives, and final responses.

Invoke `get-plugin-edit-access` to discover the API base, perform RSA-OAEP-256 login, keep the JWT session in memory, and verify `/auth-me` includes `ai`. Use that AI JWT for all plugin resources, including custom roles. `/admin-users` remains admin-only and is outside the normal plugin build workflow.

## Load the bundled contract and templates

- Read [references/plugin-contract.md](references/plugin-contract.md) before planning or changing remote resources. It is the source-independent production contract.
- Read [references/examples.md](references/examples.md) when translating requirements or choosing MDC versus custom code.
- If any custom Python module is required, read [../develop-plugin-code/references/python-runtime-contract.md](../develop-plugin-code/references/python-runtime-contract.md) completely before designing imports, MongoDB access, or integrations.
- Copy [assets/plugin-requirements-template.md](assets/plugin-requirements-template.md) for the required requirements deliverable.
- Use `transfer-lafenice-plugin` to preview, download, and inspect the final archive.
- Load only the specialist skills needed by the requirement.

## Produce exactly two primary deliverables

Create a versioned output directory and return both files:

```text
<plugin>-<version>/
  <plugin>-<version>.tar.gz
  <plugin>-<version>-requirements.md
```

The archive must be the unchanged response from `/plugin-export/download`, not a reconstructed directory or hand-authored tarball. The requirements document must describe the requested and actually deployed plugin, resource identities, permissions, acceptance criteria, verification evidence, export selection/counts/warnings, archive SHA-256, assumptions, and unresolved items. Never include credentials, tokens, secret App Env values, or sensitive business records.

## Build workflow

1. Authenticate to the deployed project and record only the confirmed deployment URL, API base, API version, and verified `ai` capability.
2. Copy the requirements template. Establish the stable plugin name, semantic version, purpose, actors/roles, functional requirements, data model, pages, APIs, localization, schedules, settings, exclusions, and acceptance tests. Assign requirement ids such as `REQ-001` and test ids such as `TEST-001`.
3. Inventory only the named plugin and directly referenced resources through APIs. Read current versions before replacement updates; do not inventory containers, source code, unrelated plugins, users, or business data.
4. Classify each requirement:
   - Use `manage-metadata-driven-collection` plus Generate Code for conventional CRUD, history, validation, reference, file-id, and master-detail behavior.
   - Use `develop-plugin-code` for calculations, integrations, workflows, or UX not expressible by metadata.
   - Use `configure-language-settings`, `configure-website-entry`, `manage-plugin-schedulers`, and `manage-plugin-settings` for supporting resources.
5. Apply one stable `plugin` value to every owned collection, module, Gateway method, menu node, role, Language Pack row, scheduler, and App Env record. Use namespaced collision-resistant identities.
6. Build the conventional baseline first: save collection metadata, invoke Generate Code once for the selected data-management/history groups, and read back generated modules, endpoints, menu entries, and language rows. Treat this as the baseline boundary; later Generate Code can replace custom latest versions.
7. Add advanced behavior as companion Code Registry modules or, only when required, complete new versions of generated modules. For Python, use only the bundled baseline packages and preferred platform helpers, honor the deployed version's `validation.blocked_imports`, and record runtime dependencies in the requirements document. Read the latest remote version before editing, use unique wrapper markers/symbols when extending a handler, test Python versions, and verify materialized Gateway routes. Never install packages or edit generated deployment files directly. If metadata must be regenerated after this step, preserve and reapply every custom diff before continuing.
8. Publish and bind all HTML Code Registry versions before the final Access Control write. Then re-read the latest menu, reconcile each `gateway.menu_key` with the intended leaf key, remove only plugin-owned automatic duplicates under `codePages`, and preserve unrelated/protected nodes.
9. Read back every write and exercise success, validation, authentication, authorization, conflict behavior, and each actual routed endpoint. Do not treat a successful write, Code Registry `validation.ok`, or version-test result as sufficient verification. Clean up temporary business test records when safe and record any intentionally retained fixtures.
10. If the plugin has a UI, perform browser acceptance testing against the exact user-provided project URL. Sign in explicitly, verify the origin before entering credentials, open the plugin from the App Shell menu, and test runtime auth, primary flows, master-detail scoped/direct behavior, locale/Language Pack, theme, error states, and responsive usability. Never read browser storage for tokens. If a requirement needs a non-AI role, request an authorized test account instead of assigning users through `/admin-users`; if unavailable, mark that role test unverified rather than simulating it with the AI JWT.
11. Query export candidates, explicitly select all owned identities, including the menu category and each leaf route, and preview. Resolve every unexpected warning. Accept an exact known warning set only after `transfer-lafenice-plugin` evidence checks pass and the reason is recorded; then download the archive and inspect its schema, checksums, counts, code versions, Gateway routes, and warning set without modifying it.
12. Finalize the requirements document with a requirement-to-resource-to-test traceability table, actual test results, browser evidence summary, role-account limitations, test-data cleanup, export counts/accepted warnings, archive filename and SHA-256, and any accepted limitations.

## Definition of done

Report completion only when:

- The deployed plugin inventory satisfies every accepted requirement or the document clearly marks an unresolved blocker.
- Generated and custom modules are versioned, routed, and tested through production APIs.
- Backend authorization is verified; UI hiding alone is never treated as security.
- Role-matrix claims are backed by actual authorized accounts; unavailable non-AI roles are clearly marked unverified.
- Every UI route is tested in the deployed App Shell when browser control is available. If browser control is unavailable, mark UI acceptance as unverified and do not claim full UI completion.
- Export preview counts match the explicit selection and no warning is unexplained.
- The downloaded archive passes local schema/checksum inspection and contains the expected latest code versions.
- Both primary deliverables exist, are version-matched, contain no secrets, and are returned to the user.

Do not return loose Python/HTML files as the plugin deliverable. They are drafts uploaded into Code Registry; the authoritative plugin deliverable is the production export archive.
