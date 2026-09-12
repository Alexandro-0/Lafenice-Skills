# <Plugin display name> Requirements and Delivery Record

## Delivery metadata

| Field | Value |
| --- | --- |
| Plugin id | `<stable-plugin-id>` |
| Version | `<semantic-version>` |
| Status | Draft / Verified / Blocked |
| Deployment URL | `<user-provided-url>` |
| Confirmed API base | `<discovered-api-base>` |
| API version | `<ping-version>` |
| Export archive | `<plugin>-<version>.tar.gz` |
| Archive SHA-256 | `<sha256>` |

Do not include accounts, passwords, JWTs, secret App Env values, or sensitive business records in this document.

## Purpose

Describe the business problem, intended outcome, and success criteria.

## Scope

### Included

- <included capability>

### Excluded

- <explicit non-goal>

## Actors and roles

| Actor/role | Capabilities | Provisioning note |
| --- | --- | --- |
| `<role>` | <allowed behavior> | Role definition is in the plugin; user assignment is environment-specific. |

## Functional requirements

| ID | Priority | Requirement | Acceptance criterion | Final status |
| --- | --- | --- | --- | --- |
| REQ-001 | Must | <behavior> | <observable result> | Planned / Passed / Blocked |

## Data model and authorization

| Collection | Field/relation | Type | Validation | Read roles | Write roles |
| --- | --- | --- | --- | --- | --- |
| `<collection>` | `<field>` | `<type>` | <rules> | <roles> | <roles> |

Document collection-level and field-level access. UI visibility is not an authorization control.

## APIs, pages, and runtime behavior

| Resource | Identity/path | Methods | Authentication/roles | Requirement ids |
| --- | --- | --- | --- | --- |
| API | `<endpoint>` | GET | JWT + <roles> | REQ-001 |
| Page | `<menu/path>` | GET | App Shell runtime context | REQ-001 |

## Python runtime dependencies

Complete this section for every custom Python module. Use `None; generated/MDC code only` when no custom Python is present.

| Module | Package or platform helper | Baseline version/interface | Purpose | Validation evidence |
| --- | --- | --- | --- | --- |
| `<module_key>` | `services.api_controller.ApiController` | Platform helper | MongoDB CRUD/history | Saved version validation + TEST-001 |

Record the deployed `item.validation.blocked_imports` value or the documented baseline when the deployment does not expose it. Never include package paths, deployment configuration, database URIs, or secret values.

## Localization, schedules, and settings

| Type | Identity | Required behavior | Portability/security note |
| --- | --- | --- | --- |
| Language Pack | `<key>` | <locales/text> | Export with plugin metadata. |
| Scheduler | `<name>` | <schedule/handler> | No credentials in payload. |
| App Env | `<app/name>` | <setting> | Redact environment-specific values. |

## Deployed plugin resource inventory

| Section | Identity | Version/status | Requirement ids |
| --- | --- | --- | --- |
| Collection | `<key>` | `<version>` | REQ-001 |
| Code | `<module_key>` | `<version-id>` | REQ-001 |
| Gateway | `<method> <endpoint>` | Active | REQ-001 |
| Menu | `<key/path>` | Enabled | REQ-001 |
| Role | `<name>` | Custom | REQ-001 |

## Acceptance tests and evidence

| ID | Requirement ids | Surface | Test | Expected | Actual/result |
| --- | --- | --- | --- | --- | --- |
| TEST-001 | REQ-001 | API | <request/scenario> | <expected> | Passed / Failed / Blocked: <evidence> |
| TEST-002 | REQ-001 | Browser | <App Shell flow> | <expected> | Passed / Unverified: <evidence> |

Record the deployed URL/path, HTTP status, response shape, or concise browser observation. Do not embed tokens or sensitive screenshots.

## Traceability

| Requirement | Deployed resources | Test ids | Status |
| --- | --- | --- | --- |
| REQ-001 | `<resource identities>` | TEST-001, TEST-002 | Passed / Blocked |

## Export record

| Section | Selected identities | Preview count | Archive count |
| --- | --- | --- | --- |
| Collections | <keys> | <n> | <n> |
| Code | <module keys> | <n> | <n> |
| Menu | <node keys> | <n> | <n> |
| Roles | <names> | <n> | <n> |
| Language Pack | <keys> | <n> | <n> |
| Schedulers | <ids/names> | <n> | <n> |
| App Env | <ids> | <n> | <n> |
| Gateway routes | <methods/endpoints> | <n> | <n> |

Preview/import warnings and resolution:

- <warning or `None`>

## Assumptions, limitations, and follow-up

- <assumption or accepted limitation>
- User-role assignments, business data, uploaded files, and redacted environment values are not included in the plugin archive.
