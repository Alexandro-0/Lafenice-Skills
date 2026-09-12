---
name: manage-plugin-settings
description: Manage exportable supporting settings for a LaFenice product plugin, specifically custom role definitions and encrypted App Env records. Use when Codex must create or update plugin-tagged roles, configuration values, feature flags, or environment settings and preserve safe export/import behavior. Require the exact project URL and role-ai account/password before development; AI sessions may maintain roles but not user assignments.
---

# Manage LaFenice Plugin Settings

## Enforce the connection gate

Before planning or changing settings, use `get-plugin-edit-access` to verify the exact project URL and role: `ai` account/password supplied by the user, perform RSA-OAEP-256 encrypted login, and confirm `/auth-me` includes `ai`. If any value is missing, ask and stop. Assume no repository, source code, container, deployment files, or database access. Do not use localhost, API Keys, default credentials, inherited browser sessions, or credentials found outside the user's explicit input.

Use the in-memory AI JWT for App Env, Plugin Export, and `/admin-roles` operations. The verified AI session may list, create, edit, and delete custom role definitions. `/admin-users` remains admin-only, so do not assign roles to users or otherwise modify accounts unless the user explicitly authorizes a separate admin workflow.

## Manage custom roles

Role definitions are plugin resources; user assignments are environment-specific and are not exported.

Run the endpoints below with the verified AI JWT. Keep role-definition maintenance separate from user-role assignment, which still requires `admin` through `/admin-users`.

```http
GET    /admin-roles
POST   /admin-roles
PATCH  /admin-roles/{role_name}
DELETE /admin-roles/{role_name}
```

Create example:

```json
{
  "name": "customer-feedback-support",
  "label": "Customer Feedback Support",
  "description": "May triage customer feedback.",
  "plugin": "customer-feedback"
}
```

Rules:

- Normalize the name to lowercase; start with a letter; use only letters, numbers, underscore, or hyphen; maximum 64 characters.
- Apply `plugin` only to custom roles. Never tag `admin`, `ai`, `user`, or another system role.
- Do not assign the role to users unless the user explicitly requests account changes; assignments are not transferred with the plugin.
- Do not delete a role still assigned to users.
- Read back the role and verify `system: false` and the exact plugin identity.

## Manage App Env

App Env stores encrypted values under a unique `app + name` pair and allows plugin metadata:

```http
GET    /app-env
POST   /app-env
PATCH  /app-env/{id}
DELETE /app-env/{id}
```

Non-secret setting example:

```json
{
  "app": "lafenice",
  "name": "customer_feedback.summary_window_days",
  "value": "30",
  "plugin": "customer-feedback",
  "description": "Summary lookback window."
}
```

Rules:

- Treat every `value` as secret material even when it is a feature flag. List/get responses contain decrypted values; never print or persist them during inventory.
- Do not read a value merely to prove the record exists. Request/filter metadata narrowly and redact output.
- Keep environment-specific credentials out of plugin source, scheduler payloads, and example archives.
- Prefer stable namespaced keys. Preserve the existing `app` unless the user explicitly changes it.
- Read by `app + name`, then update by immutable document `id` when possible.
- Add the same stable `plugin` value used by the rest of the package.

When exporting, use `value_mode: "redacted"` by default. Redacted App Env rows are intentionally skipped on import and must be configured on the target. Use `plain` only with explicit authorization and only for values confirmed safe and portable.

## Verify and hand off

1. Read back custom roles without changing user assignments.
2. Confirm App Env identity and metadata without exposing its value.
3. Confirm Plugin Export candidates list the expected role names and App Env ids under the plugin.
4. Report target-environment setup requirements for redacted values.
