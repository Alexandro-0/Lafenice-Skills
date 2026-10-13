# Account workflows

All paths are relative to the verified API base, usually `/<PROJECT_ROOT>/api`.
This contract requires core routes `admin-role-user-management`,
`tenant-user-options`, and `tenant-users` for delegation. Do not infer support
from the existence of an identically named custom role.

## 1. Public API registration

1. GET `/auth-password-public-key`, read `public_key_pem`.
2. Encrypt the UTF-8 password using RSA-OAEP with SHA-256; base64 the ciphertext.
3. POST `/auth-register`:

```json
{
  "account": "member@example.test",
  "password_ciphertext": "<encrypted-password>",
  "password_encryption": "RSA-OAEP-256",
  "display_name": "Member",
  "roles": ["user"]
}
```

`roles` may be omitted. Only `user` is allowed; custom roles and admin/ai/super
return 403. The response is 201 with `user`, `access_token`, `refresh_token`, and
expiry fields. Keep secrets in memory; do not log the response or store it in
plugin code. Do not replace an administrator's current session with a newly
created member's session. For administrator-created accounts use workflow 2/3.

Public registration does not assign tenant membership or accept arbitrary
profile fields. `display_name` is supported. To set custom fields, an authorized
manager subsequently uses the appropriate account API. Public registrations
start with `tenant_ids: []`; joining an existing tenant requires a global admin
workflow. Tenant managers create new accounts, not attach arbitrary existing ones.

Browser encryption helper (requires a secure browser context):

```js
async function encryptedPasswordFields(apiBase, password) {
  const response = await fetch(`${apiBase}/auth-password-public-key`);
  if (!response.ok) throw new Error('Unable to fetch password public key');
  const { public_key_pem } = await response.json();
  const body = public_key_pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('spki', bytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' }, key, new TextEncoder().encode(password)));
  return {
    password_ciphertext: btoa(String.fromCharCode(...encrypted)),
    password_encryption: 'RSA-OAEP-256'
  };
}
```

If encryption returns the specific `400 password_ciphertext is invalid.`, obtain
a fresh key and retry once. Handle 409 duplicate account separately. Do not send
plaintext passwords to registration, login or account maintenance APIs.

## 2. Plugin-owned user maintenance with custom fields

Use `/admin-users` only with an authorized admin/super runtime identity; use
`/tenant-users` for workflow 3. Never embed an administrator token or call an
internal Python handler with fabricated `roles` to make a request succeed.

Both support GET collection, GET `/{id}`, POST collection and PATCH `/{id}`.
Create example (merge in freshly encrypted password fields):

```json
{
  "account": "member@example.test",
  "password_ciphertext": "<encrypted-password>",
  "password_encryption": "RSA-OAEP-256",
  "roles": ["club-member"],
  "status": "active",
  "profile": {
    "display_name": "Member",
    "department": "Sales",
    "employee_no": "E001"
  }
}
```

Create returns `201 {"item": ...}`. PATCH custom fields:

```json
{"profile": {"department": "Support", "employee_no": "E002"}}
```

PATCH shallow-merges profile keys; omitted keys remain. If a plugin uses a nested
profile namespace, preserve its existing nested keys before replacing that
object. Clearing is an explicit null or empty value chosen by the field contract.
Validate required fields/types/lengths in the form; the core treats `profile` as
an object and does not implement plugin-specific uniqueness or schema validation.
When such server rules are required, use a protected companion API and/or a
tenant-required MDC keyed by `user_id`; core account privileges still apply.

UI workflow:

- Use App Shell's runtime/API-base and authenticated request mechanism described
  in `develop-plugin-code`; never extract tokens from browser storage.
- Tenant UI first GETs `/tenant-user-options` to display `tenant_id` and populate
  the exact `assignable_roles` choices. If 403, show grant/active-tenant guidance.
- Render account, display name, status, allowed-role choices and explicitly
  designed custom profile fields. Password required on create, optional on edit;
  never prefill or display a stored password hash. New-user role defaults must
  come from the allowed list (`user` is not necessarily included).
- Tenant list: GET `/tenant-users?search=alice&status=active&limit=25&offset=0`;
  response includes `items`, `has_more`, `tenant_id`. Search is literal substring.
  Allowed query keys are only search/status/limit/offset; limit is 1–100.
  Global `/admin-users` instead uses its existing query contract, e.g.
  `@contains.account`, limit, offset, sort and direction.
