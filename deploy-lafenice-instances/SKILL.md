---
name: deploy-lafenice-instances
description: 依客戶指定的實例名稱列出、登記、改名、部署與維護 LaFenice，透過作業系統固定索引找回各實例 env、Docker 目標、資料掛載及備份。適用於多實例隔離、幾週後更新、既有安裝納管與部署環境混用排查。
---

# 依名稱管理 LaFenice 實例

使用者只需表達「操作哪個實例」，例如「更新台北正式站」。名稱由客戶指定；永久 UUID 與 Docker 資源身分獨立於名稱。改顯示名稱不改 project、容器、network、volume、資料路徑或秘密。

本 skill 是 agent 可使用一般檔案與 Docker 工具執行的流程，尚未提供 `lfx` CLI 或管理 daemon。不要宣稱只安裝 skill 就已建立索引或納管服務。每次實際登記後交付紀錄位置與核對結果。

## 每次操作先定位實例

先讀 [實例索引與部署紀錄契約](references/instance-registry.md)，依 OS 固定位置找索引；不依賴前次聊天、目前目錄或全域「上次使用實例」。只列名稱、ID、Docker 目標、入口與狀態，不讀出秘密。

- 指定名稱或 ID：精確解析並核對 manifest；同名歧義或明確名稱查無結果時列出候選，不改操作另一套。
- 指定安裝路徑：解析實際路徑並比對登記；不能因名稱不同把同一安裝登記兩次。
- 未指定目標：沿用本次對話已明確選定且重新核對的實例；否則列出候選請選擇。即使只登記一套，也不把索引當成主機完整盤點。
- 只下載 ZIP：交給 [install-lafenice](../install-lafenice/SKILL.md)，不需要建立實例。
- 索引不存在、損壞或路徑失效：走契約中的復原／既有安裝登記，不能把「查不到」視為初裝。

每次變更前顯示摘要：客戶名稱與 ID、Docker 目標、目前與候選 release、正式 env 絕對路徑、資料來源及備份位置。目標明確且已授權時直接繼續，不反覆確認。缺目標時詢問實例名稱，不要求客戶重新提供每個技術路徑。

## 按任務執行

### 初次安裝

1. 取得客戶指定的名稱與安裝位置；已提供就沿用。依契約檢查名稱重複並產生 UUID。第一套與後續實例使用相同隔離規則。
2. 由 [install-lafenice](../install-lafenice/SKILL.md) 下載、設定秘密、確認資料與埠。新建 Compose project 使用固定 `lfx-<UUID去掉連字號>`，不要由顯示名稱推導；所有明確命名的容器、network、volume、image 也要唯一。
3. 根據包內契約設定所有資源，不只 frontend port。核對媒體 UDP、可選服務、各 `HOST_*_DIR` 與 overrides。資料放 release 外；容器內部 MQTT `1883`、Valkey `6379` 與該包 FastAPI 內部埠維持原契約。
4. 在非 release、非 repository、非資料掛載的位置建立穩定 control 目錄，依契約先寫 pending manifest 與索引。依 [操作與相容流程](references/instance-operations.md) 預檢；成功才改 accepted，失敗保留紀錄與診斷。

### 登記既有安裝／索引復原

客戶尚未使用本管理方式、不知道設定位置或需要協助辨識舊部署時，使用 [adopt-lafenice-instance](../adopt-lafenice-instance/SKILL.md) 的首次納管引導，協助探索、命名、建立固定入口並重新查找驗證。

讀 [操作與相容流程](references/instance-operations.md) 的納管流程。先只讀核對實際 Compose labels、mounts、env 來源與 Docker 目標，再登記。保留原 project、named volumes、資料位置與秘密；不執行第二實例設定腳本，不啟動、不重啟、不搬移資料。無法核對的項目標 needs-review，不能補猜後直接更新。

### 更新、設定異動、備份與還原

先定位，再讀 [操作與相容流程](references/instance-operations.md)。下載及新版 env 合併依 [install-lafenice](../install-lafenice/SKILL.md) 和 [env 合併規則](../install-lafenice/references/env-merge.md)。

備份把實例 ID、設定 revision、Compose 檔案／參數、Docker 目標、掛載清單與 env 雜湊綁在同一快照。還原先驗證歸屬；不能只因檔名是 current.env 或名稱相同就套用。跨實例複製設定是獨立遷移／複製任務，不能當作一般 restore。

### 改名

只更新 manifest 的 display_name 與索引快取，依契約鎖定並原子寫入。保留 UUID 與技術身分。舊名稱不自動當 alias；找不到舊名稱時展示新名稱與 ID 供辨認，不能模糊比對後直接變更服務。

## 現有腳本的界線

- `scripts/manage_instance_env.ps1 -Action Backup` 只能作舊式原始檔備份輔助，不取代完整快照、權限及歸屬驗證。
- 該腳本 Restore 未實作身分核對、完整 dotenv 合併及交易式提交。不要直接用於正式 env；如需研究輸出，只在隔離候選副本操作，再依合併規則驗證。
- `scripts/configure_second_instance.ps1` 只適用尚未啟動、沒有資料的候選副本。它未完整處理 HOST_*_DIR、媒體資源或所有埠，不能當作隔離驗收；不要把客戶中文名稱傳入技術 InstanceName。
- 目前包內啟動器固定讀 release .env。使用契約的 release-local 相容模式，不能只把 env 移到外部就宣稱隔離完成。

## 不可破壞的條件

密碼依 [安裝 skill 的密碼選擇規則](../install-lafenice/SKILL.md)：符合實際版本限制的使用者指定密碼保持原樣，不能自行加長或輪替。更新與納管不重設既有帳密，env 的 DEFAULT_*_PASSWORD 不等同資料庫內既有帳號密碼。

更新缺失原資料時停止，不建立空目錄／新 volume 冒充復原；不以 down -v、prune 或刪資料解決衝突。同一資料不可由兩套資料庫同時寫入。索引與 manifest 是定位紀錄，實際 Docker 掛載與 daemon 每次都要核對。

後續統一部署工具設計與驗收情境見 [方案與驗收](references/solution-design.md)。
