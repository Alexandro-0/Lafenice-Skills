# 依客戶名稱操作 LaFenice：方案與驗收

## 客戶體驗

- 「安裝 LaFenice，叫台北正式站，放 D:/LaFenice/production。」建立名稱與永久 ID。
- 「更新台北正式站。」幾週後的新對話從 OS 固定索引找到同一套。
- 「列出已登記的 LaFenice。」顯示 scope；不將索引宣稱為全主機掃描結果。
- 「台北正式站改名營運站。」只改顯示名稱，服務不重啟。
- 「登記原本的測試環境。」只讀核對並保存紀錄，不搬資料。

客戶指定名稱與意圖；agent 定位設定與資料。名稱歧義才問哪個實例，目標已明確就不重問技術路徑。新增實例才需要安裝目的地。

## 三層結構

1. OS 使用者固定索引：UUID、名稱快取、manifest 絕對路徑，負責發現。
2. 實例 control/manifest：永久身分、accepted 設定、Docker 目標、資源與操作紀錄。
3. 真實 Docker、檔案與資料：執行事實，必須核對；有紀錄不代表歸屬一定正確。

名稱、release、設定 revision 可變，UUID 不變。Docker 身分與資料位置只有明確遷移才改；設定及資料備份獨立。

## 本次交付範圍與後續工程

本次交付 skills、紀錄格式、登記／改名／更新程序與相容規則；尚未新增 CLI、JSON validator、原子寫入 helper 或修改匯出包啟動器，未自動納管客戶。Agent 可依契約使用一般工具寫紀錄；工具若不能保證鎖、原子提交或設定解析，就保留候選並回報，不宣稱已有程式強制保護。

後續工程順序：

1. **紀錄核心**：跨平台 list/resolve/register/rename/doctor、JSON schema、名稱正規化、路徑驗證、revision/lock/原子寫入與去秘密摘要；先納管舊部署。
2. **部署核心**：prepare/upgrade/backup/restore、受控子程序、Compose 解析、掛載歸屬、快照與中斷復原。共用邏輯，PowerShell/sh 薄入口；runtime 隨包提供或明確預檢，不假設客戶已有 Python/PowerShell 7。
3. **包格式升級**：service env_file、插值、預檢統一指定設定；取消多套 dotenv 解析。正式更新拒絕資料路徑回退，使用 long syntax 的 bind.create_host_path: false 及 volume 存在檢查；初裝另有 prepare，保留原初始化與相容步驟。
4. **打包與文件一致**：同步 packaging/package-project.ps1 產生的 README，移除整份舊 env 複製升級路線；包內包含兩份 skills 與全部 references。release-local 先相容，external 通過整合測試才啟用。

`lfx instances list`、`lfx instance upgrade --name "台北正式站"` 是未來介面示例，現在不能宣稱可執行。

## 行為驗收

| 情境 | 預期 |
| --- | --- |
| 新對話、任意 cwd 更新指定名稱 | 固定索引定位相同 ID，沿用核對的 env/mounts |
| 中文、空白、大小寫或 Unicode 正規化後重名 | 合法名稱可用；重名拒絕，不自動改客戶名稱 |
| 改名 | UUID/project/volume/設定 hash 不变；舊名稱不自動命中 |
| A/B 並存、shell 殘留 A 變數 | B 不用未登記覆蓋，A 不被停止或修改 |
| A 備份 Restore 到 B | 候選階段拒絕，正式 env 與資料不變 |
| 新包有出廠 env、原設定在其他位置 | 用 manifest 正式來源合併，不判成初裝 |
| volume 缺失或資料磁碟未掛載 | 停止更新，不建立空資料假裝復原 |
| HOST_*_DIR 跨實例或 junction/symlink 同源 | 發現實際共用，停止一般部署 |
| 媒體 UDP／可選服務埠衝突 | 預檢發現，不只檢查 frontend port |
| 索引損壞、缺失或 manifest 搬家 | 保留現場，登記／復原，不初始化另一套 |
| context 同名但 daemon 改變 | 停止，不自動在新 daemon 建資料 |
| 兩個 agent 同時更新或登記同名實例 | 僅持鎖者可修改，競爭失敗者不部署 |
| 在切換／快照／manifest 提交間注入失敗 | operation 可辨認，依實際容器與資料版本復原 |
| env 特殊字元、多行、重複 key、新增秘密 | 依 env-merge 驗收，失敗不覆蓋、不洩漏 |
| Windows、WSL、macOS、Linux | 固定發現位置正確，測中文／空白路徑、權限、LF/CRLF |
| 遠端 Docker 或換 OS 帳號／WSL | 顯示 scope/host，不把本機路徑套遠端，不將空索引當無部署 |

文件驗證只確認結構與引用，不能取代真實跨平台 Docker 測試。fixtures 使用合成秘密與獨立暫存目錄，不動客戶資料。