- On save, read back the user and refresh the current list. Use PATCH status
  `disabled` for deactivation; there is no tenant DELETE endpoint.
- Display unknown or disallowed existing roles read-only; do not silently strip
  them. Tenant endpoints intentionally hide accounts outside the grant.
- On tenant/session changes, cancel or ignore pending requests, clear forms and
  selections, then reload options and list. Prevent a draft from one tenant
  being submitted after switching to another. Use request generations/abort.
- Render profile values with `textContent`. Preserve existing Language Pack,
  menu and theme choices. A plugin menu can allow the selected custom role, but
  backend grants remain authoritative.

## 3. Optional delegation to any chosen custom App Shell role

The role is chosen for the particular deployment. There is no built-in
`tenant_admin` and no requirement that every plugin has a manager role.

### Super setup

1. Create/select a custom role using `/admin-roles`, e.g. `club-manager`, and a
   member role such as `club-member`. Preserve their plugin tags.
2. As **super**, GET `/admin-role-user-management` and PATCH
   `/admin-role-user-management/club-manager`:

```json
{"enabled": true, "assignable_roles": ["user", "club-member"]}
```

   The App Shell also offers this under Account Management → Tenant access → Tenant user
   management grants. Visibility uses `user.capabilities.tenantUserGrantEditor`,
   because displayed super roles may appear as admin; backend verifies real super.
   Ordinary admin and ai cannot configure grants. Nonempty allowed roles are
   mandatory for enabled grants. System roles cannot receive this delegation.
3. Use the global `/admin-users/{id}` API to assign the manager's custom role and
   authorized `tenant_ids`. This is an explicit provisioning action, separate
   from plugin code editing. Create tenants through `/admin-tenants` if requested.
4. Grant readback returns `items`; PATCH returns `item`. To revoke:
   `{"enabled": false, "assignable_roles": []}`. The next runtime request is denied,
   even if the manager's JWT has not expired.

### Manager login and use

1. Login using `/auth-login` with encrypted password fields. The account's stored
   custom role is used; do not include a claimed role in login to grant authority.
2. Review `/auth-me`. With one valid tenant, login may select it automatically.
   Otherwise choose one on the Account Profile `/account` page, or POST
   `/auth-active-tenant` with `{"refresh_token":"<in-memory>","tenant_id":"<assigned>"}`.
   Replace the session tokens with the returned tokens using normal App Shell
   session handling; do not build a competing tenant selector in plugin code.
3. GET `/tenant-user-options`, then create/list/edit through `/tenant-users`.
   For POST omit tenant fields entirely: the server assigns
   `tenant_ids: [validated active_tenant_id]` and records `created_by`.
4. Switch to tenant B and reload. A's accounts must no longer appear. The manager
   can belong to multiple tenants, but creates/manages one active tenant at a time.

### Enforced limits

- JWT only, active actor, live grant and active assigned tenant required.
- No client-controlled `tenant_id`, `tenant_ids` or `tenant_access`; payload
  attempts are 400. No global admin privilege is implied by this grant.
- Only single-tenant accounts in the current tenant whose roles are all within
  the manager's current assignable list are accessible. Self, multi-tenant,
  admin/super/ai and delegated-manager accounts are excluded; known IDs yield 404.
- No assigning admin, super, ai, or another currently delegated manager role.
  A role later promoted to manager is removed from existing effective allowlists.
- Global admin/super retains responsibility for shared accounts, tenant
  membership changes and manager provisioning. No automatic takeover or attachment
  of existing accounts; duplicate account creation returns 409.
- This delegation is tenant-wide, not a plugin ownership boundary. Plugin tags
  identify resources; they do not make global account profile fields private.
- Grants stay local to the deployment, outside Plugin Export/Import. A recreated
  role does not inherit a grant bound to its previous creation version.

## Acceptance matrix

Use real authorized test identities for deployed checks, not an AI JWT with
fabricated handler arguments. Cover public registration/login; profile create,
read and merge; manager A/B list/get/create/update; omitted/forged tenant fields;
role escalation; multi-tenant/privileged/self targets; absent/disabled/unassigned
tenant; immediate grant revocation; and another environment after plugin import.
Backend unit tests alone do not prove App Shell browser acceptance.
