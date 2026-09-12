---
name: configure-language-settings
description: 讓 Codex 在無 source-code access 的 production 環境中，透過 deployed LaFenice API 設定 product plugin 的語系、預設語言與 Language Pack 文案。Use when Codex must read, add, or edit locales and plugin-tagged language entries using only the exact deployed URL. Require the exact project URL and role-ai account/password before development.
---

# 語言設定

## 強制連線前置條件

開始規劃或寫入語系資料前，先用 `get-plugin-edit-access` 取得使用者明確提供的專案 URL 與 role: `ai` 帳號密碼，執行 RSA-OAEP-256 加密登入，並確認 `/auth-me` 包含 `ai`；缺少任一項就詢問並停止。不得使用 localhost、API Key、預設帳密或其他環境的憑證。

## 使用範疇

這個 skill 用於 agent 無法查看 application repository、backend/frontend source、container 或 build 產物，且必須透過 deployed API 完成設定的情境。當任務涉及下列需求時使用：

- 讀取目前系統支援的語系與語言包內容。
- 新增一個 plugin 需要的語系欄位，例如 `ja-JP`、`en-US`。
- 新增或更新 plugin 的 Language Pack key，例如選單、collection label、欄位 label、按鈕、提示文字。
- 設定或調整系統預設語言。
- 讓 plugin metadata、menu、collection config、HTML iframe page 使用可翻譯文案。

不要要求或尋找系統內部檔案、deployment configuration 或資料庫權限。若 deployed Language Pack/Style Settings contract 不相容，記錄實際 HTTP status 與非敏感 response shape 並停止該能力，不要繞過 API。

如果任務同時要建立 collection、HTML page、Gateway route 或 menu entry，搭配 `manage-metadata-driven-collection`、`develop-plugin-code`、`configure-website-entry` 使用。

## 核心概念

Language Pack 儲存在 MongoDB collection `language_pack`。每筆資料以 `key` 作為唯一識別，`name` 是預設繁體中文欄位，其他語系是動態欄位。

範例：

```json
{
  "key": "sales.orders.title",
  "plugin": "sales",
  "name": "訂單",
  "enUS": "Orders",
  "jaJP": "注文"
}
```

語系代碼與 Language Pack 欄位的轉換：

| UI / App locale | Language Pack 欄位 |
| --- | --- |
| `zh-TW` | `name`，優先使用這個欄位存繁體中文 |
| `en-US` | `enUS` |
| `ja-JP` | `jaJP` |

前端讀取 Language Pack 欄位時，`zhTW` 這類符合 `^[a-z]{2}[A-Z]{2}$` 的欄位也會被推導成 `zh-TW`；但新增 plugin 文案時，不要同時維護 `name` 與 `zhTW` 兩份繁中內容，除非有明確相容性需求。

前端啟動時會讀取 `GET /language-pack`，並把可用欄位推導成可用語系。也就是說，新增語系通常不需要另存一張「語系表」；只要在 Language Pack item 裡加入新的語系欄位即可。

預設語言不存在 Language Pack row 裡，而是存在 Style Settings：

```json
{
  "language": {
    "defaultLocale": "zhTW"
  }
}
```

## API Base 與權限

API base 必須來自前置檢查，例如：

```text
https://project.example/lafenice/api
```

讀取 Language Pack 不需要登入：

```http
GET /lafenice/api/language-pack
GET /lafenice/api/language-pack/{key}
GET /lafenice/api/language-pack?key={key}
```

新增與更新 Language Pack 需要：

```http
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

使用記憶體內、已驗證 role: `ai` 的 access token。`style-settings` 的 `PATCH` 也使用相同 session。

## 讀取語系與語言包

讀取全部語言包：

```powershell
$ApiBase = $env:LAFENICE_API_BASE
$pack = Invoke-RestMethod -Uri "$ApiBase/language-pack" -Method Get
$pack.items
```

讀取單一 key：

```powershell
$key = "sales.orders.title"
$item = Invoke-RestMethod `
  -Uri "$ApiBase/language-pack/$([uri]::EscapeDataString($key))" `
  -Method Get
$item.item
```

依 plugin 或 key prefix 搜尋：

```powershell
$plugin = "sales"
$items = Invoke-RestMethod `
  -Uri "$ApiBase/language-pack?plugin=$([uri]::EscapeDataString($plugin))" `
  -Method Get

$collectionItems = Invoke-RestMethod `
  -Uri "$ApiBase/language-pack?@startswith.key=collection.sales_" `
  -Method Get
