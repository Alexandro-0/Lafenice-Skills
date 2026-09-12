# LaFenice production Python runtime contract

## Contents

1. Authority and compatibility rules
2. Runtime package catalog
3. Import restrictions
4. MongoDB access decision
5. Tenant request context and backward compatibility
6. `ApiController` contract
7. `mongo_access` contract
8. `cache_map` contract
9. External services and secrets
10. Code Registry save and test rules
11. Production examples

## Authority and compatibility rules

Use this contract when writing a Python Code Registry module without application source access. Do not inspect a repository, container, filesystem, database configuration, or installed package directory.

The versions below are the baseline paired with this skill bundle. They are not permission to use undocumented packages, install packages, run `pip`, open a shell, or modify the deployment. Record the confirmed `/ping` version in the requirements document. If a documented import fails on the deployed system, stop, preserve the prior working version, and record a deployment compatibility problem; do not probe arbitrary imports in production.

Prefer platform interfaces over raw libraries:

1. Use MDC plus Generate Code for conventional CRUD/history.
2. Use `services.api_controller.ApiController` for custom CRUD that still fits its contract.
3. Use `mongo_access` only for aggregation or data behavior that `ApiController` cannot express.
4. Use `cache_map` only for bounded, non-sensitive, tenant-neutral values whose loss or duplication cannot affect correctness.
5. Use a declared third-party package only for a requirement that cannot be met by a platform interface.

## Runtime package catalog

These packages are installed in the baseline backend runtime:

| Import/package | Baseline version | Plugin use |
| --- | ---: | --- |
| `fastapi` | `0.136.3` | `HTTPException` or response classes when a tuple/dict is insufficient. Do not create another router or application. |
| `bcrypt` | `4.3.0` | Application-specific hashing only. Never process LaFenice account passwords. |
| `boto3` | `1.43.27` | Explicitly requested AWS integration. Obtain configuration from plugin App Env; never embed credentials. |
| `cryptography` | `48.0.1` | Explicit application cryptography. Do not mint or alter LaFenice authentication material. |
| `paho.mqtt` | `2.1.0` | MQTT client functions. Prefer the platform `mqtt_access` helper. |
| `jwt` (`PyJWT`) | `2.13.0` | External application JWTs only. Do not decode LaFenice JWTs for authorization; trust the handler's `uid` and `roles`. |
| `pymongo` | `4.17.0` | Available transitively, but prefer `ApiController` and `mongo_access`. |
| `multipart` | `0.0.31` | Server multipart support. Plugin handlers should normally use the platform Files API instead. |
| `dotenv` | `1.2.2` | Installed for the host, but plugin code must not load deployment `.env` files. Use App Env. |
| `redis` | `7.1.0` | Explicit external Redis/Valkey integration only; use bounded timeouts and App Env configuration. |
| `requests` | `2.34.2` | Synchronous outbound HTTPS. Always set a finite timeout and keep TLS verification enabled. |
| `uvicorn` | `0.38.0` | Host server runtime. Never start a nested server from plugin code. |
| `websockets` | `13.1` | Explicit bounded asynchronous WebSocket client work. Do not keep an unbounded connection inside an HTTP handler. |
| `croniter` | `6.0.0` | Cron calculation only. Create actual jobs through the Scheduler API. |
| `tzdata` | `2026.2` | Timezone data consumed through standard-library `zoneinfo`. |

Common standard-library imports such as `typing`, `json`, `re`, `math`, `decimal`, `datetime`, `zoneinfo`, `collections`, `copy`, `hashlib`, `hmac`, `base64`, `urllib.parse`, and `traceback` are available unless the deployment reports them as blocked. Do not assume any unlisted third-party package exists.

Package availability is not the same as authorization. Every handler must enforce authentication, roles, field access, resource ownership, input bounds, and safe error responses.

## Import restrictions

The baseline Code Registry rejects direct imports whose root module is:

```text
os, subprocess, socket, shutil, pathlib, sys
```

