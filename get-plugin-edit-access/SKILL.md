---
name: get-plugin-edit-access
description: Establish and verify production access for LaFenice product-plugin development when no application source code or repository is available. Use before remote planning or implementation to require the deployed project URL and role-ai account/password, discover the API base, perform RSA-OAEP-256 login, verify the ai role, protect credentials and tokens, and preflight plugin-development endpoints.
---

# Get LaFenice Plugin Edit Access

## Apply the mandatory gate

Before starting remote plugin planning or development, require all of:

1. The exact project URL and environment name.
2. The account of a LaFenice user whose roles include the required `ai` role.
3. That account's password, supplied through secure input or the `LAFENICE_AI_PASSWORD` environment variable. Prefer `LAFENICE_AI_ACCOUNT` for the account value.

If any value is unavailable, ask the user and stop. Require the deployed application URL, not a source-repository or container-registry URL. Do not substitute localhost, deployment files, a previous environment, a guessed project root, an API Key, a default account, or an inherited browser session. Do not inventory remote state, design implementation details, generate artifacts, or call project APIs before this gate is satisfied.

The account may have other roles, but `/auth-me` must include `ai`. Do not accept `admin`-only or `super`-only credentials as equivalent.

## Protect credentials and tokens

- Never write the account password, encrypted password, access token, or refresh token into a deliverable, skill, plugin source, scheduler payload, App Env example, log, diff, URL, command-line argument, or final response.
- Prefer a secure secret mechanism or process-scoped environment variables. Never echo, partially print, or return a secret.
- Fetch the current public key and send only an RSA-OAEP/SHA-256 ciphertext to `/auth-login`; never send the plain password in a request body.
- Use HTTPS for non-local environments. Reject TLS errors rather than disabling certificate verification.
- Keep source and target credentials and tokens separate. Never reuse one environment's credentials on another environment without explicit authorization.
- Keep access and refresh tokens only in the active in-memory process. Clear them when work finishes.

## Preserve the exact origin and diagnose reachability by layer

Treat the user-provided scheme, hostname/IP, port, and project root as one exact origin. Do not replace an IP literal with `localhost`, a machine name, or another loopback spelling, even when they resolve to the same computer; TLS identity, cookies, origin policy, proxies, and browser isolation can differ.

Separate these checks instead of changing the URL:

1. Verify DNS/IP syntax and TCP reachability for the exact host and port.
2. Verify the TLS certificate chain and certificate identity for the exact host. Never bypass certificate verification.
3. Verify the project root and `/ping`/authentication API with the exact origin.
4. Verify UI reachability in the selected browser surface independently. An in-app browser can be network-isolated from host loopback even when Node, PowerShell, or the user's Chrome can reach it; that does not prove the hostname is wrong.

If one browser surface cannot reach a local exact origin, keep the same URL and use another supported browser surface that can reach it for UI acceptance, after following that browser skill. Continue API work only when the exact-origin API preflight succeeds, and record which UI surface was used.

When the user explicitly asks to repair a local TLS/reverse-proxy problem, first identify the process that actually owns the requested port before editing any Nginx or proxy configuration. A configured Nginx directory does not prove Nginx owns the listener; Docker, another proxy, or the application may own it. Trust/install only the public certificate needed by the client trust store. Do not copy, export, or expose the private key unless the user explicitly authorizes a server certificate change and the verified listener requires it. Re-run the exact-origin TCP, TLS, `/ping`, and browser checks after the repair.

## Normalize, login, and preflight

Run the dependency-free Node 18+ script `scripts/preflight_ai_login.mjs` with the user-provided production URL. Add `--probe` values for protected GET endpoints needed by the selected workflow, such as `collection-config`, `_code/modules`, `language-pack`, `access-control`, `scheduler`, `app-env`, `admin-roles`, or `plugin-export/candidates?section=code`.

```powershell
# LAFENICE_AI_ACCOUNT and LAFENICE_AI_PASSWORD are already populated by approved secure input.
node plugin_skills/get-plugin-edit-access/scripts/preflight_ai_login.mjs `
  --project-url 'https://example.test/lafenice' `
  --probe 'collection-config' `
  --probe '_code/modules'
```

The script confirms `/ping`, fetches `/auth-password-public-key`, encrypts the UTF-8 password with RSA-OAEP/SHA-256, logs in through `/auth-login`, verifies `/auth-me`, and probes requested endpoints with `Authorization: Bearer <access_token>`. It fails closed unless `roles` includes `ai`.

The script uses only Node built-ins and needs no LaFenice source tree, Python environment, or installed package. It never prints the password or tokens. It intentionally discards its tokens when the process exits; actual development should repeat the same login sequence inside one persistent in-memory process and retain tokens only there.

If login returns `400 password_ciphertext is invalid.`, fetch a fresh public key and retry encryption/login once. Do not retry invalid credentials repeatedly.

## Use and refresh the AI session

Send the access token on every protected backend call:

```http
Authorization: Bearer <ai_access_token>
```

On the first `401` caused by access-token expiry, call `POST /auth-refresh` once with the in-memory refresh token, replace both rotated tokens in memory, and retry the original request once. If refresh fails, stop and request a fresh authorized login. Do not silently fall back to API Keys or another user's session.

Use a browser session only for UI acceptance testing after API authentication succeeds. Open the exact user-provided deployment origin, verify it before entering credentials, and sign in explicitly; do not extract tokens from browser storage or treat an old signed-in tab as authorization for API mutation.

The verified `ai` session is sufficient for collection configuration and Generate Code, Code Registry source operations, Gateway configuration, access-control, Language Pack, scheduler, App Env, custom-role maintenance under `/admin-roles`, and Plugin Export/Import including code. User-account maintenance and assigning roles to users under `/admin-users` remain admin-only.

## Return a capability summary

Before handing off to another plugin skill, summarize without secrets:

- Confirmed environment and API base.
- Successful encrypted login and verified `ai` role.
- Protected probes and their status.
- Any operation blocked by service rules, especially admin-only user-account maintenance under `/admin-users`.
- Never include the account, password, ciphertext, access token, or refresh token.
