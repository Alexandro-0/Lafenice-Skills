# LaFenice PWA contract

## Baseline architecture

The source baseline reviewed on 2026-07-23 is technically suitable for an App Shell PWA. Re-run the bundled audit because later source changes take precedence over this snapshot:

| Existing component | Relevant behavior | PWA implication |
| --- | --- | --- |
| `LaFeniceFrontend/package.json` | React 18 on Vite 5 | A standard Vite PWA integration can generate and register the worker. |
| `vite.config.ts` | Builds with `base: /<PROJECT_ROOT>/` | Manifest, worker, navigation fallback, and asset URLs must honor a non-root base. |
| `src/App.tsx` | Implements client-side navigation and embeds Code Registry HTML in an iframe | The outer React shell is the installable surface; an iframe cannot install or control it. |
| `index.html` | Loads `runtime-config.js` before the React entry | Runtime configuration needs an explicit online/offline caching decision. |
| nginx template | Falls back to `/<PROJECT_ROOT>/index.html` and caches common static extensions for one year | Deep links already work, but `sw.js` must not inherit the immutable JavaScript rule. |
| Docker entrypoint | Copies the built distribution under `/<PROJECT_ROOT>/` and writes runtime config at startup | The PWA can use a stable root while API/config values remain deployment-time settings. |
| HTTPS listeners | Development and packaged deployments support TLS | Production installation still requires a trusted certificate and secure context. |

That baseline has no web app manifest, service-worker registration, install prompt, or PWA build dependency. A manifest and install assets are missing for promoted installation. A service worker and PWA build dependency are optional unless the selected implementation or offline capability requires them.

## Required scope model

For App Shell mode, use the following URL model. The service-worker entry applies only when offline-shell capability is selected:

```text
document:       /<PROJECT_ROOT>/
manifest:       /<PROJECT_ROOT>/manifest.webmanifest
service worker: /<PROJECT_ROOT>/sw.js
scope:          /<PROJECT_ROOT>/
start URL:      /<PROJECT_ROOT>/
API:            /<PROJECT_ROOT>/api/...
WebSocket:      /<PROJECT_ROOT>/ws/...
```

Prefer relative manifest values such as `"scope": "./"` and `"start_url": "./"` so a rebuilt image can use another project root. Confirm the generated manifest rather than assuming the integration rewrites these fields.

Do not register a worker at the origin root. A worker scoped to `/` could affect unrelated applications hosted on the same origin.

## Cache policy

For offline-shell capability, classify resources before writing Workbox or custom worker rules:

| Resource | Strategy | Reason |
| --- | --- | --- |
| Fingerprinted JS/CSS/fonts | Precache or cache-first | Build hashes make immutable caching safe. |
| App Shell HTML | Precache with update lifecycle | Enables launch; activation must not destroy in-progress work. |
| `runtime-config.js` | Network-first or network-only; never immutable | It is deployment-specific and intentionally emitted with no-cache headers. |
| Manifest | Network-first/no-cache | Browsers must discover identity and presentation updates promptly. |
| Service worker, when used | Browser-managed update fetch plus no-cache response policy | Worker updates must not be pinned by an immutable server cache. |
| API, auth, uploads, WebSocket | Network-only | Responses may be private, mutable, or token-scoped. |
| Code Registry iframe HTML and assets | Network-first by default | Latest code versions are server-managed and may change independently of the shell build. |
| Public, versioned media | Cache-first only when explicitly classified | Avoid accidentally retaining mutable or private uploads. |
| User-created offline state requiring transactions/schema upgrades | App- or plugin-namespaced IndexedDB | Cache Storage stores responses, not application records; IndexedDB provides schema versions and transactions. |

If offline launch depends on cached runtime configuration, cache only the small non-secret environment mapping and refresh it before falling back. Never put credentials, access tokens, refresh tokens, or private API responses in Cache Storage.

## Durable client state

Treat a value as durable whenever the user expects it to survive refresh, closing or swiping away the installed app, or a normal device restart. JavaScript variables survive none of those events, and a service worker does not persist page memory.

