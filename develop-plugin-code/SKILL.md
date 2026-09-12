---
name: develop-plugin-code
description: 在無法查看 LaFenice backend/frontend source code 的 production 環境中，依照自包含的 Python package、MongoDB helper、import restriction 與 HTML runtime contract，透過部署系統的 Code Registry API 建立、讀取、修改與測試同一 product plugin 的進階程式碼模組。Use when Codex must develop plugin Python handlers, iframe HTML pages, integrations, advanced MDC behavior, collection history APIs, or specialized pages using only the bundled runtime contracts and the deployed URL. Require the exact project URL and role-ai account/password before development.
---

# 開發 Plugin 程式碼

## 強制連線前置條件

開始分析或撰寫程式碼前，必須已由 `get-plugin-edit-access` 確認使用者明確提供的專案 URL 與 role: `ai` 帳號密碼，完成 RSA-OAEP-256 加密登入，並確認 `/auth-me` 包含 `ai`；缺少任一項就先詢問並停止。不得套用 localhost、API Key、預設帳密或其他環境的憑證。

使用加密登入取得的 AI JWT 讀寫 `/_code/...`、設定 Gateway，並驗證 protected runtime Gateway endpoint。access/refresh tokens 只保存在目前程序的記憶體中，不另向使用者索取 API Key 或其他 JWT。

## 使用範疇

用這個 skill 開發 LaFenice plugin 的 API 與 HTML code module。此情境假設 agent 無法查看 application repository、backend/frontend source、container、build 產物、deployment files 或資料庫；所有讀寫都必須經由使用者提供 URL 上的 LaFenice API 完成。

適用任務：

- 讀取或修改 Code Registry 內既有 `py` / `html` module。
- 新增 plugin API handler、iframe HTML page，或更新它們的 Gateway endpoint。
- 依照 metadata-driven collection 建立 CRUD API 與管理頁。
- 寫入 collection/page 需要的 Language Pack 語系。
- 補上 `source_code_endpoint.history_api` 與 `history_page` 對應的歷史紀錄查詢 API 與網頁。

若只是建立或調整 collection metadata，優先使用 `manage-metadata-driven-collection`。若缺少 URL、role: `ai` 帳號密碼、JWT session 或權限資訊，先使用 `get-plugin-edit-access`。

## 核心規則

- 一律以 API 為主：`/_code/modules`、`/_code/modules/{module_key}/versions`、`/collection-config`、`/language-pack`、必要時 `/_gateway/config/routes/{endpoint}/{method}`。
- API base 只能使用前置檢查確認的值，不設定 localhost 預設值。
- Code Registry 讀寫使用已驗證的 AI JWT。不要把帳號密碼、password ciphertext、JWT 或任何 secret 寫入檔案、log、commit 或 final response。
- 先用 Generate Code 建立常規基線。進階需求優先新增同一 `plugin` 的 companion module；若必須修改 generated module，先重新產碼再儲存自訂新版本，並記錄之後再次 Generate Code 會覆蓋最新自訂版本。
- 一旦 generated module 已有自訂版本，不要再把 Generate Code 當成無害同步。若 metadata 變更確實需要重產，先保存 latest content 與自訂差異，重產基線後重新套用、儲存並完整回歸測試。
- 不得只為 `tenant_mode: required` 重產既有標準 module。經 Gateway 執行並 import deployment `ApiController` / scoped `mongo_access` 的既有 source 會取得 core tenant enforcement；只有 runtime contract 列出的 compatibility gap 或新版 inline template 行為才需要更新。
- `module_key` 必須小寫、英數與底線，且以小寫字母開頭；Gateway endpoint 可用連字號。預設 endpoint 會由 `module_key` 的 `_` 轉成 `-`。
- Python module 儲存後會由 deployed runtime 發布並註冊 Gateway；HTML module 儲存後會註冊 `GET /{endpoint}`，App Shell 以 iframe 呈現。
- 對 metadata collection，`source_code_endpoint` 的 `api` / `page` / `history_api` / `history_page` 是 endpoint 名稱，不是完整 URL。

## 客製化首頁的明確確認門檻

