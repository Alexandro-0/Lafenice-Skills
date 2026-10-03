---
name: adopt-lafenice-instance
description: 協助尚未建立實例索引的既有 LaFenice 部署完成首次納管，從 Docker 與既有安裝找回 env、Compose、資料掛載，請客戶命名並建立跨對話可發現的紀錄。適用於舊客戶導入新管理方式、忘記設定位置或重建遺失的登記；不重裝、不搬資料。
---

# 納管既有 LaFenice

客戶不需要知道索引位置或準備 instance.json。接受「幫我登記原本的 LaFenice」「找出目前這套的設定」「把目前這套命名為正式站」等請求。使用一般檔案及 Docker 工具完成探索、核對、命名、備份、寫紀錄與重新查找驗證；不能只交付操作說明。

本 skill 不提供自動掃描程式或 lfx CLI。它與 [deploy-lafenice-instances](../deploy-lafenice-instances/SKILL.md) 必須一起安裝；開始前讀其 [索引契約](../deploy-lafenice-instances/references/instance-registry.md) 及 [納管操作](../deploy-lafenice-instances/references/instance-operations.md)。依共用格式及鎖／原子寫入要求執行，不另建第二種索引。依賴缺失時補齊 skill；無法取得則說明缺少契約，不猜格式寫入。

## 1. 先找現場，不要求客戶提供所有路徑

先讀本 OS 使用者的固定索引及可選指標。不存在是預期的首次納管情境，不等於沒有安裝；損壞時保留原檔走復原。記錄目前 Windows/native、WSL 發行版、macOS 或 Linux 語境，以及 Docker CLI 實際目標。

- 有指定路徑／網址／容器／project：以它為線索，先比對現有登記。網址只是線索，不能由網址直接認定可存取其主機或將本機 Docker 當成該服務。
- 沒提供位置：在本次已授權的 Docker 目標先只讀盤點運行及停止容器，依 Compose project、服務組合、image、published ports 整理 LaFenice 候選。名稱或 image 關鍵字只作提示，不作歸屬證據。不要為了探索啟動 Docker、重啟服務或切換全域 context。
- Docker 不可用或目標未明：只問最有用的一項，例如「是在這台電腦還是遠端主機？」「你平常開啟的網址或啟動捷徑在哪裡？」。可依客戶提供的捷徑、啟動腳本、安裝上層目錄有限搜尋 Compose／manifest；不全磁碟搜尋 .env，不讀其他使用者私有目錄。
- 多套候選：列出候選編號、project、入口／埠、運行狀態及有證據的安裝位置，請選目標並指定名稱。可一次詢問「要登記哪套，以及希望叫什麼名稱？」；未被選中的實例維持只讀。
- 單一候選且使用者已明確指向它並命名：直接核對，不重複確認。目標未明時，即使只找到一套也不能視為完整主機盤點。

只查必要欄位。不要把完整 docker inspect、容器 Env、Compose config 或 env 原文印到對話。需要 SSH／主機存取時使用既有獲授權管道，不要求客戶在聊天貼密碼。

## 2. 重建真實設定來源

依操作契約核對 daemon ID、Compose project、原有序 -f、project directory、profiles、容器與網路、所有 bind/named volume、TCP/UDP 入口。

Compose labels 的 working_dir/config_files 可幫助定位，但可能過時或屬於別的執行主機，不能直接信任。從實際部署檔案及原啟動方式找 env；不能因旁邊恰有 .env 就視為正在使用。核對是否還有 shell overrides、外部 secrets、service env_file 或平台注入。

保留既有技術名稱。舊資料在 release/volumes 內也先原地登記，明列不可刪除的 release；不將資料路徑改成新版建議值，不執行 configure_second_instance 或 Restore。Windows junction、WSL/native、Docker Desktop 映射及遠端路徑依操作契約核對，不能只替換斜線。

原 env 遺失時先找同實例備份與原啟動設定，不能只從容器環境重建一份「完整 env」：容器不一定保留 Compose 插值、host ports 或原秘密來源。無法核對的項目留 null 並列 unresolved；不重新生成既有金鑰，不啟動或更新以測試猜測。

## 3. 客戶命名並建立紀錄

名称由客戶指定，已給就沿用；未給才詢問，不自動命名正式站。按契約處理 Unicode／重名。若已登記同一套，回報現有名稱與 ID，不重產 UUID；不同名稱請求依意圖走改名，不能複製登記同一資源。

目標確定後顯示摘要並在本次納管授權內繼續：

```text
客戶名稱：……
Docker 目標／project：……
正式 env／目前 release：……
資料來源：原 named volumes／原 bind paths
索引／control／快照位置：……
尚未核對：……
```

以 OS 固定索引及其目錄下 instances/<UUID>/ 作預設 control（依契約排除 release/repository/data）；客戶不必先建立這些目錄。未指定備份位置時可用 control 下 config-backups/，先核對權限與目錄隔離。已有合法配置則沿用；不可寫時明確說明並請指定位置，不改用 cwd。自訂索引需保存固定位置的指標，使下次 agent 仍能發現。

按契約取得鎖、重驗重複登記，建立受保護設定快照、manifest 與索引；寫入後重讀。僅資料與設定來源均可查證時設 accepted，停機的實例仍明列未測健康。缺關鍵證據、備份失敗、共用資料歸屬不明或來源漂移時設 needs-review，保留具體待補項；不得將它當成可直接更新的實例。

此階段只新增管理紀錄及設定備份，不改原 env／Compose、不改 volume labels、不重啟、不搬移資料。若有啟動器、權限或資料共用問題，先記錄，修復另按使用者授權執行。

## 4. 驗證幾週後能重新找到

寫完後不依賴記憶中的 manifest 路徑，重新從 OS 固定入口讀索引，用客戶名稱解析，確認得到同一 UUID、daemon/project、env hash 與 mounts。核對原服務狀態及設定 hash 沒因納管改變；服務已停機時不為驗證而啟動。

交付名稱／ID、索引／manifest／備份位置、已核對項目及 unresolved，並提供下一次可說的請求「更新〈客戶名稱〉」。needs-review 時明確說明已登記但尚不可安全更新及缺少的證據。不宣稱已完成資料庫備份、升級或 CLI 安裝。

若本次原要求包含更新，只有納管核對完成且目標明確後，才交給 [install-lafenice](../install-lafenice/SKILL.md) 繼續同一實例；只要求納管就到此完成。
