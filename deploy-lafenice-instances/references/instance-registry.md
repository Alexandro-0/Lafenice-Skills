# 實例索引與部署紀錄契約 v1

供 agent 使用一般檔案工具執行，也作為未來部署工具的格式契約。檔案只保存定位及非秘密資訊；密碼、token、env 原文不進索引、manifest 或對話。範例路徑與 UUID 不是實際登記值。

## 固定發現位置

每次依執行 agent 的 OS 使用者取得唯一預設索引：

| 系統 | 索引路徑 |
| --- | --- |
| Windows | 用系統 LocalApplicationData known folder，再接 `LaFenice/instances.json`；通常是 `%LOCALAPPDATA%/LaFenice/instances.json` |
| macOS | 使用者 home 下 `Library/Application Support/LaFenice/instances.json` |
| Linux / WSL | 非空且為絕對路徑的 `XDG_CONFIG_HOME` 下 `lafenice/instances.json`；未設定或為相對路徑時用使用者 home 下 `.config/lafenice/instances.json` |

無法取得 home／known folder 時報錯，不回退到 cwd。WSL 是獨立執行環境，不自動與 Windows 索引互相覆蓋。

自訂／共用索引：在預設索引旁使用 `registry-location.json`，內容為 `{"schema_version":1,"registry_path":"<索引絕對路徑>"}`。只允許一次跳轉；指標失效時停止，不改用空索引。建立指標前核對既有索引，不能隱藏或覆蓋已登記資料。使用者本次明確指定索引可優先使用，但須顯示 scope；要讓未來對話找到，必須保存指標。不能依賴暫時 shell 變數。

預設一位 OS 使用者一份索引。換帳號、sudo、Windows/WSL 或另一台機器可能看到不同索引；空索引不代表無部署。共用索引由獲授權管理者設置權限及指標；不擅自提升權限或掃描其他使用者私有目錄。

## 名稱與身分

- `instance_id`：初次登記產生 UUID v4，小寫標準格式，永久不變；客戶名稱不作目錄名或 shell 命令片段。
- `display_name`：客戶自訂中文、空格等名稱。去前後空白後為 1–80 個 Unicode code points，拒絕控制字元。以 Unicode NFC 加 casefold 比較唯一性，同一索引不可重複；不能擅自加流水號改客戶名稱。
- 名稱已存在時，判斷是操作既有實例還是另建一套；後者請指定不同名稱。不同 scope 同名時用 ID、host 與入口消歧。
- `compose.project_name`：新部署為 `lfx-<完整UUID去掉連字號>`；既有部署保留實際值。顯示名稱變更不影響它。
- 索引名稱是快取，manifest 是名稱權威；ID 不一致時停止。同一安裝／Docker 資源重複登記需先處理，不能靠不同 UUID 允許雙重管理。

## 索引格式

```json
{
  "schema_version": 1,
  "revision": 1,
  "instances": [
    {
      "instance_id": "6e9d4171-e759-4c01-8cbb-93432f069e22",
      "display_name": "台北正式站",
      "manifest_path": "D:/LaFeniceControl/6e9d4171-e759-4c01-8cbb-93432f069e22/instance.json"
    }
  ]
}
```

索引位置固定，control 位置可由使用者選。未指定 control 時可用有效索引目錄下 `instances/<UUID>/`，先確認不在 release、repository 或資料掛載內，告知路徑即可，不另要求客戶選技術目錄。索引本身也不得放在會被新版解壓覆蓋的位置。

## Manifest 欄位與型別

除明確註明可為 null 的項目，accepted manifest 必須有可核對值；無法查證的其他值可暫存 null，但 state 必須是 pending 或 needs-review。不得以範例補值。所有 JSON 路徑字串必須屬於所記錄執行主機的絕對路徑。

