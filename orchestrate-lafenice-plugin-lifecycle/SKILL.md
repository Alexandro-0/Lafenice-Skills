---
name: orchestrate-lafenice-plugin-lifecycle
description: Orchestrate staged LaFenice Plugin product development while keeping PRD, feasibility, design, implementation, tests, packaging, and user documentation aligned. Use when Codex is asked to create a Plugin, produce only one lifecycle deliverable such as a PRD or design, resume a partially completed Plugin at any stage, implement a targeted feature or bug fix in an existing Plugin, or assess whether a requested change requires updates to existing requirements or design documents. Preserve user checkpoints, enter at the current stage instead of restarting from PRD, and load only the relevant specialist plugin skills.
---

# Orchestrate LaFenice Plugin Development

## Establish the current truth

Before planning or changing anything:

1. Read repository instructions and inspect the smallest relevant set of existing PRD, feasibility, design, code, tests, package, release-history, and user-guide artifacts.
2. Determine the requested entry point and stopping point. Classify the request as:
   - new end-to-end Plugin;
   - one requested phase or artifact;
   - continuation from an existing phase;
   - targeted feature, behavior change, or bug fix;
   - review or feasibility assessment only.
3. Determine the execution mode:
   - local source repository;
   - deployed, API-managed LaFenice with no source access;
   - documentation-only planning with no implementation environment.
4. Summarize the current state, requested result, affected artifacts, known decisions, and blockers before doing material work. Ask only when an undiscoverable decision would materially change the product or authorize external/destructive action.

Do not restart from PRD merely because PRD is phase 1. Enter at the earliest phase affected by the request. Do not continue beyond the user's requested checkpoint.

## Preserve resumability

Use the repository's existing project tracker or document conventions. If work is intentionally split across sessions and no equivalent tracker exists, copy [assets/plugin-lifecycle-state-template.md](assets/plugin-lifecycle-state-template.md) into the Plugin's documentation area and maintain it as a compact handoff record.

Record:

- Plugin identity and execution mode;
- requested checkpoint;
- phase status as `not-started`, `in-progress`, `ready-for-review`, `accepted`, `blocked`, or `not-applicable`;
- artifact paths and authoritative versions;
- accepted decisions, open questions, blockers, and next permitted action.

Treat `ready-for-review` as a stop when the user wants to confirm the output. Never silently promote it to `accepted`.

## Perform impact analysis before edits

Classify the requested change and update only affected artifacts:

| Change type | PRD | Feasibility | Design | Code and tests | Product docs |
| --- | --- | --- | --- | --- | --- |
| Fix implementation that violates accepted behavior | Usually unchanged | Reopen only if the fix exposes a constraint | Update only if the design is inaccurate | Update | Update only if observed usage changes |
| Intentional product behavior or scope change | Update if present | Re-evaluate affected requirements | Update affected contracts and flows | Update | Update affected guidance/history |
| Internal refactor with unchanged contracts | Unchanged | Unchanged | Update only if architecture/operations change | Update | Usually unchanged |
| New role, data, API, page, schedule, or integration | Update if present | Evaluate the addition | Update all affected sections | Update | Update when user-visible |

When an existing PRD conflicts with an explicitly requested behavior change, update the PRD before or in the same change set as downstream artifacts. When code is merely wrong relative to the PRD, fix the code instead of rewriting the requirement. If no PRD exists during a narrow midstream fix, do not invent a complete retrospective PRD unless the user requests one; capture the changed contract in the nearest existing authoritative artifact.

Preserve stable requirement IDs. Add new IDs rather than renumbering existing ones, and trace changed requirements through design, implementation, and verification.

## Apply lifecycle gates

Read [references/phases-and-gates.md](references/phases-and-gates.md) only for the phase being entered or reviewed.

1. **PRD**: Define data, roles and permissions, administrator maintenance, role-specific workflows, acceptance criteria, and selected optional capabilities. Use [assets/prd-template.md](assets/prd-template.md) when no project template exists.
2. **Feasibility**: Classify every requirement as feasible, conditional, infeasible, or unresolved, with evidence and alternatives. Proceed to design only when every required requirement is feasible or the user explicitly accepts a revised scope. Do not reinterpret silence as approval. Use [assets/feasibility-template.md](assets/feasibility-template.md) when no project template exists.
3. **Design**: Define roles, MDC structures, APIs, non-API backend support, and web behavior including menu/category/route, theme, localization, and page functions. Use [assets/design-template.md](assets/design-template.md) when needed.
4. **Development**: Implement the accepted design. Cover backend permissions, MDC, APIs, other code and schedules; cover frontend menu, HTML/pages, and language packs. Perform proportionate verification even when a formal test report is optional. Use [assets/test-report-template.md](assets/test-report-template.md) when a report is selected.
5. **Integration**: When requested, package the Plugin and test deployment/import without treating a successful package operation as functional proof.
6. **Documentation**: When requested or affected by user-visible behavior, maintain the functional overview, version-fix history, and product usage guide. Use [assets/plugin-documentation-template.md](assets/plugin-documentation-template.md) when needed.

Optional phases and sections remain optional. Mark them `not-applicable` or leave them unstarted with the reason; do not fabricate content.

## Select specialist skills lazily

Do not read every sibling skill. Load only a specialist whose capability is needed in the current phase:

- Use `convert-external-schema-to-mdc` to normalize external schemas during PRD or data design without mutating a deployment.
- Use `manage-metadata-driven-collection` for deployed MDC creation or changes.
- Use `develop-plugin-code` for deployed custom Python/HTML modules and advanced behavior.
- Use `configure-website-entry` for deployed menu, route, and Gateway configuration.
- Use `configure-language-settings` for deployed locale and Language Pack work.
- Use `manage-plugin-schedulers` for deployed schedules.
- Use `manage-plugin-settings` for deployed custom roles and App Env.
- Use `transfer-lafenice-plugin` for export, import, archive inspection, and deployment verification.
- Use `build-lafenice-plugin` only for an authorized end-to-end build against a deployed system with no source repository.
- Use `develop-lafenice-pwa` only when the user explicitly requests PWA behavior.

Invoke `get-plugin-edit-access` only when remote inspection or mutation is now required. Do not require deployment credentials for PRD, feasibility, or design-only work.

For local source work, follow repository instructions and inspect the local contracts. Do not apply production-only API assumptions or request deployed credentials unless remote verification is in scope.

## Maintain change discipline

- Reuse existing document locations, terminology, identifiers, and templates before introducing new ones.
- Keep planning artifacts separate from implementation artifacts; never claim planned resources are deployed.
- Preserve unrelated user changes and avoid broad rewrites for a narrow fix.
- Update upstream and downstream artifacts in one coherent change when authorization covers them.
- If the requested checkpoint ends before an affected downstream artifact, record it as pending rather than silently editing past the checkpoint.
- Treat backend authorization as authoritative; menu visibility alone is not permission enforcement.
- Never place credentials, tokens, secrets, sensitive records, or environment-specific secret values in lifecycle artifacts.

## Finish the requested checkpoint

At the end of each invocation, report:

1. the entry point and checkpoint reached;
2. artifacts created or updated;
3. requirements or decisions changed;
4. verification performed and evidence;
5. unresolved items and the next permitted phase.

Declare the whole Plugin complete only when all accepted required phases and acceptance criteria are satisfied. Otherwise declare only the requested checkpoint complete or ready for review.

When the user asks how to invoke this skill or structure staged work, read [references/prompt-examples.md](references/prompt-examples.md) and adapt the smallest relevant example.
