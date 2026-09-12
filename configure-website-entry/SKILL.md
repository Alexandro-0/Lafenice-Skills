---
name: configure-website-entry
description: 讓 Codex 在無 source-code access 的 production 環境中，透過 deployed LaFenice API 設定 product plugin 的網站入口、網頁選單分類、前端路由與 API Gateway authentication。Use when adding or editing menu categories, attaching plugin HTML pages, or configuring Gateway auth_required using only the exact deployed URL. Require the exact project URL and role-ai account/password before development.
---

# 網站入口設定

## 強制連線前置條件

開始規劃或修改網站入口前，先用 `get-plugin-edit-access` 取得使用者明確提供的專案 URL 與 role: `ai` 帳號密碼，執行 RSA-OAEP-256 加密登入，並確認 `/auth-me` 包含 `ai`；缺少任一項就詢問並停止。不得使用 localhost、API Key、預設帳密或其他環境的憑證。

使用加密登入取得的同一個 AI JWT 操作 `access-control`、`/_gateway/...` 與 `/_code/...`，並驗證 protected runtime route。access/refresh tokens 只保存在目前程序的記憶體中。

## 使用範疇

使用這個 skill 時，預設 agent 無法查看 application repository、backend/frontend source、container 或 build 產物。所有 plugin 網站入口設定都經由使用者提供 URL 上的 API 讀寫；若 deployed contract 不相容，記錄實際 response 並停止該能力，不要尋找或修改內部檔案。

適用情境：

- 新增或調整網頁端 menu category。
- 將 plugin 的網頁 endpoint 加入指定的 menu category。
- 調整 menu category 或 route 的 `plugin`、`roles`、`enabled`、`sort` 等 metadata。
- 設定 API Gateway endpoint method 是否需要 access token。
- 確認前端入口權限與後端 API 權限是否一致。

不適用情境：

- 要撰寫 Python handler 或 HTML iframe 頁面本身時，改用 `develop-plugin-code`。
- 要建立 metadata-driven collection 時，改用 `manage-metadata-driven-collection`。
- 還沒有完成 URL、role: `ai` 帳密與 JWT session 的能力檢查時，先用 `get-plugin-edit-access`。

## 核心觀念

網站入口由兩層資料控制：

- `access-control`：控制前端選單樹與頁面入口。資料存在 MongoDB `access_control`，API path 是 `/lafenice/api/access-control`。
- `api gateway`：控制後端 endpoint method 的 handler 與是否要求登入。資料存在 MongoDB `gateway_configs`，API path 是 `/lafenice/api/_gateway/...`。

兩者不要混淆：

- Menu route 的 `auth_require` 只控制前端在開啟該 route 前是否要求已登入。
- Menu category/route 的 `roles` 是前端入口 metadata；目前後端會用 category roles 過濾 `GET /access-control` 回傳樹，但 route roles 不等於 API 授權。
- Gateway route 的 `auth_required` 決定是否驗證身分；本 skill 建立的 protected route 以 App Shell 使用者 JWT 或開發時的 AI JWT 驗證。
- 若 endpoint 需要 role 級授權，必須在 Python handler 內檢查 `roles`，Gateway 本身只處理 token 驗證與把 `uid`、`roles` 傳給 handler。

## API 基本設定

API base 必須來自前置檢查，例如：

```text
https://project.example/lafenice/api
```

所有 protected API 寫入都帶：

```http
Authorization: Bearer <ai_access_token>
Accept: application/json
Content-Type: application/json
```

權限需求：

- `GET /access-control`：任何已登入使用者可讀，但回傳 menu 會依使用者角色過濾。
- `PATCH /access-control`：有效角色需要 `admin`、`ai` 或 `super`。
- `/_gateway/config`、`/_gateway/config/routes/...`、`/_gateway/reload`：JWT-only，需要 `admin`、`ai` 或 `super`。

## Menu 資料模型

Category 沒有 `path`，用 `children` 裝子分類或 route：

```json
{
  "key": "operations",
  "label": "Operations",
  "plugin": "sales",
  "roles": ["admin", "sales"],
  "enabled": true,
  "sort": 10,
  "children": []
}
```

Route 有 `path`：

```json
{
  "key": "ordersPage",
  "label": "Orders",
  "plugin": "sales",
  "path": "/orders-page",
  "auth_require": true,
  "roles": ["admin", "sales"],
  "enabled": true,
  "sort": 10
}
```

重要限制：

- Top-level `developerTools` 和 `system` 是 frontend-owned protected nodes，不能透過 API 覆蓋或儲存。
- `protected_keys` 必須包含 `developerTools` 和 `system`。
- Category 與 route 的 `key` 不只是穩定識別值，也會被前端用來查找選單顯示文字。系統語言包可用對應的 `menuLabels.{key}` 管理翻譯；若語言包中有相對應 key，前端會優先顯示語言包文字，找不到才 fallback 到 `label`。詳情請參考「系統語言包設定」skill。
- route `path` 必須是 `/config/...`，或單段 code page path，例如 `/orders-page`。
- `roles` 會被 trim、lowercase、dedupe、sort。
- `enabled` 預設 `true`，`auth_require` 預設 `false`。
- 同一個 `children` array 內不可有重複 `key`。
- `codePages` 是後端可管理的 elevated category，不要放進 `protected_keys`。

