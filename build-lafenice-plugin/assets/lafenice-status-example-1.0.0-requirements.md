# LaFenice Status Example Requirements and Delivery Record

## Delivery metadata

| Field | Value |
| --- | --- |
| Plugin id | `lafenice-status-example` |
| Version | `1.0.0` |
| Status | Output example |
| Deployment URL | `https://production.example/lafenice` |
| Confirmed API base | `https://production.example/lafenice/api` |
| API version | Example only |
| Export archive | `lafenice-status-example-1.0.0.tar.gz` |
| Archive SHA-256 | `f9efe691c899f55bb332bc609cd4a630e912e0fca2b3f629e38cf3b5e4be0b50` |

This document contains no credentials, tokens, or secret settings. URLs and verification results are illustrative because the bundled archive is a format example.

## Purpose and scope

Provide an authenticated system-status endpoint, an App Shell dashboard, and a five-minute scheduled probe. Include Traditional Chinese and English labels, a portable non-secret refresh interval, and a custom viewer role. Business records, user assignments, and notification delivery are out of scope.

## Actors and roles

| Actor/role | Capabilities | Provisioning note |
| --- | --- | --- |
| `lfx-example-status-viewer` | Open the dashboard and view status. | Role definition is exported; user assignment is environment-specific. |
| `admin` | View and operate the example. | System role is not created by this plugin. |

## Functional requirements

| ID | Priority | Requirement | Acceptance criterion | Final status |
| --- | --- | --- | --- | --- |
| REQ-001 | Must | Expose authenticated health information. | `GET lfx-example-status-api` returns the documented status payload, including `updated_at_format`, for an authorized caller. | Represented in archive |
| REQ-002 | Must | Display status inside the App Shell. | The menu opens `lfx-example-status-page` and the iframe uses runtime context. | Represented in archive |
| REQ-003 | Must | Run a probe every five minutes. | Active interval scheduler targets the status handler with 300 seconds. | Represented in archive |
| REQ-004 | Should | Support Chinese and English UI text. | Title, refresh, and healthy keys contain `name` and `enUS`. | Represented in archive |

## Python runtime dependencies

| Module | Package or platform helper | Baseline version/interface | Purpose | Validation evidence |
| --- | --- | --- | --- | --- |
| `lfx_example_status_api` | `datetime.datetime`, `datetime.timezone`, `typing.Any` | Python standard library | Timestamped status payload and handler type annotations | Archive source inspection; live Code Registry validation unverified. |

No third-party package or direct MongoDB access is used by this example module.

## Deployed plugin resource inventory

| Section | Identity | Version/status | Requirement ids |
| --- | --- | --- | --- |
| Code | `lfx_example_status_api` | Active Python module | REQ-001, REQ-003 |
| Code | `lfx_example_status_page` | Active HTML module | REQ-002, REQ-004 |
| Gateway | `GET lfx-example-status-api` | Authenticated | REQ-001 |
| Gateway | `GET lfx-example-status-page` | Public delivery; runtime API uses JWT | REQ-002 |
| Menu | `lfxExampleStatusPage` / `/lfx-example-status-page` | Enabled | REQ-002 |
| Role | `lfx-example-status-viewer` | Custom | REQ-001, REQ-002 |
| Scheduler | `lfx-example-status-probe` | Active interval, 300 seconds | REQ-003 |
| App Env | `lafenice/lfx_example_status.refresh_seconds` | Plain portable value `300` | REQ-002 |
| Language Pack | `lfxExampleStatus.title`, `.refresh`, `.healthy` | Chinese and English | REQ-004 |

## Acceptance tests and evidence

| ID | Requirement ids | Surface | Test | Expected | Actual/result |
| --- | --- | --- | --- | --- | --- |
| TEST-001 | REQ-001 | API | Call authenticated status route. | HTTP 200 and status payload. | Unverified; example has no live deployment. |
| TEST-002 | REQ-002, REQ-004 | Browser | Sign in, open menu, switch locale/theme, refresh. | Dashboard remains usable and localized. | Unverified; example has no live deployment. |
| TEST-003 | REQ-003 | Scheduler/API | Read scheduler and invoke/test handler behavior. | Active 300-second interval and valid response. | Archive shape verified. |

## Traceability

| Requirement | Deployed resources | Test ids | Status |
| --- | --- | --- | --- |
| REQ-001 | API module, Gateway route, viewer role | TEST-001 | Unverified runtime |
| REQ-002 | HTML module, menu route, App Env | TEST-002 | Unverified runtime |
| REQ-003 | Scheduler, API module | TEST-003 | Archive verified |
| REQ-004 | HTML module, Language Pack | TEST-002 | Unverified runtime |

## Export record

| Section | Archive count |
| --- | --- |
| Collections | 0 |
| Code | 2 modules / 2 versions |
| Menu | 2 nodes |
| Roles | 1 |
| Language Pack | 3 |
| Schedulers | 1 |
| App Env | 1 |
| Gateway routes | 2 |

Archive schema and checksums pass the bundled inspector with no warnings. User assignments, business records, uploaded files, and scheduler run history are intentionally absent.
