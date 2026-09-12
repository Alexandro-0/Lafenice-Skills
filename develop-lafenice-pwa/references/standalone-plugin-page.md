# Standalone Code Registry page as a PWA

Use this mode only when the installed application may be a direct top-level Code Registry/Gateway URL rather than the LaFenice App Shell.

## Boundary

An HTML code page normally renders inside an App Shell iframe at an API Gateway URL. A manifest in that iframe does not make the parent document installable, and an iframe worker cannot control the outer shell.

A standalone plugin PWA is conditionally feasible when all PWA resources are opened directly and share a narrow nested path:

```text
/<PROJECT_ROOT>/api/<PLUGIN>/app
/<PROJECT_ROOT>/api/<PLUGIN>/manifest
/<PROJECT_ROOT>/api/<PLUGIN>/sw
/<PROJECT_ROOT>/api/<PLUGIN>/icon-192
/<PROJECT_ROOT>/api/<PLUGIN>/icon-512
```

Use manifest `"scope": "./"` and `"start_url": "./app"`. Omit manifest `id` so it defaults to the resolved plugin `start_url`, or generate an explicit root-relative identity containing the project root and plugin namespace. Register `./sw` from the direct app page. The resulting worker scope is `/<PROJECT_ROOT>/api/<PLUGIN>/`, not the App Shell.

Do not place the worker at `/<PROJECT_ROOT>/api/sw`; its default scope would include unrelated LaFenice APIs.

## LaFenice resources

- Use an HTML Code Registry version for the app page, or a reviewed Python `Response` dispatcher when one narrow module must serve the app, manifest, worker, and icons as separate resources under the same Gateway namespace. Follow [persistent-counter-example.md](persistent-counter-example.md) for the dispatcher pattern.
- Use a JS Code Registry asset or a reviewed Python `Response` handler for the worker with `application/javascript`, `no-store` or `no-cache`, and `nosniff`. `Service-Worker-Allowed` is unnecessary when the requested scope is the worker script's own directory.
- Use a reviewed Python `Response` handler for the manifest with `application/manifest+json`.
- Serve real PNG icon bytes with correct media types. Keep them in exportable code resources if portability is required; uploaded file bytes are not part of a normal plugin export.
- Tag every Code Registry module and Gateway route with the same stable plugin identity.
- Export and inspect every supporting module and route with the standard LaFenice plugin workflow.

Read and use the existing `build-lafenice-plugin`, `develop-plugin-code`, `configure-website-entry`, and `transfer-lafenice-plugin` skills as applicable. Follow their production URL and AI-account connection gates.

## Authentication constraint

A directly opened page does not receive the App Shell `postMessage` runtime context. Never read the parent window, existing App Shell local/session storage, browser extension state, or an inherited token to bypass that boundary.

Prefer this mode for public or anonymous single-purpose apps. If it requires authenticated private data, define and review a complete direct-login, token persistence, refresh, logout, offline storage, and device-loss model before implementation. App Shell mode is usually safer for the existing authenticated product.

## Persistent offline state

Store plugin-owned values that must survive refresh or app termination in a database named from the stable plugin identity, for example `<plugin>-pwa-state`. Use IndexedDB with a versioned schema and transactions; do not confuse cached HTML/JavaScript with saved application data.

Hydrate durable state before enabling controls, serialize or transactionally combine competing writes, and show whether a change was committed. Handle blocked upgrades, quota/permission failures, and `versionchange`. Never place LaFenice credentials or inherited App Shell tokens in this database. Verify a non-default value after reload, close/reopen, service-worker update, and offline relaunch; include a device-restart test when requested.

## Service-worker constraint

Keep the worker minimal:

- Precache only the standalone HTML shell and immutable public assets.
- Keep LaFenice API/auth calls network-only.
- Match only requests under the plugin namespace.
- Version cache names with the plugin version.
- Delete only caches owned by that plugin during activation.
- Keep IndexedDB user state when deleting superseded asset caches.
- Never intercept or synthesize responses outside the plugin scope.

## Handoff

Return the direct top-level install URL and explicitly state that opening the same page through the App Shell menu does not expose the plugin manifest as the shell manifest. Test installation, standalone launch, updates, and cache scope from the direct URL.