```

不同 deployed version 的 list/filter response shape 可能不同，或只接受部分 query operators。批次查詢只用來找 candidates，不可作為單筆寫入驗收。已知 key 一律以 `GET /language-pack/{key}` 做 authoritative readback；若 plugin filter 或 prefix filter 回傳空集合/非預期 shape，但 exact-key GET 成功，就依 exact-key 結果繼續並把 list/filter 差異記為相容性限制，不要改用 source/database 查找。

從回傳資料推導目前語系：

1. `name` 代表 `zh-TW`。
2. 符合 `^[a-z]{2}[A-Z]{2}$` 的欄位會轉成 `xx-YY`，例如 `enUS` -> `en-US`。
3. `plugin`、`key` 不是語系欄位。

## 新增語系

目前沒有獨立的「新增語系」API。要新增語系，請在需要的 Language Pack items 上新增對應欄位。

例如為 `sales` plugin 加入日文 `ja-JP`：

```powershell
$Headers = @{ Authorization = "Bearer $AccessToken" }
$items = @{
  "sales.orders.title" = @{
    plugin = "sales"
    name = "訂單"
    enUS = "Orders"
    jaJP = "注文"
  }
  "sales.orders.empty" = @{
    plugin = "sales"
    name = "目前沒有訂單。"
    enUS = "No orders yet."
    jaJP = "注文はまだありません。"
  }
}

$body = @{ items = $items } | ConvertTo-Json -Depth 20

Invoke-RestMethod `
  -Uri "$ApiBase/language-pack" `
  -Method Post `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

如果 key 已存在，`POST` 會回傳 `409`。這時應改用 `PATCH /language-pack/{key}` 更新既有 item。

## 編輯語言包

更新前先讀取現況，保留既有欄位，再合併要修改的欄位。`PATCH` 是 `$set` 更新，不是完整替換；但實務上仍建議送出完整 item，避免 Codex 遺漏既有語系造成判讀混亂。

```powershell
$key = "sales.orders.title"
$current = Invoke-RestMethod `
  -Uri "$ApiBase/language-pack/$([uri]::EscapeDataString($key))" `
  -Method Get

$item = $current.item
$item.plugin = "sales"
$item.name = "訂單管理"
$item.enUS = "Order Management"
$item.jaJP = "注文管理"

Invoke-RestMethod `
  -Uri "$ApiBase/language-pack/$([uri]::EscapeDataString($key))" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body ($item | ConvertTo-Json -Depth 20)
```

批次更新可用同一個 `PATCH /language-pack`，payload 使用 `items`：

```json
{
  "items": {
    "sales.orders.title": {
      "plugin": "sales",
      "name": "訂單管理",
      "enUS": "Order Management"
    },
    "sales.orders.create": {
      "plugin": "sales",
      "name": "新增訂單",
      "enUS": "New order"
    }
  }
}
```

## 新增語言包 key 的命名建議

plugin 文案應使用穩定、可讀、可分群的 key，並在每筆 item 加上 `plugin` 欄位。

建議模式：

- plugin 一般文案：`{plugin}.{feature}.{name}`，例如 `sales.orders.empty`。
- menu label：`menuLabels.{routeOrCategoryKey}`。
- metadata collection label：`collection.{collection_key}`。
- collection 欄位 label：`collection.{collection_key}.column.{column_key}`。
- collection relation label：`collection.{collection_key}.relation.{relation_key}`。
- option label：使用 metadata 的 `options[].label_key`，例如 `sales.order.status.paid`。
- history page：`collection.{collection_key}.history`、`collection.{collection_key}.history.operation`。

前端 App Shell 會自動合併下列 key：

- top-level AppMessages key，例如 `authLoginTitle`。
- `menuLabels.*`。
- `collection.*`。
- 不含 `.` 的 key，會視為 menu label fallback。

HTML iframe plugin page 應從 runtime context 的完整 `languagePack` 解析 plugin keys，並以 `messages` 和頁面內建文字作 fallback。App Shell 是 Language Pack API 的唯一讀取者。

## 設定預設語言

預設語言透過 Style Settings 設定，不要寫到 Language Pack item。

讀取現況：

```powershell
$settings = Invoke-RestMethod -Uri "$ApiBase/style-settings" -Method Get
$settings.item.language.defaultLocale
```

更新預設語言時，先讀完整 settings，再保留 `project`、`theme`，只修改 `language.defaultLocale` 後送回：

