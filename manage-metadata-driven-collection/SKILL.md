---
name: manage-metadata-driven-collection
description: 在無 source-code access 的 production 環境中，透過 deployed LaFenice API 安全且有效率地新增、讀取、完整替換編輯或刪除 product plugin 的 metadata-driven collection (MDC) config，包含欄位型別推斷、file/upload 欄位、驗證、list/form UI、access roles、reference/embedded、has-many master-detail、source_code_endpoint、Language Pack 與 Generate Code。Use when Codex must create or modify conventional LaFenice CRUD/history collections from an exact deployed project URL, especially when attachments, images, documents, binary data, or File API uploads must become type=file. Require that URL plus a role-ai account/password before remote design or mutation; use Code Registry skills only when metadata and generated behavior are insufficient.
---

# 管理 Metadata-driven Collection

## 套用 production gate

開始遠端設計、盤點或寫入前，先使用 `get-plugin-edit-access` 取得並驗證：

1. 使用者指定的 exact deployed project URL 與環境。
2. 角色包含 `ai` 的 LaFenice 帳號與密碼。
3. RSA-OAEP-256 登入成功，且 `/auth-me` 確認包含 `ai`。

缺少任一項就詢問並停止。不得替換成 localhost、repository URL、API Key、預設帳密、其他環境憑證或既有 browser session。密碼、ciphertext、access/refresh token 只留在目前程序記憶體，不得寫入 payload 檔、log、diff、skill、URL 或回覆。

假設 agent 看不到 application source、container、deployment files 或 database。所有 MDC 操作一律走使用者指定 deployment 的 API；若實際 contract 不相容，記錄 HTTP status 與非敏感 response shape，停止該能力，不要猜測 storage 或繞過 API。

## 載入必要資源

- 在草擬或檢查 config 前，完整閱讀 [references/collection-contract.md](references/collection-contract.md)。
- 在執行遠端 create、edit、generate 或 delete 前，完整閱讀 [references/remote-operations.md](references/remote-operations.md)。
- 在寫入前執行 `scripts/validate_mdc_config.py`；它是快速 preflight，deployed backend 仍是最終準則。
- 若輸入是外部 JSON Schema、OpenAPI、DDL、ORM、CSV/JSON samples 或 legacy data dictionary，而不是已確認的 MDC config，先使用 `convert-external-schema-to-mdc` 產出 conversion package。只有 `ready_for_mdc: true` 或使用者已接受所有 blocking decisions 時，才進入本 skill 的遠端設計/寫入。

## 先把需求正規化

只收集會改變資料模型或權限的資訊，不要廣泛盤點整個系統：

- 固定 identity：`plugin`、collection `key`、`display`。
- 欄位：`key`、type、required、default、validation、unique/multiple、reference/embedded/file 等 type-specific 設定。
- 權限：collection read/write roles，以及少數需要更嚴格規則的 field/relation override。
- UI：title field、list columns、真正需隱藏的欄位、has-many detail navigation。
- Runtime：只要 data management、只要 history，或兩者都要；是否啟用 `tenant_mode: required`。
- 語系：collection、column、option、relation 的顯示文字與 locales。

逐欄掃描 file signals，不得只照外部 primitive type 映射：field/key/display 含 attachment、upload、image、photo、avatar、logo、resume、certificate、PDF、audio/video/media，或來源是 binary、blob、bytea、base64、multipart、content/media type、File API id 時，先套用「判斷 file 欄位」流程。若使用者希望在平台上傳、預覽、下載或控管檔案，即使來源 schema 是 `string` 或 URL，也優先建模為 `type: file`；只有確定是不可上傳的外部 URL、檔名或純文字內容時才保留 `string`。

可安全採用 backend default 的項目不要反覆詢問：`i18n.label_key`、`source_code_endpoint`、date/datetime `storage.format`。不得自行假設 public access、欄位刪除、key rename、資料 migration 或重產已自訂的 generated code。

