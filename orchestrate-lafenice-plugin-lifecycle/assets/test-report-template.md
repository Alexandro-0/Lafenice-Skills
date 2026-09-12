# <Plugin name> test report

## Test context

| Field | Value |
| --- | --- |
| Plugin ID/version | `<id-and-version>` |
| Build/package/deployment | `<identity>` |
| Environment | `<local-or-exact-non-secret-environment>` |
| Test period | `<ISO dates>` |
| Result | `passed` / `failed` / `blocked` / `partial` |

Do not include passwords, tokens, secret settings, or sensitive business/test records.

## Coverage

| Test ID | Requirement IDs | Surface | Scenario | Expected | Actual/result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `TEST-001` | `REQ-001` | `API` / `web` / `integration` | `<scenario>` | `<expected>` | `<result>` | `<safe evidence>` |

Cover relevant success, validation, authentication, authorization, conflict, empty/loading/error, locale, theme, and responsive cases.

## Environment and role limitations

- `<unavailable account, unverified role, browser limitation, or none>`

## Defects and follow-up

| Defect ID | Severity | Requirement IDs | Finding | Status/follow-up |
| --- | --- | --- | --- | --- |
| `<id>` | `<severity>` | `<ids>` | `<finding>` | `<status>` |

## Test data cleanup

- `<removed fixtures, retained safe fixture with reason, or none>`

## Conclusion

State exactly which acceptance criteria are verified, failed, blocked, or unverified.