## 編輯網頁端 Menu Category

流程：

1. 先讀目前設定。
2. 以回傳的 `version` 為基準修改 `menu`。
3. 保留 `protected_keys`，不要送出 `developerTools` 或 `system` top-level 節點。
4. 用 `PATCH /access-control` 儲存整棵 backend-managed menu。
5. 若遇到 `409 ACCESS_CONTROL_VERSION_CONFLICT`，重新 GET 最新資料後再合併變更。

讀取：

```http
GET /lafenice/api/access-control?app=lafenice&scope=frontend-menu
Authorization: Bearer <ai_access_token>
```

儲存：

```http
PATCH /lafenice/api/access-control
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

範例 payload：新增或更新 `operations` category。

```json
{
  "app": "lafenice",
  "scope": "frontend-menu",
  "version": 4,
  "protected_keys": ["developerTools", "system"],
  "menu": [
    {
      "key": "operations",
      "label": "Operations",
      "plugin": "sales",
      "roles": ["admin", "sales"],
      "enabled": true,
      "sort": 10,
      "children": []
    }
  ]
}
```

PowerShell 範例：

```powershell
$ApiBase = $env:LAFENICE_API_BASE
$Headers = @{ Authorization = "Bearer $AccessToken" }

$current = Invoke-RestMethod `
  -Uri "$ApiBase/access-control?app=lafenice&scope=frontend-menu" `
  -Method Get `
  -Headers $Headers

$menu = @($current.menu)
$menu = @($menu | Where-Object { $_.key -ne "operations" })
$menu += @{
  key = "operations"
  label = "Operations"
  plugin = "sales"
  roles = @("admin", "sales")
  enabled = $true
  sort = 10
  children = @()
}

$body = @{
  app = "lafenice"
  scope = "frontend-menu"
  version = $current.version
  protected_keys = $current.protected_keys
  menu = $menu
} | ConvertTo-Json -Depth 30

Invoke-RestMethod `
  -Uri "$ApiBase/access-control" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

## 將網頁 Endpoint 加入指定 Menu Category

如果網頁是 Code Registry 的 `code_type: "html"` module，儲存 HTML version 時可以在 `gateway` payload 指定 endpoint、plugin 與預設 menu label。後端會自動：

- 建立 `GET /lafenice/api/{endpoint}` Gateway route。
- 建立前端 iframe route path `/{endpoint}`。
- 將 route upsert 到 `codePages` category。

這個自動 upsert 可能在後續儲存其他 HTML version 時再次建立 `codePages` child。因此選單設定必須放在所有 HTML version 發布之後做最後 reconciliation：

1. 先發布所有 HTML versions，且每個 `gateway.menu_key` 使用最終自訂 category 中同一個 leaf key。
2. 重新 `GET /access-control`，不要沿用發布 HTML 前的 version/menu snapshot。
3. 把每個 plugin route upsert 到目標 category，並只移除 `codePages.children` 中同 plugin 且同 key/path 的自動重複節點；保留其他 plugin、未知 sibling 與 protected nodes。
4. 以最新 `version` 做一次 replacement `PATCH`，遇到 `409` 就重新讀取、重新合併。
5. 所有 HTML version 儲存完成後不要再另存 HTML；若確實需要再發布，必須重做這個 reconciliation。

`gateway.menu_key` 是穩定資源綁定，不只是顯示文字。它必須與 curated menu leaf `key` 完全一致，方便 export preview、import merge 與重複節點清理。

Code Registry 儲存 HTML version 範例：

```json
{
  "message": "publish orders page",
  "code_type": "html",
  "content": "<!doctype html>...",
  "group": "orders",
  "plugin": "sales",
  "gateway": {
    "endpoint": "orders-page",
    "plugin": "sales",
    "menu_key": "ordersPage",
    "menu_label": "Orders"
  }
}
```

若需求是「加入指定 category」而不是留在 `codePages`，在所有 HTML version 儲存後再呼叫 `PATCH /access-control`，把 route 加到目標 category 的 `children`。路由 path 使用 App Shell-relative 的 `/{endpoint}`，不是完整 project URL、API base 或 `/lafenice/{endpoint}`：

```json
{
  "key": "ordersPage",
  "label": "Orders",
  "plugin": "sales",
  "path": "/orders-page",
  "auth_require": true,
  "roles": ["admin", "sales"],
  "enabled": true,
  "sort": 10
}
```

加入時要保留既有 sibling，避免覆蓋其他 plugin 的 route。建議只在指定 category 的 `children` 中 upsert 同 key 或同 path 的 route。

對內建前端管理頁或其他 `/config/...` path，直接新增 route：

```json
{
  "key": "salesSettings",
  "label": "Sales Settings",
  "plugin": "sales",
  "path": "/config/sales/settings",
  "auth_require": true,
  "roles": ["admin", "sales"],
  "enabled": true,
  "sort": 20
}
```

