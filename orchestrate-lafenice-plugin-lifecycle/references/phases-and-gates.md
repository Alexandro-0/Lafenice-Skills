# LaFenice Plugin phases and gates

Read only the section for the current phase or for an explicit cross-phase review.

## Contents

1. Artifact discovery and authority
2. Phase 1 — PRD
3. Phase 2 — Feasibility
4. Phase 3 — Design
5. Phase 4 — Development
6. Phase 5 — Integration
7. Phase 6 — Documentation
8. Targeted changes and bug fixes
9. Handoff requirements

## Artifact discovery and authority

Prefer established repository locations. When none exist, use a compact structure such as:

```text
docs/plugins/<plugin-id>/
  plugin-lifecycle-state.md
  prd.md
  feasibility.md
  design.md
  test-report.md
  product-guide.md
```

Determine authority in this order:

1. the user's current explicit decision;
2. an accepted PRD or change request;
3. accepted design contracts;
4. executable behavior and tests;
5. descriptive or historical documentation.

Do not silently resolve a genuine product ambiguity by trusting whichever artifact was edited most recently. Record the conflict and request a decision only when implementation cannot proceed safely.

## Phase 1 — PRD

Cover:

- product problem, outcome, scope, exclusions, and success measures;
- actors, custom roles, environment-provided roles, and assignment ownership;
- collection/data boundaries, field semantics, relations, validation, retention, and sensitive data;
- administrator maintenance flows;
- each role-specific user workflow, error path, and authorization expectation;
- optional command center, analytics/reporting, and history capabilities only when selected;
- functional requirements with stable IDs, priority, and observable acceptance criteria;
- assumptions, dependencies, migration needs, and unresolved decisions.

Gate:

- every required workflow has an actor, permission boundary, data dependency, and acceptance criterion;
- business authorization is defined independently of UI visibility;
- optional scope is explicitly selected, deferred, or not applicable;
- unresolved decisions are visible;
- stop at `ready-for-review` when the user requested PRD only.

## Phase 2 — Feasibility

Evaluate each requirement against the chosen execution mode and known platform capabilities.

Use a matrix containing:

| Requirement ID | Classification | Evidence | Constraint/risk | Proposed resolution |
| --- | --- | --- | --- | --- |

Classifications:

- `feasible`: supported with a known implementation path;
- `conditional`: feasible only after a named decision, dependency, credential, or environment capability;
- `infeasible`: cannot meet the acceptance criterion within current constraints;
- `unresolved`: insufficient evidence to decide.

Assess at least:

- authorization and role provisioning;
- MDC versus custom code;
- runtime/import/integration constraints;
- API and scheduler support;
- menu, route, theme, localization, and browser runtime needs;
- packaging/export/import limitations;
- test accounts, test data, and deployment access.

Gate:

- all required requirements are `feasible`; or
- the user explicitly accepts documented scope or acceptance-criterion changes that make them feasible.

Do not start design while a required item remains conditional, infeasible, or unresolved unless the user explicitly asks for a provisional design. Mark provisional assumptions prominently.

## Phase 3 — Design

Define:

### Roles and permissions

- role identity and purpose;
- collection-, record-, field-, API-, page-, and operation-level access;
- which role definitions belong to the Plugin and which user assignments remain environment-specific;
- denied behavior and audit expectations.

### MDC data structure

- collection keys and Plugin ownership;
- fields, types, required/unique/validation rules, defaults, options, and file semantics;
- reference, embedded, and `has_many` relationships;
- list/form behavior, access rules, history, indexes, migration, and seed/master data;
- generated behavior versus custom extensions.

### API and backend support

- endpoint, method, authentication, authorization, request/response/error contracts, idempotency, and requirement IDs;
- schedules, events, integrations, calculations, reports, shared HTML/JavaScript, and operational settings;
- retry, timeout, observability, and secret/configuration boundaries where relevant.

### Web design

- menu category, leaf key, route, and role visibility;
- page inventory and primary/empty/loading/error/denied states;
- per-page actions, validation, API dependencies, responsive behavior, and accessibility;
- theme behavior, locales, Language Pack keys, and fallback text.

Gate:

- every accepted requirement maps to design elements;
- every external/API contract has testable behavior;
- permissions are enforced in backend design;
- data ownership and Plugin identifiers are consistent;
- optional review findings are resolved or recorded.

## Phase 4 — Development

### Backend

- implement role and permission enforcement;
- create or modify MDC structures;
- implement APIs and non-API support such as schedules and integrations;
- preserve generated-code/custom-code boundaries;
- read back or inspect every material write;
- test success, validation, authentication, authorization, conflict, and important failure behavior.

### Frontend

- create or modify menu and routes;
- implement HTML/pages and runtime integration;
- add all required language entries and fallbacks;
- verify theme, locale, permission-denied, loading, empty, error, and responsive states.

Gate:

- changed code passes relevant static checks and automated tests;
- changed runtime behavior is exercised in the actual environment when in scope;
- failures are not hidden by UI-only restrictions;
- requirement-to-test traceability is current;
- formal API or web test reports are produced only when requested or required by project convention.

## Phase 5 — Integration

When selected:

- package/export the exact Plugin-owned resources;
- validate archive/package structure, counts, checksums, dependencies, and warnings;
- preview import/deployment conflicts;
- deploy/import only with appropriate authorization;
- verify restored code versions, Gateway routes, role behavior, settings, schedules, localization, and primary UI flow;
- record environment-specific follow-up such as secret values, role assignments, files, or business data.

Gate:

- package success and runtime acceptance are separately evidenced;
- every warning or skipped conflict is understood;
- no secret is embedded unintentionally;
- the target environment passes the selected smoke and acceptance tests.

## Phase 6 — Documentation

When selected or affected, maintain:

- Plugin purpose, capabilities, limitations, roles, and feature overview;
- version correction/change history with requirement or issue references;
- product usage guide with prerequisites, role-specific steps, validation/error guidance, and operational notes.

Do not expose internal credentials, tokens, secret values, or sensitive test records. Keep technical implementation detail out of the user guide unless operators need it.

Gate:

- documentation describes shipped behavior rather than planned behavior;
- role and permission claims match verified behavior;
- screenshots or examples contain no secrets or sensitive records;
- version history identifies user-visible changes and known limitations.

## Targeted changes and bug fixes

Use this shortened flow:

1. Reproduce or establish the observed behavior.
2. Identify the accepted intended behavior from the PRD, issue, tests, or user decision.
3. Classify the work as defect correction, behavior change, or internal refactor.
4. List affected requirements, design contracts, code surfaces, tests, and user documentation.
5. Update the earliest affected artifact and all authorized downstream artifacts.
6. Implement the smallest coherent change.
7. Run focused regression checks.
8. Update lifecycle state and report any downstream work intentionally left pending.

Do not force a complete PRD or feasibility cycle for a narrow fix. Reopen feasibility only when the change reveals a platform constraint, new dependency, or infeasible acceptance criterion.

## Handoff requirements

A resumable handoff must answer:

- What did the user ask for, and where did work stop?
- Which artifact is authoritative for each accepted decision?
- Which requirements changed?
- What was verified, how, and in which environment?
- What remains blocked, provisional, deferred, or optional?
- What action is permitted next, and what user approval or input is still required?
