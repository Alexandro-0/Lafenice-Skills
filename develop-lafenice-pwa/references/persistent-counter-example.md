# Persistent counter standalone PWA example

Use this reference to reproduce the `pwa-dev` pattern: one public Code Registry page that installs as a PWA, launches offline, and preserves a counter after refresh, app termination, and normal device restart.

## Contents

- [Resource layout](#resource-layout)
- [Build sequence](#build-sequence)
- [IndexedDB state pattern](#indexeddb-state-pattern)
- [Service worker pattern](#service-worker-pattern)
- [Deployment and acceptance](#deployment-and-acceptance)

## Resource layout

Use one stable identity for every resource. The example identity is `pwa-dev`; replace it consistently for another plugin.

| Resource | Example | Required behavior |
| --- | --- | --- |
| Code Registry module | `pwa_dev_app` | Reviewed Python dispatcher serving only this PWA's resources |
| Gateway endpoint | `pwa-dev` | Public `GET`; narrow plugin namespace |
| App | `/<PROJECT_ROOT>/api/pwa-dev/app` | HTML page and direct install URL |
| Manifest | `.../pwa-dev/manifest` | `application/manifest+json`, relative scope/start URL |
| Worker | `.../pwa-dev/sw` | JavaScript, `no-store`, narrow worker scope |
| Icons | `.../pwa-dev/icon-192`, `icon-512` | Real PNG bytes with correct dimensions |
| Local database | `pwa-dev-pwa-state` | IndexedDB schema owned only by this plugin |
| Shell cache | `pwa-dev-shell-v<N>` | Cache Storage for static responses only |

Keep all browser URLs relative (`./manifest`, `./sw`, `./icon-192`) so the same implementation can run under another project root. Do not register a worker above `/<PROJECT_ROOT>/api/pwa-dev/`.

## Build sequence

1. Follow the connection, edit-access, Code Registry, Gateway, Access Control, localization, and export gates in the LaFenice plugin skills. Read `develop-plugin-code` and its Python runtime contract before creating the dispatcher. Explicitly authenticate with the authorized AI account and verify the `ai` role before writing.
2. Read the latest remote version of the target module, its validation contract, the current Gateway route, and overlapping menu routes. Preserve unrelated resources.
3. Create one reviewed Python Code Registry module that dispatches only `app`, `manifest`, `sw`, `icon-192`, and `icon-512`. Reject or return `404` for other resource names.
4. Return exact media and cache headers:
   - app: `text/html; charset=utf-8`, `no-cache`;
   - manifest: `application/manifest+json`, `no-cache`;
   - worker: `application/javascript`, `no-store`, and `X-Content-Type-Options: nosniff`; add `Service-Worker-Allowed` only if a reviewed design intentionally broadens the default worker-directory scope;
   - icons: `image/png`; immutable caching is acceptable only when the bytes or URL are versioned.
5. Embed or otherwise retain exportable icon bytes with the plugin. Do not assume uploaded file storage will be included in a normal plugin export.
6. Build the HTML as a self-contained page. Link the manifest and icons relatively, register `./sw`, expose network/standalone/worker state, and show a user-controlled service-worker update action.
7. Keep the counter controls disabled until IndexedDB hydration succeeds. Show `loading`, `saved`, and storage-error states in an `aria-live` status element.
8. Materialize one narrow public `GET` Gateway route tagged with the same plugin identity. Add the optional App Shell menu route separately; installation must be tested from the direct top-level app URL, not from the iframe.

The manifest baseline is:

```json
{
  "name": "LaFenice PWA Dev",
  "short_name": "PWA Dev",
  "start_url": "./app",
  "scope": "./",
  "display": "standalone",
  "theme_color": "#4f46e5",
  "background_color": "#f8fafc",
  "icons": [
    { "src": "./icon-192", "sizes": "192x192", "type": "image/png" },
    { "src": "./icon-512", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## IndexedDB state pattern

Cache Storage preserves the offline shell; it does not preserve application variables. Use a stable, versioned IndexedDB database and a small key-value object store.

```js
const DB_NAME = "pwa-dev-pwa-state";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const COUNTER_KEY = "counter";

let database = null;
let count = 0;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      database = request.result;
      database.onversionchange = () => {
        database.close();
        database = null;
        disableCounterControls();
        showStorageError("資料庫版本已變更，請重新開啟應用程式。");
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => showStorageError("請關閉其他 PWA 分頁後重試。");
  });
}

function readCounter() {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(COUNTER_KEY);
    request.onsuccess = () => {
      const record = request.result;
      resolve(record && Number.isFinite(record.value) ? record.value : 0);
    };
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function changeCounter(delta) {
  disableCounterControls();
  return new Promise((resolve, reject) => {
    let nextValue;
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(COUNTER_KEY);
    request.onsuccess = () => {
      const record = request.result;
      const current = record && Number.isFinite(record.value) ? record.value : 0;
      nextValue = current + delta;
      store.put({ key: COUNTER_KEY, value: nextValue, updatedAt: Date.now() });
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => resolve(nextValue);
    transaction.onabort = () => reject(transaction.error || request.error);
  }).then((savedValue) => {
    count = savedValue;
    renderCounter(count);
    enableCounterControls();
    showSavedState();
  }).catch(() => {
    disableCounterControls();
    showStorageError("保存失敗，請重新開啟應用程式後再試。");
  });
}

async function hydrateCounter() {
  disableCounterControls();
  await openDatabase();
  count = await readCounter();
  renderCounter(count);
  enableCounterControls();
  showLoadedState();
}
```

Keep the read and write in the same `readwrite` transaction so two app contexts cannot overwrite each other from stale page memory. Update the visible count only after `transaction.oncomplete`. Never fall back silently to an in-memory counter when persistence fails.

## Service worker pattern

Keep shell cache versioning independent from the IndexedDB schema. Activation may delete old `pwa-dev-shell-*` caches but must never delete `pwa-dev-pwa-state`.

```js
const CACHE_NAME = "pwa-dev-shell-v1";
const CACHE_PREFIX = "pwa-dev-shell-";
const ASSETS = ["./app", "./manifest", "./icon-192", "./icon-512"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const resource = url.pathname.slice(scope.pathname.length);
  if (!["app", "manifest", "icon-192", "icon-512"].includes(resource)) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
```

Do not call `skipWaiting()` unconditionally. When a new worker reaches `installed` while a controller exists, show an update button; send `SKIP_WAITING` only after the user accepts, then reload once on `controllerchange`.

## Deployment and acceptance

Create a new Code Registry version, require `validation.ok`, execute the version-test endpoint, and then test every materialized Gateway resource. Read the saved latest version back and compare its content with the intended source.

Use this minimum acceptance matrix:

| Test | Expected result |
| --- | --- |
| Direct app URL over trusted HTTPS | Page loads with no console/MIME error |
| Manifest and icons | Relative URLs resolve; PNG dimensions are correct |
| Worker | Scope is exactly the plugin path; script is `no-store` |
| First hydration | Counter buttons stay disabled until the stored value is read |
| Transaction | Set a non-zero value; UI reports saved only after commit |
| Reload twice | The same non-zero value is loaded both times |
| Worker update | Accept the prompt; the value remains after controller reload |
| Close/reopen | Close the app or tab and open the direct URL; the value remains |
| Offline relaunch | Cached shell opens and the IndexedDB value remains |
| Device restart when requested | Restart the target device and reopen the installed app |
| Storage failure | Denied/quota/blocked errors are visible; controls do not claim success |
| Authentication boundary | No LaFenice token, cookie, or App Shell storage is read or cached |

Return the direct install URL, the deployed Code Registry version identifier, verified tests, and precise limitations. State that clearing site data, storage eviction, or uninstall may remove IndexedDB data; do not describe local-only persistence as offline server synchronization.