Use IndexedDB when durable local state requires transactions, structured records, or schema upgrades. Do not migrate existing server-backed state or a reviewed non-critical preference solely because the app becomes installable.

1. Use a stable app- or plugin-namespaced database name, a numeric schema version, and explicit object stores/keys.
2. Open and hydrate the database before enabling controls that mutate durable state.
3. Read the current value and write the next value in one `readwrite` transaction when concurrent actions could race.
4. Update the visible UI after transaction completion; show a storage error and avoid claiming success after an abort, quota error, blocked upgrade, or denied access.
5. Handle `versionchange` by closing stale connections so later schema upgrades are not blocked.
6. Never store LaFenice access/refresh tokens, inherited App Shell state, or sensitive business data without an explicit encryption, logout, retention, and device-loss design.
7. Keep service-worker cache versioning independent from IndexedDB schema versioning; deleting old asset caches must not delete user state.

Test persistence by writing a non-default value, reloading twice, closing and reopening the installed app, and repeating while offline. When device restart is an acceptance requirement, perform or hand off that exact test. Browser data clearing, site-storage eviction, or uninstall may still remove IndexedDB; state that limitation and use `navigator.storage.persist()` only as a best-effort anti-eviction request, never as a guarantee.

## Update behavior for offline-shell capability

Prefer a prompt-based update lifecycle:

1. Detect that a waiting service worker exists.
2. Show a localized “new version available” action.
3. Activate and reload only after the user accepts.
4. Prevent repeated reloads when the new worker takes control.
5. Preserve a recovery action that unregisters stale workers and clears only LaFenice-owned caches during support/debug workflows.

Do not use unconditional `skipWaiting` plus automatic reload for form-heavy authenticated UI without a product decision.

## Manifest baseline

Include:

- A product-specific `name` and concise `short_name`.
- Relative `start_url` and `scope`.
- `display: "standalone"` unless another display mode is explicitly required.
- A stable application identity. Omit `id` to let it default to the resolved `start_url`, or emit a root-relative `id` that includes the configured project root. Do not use `"./"` or `"./app"` as a supposedly directory-relative `id`; relative `id` values resolve against the `start_url` origin.
- `theme_color` and `background_color` that match the initial shell.
- PNG icons at 192×192 and 512×512.
- A maskable icon only after confirming that important artwork stays inside the maskable safe zone.

Keep document `<meta name="theme-color">` synchronized with the manifest or current theme behavior. Do not fabricate screenshots or shortcuts merely to satisfy an audit.

## Nginx requirements

The existing regex location gives `.js` files a one-year immutable cache. Add an exact service-worker location so `sw.js` bypasses that rule. Use a shape equivalent to:

```nginx
location = /${PROJECT_ROOT}/sw.js {
    add_header Cache-Control "no-store";
    add_header X-Content-Type-Options "nosniff";
    try_files $uri =404;
}
```

Add an exact manifest location with the correct manifest media type and a non-immutable cache policy. The worker already defaults to the directory containing `sw.js`; add `Service-Worker-Allowed` only for an intentional, reviewed broader scope. Keep the existing immutable rule for hashed build assets. Version icon filenames or give mutable icon filenames a separate policy.

## Acceptance boundary

A successful build is necessary but insufficient. Verify the served production artifact:

- secure origin and trusted certificate;
- manifest URL, MIME, parsed fields, and icon dimensions;
- for offline-shell capability, worker script MIME, scope, activation, and update behavior;
- installation and standalone launch;
- online login/token refresh and Code Registry iframe behavior;
- for offline-shell capability, cache contents and absence of protected API responses;
- when durable local state is requested, IndexedDB hydration, transaction failure handling, and requested close/reopen or restart persistence;
- deep-link navigation through nginx;
- offline behavior matching the written product promise.

Call the result “installable with an offline shell” if only static UI can launch. Call it “offline-capable” only after business-data persistence, mutations, synchronization, conflict handling, and device data protection have all been designed and tested.
