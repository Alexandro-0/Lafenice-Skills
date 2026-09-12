# External Schema to MDC Mapping Contract

使用本文件將外部 schema 轉成可審核、可追溯的 MDC draft。轉換的目標是保留資料語意，不是逐字複製來源 primitive types。

## Contents

- [Evidence and confidence](#evidence-and-confidence)
- [Key normalization](#key-normalization)
- [Entity and relationship mapping](#entity-and-relationship-mapping)
- [Type mapping](#type-mapping)
- [File decision matrix](#file-decision-matrix)
- [Constraint mapping](#constraint-mapping)
- [UI and access](#ui-and-access)
- [Output contract](#output-contract)
- [Readiness gate](#readiness-gate)

## Evidence and confidence

每個非直接 mapping 都記錄 evidence 與 confidence：

- `high`：explicit type/format、DDL constraint、OpenAPI/JSON Schema annotation、foreign key、使用者明確說明。
- `medium`：多筆一致 sample、清楚命名加上相容值、可合理推導但缺 explicit annotation。
- `low`：單筆 sample、模糊名稱、空值居多、互相衝突的 evidence。

Evidence 衝突時不要任選一個。保留 alternatives，加入 `blocking_decisions` 或採 reversible draft 並把 `ready_for_mdc` 設為 false。

## Key normalization

- 轉 lower snake_case；以 `[a-z]` 開始；只含 `[a-z0-9_]`；最多 64 字。
- 將 camelCase、PascalCase、kebab-case、spaces 與 dotted paths 正規化。
- Collections 優先使用穩定 plural nouns；fields 使用 singular semantics，array/file multi fields 可用 plural。
- File single 建議 `{meaning}_file_id`；multiple 建議 `{meaning}_file_ids`。
- 保留 `source_path`、`source_name`、`target_key` 與 rename reason。
- 不得建立 MDC columns：`_id`、`id`、`created_at`、`created_at_format`、`created_month`、`created_date`、`created_by`、`updated_at`、`updated_at_format`、`updated_by`。

來源 `id` 不得直接成為 MDC column `id`。依匯入能力決定是否保留成 MDC system id、另存如 `external_id`，或建立 migration id map；若來源的 `id` 實際是業務號碼，改成如 `order_no` 並標記 rename。

不得只刪掉 source primary key。每個 collection 選一種 identity strategy：

- `generated_system_id`：來源沒有 stable PK，讓 MDC 建立新 id；nested children 仍要有 import-time correlation strategy。
- `preserve_system_id`：只有匯入流程已確認能安全指定 MDC system id 時使用。
- `external_id_column`：把 source PK 保存成合法 string business column（常用於 UUID/legacy ids）；記錄 unique/index limitation。
- `migration_id_map`：讓 MDC 產生新 id，migration 維護 old→new map 並重寫所有 foreign keys。

若 source PK 被 relation 使用而 strategy 未確認，`ready_for_mdc` 必須 false。

## Entity and relationship mapping

| Source pattern | MDC mapping | Decision rule |
| --- | --- | --- |
| Independent table/object with identity | collection | 有獨立 lifecycle、query、authorization 或 reuse |
| Foreign key / `$ref` to live entity | `reference` | Target 更新時應顯示最新資料 |
| Denormalized snapshot/value object | `embedded` | 需要保存當時內容，不跟 source 更新 |
| Arbitrary object / map | `json` | Keys 不固定或 schema 不值得展開 |
| Homogeneous enum array | `option` + `multiple: true` | Values 是有限集合 |
| Array of entity ids | `reference` + `multiple: true` | 每個 value 指向同一 target collection |
| One-to-many nested entities | detail collection + `has_many` | Child 有欄位、identity、query 或獨立 mutation |
| Heterogeneous/primitive array | `json` | MDC 沒有一般 primitive-array type |

Master-detail 使用：

- Master relation `type: has_many`。
- `target_collection` 指向 detail。
- `foreign_key: master_col_id`。
- `ui.prefill.master_col_id: $record.id`。
- `ui.lock_prefill_fields` 包含 `master_col_id`。
- Detail 可定義 hidden `master_col_id` reference；不得用 business field 代替 back reference。

## Type mapping

先執行 file decision matrix，再套用本表。

| External evidence | MDC type | Notes |
| --- | --- | --- |
| text/varchar/string | `string` | 搬移 min/max length、pattern；URL 仍是 string，除非平台管理檔案 |
| integer/float/decimal | `number` | 推導 `decimal_places`；money migration 需考慮 precision |
| boolean | `boolean` | 只搬移真正 boolean default |
| date without time | `date` | MDC 儲存 epoch ms，system timezone |
| timestamp/date-time/instant | `datetime` | 記錄 source timezone/offset migration |
| enum/allowed values | `option` | 每個 value 建 label key；array enum 用 multiple |
| FK / schema ref | `reference` | 決定 value/display fields；驗證 target exists 留給 deployment |
| snapshot object | `embedded` | `copy_fields` 必須包含 value field |
| arbitrary object/array | `json` | 設 allowed root/max depth；不要虛構 fixed fields |
| trusted editor document model | `rich_text` | 只有 ProseMirror JSON 可直接映射；其他格式需轉換 |
| safe custom div content | `html` | 只有 `div_style_only`；其他 HTML 需 sanitize/migration |
| upload/binary/platform-owned file | `file` | 只存 File API id，不存 bytes/URL/path |

`null` / missing 只決定 required/nullability，不能獨立決定 type。數字字串若有 leading zeros、identifier semantics 或超大精度，保留 string。

只輸出目標 type 支援的 properties，不要為了整齊而填無效的 false/default：

- `unique` 只用於 `string`。
- `decimal_places` 只用於 `number`。
- `multiple` 只用於 `option`、`reference`、`embedded`、`file`。
- `options`、`reference`、`embedded`、`json`、`html`、`rich_text`、`file` 只出現在同名 type。
- Date/datetime 不設定 field timezone；MDC 使用 system timezone。

Canonical UI components：string `text_input`、number `number_input`、date `date_picker`、datetime `datetime_picker`、boolean `switch`、option `select` / `multi_select`、reference/embedded `collection_select` / `collection_multi_select`、json `json_editor`、html `html_editor`、rich text `rich_text_editor`、file `file_upload`。若需求超出這些 hints，列為 custom UI need，不要虛構 generator 一定支援的 component。

## File decision matrix

### Strong evidence for `type: file`

- OpenAPI `format: binary` / multipart file。
- JSON Schema `contentMediaType` 或 `contentEncoding: base64`。
- `byte` / base64 payload、SQL `blob` / `bytea`、ORM binary/blob type。
- 已存在的 File API id。
- 使用者要求 upload picker、drag/drop、preview、download、delete 或 public/private access。
- Legacy URL/path/object key 的內容要被搬入 LaFenice storage。

### Name/description candidates

attachment、file、upload、image、photo、avatar、logo、icon、resume、CV、certificate、PDF、audio、video、media。名稱只是 candidate，不足以決定；例如 `icon_name` 可能只是 UI token。

### Keep as string/non-file

- 外部系統持有且不會由 LaFenice 上傳/授權的 URL。
- filename、MIME、extension、size、checksum、caption 等 metadata。
- Base64 僅是一般 encoded business data，且不是檔案。

### File draft

```json
{
  "key": "contract_file_id",
  "display": "Contract",
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

若 visibility 未知，draft 可用 private assumption，但要加入 blocking/assumption。若 MIME 未知，用 `*/*` 並要求縮限。若 size 未知，省略或記錄 backend default；不要虛構限制。

### File migration

- Binary/base64：decode stream → File API upload → 保存 returned id。
- Legacy URL：確認授權與 SSRF/size/MIME policy → download → File API upload → 保存 id。
- Blob/bytea：stream export，不把 bytes 放進 MDC JSON。
- Multiple files：逐檔 upload，保存 id array；確認 deployed runtime/UI 支援。
- Split metadata fields：File API 已保存 filename、size、MIME、checksum 時，可移除重複欄位；若是 business/audit snapshot，則保留。

## Constraint mapping

| Source constraint | MDC mapping |
| --- | --- |
| NOT NULL / required array | `required: true` |
| nullable / optional | `required: false` |
| string length | `validation.min_length/max_length` |
| regex/check pattern | `validation.pattern` when semantically equivalent |
| numeric range | `validation.min/max` |
| enum | `option.options[]` |
| single string unique | `unique: true` |
| default | type-compatible MDC `default` where supported |

以下不能假裝已被 MDC 完整表達：composite unique、non-string unique/index、cross-field check、conditional required、database trigger、computed/generated column、cascade behavior、row-level security、data migration。全部放進 `unsupported_constraints` 或 `migration_notes`。

## UI and access

- `title_field` 選擇 stable human-readable identifier；若只有 system id，提出更好的 display field。
- List columns 建議 3–7 個短、常用、可排序/辨識欄位。
- 不把 large JSON/HTML/rich text、private file id 或大段文字默認放 list。
- Form 仍保留所有 UI-visible、可讀欄位；list choice 不得刪除 fields。
- 不從 schema 猜角色。缺 access policy 時加入 blocking decision，`ready_for_mdc` 必須 false。
- 不默認 public，也不因缺 access 而讓下游省略 access 後採 backend default。

## Output contract

輸出 JSON object：

```json
{
  "conversion": {
    "source_format": "json_schema",
    "ready_for_mdc": false,
    "readiness_reasons": ["Access roles are not specified."]
  },
  "collections": [
    {
      "source_entity": "PurchaseOrder",
      "split_reason": "Independent entity with stable order number.",
      "identity_strategy": {
        "kind": "generated_system_id",
        "source_key": null,
        "target_key": "id",
        "reason": "Source schema has no explicit primary key; MDC will create ids."
      },
      "mdc_draft": {}
    }
  ],
  "field_mappings": [
    {
      "source_path": "PurchaseOrder.invoicePdf",
      "target_collection": "purchase_orders",
      "target_key": "invoice_file_id",
      "mdc_type": "file",
      "cardinality": "one",
      "evidence": ["format=binary", "contentMediaType=application/pdf"],
      "confidence": "high",
      "transformation": "Upload through File API and store returned id."
    }
  ],
  "relationships": [],
  "file_candidates": [
    {
      "source_path": "PurchaseOrder.invoicePdf",
      "decision": "file",
      "reason": "Explicit binary PDF upload.",
      "confidence": "high"
    }
  ],
  "assumptions": [],
  "blocking_decisions": [],
  "unsupported_constraints": [],
  "migration_notes": []
}
```

Allowed file decisions：`file`、`non_file`、`needs_decision`。每個 candidate 都必須有 reason；不要只輸出被判定為 file 的欄位。

## Readiness gate

只有全部成立才設 `ready_for_mdc: true`：

- Plugin identity 已知且一致。
- 每個 source primary key 與 foreign key 都有可執行的 identity/migration strategy。
- 每個 collection 的 access read/write 已確認。
- Low-confidence type、file、entity split、reference/embedded、master-detail 決策已解決。
- Required key rename 與 reserved-field mapping 已確認。
- File migration、data migration 或 unsupported constraints 已被接受/安排，不會被誤認為 metadata 自動完成。
- 每份 config 通過 `manage-metadata-driven-collection` validator。

`ready_for_mdc` 只代表可交接建立流程，不代表 deployment key/roles/targets、Generate Code 或 runtime/UI 已驗證。
