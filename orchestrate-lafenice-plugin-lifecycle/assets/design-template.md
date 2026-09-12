# <Plugin name> design

## Design status

| Field | Value |
| --- | --- |
| Plugin ID | `<stable-plugin-id>` |
| Target version | `<version-or-tbd>` |
| Based on PRD | `<path-and-version>` |
| Status | `draft` / `ready-for-review` / `accepted` |

## Requirement mapping

| Requirement ID | Design sections/resources | Verification approach |
| --- | --- | --- |
| `REQ-001` | `<references>` | `<test>` |

## Roles and permission matrix

| Role | Collection/record | Field | API/operation | Page/menu | Denied behavior |
| --- | --- | --- | --- | --- | --- |
| `<role>` | `<access>` | `<access>` | `<access>` | `<visibility>` | `<denial>` |

## MDC data structures

### `<collection-key>`

Purpose and Plugin ownership: `<text>`

| Field | Type | Required/default | Validation | Read/write roles | UI behavior |
| --- | --- | --- | --- | --- | --- |
| `<key>` | `<type>` | `<rules>` | `<rules>` | `<roles>` | `<list/form behavior>` |

Relations, history, indexes, migration, generation, and custom-extension boundary:

- `<item>`

## API design

| Endpoint/method | Auth/roles | Request | Success response | Errors | Requirement IDs |
| --- | --- | --- | --- | --- | --- |
| `<endpoint>` | `<rules>` | `<contract>` | `<contract>` | `<status/shape>` | `REQ-001` |

## Non-API backend support

| Component | Trigger/schedule | Behavior | Retry/timeout/config | Requirement IDs |
| --- | --- | --- | --- | --- |
| `<job-or-integration>` | `<trigger>` | `<behavior>` | `<operational rules>` | `REQ-001` |

## Web design

### Navigation and runtime

| Menu category/key | Route | Visible roles | Theme/locales | API dependencies |
| --- | --- | --- | --- | --- |
| `<menu>` | `<route>` | `<roles>` | `<behavior>` | `<endpoints>` |

### Page: `<page name>`

- Purpose and primary actions: `<text>`
- Loading, empty, validation, error, and denied states: `<text>`
- Responsive and accessibility behavior: `<text>`
- Language Pack keys and fallbacks: `<keys>`
- Requirements: `<ids>`

## Verification design

| Test ID | Requirement IDs | Surface | Scenario | Expected result |
| --- | --- | --- | --- | --- |
| `TEST-001` | `REQ-001` | `API` / `web` / `integration` | `<scenario>` | `<result>` |

## Risks and unresolved decisions

| Item | Impact | Resolution/owner |
| --- | --- | --- |
| `<risk-or-question>` | `<impact>` | `<resolution>` |