## 選擇最短安全路徑

### 新增 collection

1. 只查目標 key：`GET /collection-config/{key}`。若已存在，不要用 POST 猜測；回報衝突並確認使用者要編輯既有 config 或改 key。
2. 建立完整 config。設定穩定的 `plugin`，避免跨 plugin 共用 generic identity。
3. 檢查 reference/embedded target、file candidates、`ui.list` 欄位與 has-many pair 的名稱是否一致。
4. 將非敏感 config 存到暫存 JSON，執行：

   ```text
   python scripts/validate_mdc_config.py <config.json> --mode create
   ```

5. `POST /collection-config`，讀回 `item`，確認 normalized config、`version: 1`、plugin 與 endpoints。
6. 只有使用者需要 runtime API/page 時才 Generate Code；使用明確 generation flags。
7. 補齊 Language Pack，並驗證實際 Gateway API/page，而不是只看 write/generate response。

### 編輯既有 collection

PATCH 是完整 replacement，不是 partial patch：

1. `GET /collection-config/{key}`，以回傳的完整 `item` 為唯一編輯基線。
2. 複製 item，只套用使用者要求的最小 semantic diff。保留 `key`、最新 `version` 與所有未知但合法欄位。
3. 同步修正受影響的 `ui.list.title_field`、`ui.list.columns`、relation、reference/embedded source 與 i18n keys。
4. 顯示或自行審核 before/after diff。不得把缺省欄位誤當刪除指示。
5. 執行：

   ```text
   python scripts/validate_mdc_config.py <updated-config.json> --mode update
   ```

6. `PATCH /collection-config/{key}` 送完整 config，讀回確認 version 只增加 1 且目標 diff 已生效。
7. 若回 `COLLECTION_CONFIG_VERSION_CONFLICT`，重新 GET 最新 item、重新套用同一 semantic diff、再驗證與 PATCH；不要重送 stale payload。
8. 先判斷既有 runtime 是否會動態讀取變更後的 metadata；可直接生效時不要重產。只有需要新的 template/inline code 行為時才重產，並依 [references/remote-operations.md](references/remote-operations.md) 的 Generate Code 流程保存客製 source、既有選單設定與各語系翻譯，重產後重新套用並比對。

## 評估變更風險

- 欄位 rename 等同刪除舊 metadata key 再新增新 key；不會遷移既有 business data。沒有 migration 決策時不得自動 rename。
- 新增 required 欄位、縮緊 validation、改 type、reference target、`multiple` 或 unique 可能讓既有資料不相容。先要求既有資料處理策略，或明確把 migration 標為未處理。
- 移除欄位 metadata 不代表刪除既有 document value；需要清理資料時改用被授權的進階資料 migration workflow。
- 改 `source_code_endpoint` 會建立或使用不同 module/route identity；舊 module/route 不會因此自動安全刪除。先做 owned-resource impact check。
- `tenant_mode` 從 `legacy` 改成 `required` 代表啟用 MDC multi-tenancy，會把 main、history 與關聯 file 的未標記資料歸到以 collection plugin 為 migration namespace 的獨立系統 Legacy tenant，並調整 generated unique index。Tenant 本身是全域的，不屬於該 plugin；plugin 只保留 collection identity 與 Legacy migration 用途。啟用前確認 plugin identity 穩定、記錄 migration 結果，並安排 Legacy tenant 使用者授權；啟用後不得關閉或改 plugin。
- Tenant isolation 是 core data-access migration，不是 Generate Code migration。標準 Gateway generated handler 使用平台 `ApiController` / scoped `mongo_access` 時不得只為 tenancy 重產；先依 [references/collection-contract.md](references/collection-contract.md) 的相容性條件審核 raw Mongo、非 Gateway、background 與 custom HTML 例外。
- `ui.list.columns` 只控制 list/table surface；create/edit form 使用所有 UI-visible 且可讀的 `metadata.columns`。不要為縮短列表而刪除表單欄位或後端 write 能力。
- UI 隱藏不是安全邊界；collection/field access 必須由 runtime API enforce。

