# LaFenice Skills

**English** | [繁體中文](README.zh-TW.md)

Help AI agents plan, develop, test, and deliver business Plugins using LaFenice's platform contracts.

This repository contains skills for Codex, together with API and runtime references, requirements and test templates, validation scripts, and examples. The main development workflow uses deployed LaFenice APIs, supporting Plugin development without Backend or Frontend source access. Dedicated skills also cover architecture explanations, schema design, and deployment maintenance.

**New here?** Follow the [Quick start](#quick-start), then choose an entry point from the [Skills catalog](#skills-catalog). For a new Plugin, start with [`orchestrate-lafenice-plugin-lifecycle`](orchestrate-lafenice-plugin-lifecycle/SKILL.md).

## What can you do with these skills?

- Turn product requirements into a PRD, feasibility assessment, design, and acceptance criteria.
- Convert external schemas into MDC (Metadata-Driven Collection) designs with fields, validation, permissions, and master-detail relationships.
- Generate CRUD and history APIs and data pages, then extend Python handlers and HTML pages through Code Registry.
- Integrate menus, localization, roles, App Env, schedulers, PWA features, and RTSP media.
- Verify deployed behavior, export Plugin packages, and import or transfer them between environments.
- Understand LaFenice's core architecture or maintain isolated deployments on the same Docker host.

A **skill** provides working instructions for an agent. A **LaFenice Plugin** packages business functionality deployed on the platform. Downloading this repository does not install a LaFenice server or automatically import the example Plugin.

## Quick start

### 1. Install the skills

If your Codex environment provides `skill-installer`, use this prompt:

```text
Use $skill-installer to install every skill folder containing SKILL.md
at the root of https://github.com/Alexandro-0/Lafenice-Skills.
Preserve each folder's references, assets, scripts, and agents,
and keep the skills as siblings so their relative links remain valid.
```

Alternatively, download the repository manually:

```sh
git clone https://github.com/Alexandro-0/Lafenice-Skills.git
```

Copy each complete folder containing `SKILL.md` into one of these locations, keeping the skill folders at the same level:

| Scope | Destination |
| --- | --- |
| A specific project | `<your-project>/.agents/skills/` |
| All your projects | `~/.agents/skills/` (Windows: `%USERPROFILE%\.agents\skills\`) |

For example, the installed entry point should be `.agents/skills/build-lafenice-plugin/SKILL.md`. Copying only `SKILL.md` omits contracts, scripts, and templates. If you install an individual skill, also include the other skills it references. Installing the complete collection is suitable for end-to-end development.

See the [official OpenAI Skills documentation](https://learn.chatgpt.com/docs/build-skills) for local discovery locations, explicit invocation, and installation guidance. If a newly installed skill does not appear, restart Codex.

### 2. Prepare your task details

For architecture explanations, document planning, or offline schema conversion, start with your question, requirements, or input files.

To operate on a deployed system, prepare:

| Information | What to provide |
| --- | --- |
| Project URL | The exact target environment URL, including its project path. |
| Development identity | A LaFenice account whose roles include `ai`, with its password supplied securely. |
| Plugin scope | Name, version, whether it is new or existing, intended functionality, and the environment the agent may operate on. |
| Acceptance criteria | Required workflows, user roles, data rules, and the stage where you want work to stop. |

[`get-plugin-edit-access`](get-plugin-edit-access/SKILL.md) handles API login and role verification. Depending on your execution environment, credentials can be supplied through process-scoped `LAFENICE_AI_ACCOUNT` and `LAFENICE_AI_PASSWORD` variables. Do not place passwords or tokens in requirements documents, source code, public Issues, or packages.

API-based development requires network access to the target deployment. UI acceptance testing requires browser control. Prepare Python, Node.js, or PowerShell as required by the scripts you use; deployment maintenance also requires the relevant Docker environment. Each skill defines its own prerequisites.

### 3. Choose an entry point

Use these prompts as starting points. The URL below is a placeholder; replace it with your target environment.

**Prepare requirements and stop at the PRD:**

```text
Use $orchestrate-lafenice-plugin-lifecycle to plan an equipment maintenance Plugin.
It needs an equipment list, maintenance records, attachments, and overdue reminders.
Produce only the PRD and open questions. Do not operate on a deployment yet.
```

**Build a Plugin on a deployed system:**

```text
Use $build-lafenice-plugin to build the maintenance Plugin from my confirmed requirements.
Target project: https://example.com/lafenice
I will provide development credentials through secure input.
Complete API and UI acceptance testing, then deliver the platform-exported package
and requirements document.
```

**Fix an existing feature:**

```text
Use $orchestrate-lafenice-plugin-lifecycle to fix date filtering for maintenance records
in the maintenance Plugin. I will provide the existing requirements and test data.
Resume at the affected stage and identify the documents and tests that need updating.
```

**Convert a data structure before implementation:**

```text
Use $convert-external-schema-to-mdc to turn the attached SQL DDL into an MDC design.
Identify collection boundaries, relationships, attachment fields, and decisions
that need my input. Produce the design only; do not write to a deployment.
```

**Understand the platform architecture:**

```text
Use $explain-lafenice-architecture to explain how App Shell, Gateway,
Code Registry, MDC, and MongoDB work together, and how Core and Plugins divide responsibilities.
```

## Skills catalog

### Planning and core development

| Skill | Use it for |
| --- | --- |
| [`orchestrate-lafenice-plugin-lifecycle`](orchestrate-lafenice-plugin-lifecycle/SKILL.md) | Coordinate requirements, feasibility, design, implementation, testing, and documentation; support individual stages, resumed work, and targeted fixes. |
| [`build-lafenice-plugin`](build-lafenice-plugin/SKILL.md) | Build, test, and export a complete Plugin through deployed APIs, delivering its package and requirements document. |
| [`get-plugin-edit-access`](get-plugin-edit-access/SKILL.md) | Confirm the project URL, authenticate, verify the `ai` role, and preflight development APIs. |
| [`convert-external-schema-to-mdc`](convert-external-schema-to-mdc/SKILL.md) | Convert JSON Schema, SQL, OpenAPI, sample data, or textual structures into an MDC design. |
| [`manage-metadata-driven-collection`](manage-metadata-driven-collection/SKILL.md) | Manage MDC fields, validation, permissions, relationships, file fields, and Generate Code. |
| [`develop-plugin-code`](develop-plugin-code/SKILL.md) | Create or modify Code Registry Python and HTML, advanced data behavior, and external integrations. |

### Feature integration and delivery

| Skill | Use it for |
| --- | --- |
| [`configure-website-entry`](configure-website-entry/SKILL.md) | Manage menu categories, page entry points, frontend routes, and Gateway authentication settings. |
| [`customize-lafenice-shell`](customize-lafenice-shell/SKILL.md) | Customize topbar/sidebar HTML through Code Registry, apply pinned versions, verify, and restore. |
| [`configure-language-settings`](configure-language-settings/SKILL.md) | Configure locales, the default language, and Plugin Language Pack entries. |
| [`manage-plugin-settings`](manage-plugin-settings/SKILL.md) | Manage custom Plugin roles and encrypted App Env records; user role assignment is outside its scope. |
| [`manage-plugin-schedulers`](manage-plugin-schedulers/SKILL.md) | Manage cron, interval, date, and startup schedules, including enabled and paused states. |
| [`develop-lafenice-pwa`](develop-lafenice-pwa/SKILL.md) | Address explicit PWA installation, manifest, service worker, and offline requirements. |
| [`use-lafenice-rtsp`](use-lafenice-rtsp/SKILL.md) | Integrate cameras, live viewing, and playback; configure and check network allowlists and diagnose RTSP connectivity. |
| [`transfer-lafenice-plugin`](transfer-lafenice-plugin/SKILL.md) | Preview, export, inspect, and import Plugin packages, with verification across environments. |

### Architecture and deployment

| Skill | Use it for |
| --- | --- |
| [`explain-lafenice-architecture`](explain-lafenice-architecture/SKILL.md) | Explain architecture, component responsibilities, data flows, and the Core / Plugin boundary. |
| [`install-lafenice`](install-lafenice/SKILL.md) | Download the latest ZIP by Drive modified time, set up and back up first-install env, or merge settings and verify an upgrade. |
| [`deploy-lafenice-instances`](deploy-lafenice-instances/SKILL.md) | Install, configure, back up, restore, and upgrade full-export instances on the same Docker host. |

## How the skills work together

Agents should select skills for the current task and read references as needed. **Installing the full collection does not mean loading every skill for every task.**

Development starts with the lifecycle skill or the relevant specialist skill. `explain-lafenice-architecture` is for architecture explanations, not prerequisite reading for every LaFenice task. Likewise, a mobile-friendly layout alone should not activate the PWA skill.

A typical full build follows requirements and design → access verification → MDC and generated baseline → custom code and integrations → acceptance testing → export. Targeted fixes can resume at the affected stage. A request for a PRD stops at the PRD rather than automatically advancing to deployment.

## Deliverables and verification

The complete API-based build workflow produces two primary deliverables:

```text
<plugin>-<version>/
├── <plugin>-<version>.tar.gz
└── <plugin>-<version>-requirements.md
```

The package comes from LaFenice Plugin Export. The requirements document records resources, acceptance evidence, export results, and limitations. Planning-only tasks, targeted fixes, and deployment maintenance produce deliverables appropriate to their scope.

A successful save or code validation result does not establish functional acceptance. Development also checks actual Gateway routes, permissions, data boundaries, and user workflows. Missing role-specific test accounts or browser access should be recorded as verification gaps. Running Generate Code again can replace customized versions, so custom changes must be preserved and checked.

Plugin packages contain configuration and code, not backups of business records. App Env values are redacted by default during export. Actual capabilities and API compatibility must be confirmed against the target deployment.

## Directory structure and resources

Each skill has its own folder. Supporting directories are included where needed:

```text
<skill-name>/
├── SKILL.md          Scope and working instructions
├── agents/           Display metadata and invocation settings
├── references/       API and runtime contracts, detailed guidance
├── assets/           Document templates and examples
└── scripts/          Operation or validation tools
```

Useful references:

- [Plugin development contract](build-lafenice-plugin/references/plugin-contract.md)
- [Python runtime contract](develop-plugin-code/references/python-runtime-contract.md)
- [Requirements document template](build-lafenice-plugin/assets/plugin-requirements-template.md)
- [Plugin lifecycle document templates](orchestrate-lafenice-plugin-lifecycle/assets/)
- [Complete example Plugin and documentation](build-lafenice-plugin/assets/lafenice-status-example-1.0.0/README.md)
- [System architecture overview](explain-lafenice-architecture/references/system-architecture.md)

## Issues and contributions

Use [Issues](https://github.com/Alexandro-0/Lafenice-Skills/issues) to report contract discrepancies, example problems, or use cases. Pull requests are also welcome.

Include the relevant skill, LaFenice version, expected and actual behavior, and reproduction steps with sensitive information removed. When updating a skill, keep its invocation scope clear, maintain valid relative links, and update affected references, examples, and this catalog.
