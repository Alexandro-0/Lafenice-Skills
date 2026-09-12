# MDC Collection Contract

在草擬、修改或驗證 collection config 時完整閱讀本文件。Deployed backend 是最終準則；此 contract 用來減少常見 `422` 與錯誤 runtime 設計。

## Contents

- [Collection shape](#collection-shape)
- [Access semantics](#access-semantics)
- [Tenant isolation and generated-code compatibility](#tenant-isolation-and-generated-code-compatibility)
- [Common column shape](#common-column-shape)
- [Field catalog](#field-catalog)
- [File inference and upload contract](#file-inference-and-upload-contract)
- [Has-many master-detail](#has-many-master-detail)
- [UI visibility](#ui-visibility)
- [Optional empty values](#optional-empty-values)

## Collection shape

Create 可直接送 config，或包在 `{"item": {...}}`。Update 必須包含 GET 回傳的最新 `version`。

```json
{
  "key": "sales_orders",
  "display": "Sales Orders",
  "plugin": "sales",
  "tenant_mode": "required",
  "i18n": {"label_key": "collection.sales_orders"},
  "access": {
    "read": {"auth_required": true, "roles": ["sales"]},
    "write": {"auth_required": true, "roles": ["sales_manager"]}
  },
  "source_code_endpoint": {
    "api": "sales-orders-api",
    "page": "sales-orders-page",
    "history_api": "sales-orders-api-history",
    "history_page": "sales-orders-page-history"
  },
  "ui": {
    "list": {
      "title_field": "order_no",
      "columns": ["order_no", "status", "customer_id", "total"]
    }
  },
  "columns": [],
  "relations": []
}
```

Rules：

- `key` 以小寫字母開始，只含小寫字母、數字、底線，最多 64 字；PATCH 時不可改名。
- `display` 必填。Product plugin collection 必須有穩定且一致的 `plugin`。
- `tenant_mode` 可為 `legacy`（default）或 `required`。這是 MDC 的「是否允許 multi-tenancy」設定：`required` 必須有 plugin 作為 collection identity 與 Legacy migration namespace；啟用後不能改回 `legacy`，也不能更換 plugin。Tenant 本身不屬於該 plugin。
- `source_code_endpoint` 可省略；default 會把 key 的 `_` 換成 `-`，再加 `-api`、`-page`、`-api-history`、`-page-history`。Endpoint 不得以 `/` 開頭，只能含英數、dot、underscore、hyphen。
- `ui.list.title_field` 與 `ui.list.columns` 只能引用 configured column keys。它們不控制 create/edit form。
- `defaults.timezone` 與 field timezone 是 system-managed，不得寫入 collection config。

## Access semantics

```json
{"auth_required": true, "roles": ["sales", "auditor"]}
```

- `auth_required: false` 且 roles 為空：public。
- `auth_required: true` 且 roles 為空：任一 authenticated user。
- roles 非空：any-role match，且 `auth_required` 必須為 true。
- roles 比對不分大小寫；backend 保留第一個 spelling 與輸入順序並去除重複。
- 欄位或 relation 沒有 `access` 時繼承 collection access。
- Child rule 只能限縮；generated API 會與 collection rule 取交集，不能擴張 collection access。
- `admin`、`ai`、`super` 是 runtime privileged roles，但一般使用者的規則仍必須用實際帳號驗證。
- Privileged role 不繞過 required tenant boundary；`super` 可選所有 active tenants，但仍必須一次選一個 active tenant。

## Tenant isolation and generated-code compatibility

Tenant 是跨 plugin 的全域 workspace。使用者以扁平 `tenant_ids` 被指派多個 tenants，但一個 session 只有一個 `active_tenant_id`。同一 active tenant 可套用到不同 plugin 的 required MDC，前提是呼叫者也通過各 collection/field role access。API key 最多綁一個全域 tenant，不能動態切換。

`tenant_mode: legacy` 保留既有 unscoped 行為。`tenant_mode: required` 會由 Gateway authenticated request context 驗證 active tenant、caller assignment 與 tenant status，再由平台資料層套用 scope；collection plugin 不參與 tenant authorization。`tenant_id` 是 reserved server field：不得放入 `columns`、不得當 UI input、不得從 query/body 選 scope、不得自行 decode LaFenice JWT。POST 的 client tenant id 會被 active tenant 覆蓋，PATCH 不能改 tenant。

從 `legacy` 啟用 `required` 時，backend 會建立/重用該 plugin 的系統 Legacy tenant，將 main collection、`{key}_history` 與 `entity_type == key` 的 File API 未標記資料歸入 Legacy tenant，建立 tenant indexes，並把 generated unique string constraint 改為 tenant + unique key。這是 bounded、idempotent migration；不涵蓋 custom collections、external stores、caches 或 background jobs。管理者仍須把 Legacy tenant 指派給需要舊資料的使用者。

不得把 Generate Code 當成 tenant migration：

- 標準既有 Python data/history modules 若經 API Gateway 執行、import deployment 的 `services.api_controller.ApiController` 或 scoped `mongo_access` helpers，會在 runtime 使用目前 core tenant enforcement，不需重新產生。
- Code Preview 的 authenticated tenant context 由目前 core 綁定，既有 source 也會受益。
- Generate Code 會建立並啟用 Code Registry latest versions；route mapping 保留不等於 custom source 保留。只為 tenancy 批次重產會帶來不必要的客製碼覆寫風險。
- 只有 inline generated HTML/template 需要新版行為時才為該 group 重產。重產前保存 latest content 與 custom diff，之後重新套用並回歸。

啟用前必須人工審核以下 compatibility gaps：raw `pymongo`、unrestricted `get_collection()` / direct collection methods、copied controller/helper、direct/non-Gateway route、Scheduler/MQTT/queue/startup/background execution、custom tenant-owned store，以及不接收 runtime context 或 access token 更新後不 reload 的舊/custom HTML。這些情況不得以 request-supplied `tenant_id` 修補；改用明確、server-bounded 且已批准的 tenant execution 設計。

Required-mode 驗收至少使用兩個全域 tenant A/B：驗證 list/get/create/update/delete、history、reference display、unique、private file 與 tenant switching；已知 B record id、偽造 body/query `tenant_id` 與無 active tenant 都不能越界。另以同一 tenant 驗證兩個不同 plugin 的 required MDC 都正確隔離且仍各自 enforce role access，並驗證 super 未選 tenant時被拒絕、選定後只看到該 tenant，以及 Legacy tenant 使用者仍能存取舊資料。

## Common column shape

```json
{
  "key": "order_no",
  "display": "Order Number",
  "type": "string",
  "required": true,
  "i18n": {
    "label_key": "collection.sales_orders.column.order_no",
    "help_key": "collection.sales_orders.column.order_no.help",
    "placeholder_key": "collection.sales_orders.column.order_no.placeholder"
  },
  "access": {
    "read": {"auth_required": true, "roles": ["sales"]},
    "write": {"auth_required": true, "roles": ["sales_manager"]}
  },
  "validation": {},
  "ui": {}
}
```

Reserved keys：

```text
_id, id, created_at, created_at_format, created_month, created_date,
created_by, updated_at, updated_at_format, updated_by, tenant_id
```

Column 與 relation keys 共用同一 namespace，不得重複。

## Field catalog

### String

```json
{
  "key": "order_no",
  "type": "string",
  "required": true,
  "unique": true,
  "validation": {"min_length": 1, "max_length": 50, "pattern": "^[A-Z0-9-]+$"},
  "ui": {"component": "text_input"}
}
```

Generate Code 只把第一個 `unique: true` string 當作 `ApiController.unique_key`；多個 unique 欄位不會自動得到完整 database constraint。

### Number

```json
{
  "key": "total",
  "type": "number",
  "required": true,
  "decimal_places": 2,
  "validation": {"min": 0, "max": 99999999},
  "ui": {"component": "number_input", "step": 0.01}
}
```

`decimal_places` 必須為 0–18。

### Date / datetime

```json
{"key": "order_date", "type": "date", "required": true, "ui": {"component": "date_picker"}}
```

```json
{"key": "scheduled_at", "type": "datetime", "required": false, "ui": {"component": "datetime_picker", "minute_step": 5}}
```

Backend 固定 normalize 成 `storage.format: epoch_ms`。不得設定 timezone；runtime 使用 system timezone。

### Boolean

```json
{"key": "enabled", "type": "boolean", "required": true, "default": true, "ui": {"component": "switch"}}
```

### Option

```json
{
  "key": "status",
  "type": "option",
  "required": true,
  "multiple": false,
  "options": [
    {"value": "draft", "label_key": "order.status.draft"},
    {"value": "confirmed", "label_key": "order.status.confirmed"}
  ],
  "ui": {"component": "select"}
}
```

`options` 必須非空；value 不得重複。Multiple option 儲存 string array。

### Reference

```json
{
  "key": "customer_id",
  "type": "reference",
  "required": true,
  "multiple": false,
  "reference": {
    "collection": "customers",
    "value_field": "id",
    "display_field": "name"
  },
  "ui": {"component": "collection_select", "search_fields": ["name", "email"]}
}
```

Metadata 可先於 target 建立；runtime write 才驗證 target value。Primary item 保留 id，generated response 以 `reference_values` side-load 顯示 label/data。

### Embedded

```json
{
  "key": "billing_address",
  "type": "embedded",
  "required": false,
  "multiple": false,
  "embedded": {
    "collection": "addresses",
    "value_field": "id",
    "display_field": "name",
    "copy_fields": ["id", "name", "postal_code", "address"]
  },
  "ui": {"component": "collection_select"}
}
```

`copy_fields` 必須非空、不得重複且包含 `value_field`。Embedded 是 snapshot，不會隨 source 更新。

### JSON

```json
{
  "key": "metadata",
  "type": "json",
  "json": {"allowed_root": ["object", "array"], "max_depth": 10},
  "ui": {"component": "json_editor"}
}
```

`allowed_root` 只能含 `object` / `array`；`max_depth` 為 1–100。

### HTML

```json
{
  "key": "custom_content",
  "type": "html",
  "html": {"sanitizer_profile": "div_style_only"},
  "ui": {"component": "html_editor", "preview": true}
}
```

只允許 `div_style_only`。Runtime 必須實際 sanitize；metadata 本身不是 sanitizer。

### Rich text

```json
{
  "key": "description",
  "type": "rich_text",
  "rich_text": {
    "format": "prosemirror_json",
    "features": ["paragraph", "heading", "bold", "italic", "bullet_list", "link"]
  },
  "ui": {"component": "rich_text_editor"}
}
```

Format 固定 `prosemirror_json`。Features 只能使用 `paragraph`、`heading`、`bold`、`italic`、`underline`、`strike`、`ordered_list`、`bullet_list`、`blockquote`、`code`、`code_block`、`link`。

### File

```json
{
  "key": "attachment_file_id",
  "type": "file",
  "required": false,
  "file": {
    "visibility": "private",
    "accept": ["application/pdf", "image/*"],
    "max_size_bytes": 10485760
  },
  "ui": {"component": "file_upload", "show_preview": true, "allow_remove": true}
}
```

儲存 File API id，不儲存 URL。Visibility 為 `public` 或 `private`；accept 非空；size 為 1 byte–10 GiB。

## File inference and upload contract

### Prefer behavior over source primitive type

把欄位映射成 `type: file`，只要其業務行為是讓使用者透過 LaFenice 上傳、保存、預覽、下載、刪除或控管存取。來源常把檔案表示為 `string`，不能因此直接映射成 MDC string。

Strong file signals：

- OpenAPI `type: string, format: binary`、multipart file part。
- JSON Schema `contentMediaType`、`contentEncoding: base64`，或 byte/base64 payload。
- SQL/ORM `blob`、`bytea`、binary stream。
- File API id，或要匯入平台的 object-storage key、local path、legacy file URL。
- Field/key/display 語意為 attachment、upload、image/photo/avatar/logo/icon、resume/CV、certificate、PDF、audio、video 或 media。
- UI 明確要求 file picker、drag-and-drop、preview 或 download。

不是 file 的常見情況：

- 永遠保留在外部系統、LaFenice 不負責上傳或授權的 immutable URL。
- `filename`、MIME、checksum、caption 等純 metadata；它們可作獨立 string，也可由 File API metadata 取代。
- Rich text 或 HTML content 本身；除非使用者要上傳一個 `.html` / document file。

對 URL 或語意不清欄位，不要靜默猜測。先輸出 candidate 與理由，再確認「LaFenice 是否負責檔案生命週期」。

### Canonical single file

```json
{
  "key": "invoice_file_id",
  "display": "Invoice",
  "type": "file",
  "required": true,
  "multiple": false,
  "file": {
    "visibility": "private",
    "accept": ["application/pdf"],
    "max_size_bytes": 10485760
  },
  "ui": {
    "component": "file_upload",
    "show_preview": true,
    "allow_remove": true
  }
}
```

### Canonical multiple files

```json
{
  "key": "attachment_file_ids",
  "display": "Attachments",
  "type": "file",
  "required": false,
  "multiple": true,
  "file": {
    "visibility": "private",
    "accept": ["application/pdf", "image/*"],
    "max_size_bytes": 10485760
  },
  "ui": {
    "component": "file_upload",
    "show_preview": true,
    "allow_remove": true
  }
}
```

確認 deployed runtime 能以 array 保存與呈現多個 ids。新版基線 page 支援 `multiple: true` 的多檔 picker、逐檔上傳與 id array 回寫；舊 page 必須重新 Generate Code。

### File API lifecycle

1. 以 access token 送 `multipart/form-data` 到 `POST {ApiBase}/files`。
2. 使用 metadata 的 `visibility`，並把 `accept` / `max_size_bytes` 用於 generated client validation；File API 另行 enforce 授權與全域大小政策。若需要不可繞過的欄位級限制，必須在 server-side handler 加驗證。
3. 只把回傳的 `id`（或 id array）存入 MDC record。
4. 透過 `/files/{id}/content` 或 `/download` 顯示/下載；private file 必須帶授權。
5. 區分「從 record 移除 id」與「DELETE File API object」。沒有 ownership/共享判斷時，不得因清空欄位就刪除實體檔案。

不要把 file id 默認放入 `ui.list.columns` 或設為 `title_field`。Reference table renderer 可能只顯示 raw id；若需要縮圖、原始檔名、content/download link 或 private preview，必須確認實際 page 有安全 renderer，否則建立自訂 HTML latest version。

### Generated page behavior and versioning

目前基線 generated data page 把 visible `type: file` render 成 file picker，支援 `accept`、`max_size_bytes`、single/multiple、File API multipart upload、既有 id 保留/替換/移除，以及 id/id-array 回寫。從 record 移除 id 不會刪除 File API object；若 record write 失敗，page 只會 best-effort 清理由該次 save 新上傳的檔案。

Generated HTML 是 Code Registry version，不會因 metadata PATCH 自動更新。既有 deployment 若仍顯示 file id 文字 input，先以 `data_management: true` 重新 Generate Code，再確認實際 Gateway route/module。只有最新基線仍不符合需求，或需求包含 private inline preview、列表縮圖、進度/取消、欄位級 server validation 等進階行為時，才用 `develop-plugin-code` 建立自訂 latest version。

## Has-many master-detail

Master relation：

```json
{
  "key": "order_items",
  "display": "Order Items",
  "type": "has_many",
  "target_collection": "sales_order_items",
  "foreign_key": "master_col_id",
  "i18n": {"label_key": "collection.sales_orders.relation.order_items"},
  "access": {
    "read": {"auth_required": true, "roles": ["sales"]},
    "write": {"auth_required": true, "roles": ["sales_manager"]}
  },
  "ui": {
    "component": "detail_link",
    "route": "/project-root/sales-order-items-page",
    "prefill": {"master_col_id": "$record.id"},
    "lock_prefill_fields": ["master_col_id"]
  }
}
```

- `type` 只能是 `has_many`。
- `target_collection` 與 `foreign_key` 使用合法 key。
- `ui.route` 可省略；若提供，必須是包含 project root path 的 absolute frontend route，不含 origin 或 API base。
- `prefill[foreign_key]` 必須等於 `$record.id`；locked fields 必須包含 foreign key。
- Product plugin 預設使用 `master_col_id` 作 system-owned back reference。
- Detail config 可把 `master_col_id` 描述成 hidden reference column，但 generated UI 不應讓使用者直接編輯它。

## UI visibility

Generated UI 把以下欄位視為 hidden：

- `ui.hidden: true`
- `ui.visible`、`show`、`display`、`show_in_ui` 或 `display_in_ui` 為 false
- `ui.component` 為 `hidden`、`none`、`no_ui`、`no-ui`

List 用 `ui.list.columns`。Create/Edit form 用所有 UI-visible、目前角色可讀的 metadata columns。Single-record response 必須保留這些 form fields；list response 可縮減到 list surface 加 system fields。

## Optional empty values

Generated form 可能送 `null` 或空字串。Runtime 應依 metadata `required` 正規化：選填 string/number/date/datetime/reference 的空值視為未提供；必填欄位仍拒絕。不要把規則綁死到特定 collection 或 field。