```powershell
$settings = Invoke-RestMethod -Uri "$ApiBase/style-settings" -Method Get
$item = $settings.item
$item.language.defaultLocale = "en-US"

$body = @{
  project = $item.project
  language = $item.language
  theme = $item.theme
} | ConvertTo-Json -Depth 40

Invoke-RestMethod `
  -Uri "$ApiBase/style-settings" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

`defaultLocale` 支援英數、`_`、`-`。前端會把 `zhTW` 與 `zh-TW` 這類差異做 normalization，但新增設定時應優先使用目前系統已出現的 locale key。

## Plugin HTML Page 使用語言包

HTML Code Registry page 在 iframe 中執行，不要直接讀 parent DOM、React state 或 localStorage token。應透過 runtime context 取得：

- `locale`
- `messages`
- `languagePack`
- `apiBaseUrl`
- `accessToken`

建議 helper：

```js
const state = { locale: "zh-TW", messages: {}, languagePack: {} };

function localeToField(locale) {
  if (locale.toLowerCase() === "zh-tw") return "name";
  return locale.replace(/-([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
}

function t(key, fallback) {
  const item = state.languagePack?.[key];
  const packValue = item?.[localeToField(state.locale)] || item?.name;
  if (typeof packValue === "string" && packValue) return packValue;
  const value = state.messages?.[key];
  if (typeof value === "string" && value) return value;
  const menuValue = state.messages?.menuLabels?.[key];
  if (typeof menuValue === "string" && menuValue) return menuValue;
  return fallback;
}
```

收到 runtime context 時將 App Shell 傳入的 snapshot 正規化：

```js
function applyRuntimeContext(context) {
  state.locale = context.locale || state.locale;
  state.messages = context.messages || {};
  state.languagePack = context.languagePack?.items || context.languagePack || {};
}
```

不要讓 iframe 自行呼叫 `/language-pack`，也不要把 Language Pack 或 access token 寫入 iframe storage；locale、system messages 與 theme presentation cache 可以是非敏感短期資料。

## 與 Collection Config 的關係

建立 metadata-driven collection 時，collection config 的 `i18n.label_key` 應對應 Language Pack key：

```json
{
  "key": "orders",
  "display": "Orders",
  "plugin": "sales",
  "i18n": { "label_key": "collection.orders" }
}
```

`POST /collection-config/generate-code` 會呼叫 backend helper，為 collection label 建立或更新 Language Pack item，並把目前所有既有 locale 欄位填入同一個值。若 plugin 需要更精準的各語系翻譯，generate-code 後再用 `PATCH /language-pack/{key}` 覆蓋各語系欄位。

## 錯誤與限制

- `401`：AI access token 無效或過期；依 `get-plugin-edit-access` 規則 refresh 一次，失敗就停止並重新登入。
- `403 Language pack requires admin or ai role.`：登入 session 的角色不足；重新確認 `/auth-me` 包含 `ai`。
- `403 Style settings requires admin or ai role.`：更新預設語言時有效角色不足。
- `404 Language pack item was not found.`：指定 key 不存在。新增請用 `POST`。
- `409 Language pack key already exists`：新增 key 已存在。改用 `PATCH`。
- `400 key is required.` 或 `400 name is required.`：payload 缺少必要欄位。

目前公開 API 沒有刪除 Language Pack item 或移除單一 locale 欄位的功能。`PATCH` 只會 `$set` 欄位；不要假設送空 payload 或省略欄位會刪除既有翻譯。若確實需要刪除語言包資料，應另行開發受權限保護的 API 或由系統維護者直接處理資料庫。

## Codex 工作流程

1. 確認使用者提供且已驗證的 API base URL 與記憶體內 AI JWT session。
2. 用 `GET /language-pack` 讀取現況，找出既有 locale 欄位與目標 plugin keys；每個已知目標 key 再用 exact-key GET 確認，不依賴 list/filter shape。
3. 如需新增語系，決定欄位名稱，例如 `jaJP`，並在目標 items 中加入該欄位。
4. 新 key 用 `POST /language-pack`；既有 key 用 `PATCH /language-pack/{key}` 或批次 `PATCH /language-pack`。
5. 每筆 plugin 文案都帶上 `plugin` 欄位，空值則省略。
6. 如需改預設語言，讀取 `GET /style-settings`，保留完整 `project`、`theme`，只調整 `language.defaultLocale` 後 `PATCH /style-settings`。
7. 驗證：重新 `GET /language-pack/{key}`、`GET /style-settings`，並確認前端目前 locale 可以解析到對應文案。

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