`lfx_customize_landing_page` 是用來取代整個 App Shell 原生首頁 `/` 的保留 Gateway endpoint，不是一般 plugin HTML page。當開發者認為需求適合使用客製化首頁時，在設計、建立或更新對應 HTML module 與 Gateway route 之前，**一定要先直接詢問使用者是否確定要以客製化 HTML 取代原生首頁，並等待使用者明確同意**。一般的 plugin 開發授權、建立 HTML page 的要求，或 agent 自己判斷 landing page 較合適，都不能代替這次確認。

使用者未明確同意、拒絕或回覆仍有歧義時，不得建立、更新或啟用 `lfx_customize_landing_page`；保留原生首頁，並把功能做成一般 plugin page 與 menu route。即使部署環境已存在同名 module 或 endpoint，也要先確認才能修改或重新啟用。

取得明確同意後，依下列 contract 實作：

- 建立啟用中的 HTML Code Registry module，建議 module key 使用 `lfx_customize_landing_page`。
- Gateway 必須提供完全相同名稱的 `GET lfx_customize_landing_page`（含底線）；自動產生的 `lfx-customize-landing-page` 連字號 endpoint 不能取代它。
- 首頁會在檢查期間顯示 loading；endpoint 成功回傳 HTML 時，以 iframe 顯示內容；endpoint 不存在、請求失敗或回傳內容不是 HTML 時，fallback 至原生首頁。
- 依頁面是否允許未登入瀏覽設定 Gateway authentication，並遵守本 skill 的 HTML runtime context、主題、語系與 token 安全規範。

## 使用內建 production contract

本 skill 以下各節就是實作所需的自包含 runtime contract；搭配 `build-lafenice-plugin/references/plugin-contract.md` 使用。任何 Python module 在設計或修改前，都必須完整閱讀 [references/python-runtime-contract.md](references/python-runtime-contract.md)，並且只使用其中列出的 baseline packages、platform helpers 與 import rules。不要要求 application repository、額外 backend/frontend 文件、container shell、source map 或資料庫存取。如果 deployed endpoint、payload、package 或 response 與 contract 不相容，停止該能力的寫入並把實際 HTTP status、非敏感 response shape 與相容性問題記入需求文件，不要猜測內部檔案、嘗試安裝套件或繞過 API/import guardrail。

## API 端規範

Python Code Registry module 必須提供同名 handler contract：

```python
from typing import Any

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
    ...
```

可回傳 `dict`、`(status_code, dict)`，或 FastAPI/Starlette response。一般 CRUD 使用 `services.api_controller.ApiController`，它會處理 MongoDB CRUD、`created_at` / `updated_at` 欄位、`unique_key` 檢查與 history collection 寫入。只有 aggregation 或 `ApiController` 無法表達的資料行為才使用 runtime contract 中的 `mongo_access`；不得硬編 Mongo URI/database、接受使用者傳入的 collection/pipeline，或以 raw `pymongo` 繞過 access/history 規則。

只有非敏感、tenant-neutral、可隨時重建且不影響正確性的暫存值，才可使用 runtime contract 中的 `cache_map`。它是 process-local 的 best-effort 記憶體快取，不提供 TTL、容量限制、持久化、跨 worker 同步或安全隔離；完整 API、key namespace、失效處理與測試要求依 [references/python-runtime-contract.md](references/python-runtime-contract.md) 的 `cache_map` 章節。

Tenant-required MDC 的 scope 由 Gateway authenticated request context 與 core helpers 套用。Plugin 不得 decode LaFenice JWT、不得把 `tenant_id` 當 query/body selector、不得信任 client-supplied tenant id，也不得自行實作 privileged-role bypass。Raw collection access、copied helpers、non-Gateway routes 與 background execution 都不在自動相容範圍；完整決策與驗證矩陣依 [references/python-runtime-contract.md](references/python-runtime-contract.md) 的 tenant 章節。

**重要：只從 `mongo_access.py` import `create_mongo_client` / `get_database` 並不代表已使用 `mongo_access` 的 tenant 保護。** 這兩個 function 只提供 deployment-owned MongoDB 連線；後續對 `DB[collection]` 或 `get_collection()` 呼叫 `.find()`、`.aggregate()`、`.insert_one()`、`.update_*()` 或 `.delete_*()` 仍是 unscoped raw PyMongo，不會讀取 active tenant，也不會因 collection 設了 `tenant_mode: required` 就自動補上 `tenant_id`。此錯誤會使 list/singleton 讀取混用所有 tenants、create 寫入無 tenant 資料，並使 update/delete/history/idempotency 發生跨 tenant 命中。一般 CRUD 必須使用 `ApiController`；特殊讀寫必須呼叫 tenant-aware `mongo_access` document/aggregation helpers，而不是只用它建立連線。詳細錯誤／正確範例見 runtime contract。

