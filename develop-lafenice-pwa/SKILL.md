---
name: develop-lafenice-pwa
description: >-
  Assess, implement, and verify PWA installation or offline behavior for the LaFenice App Shell and standalone Code Registry pages. Use only when the user explicitly asks about a PWA, manifest, install prompt or icons, service worker, offline behavior, Vite PWA integration, or related nginx rules. Do not invoke for an ordinary web page, SPA, mobile layout, caching task, or local-persistence task.
---

# Develop a LaFenice PWA

## Establish the delivery target

Choose exactly one delivery mode before running mode-specific checks:

- Use **App Shell mode** to make `LaFeniceFrontend` itself installable. Prefer this mode for the normal authenticated LaFenice experience.
- Use **standalone plugin-page mode** only when the user explicitly wants a Code Registry page opened directly as the installed app. Read [references/standalone-plugin-page.md](references/standalone-plugin-page.md) first. For a small public one-page app with durable local state, also read and adapt [references/persistent-counter-example.md](references/persistent-counter-example.md). Do not claim that an iframe page makes the outer App Shell installable.

Treat “one page” as one installable application surface. Preserve LaFenice deep links and routes inside that surface; do not create a second shell merely to satisfy the wording.

For App Shell mode, read [references/lafenice-pwa-contract.md](references/lafenice-pwa-contract.md) before changing source or claiming feasibility. Choose the capability level from the request:

- **installable** requires a valid manifest, install icons, secure production delivery, and correct application identity/scope. A service worker is optional.
- **offline-shell** includes installability and additionally requires a service worker, controlled static-shell caching, an update lifecycle, and an honest offline fallback.

Then run the static preflight from the repository root at that level:

```powershell
$capabilityLevel = "installable" # or "offline-shell"
node .\plugin_skills\develop-lafenice-pwa\scripts\audit_lafenice_pwa.mjs --root . --level $capabilityLevel
```

Do not run the App Shell audit as a prerequisite for standalone plugin-page mode. That mode may be developed against a deployed LaFenice instance without a local frontend checkout.

## Implement App Shell mode

1. Inspect `LaFeniceFrontend/package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, the nginx template, Dockerfile, runtime-config entrypoint, and current working-tree changes. Preserve unrelated user work.
2. If using a Vite PWA integration, verify its current API against official documentation before adding or upgrading it, and update both `package.json` and the lockfile. A reviewed custom manifest or service worker is also valid; do not add `vite-plugin-pwa` solely to satisfy the audit.
3. Keep Vite's existing `base: /<PROJECT_ROOT>/`. Define manifest `scope` and `start_url` relative to that base; never hardcode `/` or `/lafenice/`.
4. Add install icons with real 192×192 and 512×512 PNG files. Add a maskable icon when its safe zone has been visually checked. Use versioned filenames or non-immutable cache rules. Feature-detect custom install prompts and provide platform-appropriate installation guidance where `beforeinstallprompt` is unavailable.
5. For offline-shell capability, register updates with a visible prompt. Do not force an automatic reload while a user may be editing a form.
6. For offline-shell capability, precache only the static shell and fingerprinted assets. Apply these runtime rules:
   - Keep API, WebSocket, authentication, upload, and personalized responses network-only.
   - Exclude `runtime-config.js` from immutable precache. If offline launch is required, use an explicit network-first last-known configuration policy and document that the file contains no secrets.
   - Restrict navigation fallback and service-worker scope to the configured project root.
   - Never cache responses containing `Authorization`-scoped or user-specific data unless the user explicitly approves a reviewed encrypted/offline-data design.
7. Add an exact nginx location for the manifest. For offline-shell capability, also add an exact service-worker location. Serve the worker with `Cache-Control: no-store` or `no-cache` and `X-Content-Type-Options: nosniff`. Add `Service-Worker-Allowed` only when intentionally allowing a scope broader than the worker script's directory. Preserve long immutable caching only for fingerprinted assets.
8. Do not migrate existing state solely because the app becomes installable. When the request includes plugin-owned offline records or another durable local workflow that needs transactions and schema upgrades, use a stable app- or plugin-namespaced IndexedDB database. Hydrate before enabling dependent mutations, commit changes transactionally, and surface storage failures instead of silently claiming persistence. Existing server-backed state and reviewed non-critical preferences may keep their established storage design.
9. Provide an honest offline state. Distinguish “the shell launches,” “local state survives restart,” and “server business data synchronizes offline”; the last capability requires a separate sync, conflict, and data-protection design.

## Verify the result

Run the normal project checks and then the static preflight at the selected capability level:

```powershell
Set-Location .\LaFeniceFrontend
npm run lint
npm run build
Set-Location ..
$capabilityLevel = "installable" # or "offline-shell"
node .\plugin_skills\develop-lafenice-pwa\scripts\audit_lafenice_pwa.mjs --root . --dist .\LaFeniceFrontend\dist --level $capabilityLevel --strict
```

Serve the production build from its real project-root path over a trusted HTTPS origin. Verify:

- The manifest loads with no console or MIME errors and resolves `start_url`, `scope`, and icons under the project root.
- The installed app opens in standalone display mode at the intended route.
- For offline-shell capability, a cold offline launch shows only the capability actually promised.
- When durable local state is part of the request, values survive refresh and closing/reopening the app; test an actual process or device restart when the requirement names it.
- When IndexedDB-backed mutations are part of the request, controls remain disabled until hydration completes, transactional writes survive a second reload, and denied/quota/version errors are visible.
- For offline-shell capability, API and authenticated responses do not appear in Cache Storage.
- Refresh, login, logout, token refresh, and iframe Code Registry pages still work online.
- For offline-shell capability, a new build produces an update prompt; accepting it activates the new version without an update loop.
- Direct navigation to a deep link still reaches the App Shell through nginx fallback.

Use browser developer tools or an installability audit as supporting evidence, not as the sole test. Test at least Chromium desktop and one target mobile browser when mobile installation is part of the request.

## Handle standalone plugin-page mode

Follow the production-only connection and authentication gates in the existing LaFenice plugin skills. Keep the installed page, manifest, service worker, icons, and IndexedDB database under one stable plugin identity so the service worker cannot control unrelated LaFenice APIs and local data cannot collide with another app. Supply the direct top-level install URL and test it outside the App Shell iframe.

When the requested app resembles the `pwa-dev` counter, follow [references/persistent-counter-example.md](references/persistent-counter-example.md) as the reference implementation. Replace its example identifiers with the target plugin's stable names, read the remote latest Code Registry version before every edit, and create a new version instead of patching generated deployment files. Never copy credentials, access tokens, environment-specific version IDs, or a hardcoded project root into the reusable implementation.

Reject or redesign the mode when it would require reading existing App Shell local/session storage, persisting inherited tokens, caching bearer-authenticated API responses, controlling `/<PROJECT_ROOT>/`, or silently broadening the service-worker scope to the shared API root. Use namespaced IndexedDB only for the plugin's own reviewed state.

## Definition of done

Report completion only when the selected surface is installable from its production-equivalent URL, the selected capability level and requested persistence behavior are verified, the build and static preflight pass, authentication behavior is unchanged, and any offline limitations are stated precisely. Treat the preflight as static evidence rather than a substitute for served-origin and browser testing. Do not equate the presence of a manifest or a registered service worker with a completed PWA.