## 判斷與實作 file 欄位

先判斷業務行為，再判斷來源 primitive type：

1. 使用者是否要從 LaFenice 選檔上傳、保存、預覽、下載、刪除或套用 public/private 權限？若是，使用 `type: file`。
2. 來源是否為 OpenAPI `format: binary` / `byte`、JSON Schema `contentMediaType` / base64、SQL `blob` / `bytea`、multipart part，或既有檔案 URL/路徑要匯入平台？若是，使用 `type: file`，並把舊內容轉 File API id 的工作列為 migration。
3. 值是否只是永遠留在外部系統的 URL、檔名、MIME label 或 checksum，且 LaFenice 不負責上傳與存取？若是，保留 `string`；不要把所有含 `url` 或 `name` 的欄位誤判為 file。

File config 至少明確決定：

- single 或 `multiple`；單檔建議 key 以 `_file_id` 結尾，多檔以 `_file_ids` 結尾。修改既有 schema 時不得未經同意 rename。
- `file.visibility`：不確定時採 `private`，不得自行公開。
- `file.accept`：依明確 MIME/副檔名需求填入；未知時可用 `['*/*']`，但要標記待縮限。
- `file.max_size_bytes`：採使用者限制；未知時保留 backend default 並在交付中說明。
- `ui.component: file_upload`、`allow_remove`，以及只有可安全 inline 呈現時才啟用 `show_preview`。
- 不要把 raw private File API id 默認放進 `ui.list.columns` 或當 `title_field`。若列表需要縮圖、檔名或下載動作，驗證 generated renderer；只能顯示 id 時，改用自訂 page renderer。

MDC document 只儲存 File API `id`，不儲存 URL、local path、base64 或 object-storage key。建立/編輯資料前，先呼叫 File API 上傳，再把回傳 id 寫入 file field；多檔則需 id array 與相容 UI/runtime。

目前基線 Generate Code page 會為 `type: file` 產生 file picker，於 record 儲存時呼叫 `POST {ApiBase}/files`，依 `visibility` 上傳並只寫入回傳 id；`multiple: true` 寫入 id array。修改或新增 file metadata 後，要以 `data_management: true` 重產 page，不能只 PATCH metadata。

產碼後仍須實際檢查表單與 network：

- 建立時選檔，確認 multipart request 沒有手動設定 JSON `Content-Type`，File API 成功後 record 才收到 id。
- 編輯時不選新檔應保留既有 id；單檔替換、多檔追加、從 record 移除 id、required 與 MIME/size 錯誤都要測試。
- 從 record 移除 id 不等於 DELETE File API object；沒有 ownership/共享判斷時不要刪實體檔案。record write 失敗時，只能 best-effort 清理由該次儲存新上傳的檔案。
- 若重產最新 data-management page 後仍只有 file id 文字輸入，先確認 Gateway 是否仍指向舊/自訂 module；確定是 deployed generator compatibility gap 時，才使用 `develop-plugin-code` 修正 latest HTML。不要把 text input 宣稱為上傳功能。
- Private content preview/download 仍受 File API 授權；需要 inline preview 或列表縮圖時必須另做 runtime 驗收。

## 處理 master-detail

使用 `has_many` 時，同時設計 master relation 與 detail context：

- relation `foreign_key` 使用 system-owned `master_col_id`，不要重用 status、currency、document number 等 business 欄位。
- `ui.prefill.master_col_id` 必須是 `$record.id`，`lock_prefill_fields` 必須包含 `master_col_id`。
- detail URL 使用 `?master_col_id=<master id>`；list、POST、PATCH 必須由 server-side 套用/鎖定 context。
- query-only、payload-only、兩者相同應成功；兩者不同或皆缺應回 `422`。
- direct detail page 缺少 master context 時停用 Create。必須從 master row relation link 實際建立一筆 detail 做 UI 驗收。