| 欄位 | 型別與契約 |
| --- | --- |
| schema_version, revision | 整數 1、正整數且單調遞增；未知 schema 拒絕寫入 |
| instance_id, display_name | 字串，永久 ID 與客戶名稱 |
| state | pending / accepted / updating / needs-review |
| created_at, updated_at | UTC ISO 8601 字串 |
| execution | 物件：os、environment（native/wsl）、wsl_distribution（非 WSL 為 null）、deployment_host 字串 |
| docker | 物件：context、無憑證 endpoint、實測 daemon_id 字串；同名 context 不一定同一 daemon |
| installation_root, active_release | 絕對路徑字串 |
| env | 物件：mode（release-local/external）、path、sha256 字串、revision 正整數 |
| compose | 物件：project_name、project_directory 字串；files 為有序 path/sha256 物件陣列；profiles 為字串陣列 |
| mounts | 物件陣列：service、target、type（bind/volume）、source、read_only 布林、client_path（不適用為 null）、driver（bind 為 null） |
| resources | 物件：containers、networks、volumes、images，各為實際名稱的字串陣列；含可選服務 |
| ports | 物件陣列：service、host_ip、host_port 整數、container_port 整數、protocol（tcp/udp） |
| entry_urls | 不含 token、密碼或使用者資訊的 URL 字串陣列 |
| backup_root | release/repository/data 外的設定快照絕對路徑 |
| config_sources | 物件陣列：kind（file/process-override）、keys 字串陣列、source_ref 字串（本機絕對檔案路徑或受保護來源引用）、restore_notes 字串；不存秘密值 |
| last_verified_at | UTC ISO 8601 字串；尚未驗證為 null |
| verification | 物件：passed、unresolved 各為不含秘密的字串陣列；明列未測項目 |
| operation | 平時 null；操作時為物件：id、previous_release、candidate_release、candidate_env、started_at、phase、snapshot_path；尚未產生的候選／快照為 null |

mounts 的 bind source 保存 daemon 所見絕對來源，client_path 保存 Docker Desktop 等情況的本機映射；volume source 保存實際名稱，不把 Docker 內部 Mountpoint 當成可移植資料路徑。遠端路徑必須附 execution/docker 語境，不能在 agent 本機對它 mkdir。

## 原子寫入、並行與中斷

UTF-8 JSON 嚴格解析，拒絕重複 key；檢查必要欄位、名称唯一、ID 和路徑，保留未知欄位。更新前重讀 revision，變更時不能覆蓋其他操作。

索引修改使用索引旁 `.registry.lock`；部署／改名／設定修改使用 control 內 `.instance.lock`。以原子 exclusive-create 取得鎖，記錄操作 ID、主機、PID、開始時間；不能只按檔案年齡判斷過期。多鎖順序一律 instance → registry；只讀不寫鎖。鎖存在時回報進行中或中斷待核對，不逕自刪鎖。只在 finally 釋放屬於本操作的鎖。共用儲存無法保證原子鎖／替換時，停止依賴此保證的寫入，改用明確協調的單一管理者，不宣稱可靠並行。

寫入前備份舊 JSON；同目錄暫存、flush，再以平台原子替換提交。改名先写 manifest 再更新索引快取；不一致時按同一 ID 的 manifest 修復。新增先寫 manifest 再登記索引；中斷留下未索引 manifest 時由指定路徑核對並登記，不重產 UUID。登記索引時持 registry lock 重新檢查名稱與資源重複，競爭失敗不得啟動。兩檔不是跨檔交易，保留復原資訊。

設定更新以 operation 記錄階段，驗證成功才更新 active_release/env/state；失敗保留診斷與舊 accepted 快照。env/Compose hash 與登記不符時先核對合法人工修改，不能自動覆蓋或視為已接受版本。hash 不能單獨證明資源歸屬。

## 找不到時

- 索引不存在：顯示 OS 使用者、scope、預期位置；在已授權 Docker 目標做有限只讀盤點，請客戶提供既有安裝／control 位置。不得全磁碟找 env 或自動新裝。
- 索引損壞：保留原檔，依可核對備份及 manifests 重建，不能直接寫空索引。
- manifest 搬家：核對新位置、原 UUID、實際資源後修復索引；移 control 不等於授權移資料。
- daemon 不可達或身分改變：先釐清目標，不自動切換本機 Docker。
- 名稱查無結果：列可用名稱；不按相似名稱、最近使用或唯一剩餘實例直接部署。
