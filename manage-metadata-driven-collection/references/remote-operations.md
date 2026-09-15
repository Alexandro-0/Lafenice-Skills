# MDC Remote Operations

在對 deployed LaFenice 執行 create、edit、generate 或 delete 前完整閱讀本文件。必須先由 `get-plugin-edit-access` 驗證 exact project URL 與 role `ai` session。

## Contents

- [Request rules](#request-rules)
- [Minimal targeted inventory](#minimal-targeted-inventory)
- [Create](#create)
- [Replacement edit](#replacement-edit)
- [Generate Code](#generate-code)
- [Language Pack follow-up](#language-pack-follow-up)
- [Delete metadata](#delete-metadata)
- [Error handling](#error-handling)
- [Runtime acceptance matrix](#runtime-acceptance-matrix)

## Request rules

只使用已確認的 API base，例如：

```text
{ExactProjectUrl}/api
```

不要自行加入、移除或猜測 project root。所有 protected request 使用：

```http
Authorization: Bearer <ai_access_token>
Accept: application/json
Content-Type: application/json; charset=utf-8
```

PowerShell 傳送非 ASCII JSON 時轉成 UTF-8 bytes：

```powershell
$json = $payload | ConvertTo-Json -Depth 40
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
Invoke-RestMethod -Uri $Uri -Method Post -Headers $Headers -ContentType "application/json; charset=utf-8" -Body $bodyBytes
```

PATCH 使用相同方式。不要把 token 寫進 script、command-line argument 或檔案。

## Minimal targeted inventory

只讀取目標 plugin 與直接 dependency：

```http
GET {ApiBase}/collection-config?plugin=sales&sort=key&direction=asc
GET {ApiBase}/collection-config/sales_orders
```

單筆 response：

```json
{
  "schema_version": 1,
  "defaults": {"timezone": "Asia/Taipei", "locale": "zhTW", "version": 1},
  "item": {"key": "sales_orders", "version": 4}
}
```

建立前只需 GET 目標 key 判斷是否已存在。編輯 reference/embedded/has-many 時，再讀 target 或 master/detail configs；不要掃 unrelated plugins 或 business data。

## Create

```http
POST {ApiBase}/collection-config
```

Body 可直接是完整 config，或：

```json
{"item": {"key": "sales_orders", "display": "Sales Orders", "plugin": "sales", "columns": [], "relations": []}}
```

成功為 `201`，response `item.version` 為 1。立即 GET readback，比較 backend-normalized values，不要只信 local draft。

## Replacement edit

```http
GET {ApiBase}/collection-config/sales_orders
PATCH {ApiBase}/collection-config/sales_orders
```

PATCH body 必須是完整 config，且含最新 `version`：

```json
{
  "key": "sales_orders",
  "display": "Sales Orders",
  "plugin": "sales",
  "access": {
    "read": {"auth_required": true, "roles": ["sales"]},
    "write": {"auth_required": true, "roles": ["sales_manager"]}
  },
  "ui": {"list": {"title_field": "order_no", "columns": ["order_no", "status"]}},
  "columns": [],
  "relations": [],
  "version": 4
}
```

Backend 用 atomic `{id, version}` update，成功後 version 變 5。若 `409 COLLECTION_CONFIG_VERSION_CONFLICT`：

1. 讀 `error.current_version`。
2. 重新 GET 最新 item。
3. 重新套用原本 semantic diff；不要把 stale full payload 覆蓋回去。
4. 重新 local validate、PATCH、GET readback。

## Generate Code

先確認 config 已成功儲存，再明確指定要產生的 group：

```http
POST {ApiBase}/collection-config/generate-code
```

```json
{
  "key": "sales_orders",
  "generate": {"data_management": true, "history": true}
}
```

至少一個 flag 必須 true。省略 `generate` 在相容模式下會全部產生，但新工作不要依賴此行為。

`data_management: true`：

- 選第一個 `unique: true` string 作 API unique key。
- 產生 `{api}` Python module 與 GET/POST/PATCH/DELETE Gateway methods。
- 產生 `{page}` HTML module 與 public GET delivery route。
- 為 visible `type: file` 欄位產生 picker、client MIME/size validation、File API multipart upload、既有 id 保留/移除與 id/id-array 回寫。
- Upsert collection page label。

`history: true`：

- 產生 `{history_api}` read-only Python module 與 GET route。
- 產生 `{history_page}` HTML module 與 public GET delivery route。
- Upsert `{collection_label_key}.history`。

Gateway route existence 以 endpoint + method 判斷；既有 mapping 會 preserve，missing methods 才補上。Code Registry 仍會儲存並 activate 新 version。因此 regenerate 前：

1. 把四個 endpoint 轉成 module keys（小寫；非 `[a-z0-9_]` 轉 `_`；去頭尾 `_`）。
2. 讀 module latest versions；辨認是否有 generated baseline 之後的自訂 code。
3. 有自訂時保存 latest content 與 diff。GET `/access-control`，依選定 page endpoint 的 path 在完整 menu tree 中找到既有 route，保存 key、label、path、分類位置、sort、auth_require、roles、enabled、plugin。不要假設 route 位於 Code Pages，或以 MDC label key 取代既有自訂 route key。
4. 對選定 group 的 Language Pack key 做 exact-key GET：data management 使用 collection 的 `i18n.label_key`，history 使用 `{collection_label_key}.history`。保存既有 `name`、所有 locale 欄位與 plugin，並記錄真正不存在的 key；非 404 讀取失敗時先停止產碼，避免失去還原基線。此 upsert 會把既有各語系都改成 display/history display，不只是補缺值。

產碼後：

1. 依 `configure-language-settings` 讀回受影響 items，以保存的翻譯加上使用者要求的文案差異 PATCH 回去；保留既有 plugin，不傳 id、timestamps 等唯讀欄位。新 key 才補初始翻譯。若遇到無法解釋的並行變更，先停止該筆寫入並回報差異，不用舊快照蓋掉他人修改。
2. 有客製 source 時重新套用 diff、存成新 version。重存 HTML 必須沿用既有 Gateway endpoint，明確帶 `gateway.preserve_existing: true`；若填 `menu_key`、`menu_label`，沿用快照中的值。該旗標不會由上一個 generated version 自動繼承。
3. 在 Generate Code 及每次 HTML 儲存後 GET `/access-control`，比對既有 route 上述欄位與分類位置；sort 必須保留原數值，不能重編序號或全設為 10。同步確認 Language Pack 原有翻譯與使用者要求的文案差異。
4. 若保留旗標被 deployed backend 拒絕或仍出現選單重置，停止後續 HTML 儲存，記錄 compatibility gap。修復本次操作造成的差異時，依 `configure-website-entry` 重新 GET 最新 menu/version，只合併本次受影響欄位；不要用舊整棵 menu 覆蓋並行更新。無法安全還原時明確回報未恢復項目。
5. 測 Code Registry version、實際 Gateway route 與 App Shell 側邊欄名稱/排序；不要只看 `validation.ok` 或 generate response。語系還原失敗不得宣稱重產流程完成。

舊 page 不會因 PATCH file metadata 自動取得 picker。新增/修改 file 欄位後必須重產 `data_management`，再以 create/edit modal 與 `POST {ApiBase}/files` 的實際 network request 驗收；若仍是 id 文字 input，檢查 route 是否保留舊或自訂 mapping。

Generated response 會包含 `generated` flags、`source_code_endpoint`、`unique_key` 與選定 modules。AI/Super 可讀 source-bearing response；admin response 會移除 content。

## Language Pack follow-up

Generate Code 只處理 collection 與 history page label。掃描 config 中：

- `collection.i18n.label_key`
- `columns[].i18n.label_key/help_key/placeholder_key`
- `option.options[].label_key`
- `relations[].i18n.label_key`

使用 `configure-language-settings` 為需要的 locales 寫入文字，並沿用相同 `plugin`。不要把完整語系只硬編在 generated HTML。

## Delete metadata

只有使用者明確要求時才刪除：

```http
DELETE {ApiBase}/collection-config/sales_orders?version=5
```

Delete 只刪 metadata，不刪 business collection/data，也不保證清除 generated modules、Gateway routes、menu 或 Language Pack。先 inventory plugin-owned dependencies 與殘留資源。

若 reference、embedded 或 has-many 使用目標，backend 回：

```text
409 COLLECTION_CONFIG_IN_USE
```

讀 `error.dependencies`，先更新引用端；不要 force retry。

## Error handling

- `401`：依 `get-plugin-edit-access` 用 refresh token rotate 一次並 retry 原 request 一次；仍失敗就停止。
- `403 COLLECTION_CONFIG_FORBIDDEN`：確認 `/auth-me` 包含 `ai`；不要換用 API Key 或 admin-only workflow。
- `404` on GET：create path 可視為 key 尚不存在；edit/delete path 必須停止。
- `409 COLLECTION_CONFIG_ALREADY_EXISTS`：不自動覆蓋；確認 edit 或新 key。
- `409 COLLECTION_CONFIG_VERSION_CONFLICT`：重新讀取與合併。
- `409 COLLECTION_CONFIG_IN_USE`：先處理 dependencies。
- `422 COLLECTION_CONFIG_VALIDATION_ERROR`：逐一讀 `error.fields` 的 JSON path，修 local config 並重跑 validator；不要盲目重送。

## Runtime acceptance matrix

Metadata write 完成後至少驗證：

| Surface | Checks |
| --- | --- |
| Config | GET readback、version、plugin、endpoints、normalized fields |
| List API | auth、pagination/filter/sort、list field surface、unreadable field rejection |
| Record API | create、single GET、edit、delete、required/type/unique validation |
| Form | 所有 UI-visible/readable fields 可用；不被 `ui.list.columns` 限制 |
| Access | allowed/denied collection + field operations；使用實際授權帳號 |
| Reference | ids 保留；`reference_values` 顯示與 field masking 正確 |
| File | candidate 判定、File API multipart upload、record 僅存 id、MIME/size、private/public content、remove 與 delete semantics |
| History | read-only、descending records、field masking、actor/reference display |
| Master-detail | relation link、scoped list、locked writes、五種 query/payload case |
| App Shell | exact origin、explicit login、locale、theme、responsive/error states |

測試資料只用 plugin-owned disposable records，安全時清理；記錄未清理 fixture。只有 AI session 時，把非 AI 角色測試標成未驗證。
