---
name: convert-external-schema-to-mdc
description: 將使用者提供的外部資料格式或 schema 轉為 LaFenice metadata-driven collection (MDC) 的可追溯設計稿，包含 collection boundaries、欄位 key/type/required/validation、option、reference/embedded、has-many、file candidates、UI 建議、migration notes、confidence 與 blocking decisions。Use when the input is JSON Schema, OpenAPI/AsyncAPI schema, SQL DDL, ORM/model definitions, CSV headers plus samples, JSON/XML examples, legacy database fields, spreadsheet data dictionaries, or natural-language structures that must be normalized before manage-metadata-driven-collection creates or edits MDC configs. Prioritize upload/file semantics over primitive string types; do not mutate a deployment.
---

# 將外部資料結構轉為 MDC

## 保持 conversion 與 deployment 分離

只分析與轉換使用者提供的結構，不呼叫 LaFenice deployment、不要求 URL/帳密、不建立 collection。若使用者同時要求實際建立或修改 MDC，先完成本 skill 的 conversion package，再交給 `manage-metadata-driven-collection`；遠端步驟必須遵守該 skill 的 production gate。

不要把不確定的推論偽裝成 schema fact。保留 source path、原始名稱、證據、confidence、assumption 與 migration requirement，讓下一步可以審核。

## 載入轉換規則

- 每次轉換前完整閱讀 [references/mapping-contract.md](references/mapping-contract.md)。
- 遇到 nested arrays、binary/file、external URL 或 master-detail 時，閱讀 [references/examples.md](references/examples.md)。

## 盤點來源證據

辨認輸入格式並擷取：

- entities/tables/object boundaries 與 stable identifiers。
- fields、primitive/container types、required/nullability、defaults、enum、length/range/pattern、unique/index。
- foreign keys、`$ref`、nested object/array、one-to-one、many-to-one、one-to-many。
- binary/content media、multipart、blob/bytea/base64、URL/path、附件/圖片/文件語意。
- sample values，但不要只因單筆 sample 是數字、日期或空值就確定 type。

證據優先序：explicit schema annotation > database constraint/relationship > multiple representative samples > field name/display wording > single sample guess。

## 決定 collection boundaries

- 把可獨立識別、查詢、授權或重複使用的 entity 建成獨立 collection。
- 把 value-object snapshot 映射為 `embedded`；把仍需跟隨來源更新的關聯映射為 `reference`。
- 把任意、異質或尚未定型的 object/array 映射為 `json`，不要虛構欄位。
- 把 one-to-many child 拆成 detail collection，master 使用 `has_many`，detail 使用 system-owned `master_col_id` context。
- 不要因 nested object 就自動建立新 collection；先判斷 identity、lifecycle、reuse 與 query needs。

## 正規化 identity

把 collection/field keys 轉為 lower snake_case、以小寫字母開始、最多 64 字。不得使用 MDC reserved fields。保留每個 rename 的 `source_path` 與 `target_key`；不要讓 normalized key 失去可追溯性。

若來源欄位碰到 `id`、`created_at` 等 system-managed key，區分「同義 system field」與「業務欄位」：前者記錄為 system mapping，後者改成明確 business key 並列為 rename decision。

每個 source primary key 都必須有 `identity_strategy`：經已驗證的 import 保留為 MDC system id、另存成 `external_id`/business key，或在 migration 中維護 old→new id map。不得靜默丟棄 source key，尤其是仍被 child/foreign key 引用時。

## 先判斷 file，再做一般 type mapping

對每個欄位先執行 file gate：

1. 是否是 binary/blob/bytea/base64、multipart、`format: binary|byte`、`contentMediaType`、File API id，或要匯入的 legacy URL/path/object key？
2. 名稱/說明是否表示 attachment、upload、image/photo/avatar/logo、resume/CV、certificate、PDF、audio/video/media？
3. 使用者是否希望 LaFenice 提供選檔上傳、保存、預覽、下載、刪除或 public/private 權限？

任一強證據成立且平台負責檔案 lifecycle 時，映射為 `type: file`，而不是 `string`。推導 `multiple`、MIME `accept`、`max_size_bytes` 與 `visibility`；不確定 visibility 時採 private assumption 並標記待確認。

只有確定值是外部系統持有的 URL、純檔名、checksum、MIME label 或文字內容，且 LaFenice 不負責上傳時，才保留 `string`。Base64/URL/path 轉 File API id 必須列入 migration notes。

## 映射欄位與限制

依 mapping contract 將來源映射為 `string`、`number`、`date`、`datetime`、`boolean`、`option`、`reference`、`embedded`、`json`、`html`、`rich_text`、`file`。只搬移 MDC 能表達的限制；無法表達的 composite unique、conditional validation、cross-field rule 或 database migration 保留在 `unsupported_constraints`。

不要自行推測 access roles。缺少 read/write policy 時，把它列為 blocking decision；不得以省略 access 的方式讓下一步默認為任一登入者可寫。

為 UI 提議穩定、可辨識的 `title_field` 與 3–7 個 list columns；list 不等於 form。File、JSON、rich text、長 HTML 通常不放 list，除非需求明確。

## 產出 conversion package

同時提供簡短摘要與符合 [mapping contract](references/mapping-contract.md#output-contract) 的 JSON package，至少包含：

- `source_format`、`ready_for_mdc`、`readiness_reasons`。
- 每個 `mdc_draft`。
- 每個 collection 的 `identity_strategy`。
- `field_mappings`：source path、target、MDC type、evidence、confidence、transformation。
- `relationships` 與 collection split reason。
- `file_candidates`：判定為 file/non-file/needs_decision 及理由。
- `assumptions`、`blocking_decisions`、`unsupported_constraints`、`migration_notes`。

先完成 best-effort draft，再把真正阻塞的問題合併成最少數量的問題。不得因一兩個模糊欄位停止整份轉換。

只有在 plugin、access、所有低信心 type/relation/file decisions 與 required migrations 已獲處理，而且每份 draft 通過 `manage-metadata-driven-collection/scripts/validate_mdc_config.py` 時，才設 `ready_for_mdc: true`。

## 交接到 MDC 建立流程

交接時只傳遞已確認的 draft 與 conversion package，不丟失 source mapping。要求 `manage-metadata-driven-collection` 再次檢查目標 deployment 中的 key collision、target collections、roles、File API/runtime 能力與 generated module customization；conversion 的 `ready_for_mdc` 不代表 production 已建立或驗收。
