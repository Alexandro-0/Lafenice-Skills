---
name: transfer-lafenice-plugin
description: Preview, export, inspect, import, and verify LaFenice product plugin tar.gz packages against deployed production systems with no source-code access. Use when Codex must move plugin-tagged collections, Code Registry modules, menu routes, custom roles, Language Pack entries, schedulers, App Env settings, and Gateway routes between LaFenice environments, resolve package warnings or conflicts, inspect a plugin archive, or record the final archive in a requirements document. Requires each exact project URL and separate role-ai account/password credentials before remote transfer work begins.
---

# Transfer a LaFenice Plugin

## Enforce the connection gate

Require the exact project URL and separate role: `ai` account/password credentials for every source or target environment before inspecting remote state or preparing a transfer. If any value is absent, ask and stop. Never infer localhost, use an API Key, or reuse credentials across environments without explicit authorization.

Run `get-plugin-edit-access` for each environment. Encrypt each password with that environment's current RSA-OAEP-256 public key, log in, verify `/auth-me` includes `ai`, and retain each access/refresh token pair only in its own in-memory session. Use the resulting AI JWT for candidates, preview, download, import, Code Registry recovery, and post-transfer protected runtime verification.

Do not fall back to API Keys, default accounts, deployment files, source repositories, container access, or an inherited browser session. Browser control may be used only for explicit post-transfer UI acceptance testing against the user-provided URL; it is not a substitute for API authentication.

## Read the package contract

Read [references/package-contract.md](references/package-contract.md) before creating or applying an archive. Use `scripts/inspect_plugin_archive.py` to inspect a local archive without extracting it into the workspace.

## Export workflow

1. Confirm `plugin.name`, semantic/version string, and `source_plugin` identity.
2. Query candidates separately for `collections`, `code`, `menu`, `roles`, `language_pack`, `schedulers`, and `app_env`.
3. Select explicit keys/ids. Do not assume the package name filters candidates. For menu export, explicitly select the plugin category and every owned leaf route key, then compare preview menu count with the expected flattened node count; selecting only the parent is not sufficient evidence.
4. Default App Env to `value_mode: "redacted"`; include plain values only with explicit authorization and after confirming portability.
5. Call `/plugin-export/preview`. Compare counts with the selection and classify every dependency warning. Any unexpected warning blocks download. An exact, understood warning set may be explicitly accepted only after the evidence checks in the package contract pass and the acceptance reason is recorded in the requirements document; preview warnings are not automatically harmless or automatically fatal.
6. Call `/plugin-export/download` only after preview is acceptable and save the response bytes unchanged as `<plugin>-<version>.tar.gz`.
7. Inspect the downloaded archive, verify schema/checksums, compute SHA-256, and report the archive filename, hash, counts, and both accepted/unexpected warnings without exposing code or secrets unnecessarily. The inspection result must match the accepted preview warning set; any new warning reopens the review. When called from `build-lafenice-plugin`, write these facts into the version-matched requirements document.

## Import workflow

1. Inspect the local archive before upload.
2. Call `/plugin-export/import/preview` with multipart field `file`.
3. Review conflicts and warnings. Default to `overwrite=false`.
4. Obtain explicit user authorization before using `overwrite=true`; it can replace code, configuration, routes, menu nodes, roles, language, schedules, and App Env values.
5. Call `/plugin-export/import/apply` and record created/updated/skipped counts.
6. Read back every imported Code Registry module and latest version. Some deployed versions may create module metadata but return `Code module '<key>' has no version payload.` If detected, do not claim success. With the user's existing import authorization and target AI JWT, restore each original version from the untouched archive's `payload/code_versions.json` through Code Registry, or stop and report a deployment compatibility issue.
7. Smoke-test protected runtime Gateway endpoints using the target AI access token.
8. If the plugin has UI, sign in explicitly through a browser at the exact target URL and verify its App Shell menu, page, locale/theme behavior, and primary flow. Never reuse an old signed-in tab as transfer authorization or extract tokens from browser storage.
9. Report environment-specific follow-up work, especially redacted App Env values, user-role assignments, uploaded files, and business data that are intentionally absent.

## Safety rules

- Never hand-edit an archive intended for import unless the user explicitly asks for archive repair and accepts that it is no longer an authentic export.
- Reject unsafe paths, unsupported schema versions, invalid JSON, and checksum mismatches.
- Preserve the original archive when repairing or comparing.
- Do not claim a transfer is complete when conflicts were skipped or required App Env values remain redacted.
- Do not treat a successful import summary as proof that code source was restored; verify `latest_version_id` and retrieve the latest version for each module.
- Do not edit archive metadata to suppress a preview or inspection warning. Preserve and explain a verified false positive instead.