Metadata-driven collection API 的建議做法：

1. 以 collection key 作為 business collection 名稱。
2. 用 `ApiController(collection_name=key, unique_key=<第一個 unique 欄位或 None>, history_collection_name=f"{key}_history")`。
3. `GET` list response 必須把 collection config 物件直接放在 `metadata`，而不是把 `ApiController.get()` 的 `(status, body)` tuple 塞進去。
4. 套用 collection/field access；UI 隱藏不是安全邊界。
5. has-many detail API 要在 server side 套用 locked foreign key，並拒絕使用者送入不同值。
6. has-many detail relation must use `master_col_id` as the system-owned foreign key; do not reuse a business column such as currency, status, or document number for the master-detail back reference.
7. Generated pages use `ui.list.columns` for table/list presentation only. New/Edit forms use all UI-visible, role-readable `metadata.columns`, and single-record responses must include those readable form fields. Do not enforce list hiding in backend POST/PATCH; field access remains the security boundary.
8. HTML 欄位只接受 `div_style_only` profile；若 sanitizer 尚未存在，API 應拒絕 HTML 寫入或只讀呈現。
9. Detail `GET` 必須把 query 中的 `master_col_id` 當作受控 relation context 套用 filter，並保留 collection `metadata`；若 baseline controller 拒絕這個 system query，wrapper 應先取出並驗證 context，再用 `ApiController` 可接受的 query 執行 bounded 查詢與回傳相同 response contract。
10. Detail `POST` / `PATCH` 必須正規化 query 與 payload 的 relation context：兩者都有時必須相等；只有一個時接受並在 delegation 前補齊；兩者皆無或彼此衝突時回 `422`。HTML page 的 write URL 與 payload 都必須帶 locked `master_col_id`；只有頁面 URL 有有效 master context 時才啟用 Create，直接開啟 detail list 時必須停用 Create 或要求先選 master。
11. Generated form 可能把未填的選填欄位送成 `null` 或空字串。驗證器必須依 metadata 的 `required` 處理：選填 number/date/datetime/reference/string 的空值視為未提供；必填欄位仍拒絕空值。規則必須由 metadata 驅動，不得綁特定 collection 或欄位名稱。

### 擴充既有 handler 的安全規則

若以 wrapper 擴充 latest generated handler，而不是建立 companion module：

- 每一版使用唯一、版本化的 marker 與全域符號，例如 `_previous_handle_master_filter_v2`、`_handle_master_filter_v2`；不要重用 `_previous_handle`、`_business_handle` 等通用名稱。
- latest content 可能已包含前一層 wrapper。新版本只捕捉「目前的 `handle`」一次並綁到唯一名稱，再讓新的 `handle` 呼叫它；不得讓較早 wrapper 的 global lookup 被新賦值覆寫，否則可能形成遞迴與 runtime `500`。
- 更新腳本必須可判斷自己的唯一 marker，避免同一 patch 重複附加。不要只靠字串中存在 `def handle` 判斷。
- Code Registry 的 `validation.ok` 只證明該版本通過當下的靜態/import 驗證，不證明 Gateway route 執行正確。每次儲存後都要測 version test 與實際 routed endpoint，至少涵蓋被攔截的分支和 delegated baseline 分支，並確認沒有 recursion/`500`。

Master-detail write 驗收矩陣必須同時涵蓋 query-only、payload-only、query/payload 相同、query/payload 衝突、兩者皆缺；前三者應成功且持久化正確 `master_col_id`，後兩者應回 `422`。另外必須從 master row 的 relation link 進入實際 HTML page 建立一筆 detail，不能只用 version test 或直接 API 代替 UI 驗收。

必要時可先呼叫系統產碼：

```http
POST {ApiBase}/collection-config/generate-code
Authorization: Bearer <ai_access_token>
Content-Type: application/json

{"key": "orders"}
```

Generate Code 會依 collection 的 `generate` 設定產生常規基線：`data_management: true` 產生主 API 與主 page，`history: true` 產生 `history_api` 與 `history_page`。常規 CRUD/history 優先使用這四個 generated modules；只有需求超出生成能力時，才以同一 `plugin` 的 companion module 或自訂新版本擴充。

