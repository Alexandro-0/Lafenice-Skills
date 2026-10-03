# 實例操作與現有完整包相容流程

先依 [索引契約](instance-registry.md) 選定 UUID；本文件不取代 [env 合併規則](../../install-lafenice/references/env-merge.md)。

## 納管既有部署

1. 取得客戶名稱與已授權安裝／Docker 目標，讀索引排除重複。有原 manifest 時保留 ID。
2. 只讀核對 context、實際 daemon ID、容器 Compose labels、運行／停止狀態、mounts、ports。只抽取必要 inspect 欄位，不列印 Env。停止中的容器也要盤點；容器已移除時不能只靠目錄名推斷歸屬。
3. 找出真正使用的 Compose 有序檔案、profiles、project directory、env 與外部設定。完整包通常是根 .env，不是 backend/frontend standalone env；labels 歷史路徑也須與實際檔案及掛載核對。
4. 相對掛載依原 Compose 基準解析，與 Docker mounts 比對。處理 symlink/junction、Docker Desktop 的 host/VM 映射；無法對應則 needs-review。資料仍在舊 release 時記錄該 release 不可刪除，不強制搬移。
5. 建立受保護設定快照與 manifest，登記索引。確定但停機的安裝可登記，verification 明列未測運行健康；不因登記而啟動。歸屬或設定不明標 needs-review。

納管不修改 env、帳密、資源名稱或資料，不執行 configure_second_instance。多實例已共用資料時，列出共用項目並停止一般更新；分離是獨立遷移任務。

## 設定模式

### release-local：目前包的相容模式

manifest 精確指向 active release 根 .env，control 保存紀錄，快照保存原始設定。新包 .env 只是出廠範本，下載／解壓不更新正式指標。

新 release 產生合併候選，預檢通過才寫入新 release .env，啟動驗證成功才更新 manifest；舊 env 保留。這能辨識哪份是正式設定，但不是 env 已搬出 release，不宣稱外部設定啟動器已實作。

### external：包與工具已支援才啟用

control 下 `config/revisions/<revision>.env` 為不可變 accepted 設定，manifest 指向正式 revision。插值、service env_file、啟動預檢、建置輸入及 secrets 引用均接受同一明確設定來源。

目前 `env_file: .env` 及 .ps1/.sh 固定讀 release .env；單加 `--env-file <外部檔>` 不符合 external 模式。不能用 symlink 或複製檔案就假稱已支援，不未經驗證改現有客戶模式。

## 啟動／更新核對

- 固定 Docker context/endpoint，驗證 daemon ID。DOCKER_HOST、DOCKER_CONTEXT、TLS 設定來源有差異時先查明。
- 使用明確 `-p`、`--project-directory`、`--env-file`、有序絕對 `-f`、profiles；start/stop/ps/config 對準同一組目標。使用既有 helper 時先核對其實際參數，若無法傳入上述參數，以受控子程序與經驗證的等價設定固定目標，不假設 helper 已支援新參數。
- 隔離子程序環境：核對 Compose 引用及設定 keys、父程序同名變數和 COMPOSE_* 控制值。未登記覆蓋先核對，只在子程序排除；授權覆蓋由 config_sources 恢復。不清掉使用者／系統環境，不 source/eval env。
- 用真正 Compose 解析結果檢查設定與 mounts；config --quiet 只驗證語法。完整 config 含秘密，只在受控記憶體／限制存取暫存處理，對話僅出允許摘要。helper 自行解析與 Compose 不一致時保留候選並停止，不繞過初始化步驟就宣稱成功。
- 所有持久掛載按 service/target 比較，不只 HOST_DATA_ROOT；不得意外 bind↔volume 切換。原 volume 消失、磁碟未掛載、來源換空目錄或歸屬不明時停止。升級新增掛載要有版本契約，不能替代舊資料。
- 核對所有 TCP/UDP、IP/wildcard、可選服務。舊版同實例占用原埠是正常切換狀態，不停其他實例或自行改正式入口。
- Windows 使用 native API 核對磁碟、junction、ACL、Docker 可見性；Linux/macOS 核對 UID/GID、權限、symlink、實際檔案系統大小寫及磁碟掛載，Linux 另核對適用的 SELinux/rootless 條件。中文／空白路徑用參數陣列，不拼 shell。
- WSL 保存發行版與 CLI 環境，不能只換斜線轉 Windows 路徑；遠端 Docker bind path 屬遠端主機，Docker Desktop 需核對共享／映射，本機 exists 不證明 daemon 可用。

參考：[Docker 插值](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)、[project name](https://docs.docker.com/compose/how-tos/project-name/)、[bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)。shell 同名變數可覆蓋 --env-file 插值；僅換 project 也不隔離顯式同名資源。

## 備份與還原

快照使用 `<backup_root>/<UUID>/<UTC時間-操作ID>/`，包含 env 原始位元組、Compose/overrides、必要外部 secret/config 檔及權限資訊。不含秘密的 snapshot.json 保存 schema_version、instance_id、manifest revision、daemon_id、project、來源路徑、每檔 SHA-256、mounts、release、UTC 時間。

建立快照時即限制存取：Windows ACL；POSIX 目錄 0700、秘密檔 0600 或明確授權管理群組。env 快照不是資料庫一致性備份。control/索引亦只授權管理者修改，避免其他使用者改指標使 agent 操作錯誤目標。

還原先核對 ID、完整性、daemon/project/mounts。名稱可能已改，UUID 不變。舊備份無 metadata 時視為未驗證來源，需用舊安裝與 Docker 證據核對；不能推測同名即同實例。既有腳本 Restore 不作正式入口。

## 更新與中斷復原

取得 instance lock → 核對 accepted 狀態／hashes → 設定及資料備份 → operation 記錄並設 state=updating → 下載合併候選 → 預檢／建置 → 停目標舊版 → 啟動候選 → 健康、登入及既有資料驗證 → accepted 快照 → 更新 manifest 指標、設 state=accepted、清 operation → 釋放鎖。下載與候選階段若需要長時間作業，可先保存候選後釋放鎖；重新取得鎖時必須重驗 revision/hash/實際資源，不能直接沿用過時预檢結果。

只要求下載或準備候選時停在授權階段，不停止服務。失敗保留 operation，核對實際容器判斷切換階段；manifest 舊指標不代表仍運行舊版。資料格式相容才回復舊程式；已遷移則按一致備份復原。歸屬不明設 needs-review，不繼續盲目重試。
