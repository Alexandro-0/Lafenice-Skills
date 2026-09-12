# <Plugin name> lifecycle state

## Identity

| Field | Value |
| --- | --- |
| Plugin ID | `<stable-plugin-id>` |
| Target version | `<semantic-version-or-tbd>` |
| Execution mode | `local-source` / `deployed-api` / `documentation-only` |
| Current request | `<requested outcome>` |
| Requested checkpoint | `<phase or artifact where Codex must stop>` |
| Last updated | `<ISO date>` |

## Phase status

| Phase | Status | Authoritative artifact | Notes |
| --- | --- | --- | --- |
| PRD | `not-started` | `<path-or-none>` | |
| Feasibility | `not-started` | `<path-or-none>` | |
| Design | `not-started` | `<path-or-none>` | |
| Backend development | `not-started` | `<path-or-none>` | |
| Frontend development | `not-started` | `<path-or-none>` | |
| Integration | `not-started` | `<path-or-none>` | |
| Documentation | `not-started` | `<path-or-none>` | |

Allowed status values: `not-started`, `in-progress`, `ready-for-review`, `accepted`, `blocked`, `not-applicable`.

## Accepted decisions

| ID/date | Decision | Affected requirements/artifacts |
| --- | --- | --- |
| `<id>` | `<decision>` | `<references>` |

## Open questions and blockers

| Item | Owner/input needed | Impact |
| --- | --- | --- |
| `<question-or-blocker>` | `<user/environment/team>` | `<blocked work>` |

## Verification evidence

| Requirement/change | Check | Result | Evidence location |
| --- | --- | --- | --- |
| `<id>` | `<test-or-review>` | `passed` / `failed` / `blocked` / `unverified` | `<path-or-summary>` |

## Next permitted action

`<one concrete next step; state required review or authorization>`