## HTML 端規範

HTML Code Registry module 是被 App Shell 放進 iframe 的完整 HTML。不要假設可讀 parent DOM、React state 或 localStorage；要透過 `postMessage` 取得 runtime context。

基本流程：

1. 監聽 `lafenice:runtime-context`，取得 `apiBaseUrl`、`accessToken`、`roles`、`locale`、`messages`、完整 `languagePack`、`themeMode`、`theme`。
2. 載入後向 parent 發送 `{ type: "lafenice:runtime-context:request" }`。
3. 所有 API request 透過 runtime `apiBaseUrl` 與 Bearer token。
4. 語系優先使用 Language Pack，fallback 到 HTML 內建文字。
5. theme 使用 App Shell 傳入的 CSS token，不要寫死大面積不可切換的顏色。
6. Active tenant 切換會更新 access token；token 改變時清除 tenant-sensitive cache、取消/忽略舊 request 結果並重新載入。目前 token 不得與前一 tenant 的 records 混用。

### HTML 範例與表格版面基準

Metadata-driven collection page 的 HTML 版面與互動應以 repository 的
`LaFeniceBackend/code_templates/metadata_collection_page.html` 為基準；history page
則以同目錄的 `metadata_collection_history_page.html` 為基準。這些 template 是
MDC page 的 source of truth，若要自訂頁面，先沿用其 runtime context、theme token、
loading/error state、responsive layout 與安全的 DOM rendering，再加入 plugin-specific
功能。不要把 `build-lafenice-plugin/assets/` 內較舊的簡化 status page 當成 MDC CRUD
page 的完整範本；custom page 若不使用系統 helper，也必須把需要的 HTML、CSS 與
JavaScript 自包含在同一個 module 中。

表格必須保留可水平捲動的 wrapper，並使用 intrinsic width，避免欄位被壓縮：

```css
.table-wrap { width:100%; overflow:auto; }
table { width:max-content; min-width:720px; }
.updated-column {
  width:220px;
  min-width:220px;
  white-space:nowrap;
}
```

需求中所稱的 `update_at`，在 LaFenice 實際對應的是 `updated_at` /
`updated_at_format`。這些欄位顯示完整時間字串，不可設得過窄或套用
會截斷內容的固定寬度；依實際 locale 與格式保留足夠的 `min-width`。`table` 使用
`width:max-content`，由 `.table-wrap` 負責水平 overflow；不要用 `width:100%` 讓多欄
資料表被迫壓縮。若 history table 顯示 `created_at_format`，同樣要給時間欄位足夠的
最小寬度。

API helper 範式：

```js
async function apiRequest(path, init = {}) {
  const headers = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
  }
  const response = await fetch(
    `${state.apiBaseUrl}/${String(path).replace(/^\/+/, '')}`,
    { ...init, headers: { ...headers, ...init.headers } },
  )
  const text = await response.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch {}
  if (!response.ok) throw Object.assign(new Error(data.error?.message || data.detail || `Request failed (${response.status})`), { status: response.status, details: data.error || data })
  return data
}
```

Metadata collection CRUD page 使用：

```html
<meta name="collection-api-endpoint" content="orders-api">
```

`content` 是 Python business-data Gateway endpoint，不是 HTML module key、collection key、完整 URL 或 `.py` 檔名。

## 讀取程式碼

先由 collection config 或使用者需求確認 endpoint 與 module key。

```http
GET {ApiBase}/collection-config/{collection_key}
GET {ApiBase}/_code/modules/{module_key}
GET {ApiBase}/_code/modules/{module_key}/versions?include_content=true&sort=version&direction=desc&limit=1
GET {ApiBase}/_code/modules/{module_key}/versions/{version_id}?include_content=true
```

從 collection endpoint 推 module key 時，使用後端規則：將 endpoint 小寫，非 `[a-z0-9_]` 字元轉成 `_`，去頭尾 `_`，若不是字母開頭則補前綴，最多 64 字。例：`orders-api-history` 對應 `orders_api_history`。

讀到既有 code 後再修改；不要用空白模板覆蓋使用者既有版本。若 module 不存在，才建立新 module 或直接 `POST versions` 讓 `_ensure_module` 自動建立。