## 設定 API Gateway Endpoint 權限控管

Gateway route method config：

```json
{
  "handler": "services.generated.orders_api:handle",
  "auth_required": true,
  "plugin": "sales"
}
```

`auth_required` 行為：

- `true`：呼叫 endpoint 必須帶有效 JWT；handler 會收到 `uid` 與有效 `roles`。
- `false`：endpoint 可匿名呼叫，handler 收到 `uid` 為 `x-user-id` header 或 `null`，`roles` 為 `[]`。

透過單一路由 API 設定：

```http
PATCH /lafenice/api/_gateway/config/routes/{endpoint}/{method}
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

範例：

```json
{
  "handler": "services.generated.orders_api:handle",
  "auth_required": true,
  "plugin": "sales"
}
```

PowerShell：

```powershell
$Headers = @{ Authorization = "Bearer $AccessToken" }
$endpoint = "orders-api"
$method = "GET"
$routeBody = @{
  handler = "services.generated.orders_api:handle"
  auth_required = $true
  plugin = "sales"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "$ApiBase/_gateway/config/routes/$([uri]::EscapeDataString($endpoint))/$method" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $routeBody
```

刪除某個 method：

```http
DELETE /lafenice/api/_gateway/config/routes/orders-api/DELETE
Authorization: Bearer <ai_access_token>
```

若 endpoint 是 Code Registry Python module，可先在儲存 version 的 `gateway` metadata 設定 route；需要調整 method、handler、`auth_required` 或 plugin metadata 時，再用 AI JWT 呼叫 `/_gateway/config/routes/...`。

```json
{
  "message": "publish orders API",
  "code_type": "py",
  "content": "<python handler>",
  "group": "orders",
  "plugin": "sales",
  "gateway": {
    "endpoint": "orders-api",
    "methods": ["GET", "POST", "PATCH", "DELETE"],
    "auth_required": true,
    "plugin": "sales"
  }
}
```

如果只允許讀取，可以只保留 `GET`：

```json
{
  "gateway": {
    "endpoint": "orders-api-history",
    "methods": ["GET"],
    "auth_required": true,
    "plugin": "sales"
  }
}
```

## Handler 內的 Role 控管

Gateway 不會根據 roles 自動拒絕請求。需要 role-based authorization 時，handler 要自行判斷：

```python
EDITOR_ROLES = {"admin", "sales"}

def _allowed(roles: list[str]) -> bool:
    normalized = {role.strip().lower() for role in roles if isinstance(role, str)}
    return not EDITOR_ROLES.isdisjoint(normalized)

def handle(*, method, query_params, resource_id, payload, header, uid, roles):
    if not uid:
        return 401, {"error": {"code": "LOGIN_REQUIRED", "message": "Login required."}}
    if not _allowed(roles):
        return 403, {"error": {"code": "FORBIDDEN", "message": "Permission denied."}}
    return {"ok": True}
```

對使用者可見入口也要同步設定：

- Gateway `auth_required: true`：API 必須登入。
- Menu route `auth_require: true`：前端開頁前要求登入。
- Category `roles`: 控制一般使用者是否看得到該分類與整個 subtree。
- Route `roles`: 保留 route 級權限 metadata，但不要把它當作唯一後端安全邊界。

## 驗證清單

完成設定後檢查：

- `GET /access-control?app=lafenice&scope=frontend-menu` 回傳含目標 category/route。
- 目標 route path 符合 `/config/...` 或 `/{endpoint}`。
- `plugin` 欄位在 menu route/category 與 Gateway route 上一致。
- 每個 HTML `gateway.menu_key` 與最終 category leaf `key` 完全一致；`codePages` 沒有同 plugin、同 key/path 的自動重複 route。
- 以一般使用者身分讀取 `/access-control` 時，只看到該角色應看到的 category。
- 呼叫 Gateway endpoint 時，`auth_required: true` 的 method 沒有有效 JWT 會回 `401`。
- 有效 role 不足時應回 `403`。
- HTML endpoint 能透過前端 `/lafenice/{endpoint}` iframe 開啟，iframe src 對應 `{API_BASE}/{endpoint}`。
- 使用 browser 開啟使用者提供的 exact project URL，確認 origin 後明確登入，並從 App Shell menu 完成頁面與權限驗證；不得依賴既有 session 或從 browser storage 取出 token。

常見錯誤：

- `409 ACCESS_CONTROL_VERSION_CONFLICT`：有人更新過 menu，重新 GET 後合併再 PATCH。
- `422 ACCESS_CONTROL_VALIDATION_ERROR`：檢查 protected keys、重複 key、path 格式、roles 型別。
- `400 Gateway endpoint can contain at most one nested path segment.`：Gateway endpoint 最多一層 nested path；一般 plugin endpoint 建議用單段 kebab-case。
- `403 ... requires admin or ai role`：目前 JWT 的有效角色不足；重新確認 `/auth-me` 包含 `ai`。

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