This blocked set is deployment-configurable and may be larger. Before changing an existing Python module, read its latest version and inspect:

```text
item.validation.blocked_imports
```

The response from saving a valid version also includes this validation field. If the deployment rejects an import with `Code imports blocked modules: ...`, remove the dependency or stop and document the incompatibility. Never evade validation with `__import__`, `importlib`, `eval`, `exec`, a transitive wrapper, encoded source, or another dynamic-loading technique.

The restriction also means plugin code must not:

- read environment variables or `.env` files directly;
- execute commands or create subprocesses;
- access container files or arbitrary filesystem paths;
- open raw sockets;
- modify Python paths or runtime internals.

Use App Env for configuration, `requests` for approved outbound HTTPS, `mqtt_access` for MQTT, and database helpers for MongoDB.

## MongoDB access decision

### Conventional CRUD

Use `ApiController`. It provides business `id` values, timestamps, query filters, unique-string validation, safe targeted update/delete, and operation history.

### Aggregation or specialized reads

Use the narrowest `mongo_access` functions needed. Construct collection names and aggregation pipelines in code from the accepted requirements. Never accept a collection name, raw MongoDB query, `$where`, aggregation stage, projection, or sort field directly from an untrusted request.

### Specialized writes

Prefer `ApiController`. Direct helpers bypass collection/field access rules and may bypass the expected history record. Use them only when the requirements explicitly need behavior unavailable in `ApiController`; enforce roles and ownership first, target exactly one resource, remove protected fields, and create the required audit/history record.

Never hardcode or accept a MongoDB URI/database name. Use the deployment-owned connection only:

```python
from mongo_access import create_mongo_client, get_database

db = get_database(create_mongo_client())
```

This `mongo_access.py` connection pattern is necessary, but it is **not** a tenant-isolation API. `create_mongo_client()` and `get_database()` only select the deployment-owned client and database. The returned `db` is a normal PyMongo `Database`; neither `db[collection]` nor a collection returned by `get_collection()` is wrapped with tenant policy. Tenant enforcement happens only when code calls `ApiController` or one of the explicitly scoped `mongo_access` operation helpers documented below.

Do not return MongoDB `_id` values or expose internal collections.

## Tenant request context and backward compatibility

For an MDC config with `tenant_mode: required`, API Gateway authenticates the JWT or API key and binds a server-owned request context while the handler runs. Tenants are global workspaces rather than plugin-owned records. The platform resolves the collection config, verifies the active tenant is active and assigned to the caller, then applies its `tenant_id` through `ApiController` and the scoped `mongo_access` document helpers. The collection plugin remains metadata and an independent role/access boundary; it is not part of tenant authorization.

Do not decode the LaFenice JWT, accept `tenant_id` from query/body as a scope selector, or implement role-based tenant bypass. `tenant_id` is server-managed: scoped creates overwrite a supplied value, scoped updates cannot change it, and reads/updates/deletes must use the active tenant even when the caller knows another record id. `super` can choose any active tenant but must still choose one before using a required collection. An API key has one fixed tenant and cannot switch.

Existing standard generated Python modules do not need regeneration solely for multi-tenancy when they:

- execute through API Gateway;
- import the deployed `services.api_controller.ApiController` or scoped `mongo_access` helpers rather than copying them;
- access the configured MDC main/history collections only through those interfaces;
- complete the operation within the bound Gateway request.

The imported core is resolved at runtime, so existing standard CRUD/history source receives current scoping. Code Registry Preview also binds the authenticated request context in the current core. Generate Code is required only for a needed generated-source/template behavior, not for the isolation boundary itself; it creates a new latest version and can overwrite customized source.

Automatic scoping covers `list_documents`, `get_document*`, `create_document`, `update_document*`, `delete_document`, and `aggregate_documents`. Raw `get_collection()` and raw `pymongo` collection calls are unscoped. A copied controller/helper, direct/non-Gateway endpoint, or Scheduler/MQTT/startup/queue/background operation also lacks the normal compatibility guarantee. Do not guess a context binder or pass a user-controlled tenant id to these paths: preserve the working version and require an approved server-bounded tenant execution design.