## 新增或修改 API 程式碼

建立或更新 Python module：

```http
POST {ApiBase}/_code/modules/{module_key}/versions
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

```json
{
  "message": "implement orders history API",
  "code_type": "py",
  "content": "<完整 Python handler 程式碼>",
  "group": "orders",
  "plugin": "sales",
  "gateway": {
    "endpoint": "orders-api-history",
    "methods": ["GET"],
    "auth_required": true,
    "plugin": "sales"
  }
}
```

`gateway.methods` 明確給 `["GET"]` 可以避免 history API 被自動註冊成 CRUD 全方法。若系統已註冊不需要的方法，可刪除：

```http
DELETE {ApiBase}/_gateway/config/routes/{endpoint}/POST
DELETE {ApiBase}/_gateway/config/routes/{endpoint}/PATCH
DELETE {ApiBase}/_gateway/config/routes/{endpoint}/DELETE
```

儲存 Python 後可用 test API 測試特定 version，但 save version 已是 latest：

```http
POST {ApiBase}/_code/modules/{module_key}/versions/{version_id}/test
```

Version test 用來驗證指定 source/version 的執行結果，但不要假設 request body 中自填的 `uid` 或 `roles` 一定能覆蓋 authenticated caller context；deployed version 可能仍以呼叫者 JWT 的角色為準。因此，不得只用 AI session 加上虛構 roles 就宣稱一般角色已通過 `403`/允許測試。需要角色矩陣時，使用使用者明確授權的實際測試帳號；若沒有帳號，就在 requirements 把該角色情境標為未驗證，不得呼叫 `/admin-users` 自行指派角色。

每次 version test 後再呼叫已 materialize 的 Gateway endpoint。測試至少涵蓋正常分支、validation error、授權失敗、wrapper delegated branch，以及修改過的 GET/POST/PATCH/DELETE；任何 `500` 都先讀回 latest content 檢查 wrapper symbol capture，不要只因 `validation.ok` 為 true 就繼續。

## 新增或修改 HTML 程式碼

建立或更新 HTML module：

```http
POST {ApiBase}/_code/modules/{module_key}/versions
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

```json
{
  "message": "implement orders history page",
  "code_type": "html",
  "content": "<!doctype html>...",
  "group": "orders",
  "plugin": "sales",
  "gateway": {
    "endpoint": "orders-page-history",
    "methods": ["GET"],
    "auth_required": false,
    "menu_key": "collection.orders.history",
    "menu_label": "訂單異動紀錄",
    "plugin": "sales"
  }
}
```

HTML 儲存後瀏覽器 route 通常是 `/{PROJECT_ROOT}/{endpoint}`，iframe source 是 `{apiBaseUrl}/{endpoint}`。HTML page 仍應由 runtime context 帶入 token 呼叫受保護的 API。

## 寫入 Language Pack

collection 與 HTML 顯示文字要寫入系統 Language Pack。讀取不需 auth，寫入需要 `admin` 或 `ai`。

常用 key：

- collection label：`collection.{collection_key}`。
- column label：`collection.{collection_key}.column.{column_key}`。
- relation label：`collection.{collection_key}.relation.{relation_key}`。
- option label：使用 metadata 內 `options[].label_key`，例如 `order.status.paid`。
- history page：`collection.{collection_key}.history`、`collection.{collection_key}.history.operation`、`collection.{collection_key}.history.documentId` 等。

寫入時加上 `plugin`，方便語系管理依 plugin 搜尋：

