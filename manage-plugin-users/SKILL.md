---
name: manage-plugin-users
description: Register LaFenice users through the API, build plugin-owned user maintenance forms with custom profile fields, and configure optional tenant-scoped account management for a super-authorized custom App Shell role. Use for these account workflows; no custom role name is built in or mandatory.
---

# Manage Plugin Users

## Choose the requested workflow

Read [the API and UI contract](references/user-management.md) for the applicable workflow:

1. **Public registration:** use the public-key API and `POST /auth-register`. Only the ordinary `user` role is self-registerable. This does not assign a tenant or confer management privileges.
2. **Plugin user maintenance UI:** use existing account APIs, with custom fields under `profile`. An MDC business record is not a login account. Choose global `/admin-users` for an explicitly authorized admin/super workflow, or `/tenant-users` for an explicitly granted custom-role workflow.
3. **Optional tenant delegation:** super grants a chosen custom App Shell role access to `/tenant-users`, with an explicit assignable-role list. New accounts belong to the caller's validated active tenant. A name such as `club-manager` or `tenant_admin` is just an example, not a required system role.

## Access and scope

- Documentation and offline designs do not require credentials. For actual API operations, use the exact user-authorized project URL and the appropriate authenticated account; never guess defaults or reuse another environment's secrets.
- Plugin source/menu changes use `get-plugin-edit-access`, `develop-plugin-code`, and `configure-website-entry`. Their AI development session does not authorize account provisioning or delegation changes.
- Public registration needs no admin session. Grant configuration requires a real super JWT. Runtime tenant user management requires a real JWT for an account with a granted custom role and an assigned active tenant. These are separate identities; never embed super/AI credentials in plugin source or elevate handler arguments.
- Creating a role or exposing a menu does not confer account management permission. Existing `/admin-users` stays global admin/super-only. New tenant endpoints do not accept API keys.
- Before creating accounts or changing grants, establish that those changes are within the user's requested scope. Do not create test accounts or assign roles merely because a UI test needs them. Reuse authorized fixtures when available.

## Implement and verify

1. Discover the API base from the specified deployment. Check the applicable endpoint; missing tenant endpoints mean core must be upgraded, not that a plugin should bypass account security with direct database writes.
2. Record custom profile keys/types, the chosen manager and member roles, and whether management is global or tenant-scoped. `profile` is account-global data, not a private per-plugin secret store.
3. For delegation, have super create/select the custom role, configure the grant and assign the manager's role and `tenant_ids`. Keep deployment grants out of plugin exports. A destination super must configure them independently.
4. Build the plugin form/list using the reference's API contract and the existing App Shell authenticated runtime. Use Language Pack, the existing visual conventions, and Code Registry. Save/read back source through APIs; never edit generated directories.
5. Verify public registration, custom-field create/read/update, and actual manager login/create/list/update in tenants A and B. Test forged tenant assignments, disallowed roles, known foreign IDs, shared accounts, absent tenant, revoked grants, and public attempts to self-register a manager role.
6. Report code/API checks separately from deployed/browser acceptance. A successful AI code save is not proof of a custom role's runtime permissions. Missing authorized runtime accounts mean those tests remain unverified.