### Why raw PyMongo silently disables the tenant architecture

`tenant_mode: required` is metadata consumed by the LaFenice data-access layer; it is not MongoDB row-level security and does not modify PyMongo itself. Gateway binding an authenticated request context only makes the verified `active_tenant_id` available to the core helpers. A helper must still be called for that context to become a MongoDB predicate or a stored `tenant_id`.

The following code is therefore **not tenant-safe**, even though it imports from `mongo_access` and runs through an authenticated Gateway route:

```python
from mongo_access import create_mongo_client, get_database

DB = get_database(create_mongo_client())
COLLECTION = "contracts"


def find_singleton():
    return DB[COLLECTION].find_one({"deployment_key": "current"})


def create_singleton(document):
    DB[COLLECTION].insert_one(document)
```

The import only obtains the database connection. `find_one()` receives no tenant predicate, and `insert_one()` receives no server-owned `tenant_id`. Adding `tenant_mode: required` to the collection config cannot repair those raw calls.

The consequences apply to every operation, not only list queries:

- Raw `.find()` / `.find_one()` can return another tenant's records. A query such as `{}` or a global-looking singleton key returns the same record to every tenant.
- Raw `.aggregate()` does not prepend the active tenant `$match`, so totals, joins, exports, reports, and existence checks can combine tenants.
- Raw `.insert_one()` / `.insert_many()` do not inject the active tenant. The row can be unscoped, assigned to a caller-supplied tenant, migrated into an unintended Legacy tenant later, or become invisible through the correct scoped API.
- Raw `.update_*()` / `.replace_one()` / `.find_one_and_update()` and `.delete_*()` do not constrain their target to the active tenant. Knowing or colliding with another tenant's business id can modify or delete that tenant's data.
- Singleton checks, idempotency keys, sequence allocation, uniqueness checks, locks, history, and audit lookups become deployment-global unless their own tenant-aware storage design is enforced. One tenant can block, replay, overwrite, or observe another tenant's operation.
- Adding `tenant_id` from query parameters or request bodies is not a fix. That changes a server-owned authorization boundary into a client-controlled selector and enables deliberate cross-tenant access.

For conventional CRUD, delegate the operation to `ApiController`. For specialized reads or writes that fit the documented helper contract, call the operation helpers themselves:

```python
from mongo_access import (
    create_document,
    create_mongo_client,
    get_database,
    get_document_by_query,
    update_document_by_query,
)

DB = get_database(create_mongo_client())
COLLECTION = "contracts"


def find_singleton():
    # For a required MDC collection, the core combines this query with the
    # authenticated request's active tenant_id.
    return get_document_by_query(
        DB,
        COLLECTION,
        {"deployment_key": "current"},
    )


def create_singleton(document):
    # The core overwrites any supplied tenant_id with the verified active tenant.
    return create_document(DB, COLLECTION, document)


def update_singleton(changes):
    # Both lookup and mutation stay inside the verified active tenant.
    return update_document_by_query(
        DB,
        COLLECTION,
        {"deployment_key": "current"},
        changes,
    )
```

This protection applies only while an authenticated Gateway request context is bound and only when the target main/history collection resolves to an MDC config in required mode. A custom audit, lock, idempotency, counter, or side collection is not automatically tenant-owned merely because the business collection is. Use the standard `ApiController` history path where possible. Otherwise, stop and obtain an approved server-bounded tenant execution/storage design that covers the side collection, compound indexes, transactions, and every read/write path; do not copy internal context logic or invent a client-controlled tenant filter.

Code review must trace each data operation, not merely inspect imports. Treat any of these patterns as an automatic tenant-isolation finding until proven safe by an approved design:

```text
DB[...].find / find_one / aggregate
DB[...].insert_one / insert_many
DB[...].update_* / replace_one / find_one_and_update
DB[...].delete_* / find_one_and_delete
get_collection(...).<any direct collection method>
```