若 deployed generated handler/page 不符合以上契約，改用 `develop-plugin-code` 讀取 Code Registry latest version、建立修正版並測 version test 與實際 route；不要修改 application source 或弱化 metadata。

## Generate Code 與語系

明確選擇 generation group，不要靠舊版「省略即全產」行為：

```json
{
  "key": "orders",
  "generate": {
    "data_management": true,
    "history": true
  }
}
```

- `data_management` 產生 CRUD API 與管理 page；`history` 產生 read-only history API 與 page。
- 管理 page 會為 visible `type: file` 欄位產生選檔、MIME/size validation、File API multipart upload、既有 id 保留/移除與 id/id-array 回寫。舊 generated page 必須重新產生 `data_management` 才取得新版行為。
- 不得只為 `tenant_mode: required` 重產。標準既有 Python modules 透過目前 Gateway 與 core helpers 自動取得 scope；只有新版 inline HTML/template 行為確實必要，或相容性審核發現 plugin 自行繞過 scope 時才重產或手動修正。
- Generate Code 會新增 Code Registry latest versions，但保留已存在的 Gateway method mapping；成功 response 不等於 runtime 驗收成功。
- 重產前保存受影響 route 的 key、label、path、分類位置、sort、auth_require、roles、enabled、plugin；後續重存客製 HTML 也必須帶 `gateway.preserve_existing: true` 與既有 endpoint。只修改 MDC/source 不代表授權更改選單名稱、排序或權限。
- 產碼只自動 upsert collection 與 history page label。column、option、relation 與額外 locales 使用 `configure-language-settings` 補齊。
- 此 label upsert 會覆寫既有各語系文字；依 remote-operations 保存並還原原翻譯，只套用使用者要求的文案差異。不可只在產碼後重新猜測翻譯。
- metadata 已足夠時不要手寫 Python/HTML。只有 calculation、aggregation、integration、特殊 workflow 或 generator compatibility gap 才使用 `develop-plugin-code`。

## 完成驗證

至少確認：

- GET readback 與預期 normalized config 一致，plugin 正確，version 正確。
- list title/columns 都引用現存欄位；form 可見欄位沒有被 list config 誤刪。
- access 使用實際獲授權角色測試；只有 AI session 時，不得假稱一般角色矩陣已驗證。
- Required tenant collection 以兩個全域 tenants 驗證 list/get/create/update/delete、history、reference、unique 與 file 隔離；已知 id 與偽造 `tenant_id` 也不可跨界。另確認同一 active tenant 可在不同 plugin 的 required MDC 中形成相同資料邊界（仍須通過各 collection role/access）、無 active tenant 會被拒絕、super 必須選 tenant，以及 Legacy tenant 舊資料可見性。
- reference/embedded option 能載入，has-many link 與 scoped writes 正確。
- 每個 file candidate 都有明確 `file` 或 non-file 判定；file 欄位已驗證 picker、MIME/size/visibility、File API multipart request、record 只存 id/id array、既有值保留/替換/移除、required、失敗清理與預覽/下載權限。若重新產碼後仍只有 id 輸入，記錄實際 module/route 與 compatibility gap。
- selected generated modules、Gateway methods、runtime API 與 App Shell page 可用。
- Generate Code 與每次客製 HTML 儲存後，既有 route 的名稱參照、分類、sort 與權限設定沒有非預期變更；原有各語系翻譯已還原，側邊欄以既有 route key 正確解析 Language Pack。
- create/edit/delete、required/type validation、`401/403/409/422` 的主要路徑符合預期。
- 沒有在檔案、console、URL、browser storage 或回覆洩露 secret。

完成後回報 collection key、plugin、before/after version、變更摘要、`source_code_endpoint`、generation flags、runtime/UI 驗證結果，以及未執行的 migration 或角色測試。