```http
POST {ApiBase}/language-pack
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

```json
{
  "items": {
    "collection.orders": {
      "plugin": "sales",
      "name": "訂單",
      "enUS": "Orders"
    },
    "collection.orders.history": {
      "plugin": "sales",
      "name": "訂單異動紀錄",
      "enUS": "Order History"
    }
  }
}
```

若 key 已存在，使用：

```http
PATCH {ApiBase}/language-pack/{language_key}
```

HTML 端 locale 對應：`zh-TW` 讀 `name`，`en-US` 讀 `enUS`，`ja-JP` 讀 `jaJP`。不要把語系文字只硬編在 HTML 中。

## 進階自訂 Collection 操作歷史紀錄 API

若常規 Generate Code history 已符合需求，不要重寫。只有需要額外聚合、filter、欄位遮罩或特殊授權時，才依本節建立 companion module 或明確覆寫 generated version，並在需求文件記錄後續再次 Generate Code 可能覆蓋自訂版本。

主資料 API 使用 `ApiController` 時，`POST` / `PATCH` / `DELETE` 會寫入 `{collection_name}_history`。每筆 history 包含：

- `operation`: `create`、`update`、`delete`。
- `collection_name`、`document_id`、`uid`。
- `original_data`: 修改或刪除前的資料；create 為 `null`。
- `payload`: create/update 的提交內容；delete 為 `null`。
- `data_after`: create/update 後資料；delete 為 `null`。
- `created_at` 與格式化時間由 Mongo access 層產生。

history API 只開放查詢。Generated history handler 依 collection/field access 過濾 `metadata.columns`、`changes` 與 `written_fields`；若自訂 history handler，必須維持相同規則，不得直接暴露 raw `original_data` / `payload` / `data_after` 快照。

範本：

```python
from typing import Any

from services.api_controller import ApiController

COLLECTION_KEY = "orders"
HISTORY_COLLECTION = f"{COLLECTION_KEY}_history"
EDITOR_ROLES = {"admin", "ai"}

history_controller = ApiController(
    collection_name=HISTORY_COLLECTION,
    history_collection_name=f"{HISTORY_COLLECTION}_audit",
)

def _allowed(roles: list[str]) -> bool:
    actual = {str(role).strip().lower() for role in roles}
    return not EDITOR_ROLES.isdisjoint(actual)

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
    if method != "GET":
        return 405, {"error": {"code": "METHOD_NOT_ALLOWED", "message": "History API is read-only."}}
    if not uid or not _allowed(roles):
        return 403, {"error": {"code": "HISTORY_FORBIDDEN", "message": "You do not have access to this history."}}

    query = dict(query_params or {})
    query.setdefault("sort", "created_at")
    query.setdefault("direction", "desc")
    query.setdefault("limit", "100")
    status, body = history_controller.get(query, resource_id=resource_id)
    body["history"] = {
        "collection": COLLECTION_KEY,
        "fields": ["operation", "document_id", "uid", "created_at_format", "original_data", "payload", "data_after"],
    }
    return status, body
```

可支援查詢：

```http
GET {ApiBase}/orders-api-history?document_id=<record_id>&sort=created_at&direction=desc&limit=100
GET {ApiBase}/orders-api-history?operation=update
GET {ApiBase}/orders-api-history?@gte.created_at=<epoch_ms>&@lte.created_at=<epoch_ms>
```

## 進階自訂歷史紀錄查詢網頁

history HTML page 應使用 runtime context 與 Language Pack，並呼叫 `history_api` endpoint。建議在 HTML 加上：

```html
<meta name="history-api-endpoint" content="orders-api-history">
<meta name="history-document-id-param" content="document_id">
```

頁面功能至少包含：

- 列表欄位：時間、操作、資料 id、操作者 uid。
- filter：`document_id`、`operation`、日期區間。
- 明細檢視：格式化呈現 `original_data`、`payload`、`data_after` JSON。
- 錯誤狀態：未登入顯示登入提示，`403` 顯示無權限。
- 語系：標題與欄位用 `languageText(key, fallback)`，不要只寫死中文。

history page 的 API 呼叫範式：

```js
const endpoint = document.querySelector('meta[name="history-api-endpoint"]')?.content