Before enabling required mode for custom plugin code, audit raw `.find`, `.aggregate`, `.insert_one`, `.update_*`, and `.delete_*` calls, copied data-access code, custom stores, and background triggers. Validate with two global tenants: known foreign ids and forged `tenant_id` values must fail for list/get/create/update/delete, history, reference display, unique constraints, and private files. Also verify one active tenant scopes required MDC collections from different plugins while their role/access rules remain independent, then test no active tenant, super selection, and Legacy-tenant visibility for migrated records.

## `ApiController` contract

Import:

```python
from services.api_controller import ApiController
```

Constructor:

```python
controller = ApiController(
    collection_name="orders",
    unique_key="order_no",              # optional string field
    history_collection_name="orders_history",  # optional
)
```

Supported methods return `(status_code, body)`:

```python
controller.get(query_params, resource_id=resource_id)
controller.post(payload, uid=uid)
controller.patch(payload, uid=uid, resource_id=resource_id, query_param=query_params)
controller.delete(uid=uid, resource_id=resource_id, query_param=query_params)
controller.handle(
    method=method,
    query_params=query_params,
    resource_id=resource_id,
    payload=payload,
    uid=uid,
)
```

List queries support equality, comma-separated `$in`, `@contains`, `@startswith`, `@endswith`, `@regex`, `@gt`, `@gte`, `@lt`, `@lte`, `@eq`, `@ne`, `@between`, `offset`, `limit`, `sort`, and `direction`.

`POST`, `PATCH`, and `DELETE` create history rows containing operation, collection name, document id, uid, original data, payload, data after, and timestamps. For a required MDC collection, the controller scopes reads/writes/history and generated unique keys to the active tenant and validates that referenced files belong to it. `ApiController` does not implement product-specific role or field rules: apply those before passing data to it, and filter response fields afterward.

## `mongo_access` contract

Supported internal imports:

```python
from mongo_access import (
    aggregate_documents,
    build_query,
    create_document,
    create_mongo_client,
    delete_document,
    get_database,
    get_document,
    get_document_by_query,
    list_documents,
    update_document,
    update_document_by_query,
)
```

| Function | Contract |
| --- | --- |
| `create_mongo_client()` | Connect with deployment-owned configuration. Never pass a custom URI. |
| `get_database(client)` | Select the deployment-owned database. Never pass a custom database name. |
| `list_documents(db, collection, query_params, projection=None)` | Query with the same supported operators as `ApiController`; maximum runtime limit is 50,000, but plugins should set a much smaller bound. Applies required MDC tenant scope. |
| `aggregate_documents(db, collection, pipeline, hide_mongo_id=True)` | Run a fixed/bounded aggregation, prepend required MDC tenant match, and hide `_id` by default. Always include a practical `$limit`. |
| `get_document(db, collection, document_id, projection=None)` | Read one document by business `id`, scoped for required MDC. |
| `get_document_by_query(db, collection, query, projection=None)` | Read one document by a code-constructed query, scoped for required MDC. |
| `create_document(db, collection, data)` | Insert and add business `id` plus created/updated timestamps. For required MDC, overwrites `tenant_id` with the active tenant. Returns the business id. |
| `update_document(db, collection, document_id, data)` | `$set` one document by business `id`; ignores supplied `id`/`_id`, protects required MDC `tenant_id`, and updates timestamps. |
| `update_document_by_query(db, collection, query, data)` | `$set` one document matched by a code-constructed query; applies required MDC tenant scope and protects `tenant_id`. |
| `delete_document(db, collection, document_id)` | Delete one document by business `id`, scoped for required MDC. |
| `build_query(query_params)` | Convert supported HTTP-style filters into a Mongo query. Do not expose the resulting query for user modification. |

Do not use `drop_collection`, `list_collection_names`, unrestricted `get_collection`, or raw `pymongo` operations in ordinary plugin code. If an exceptional requirement truly needs raw collection access, record the reason, authorization, query bounds, audit behavior, and tests in the requirements document.

