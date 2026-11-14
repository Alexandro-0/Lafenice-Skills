# 自訂容器與監控 API

以下路徑相對於目標實例的 API base。JSON 請求使用 Content-Type: application/json 與該實例的 Bearer access token。自訂部署端點要求 super 或 container-deployer；一般部署者只可存取自己的記錄及工作。機器快照獨立要求 super 或 admin。只做其中一類操作時，僅需要該類權限。

| 方法與路徑 | 操作與回應 |
| --- | --- |
| GET /container-deployments | online 表示部署服務心跳，items 含 id、name、revision、status、project、compose、container_names 等欄位。container_names 為 null 表示無可用清單，空陣列表示此次採樣未發現容器。 |
| POST /container-deployments/preview | 傳草稿，取得正規化的 compose、previous、parameters、missing。預覽不建立容器。 |
| POST /container-deployments/apply | 傳相同草稿及必要的 values。HTTP 202 回傳 job 與部署 id。 |
| POST /container-deployments/{id}/remove | 傳最新 revision 及布林值 volumes（預設 false）。HTTP 202 回傳 job 與 id。 |
| GET /container-deployments/jobs/{job} | queued 表示尚無最終結果。約每 1–2 秒讀一次，completed 後重讀記錄，failed 時讀 error。 |
| GET /container-deployments/{id}/compose | 回傳 application/yaml，可直接存為 compose.yaml，環境參數以變數參照保留。 |
| GET /system/machine-status | 唯讀。查看 scope、sampled_at、stale、host、containers、api 與 mongodb；依可用欄位呈現。 |

## 草稿與匯入

建立時省略 id，revision 使用 0。更新時在相同 JSON 加入部署 id，revision 換成目前版本。name 為 1–80 字元，source 為完整 YAML 或指令字串。例：

```json
{"name":"訂單資料庫","revision":0,"source":"services:\n  database:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata: {}\n","values":{}}
```

匯入檔案時直接讀取文字作為 source。上例預覽會列出 POSTGRES_PASSWORD，在 apply 的 values 以該名稱帶入安全取得的值。提供使用者下載時，把 source 的文字存成 YAML。匯出只包含部署配置，目的主機需具備可用的映像檔、連接埠與對應參數。

UI 匯入上限為 64 KiB。平台支援 1–16 個 services；每個 service 支援 image、environment、ports、具名 volumes、restart、depends_on、command、entrypoint。環境參照使用單純的 ${VARIABLE}。docker run 支援 -d、--name、--restart、-e、-v、-p 與對應長選項；--name 轉成服務名稱，實際容器名稱以採集結果為準。遇到不支援的設定（如任意主機路徑、build），指出欄位及影響，勿靜默丟棄後部署。

## 失敗與快照判讀

401 檢查目標實例的工作階段；403 回報所缺角色；404 檢查 ID 和可見範圍。409 表示版本改變，重新讀取部署並比對差異後再預覽。422 檢查 detail、來源格式和缺少的參數。503 表示部署服務離線；恢復後再提交。工作失敗時以結果的 error 和最新 revision 判斷下一步。

host.memory_used、host.memory_total、host.disk_free 是採集器所見主機的位元組數；containers 各列的 memory 是容器用量。api_disk_free 僅代表 API 工作目錄所在檔案系統。stale 表示舊快照；collector_disabled、snapshot_unavailable、inventory_error 或單筆 partial 時說明缺少的資料。此時空清單不能證明主機沒有容器。依快照列出所有可見容器，容器狀態讀 state，健康檢查讀 health；缺少 health 時避免推定健康。

## 含附件的部署包

POST /container-deployments/import-package，以 application/zip 傳原始 ZIP。根目錄放 compose.yaml，其他檔案作附件。ZIP 上限 5 MiB，最多 128 個附件，附件解壓總量 4 MiB。使用 ZIP 內的相對路徑掛載單檔或資料夾，例如 `./init:/docker-entrypoint-initdb.d:ro`。部署服務以唯讀方式交給容器，腳本執行時機由映像決定。PostgreSQL 僅在空資料目錄初始化時執行 init SQL。

將匯入回應的 source 與 files（相對路徑對 base64 內容）帶入 preview 和 apply。預覽的 files 表示新增、修改、移除或未變；mounts 列出來源、服務與容器目的路徑。更新時省略 files 會沿用目前附件；傳空物件可清空。GET /container-deployments/{id}/package 匯出 Compose 和附件，供其他實例重新匯入，不含資料卷。附件以原始內容匯出，機密值使用環境參數。

### 判斷腳本何時執行

Compose 的掛載設定決定檔案出現在容器的哪個路徑。匯入 ZIP 或掛載檔案本身不會執行腳本。LaFenice 將附件檔案設為唯讀（0444），啟動行為取決於映像內的程式。

- **首次初始化**：官方 PostgreSQL 映像會在資料目錄為空時處理 `/docker-entrypoint-initdb.d/` 裡的初始化 SQL。沿用既有資料卷並更新 SQL 只會換掉掛載的檔案。若要更新既有資料庫，應使用對應的資料庫遷移流程。
- **每次啟動**：將腳本隨 ZIP 匯入。在 Compose 中用 `entrypoint` 指定映像內可用的直譯器和容器內腳本路徑，`command` 提供腳本參數。例如 PostgreSQL 服務可以加入下列設定：

```yaml
entrypoint: ["/bin/sh", "/app/start.sh"]
command: ["postgres"]
volumes:
  - ./scripts/start.sh:/app/start.sh:ro
  - pgdata:/var/lib/postgresql/data
```

在根層宣告具名資料卷 pgdata。腳本最後使用 `exec docker-entrypoint.sh "$@"`，交由官方 PostgreSQL 映像完成初始化並啟動主程序。其他映像應按其實際啟動方式調整。以 LF 儲存 shell 腳本。可在腳本印出啟動訊息，重啟同一容器後檢查訊息再次出現及服務可用性。

兩個欄位都支援字串、字串陣列及 null。省略或 null 沿用 Compose 的預設行為；空字串或空陣列會清空相應的預設。非 null 的 entrypoint 會取代映像入口並忽略映像原有 CMD，有需要時應明列 command。建議陣列形式保留引數邊界。Compose 欄位中的容器變數使用 `$$` 跳脫，並由容器內的 shell 展開；ZIP 腳本內直接使用一般 shell 語法。