async function loadHistory() {
  const params = new URLSearchParams({ sort: 'created_at', direction: 'desc', limit: '100' })
  if (filters.documentId) params.set('document_id', filters.documentId)
  if (filters.operation) params.set('operation', filters.operation)
  const data = await apiRequest(`${endpoint}?${params}`)
  renderRows(data.items || [])
}
```

若從主資料頁開啟 history，可以用 `?document_id={record_id}` 傳入；history page 讀 `location.search` 後自動套用 filter。

## 驗證清單

完成前逐項確認：

- 已讀取既有 collection config、module 最新版本與 endpoint，沒有覆蓋未知既有程式碼。
- `module_key` 與 Gateway endpoint 命名正確，`plugin` metadata 已寫入 Code Registry/Gateway/Language Pack payload。
- Python handler 可 import，簽名符合 Gateway contract，回傳錯誤 shape 穩定。
- Python imports 全部存在於 bundled runtime contract，沒有使用 deployment blocked imports；已讀回 `item.validation.blocked_imports` 並記錄必要的 runtime dependencies。
- 若使用 `cache_map`，只保存有界、非敏感、tenant-neutral 且可重建的值；key 已以 plugin/module/version namespace，並已測 cold miss、cache hit、明確 invalidation 與實際 Gateway route。沒有把 cache 用於授權、去重、鎖、計數器或任何必須跨 worker 正確的狀態。
- MongoDB CRUD 優先使用 `ApiController`；aggregation 使用 bounded `mongo_access` pipeline，沒有自訂 Mongo URI/database、request-supplied collection/pipeline 或未說明的 raw `pymongo`。沒有把「已 import `create_mongo_client` / `get_database`」誤當成 tenant-safe；所有 tenant-owned collection 的讀寫都實際經過 `ApiController` 或 tenant-aware `mongo_access` operation helper。
- Tenant-required MDC 已用兩個全域 tenant A/B、無 active tenant 與 super 選擇情境驗證；已知其他 tenant 的 record id、偽造 query/body `tenant_id`、history/reference/file/unique 路徑都不能跨界。同一 active tenant 也已在不同 plugin 的 required MDC 驗證全域 scope，且各 collection role/access 仍獨立 enforce。若 module 使用 raw Mongo、copied helper 或 background/non-Gateway execution，已停止自動相容宣稱並完成明確 tenant design review。
- 外部連線只使用明確需求允許的 package/host、App Env secrets 與有限 timeout，沒有停用 TLS、無限制 response/connection 或敏感錯誤輸出。
- Metadata collection list response 的 `metadata` 是直接物件，且 `metadata.columns` 是 array，包含 UI-readable form fields 而不是只包含 list columns。
- has-many detail 使用 `master_col_id` 作為 system-owned foreign key；scoped GET 有 server-side filter 與 metadata；POST/PATCH 已通過 query/payload context 矩陣；direct page 缺少 context 時不能建立資料；從 master relation link 進入 UI 後可成功建立且持久化正確 foreign key。
- 選填欄位的 `null`/空字串依 metadata 視為未提供，必填欄位仍拒絕空值，沒有把 nullable 規則綁死到特定欄位名稱。
- wrapper 使用唯一 marker/symbol capture，version test 與實際 Gateway route 都已覆蓋 delegated 與攔截分支，沒有 recursion/`500`。
- 角色授權結果來自實際授權測試帳號；若只有 AI session，沒有把 version-test 中自填 roles 當成一般角色證據。
- HTML 不讀 localStorage token，不把 token 寫入 URL、DOM 或 storage。
- HTML 收到 runtime access token 變更時會清除 tenant-sensitive state 並重新載入，不會保留前一 tenant 的 rows、references 或 file metadata。
- 若建立、更新或啟用客製化首頁，已有本次任務中使用者明確同意取代原生首頁的紀錄；沒有明確同意時，未變更 `lfx_customize_landing_page` module 或 Gateway endpoint。
- Language Pack 已補 collection、column、relation、option、history page 文字。
- history API 預設 read-only 並有權限檢查；history page 能查詢、filter、顯示 JSON 明細。
- 儲存後呼叫實際 Gateway endpoint 驗證 API 與 HTML route。
- 若有 UI，使用 browser 開啟使用者提供的 exact project URL、明確登入並從 App Shell menu 驗證頁面；不要用既有 browser session 代替 API 授權，也不要從 browser storage 抽取 token。

## UTF-8 API request rule

When sending API requests that may contain Chinese or any non-ASCII text, always preserve UTF-8 explicitly.
This rule overrides older examples in this skill that show `-ContentType "application/json"` without `charset=utf-8` or that pass non-ASCII JSON strings directly as `-Body`.

PowerShell:
- Prefer building JSON first, then send UTF-8 bytes.
- Use `Content-Type: application/json; charset=utf-8`.
- Do not pass a non-ASCII JSON string directly to `Invoke-RestMethod -Body` with only `-ContentType "application/json"`; Windows PowerShell can encode the request body incorrectly.

```powershell
$json = $payload | ConvertTo-Json -Depth 40
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)

Invoke-RestMethod `
  -Uri $Uri `
  -Method Post `
  -Headers $Headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $bodyBytes
```

For `PATCH` requests, use the same pattern with `-Method Patch`.