Do not classify a module as tenant-safe merely because it imports `mongo_access`, calls `create_mongo_client()` / `get_database()`, or executes behind an authenticated Gateway endpoint. Tenant safety is established only by tracing every main, history, audit, lock, idempotency, and related collection operation to `ApiController`, a documented scoped helper, or an explicitly approved server-bounded design, then verifying tenant A/B isolation through the routed endpoint.

## `cache_map` contract

`cache_map` is a small platform helper for best-effort, in-process reuse by Python Code Registry modules. Supported import:

```python
from cache_map import delete_cache_map, get_cache_map, update_cache_map
```

| Function | Contract |
| --- | --- |
| `get_cache_map(key)` | Return the value stored under `key`, or `None` when the key is absent. Do not store `None`, because callers cannot distinguish it from a miss. |
| `update_cache_map(key, value)` | Insert or replace one value in the current backend Python process. It does not replicate or persist the value. |
| `delete_cache_map(key)` | Remove one key. It raises `KeyError` when the key is absent, so idempotent invalidation must catch `KeyError`. |

Treat this helper as an optimization only:

- State is process-local. A restart, reload, deployment, or worker replacement loses it; multiple workers can contain different values. Every request must remain correct on a miss or stale/duplicated cache state.
- The map is shared by Code Registry modules running in the same process. Namespace every key with stable plugin and module identities plus a schema/version segment, for example `acme-feedback:summary-api:v2:public-schema`.
- There is no TTL, eviction policy, capacity limit, tenant scoping, role scoping, or persistence. Keep both the number of keys and value sizes bounded, and invalidate known keys when the owning module changes the underlying source.
- Cache only non-sensitive, tenant-neutral data that can be recomputed. Never store credentials, tokens, personal data, tenant/user-specific records, authorization decisions, mutable security policy, or secrets read from App Env.
- Do not use the map as a lock, counter, queue, idempotency/deduplication store, rate limiter, job state, or source of truth. Those uses require atomicity, durability, or cross-worker coordination that this helper does not provide.
- Retrieved mutable objects are shared references inside the process. Treat cached values as immutable or return a defensive copy before allowing caller code to modify them.

Example with a bounded, tenant-neutral schema value and explicit invalidation:

```python
from copy import deepcopy

from cache_map import delete_cache_map, get_cache_map, update_cache_map

CACHE_KEY = "acme-feedback:summary-api:v2:public-schema"


def get_public_schema() -> dict:
    cached = get_cache_map(CACHE_KEY)
    if cached is not None:
        return deepcopy(cached)

    value = {
        "fields": ["status", "category", "updated_at_format"],
        "schema_version": 2,
    }
    update_cache_map(CACHE_KEY, deepcopy(value))
    return value


def invalidate_public_schema() -> None:
    try:
        delete_cache_map(CACHE_KEY)
    except KeyError:
        pass
```

Record `cache_map` as a runtime dependency in the plugin requirements. After saving the module, verify a cold miss, a cache hit, idempotent invalidation, recomputation after invalidation, and the actual Gateway route. If materialization or activation returns `ModuleNotFoundError` for `cache_map`, preserve the prior working version and report a deployment compatibility mismatch; do not replace it with dynamic-import tricks or assume another worker exposes it.

## External services and secrets

Read plugin configuration with:

```python
from services.app_env import get_app_env_value

token = get_app_env_value("lafenice", "acme_feedback.partner_token")
```

Treat the returned value as secret: never log it, return it, include it in exception text, place it in a URL, or copy it into the plugin export. The App Env record must use the same plugin identity and is exported redacted by default.

For outbound HTTP with `requests`:

- use an HTTPS host approved in the requirement; never fetch an arbitrary URL supplied in a request;
- set explicit connect/read timeouts, for example `timeout=(3.05, 10)`;
- leave certificate verification enabled;
- bound response size and parse only the expected content type/shape;
- translate upstream failures into a stable, non-sensitive plugin error.

For MQTT, prefer:

```python
from mqtt_access import publish_message
```

For an authenticated operator module that monitors or restarts Code Registry
MQTT listeners, the supported manager interface is:

```python
from services.mqtt_listeners import (
    get_mqtt_listener_statuses,
    restart_mqtt_listener,
)
```

`get_mqtt_listener_statuses()` returns every currently registered Code Registry
module that declares `MQTT_LISTENER`, including disabled definitions.
`restart_mqtt_listener(module_key)` accepts a Code Registry module key and rejects
invalid, unregistered, or disabled modules. Do not construct or accept arbitrary
Python import paths in plugin requests. Restrict these operations to trusted
operator roles and keep the Gateway route authenticated.

Do not start a long-running subscriber inside a Gateway request. For Redis/Valkey, AWS, or WebSockets, require an explicit requirement, App Env configuration, bounded timeouts, and failure-mode tests.

## Code Registry save and test rules

Code Registry has no package-install or shell capability and no safe arbitrary-import discovery workflow. Do not create a throwaway module to enumerate packages.

Before saving:

1. Read the current module and latest version, including validation metadata.
2. Use only imports declared by this contract and allowed by `validation.blocked_imports`.
3. Preserve the complete prior content locally in memory for comparison; never persist credentials.
4. Verify handler signature, authorization, input bounds, timeouts, error shape, and plugin metadata.

After saving:

1. Inspect the returned `item.validation` and version id.
2. Call `POST /_code/modules/{module_key}/versions/{version_id}/test` with bounded representative inputs.
3. Call the actual Gateway route with the AI JWT and test authentication/authorization failures.
4. Read back the latest version and confirm the expected version remains active.

If activation returns `ModuleNotFoundError`, an import error, or a blocked-import error, do not retry with dynamic-import tricks and do not overwrite another module. Record the failure and deployment version in the requirements document.

## Production examples

### Bounded aggregation endpoint

```python
from typing import Any

from mongo_access import aggregate_documents, create_mongo_client, get_database

DB = get_database(create_mongo_client())
COLLECTION = "acme_orders"
VIEW_ROLES = {"admin", "ai", "acme-order-viewer"}


def handle(
    *,
    method: str,
    query_params: dict[str, Any],
    resource_id: str | None,
    payload: dict[str, Any],
    header: dict[str, str],
    uid: str | None,
    roles: list[str],
) -> tuple[int, dict[str, Any]]:
    actual_roles = {str(role).strip().lower() for role in roles}
    if not uid:
        return 401, {"error": {"code": "LOGIN_REQUIRED", "message": "Login required."}}
    if actual_roles.isdisjoint(VIEW_ROLES):
        return 403, {"error": {"code": "FORBIDDEN", "message": "Permission denied."}}
    if method != "GET":
        return 405, {"error": {"code": "METHOD_NOT_ALLOWED", "message": "GET is required."}}

    pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {"_id": "$currency", "count": {"$sum": 1}, "total": {"$sum": "$total"}}},
        {"$project": {"_id": 0, "currency": "$_id", "count": 1, "total": 1}},
        {"$sort": {"total": -1}},
        {"$limit": 100},
    ]
    items = aggregate_documents(DB, COLLECTION, pipeline)
    return 200, {"message": "success", "items": items}
```

Do not replace the fixed collection/pipeline with request-supplied MongoDB syntax.

### Bounded outbound HTTPS

```python
import requests

from services.app_env import get_app_env_value


def fetch_partner_status() -> dict:
    token = get_app_env_value("lafenice", "acme_feedback.partner_token")
    if not token:
        raise RuntimeError("Partner integration is not configured.")
    response = requests.get(
        "https://partner.example/api/status",
        headers={"Authorization": f"Bearer {token}"},
        timeout=(3.05, 10),
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict) or not isinstance(data.get("status"), str):
        raise RuntimeError("Partner response is invalid.")
    return {"status": data["status"]}
```

The actual handler must catch upstream exceptions and return a stable error without credentials, response bodies, or internal traces.
