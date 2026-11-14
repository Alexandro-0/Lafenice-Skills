---
name: manage-custom-containers
description: Manage custom Docker containers in an existing LaFenice instance. Use for 自訂容器 creation, updates, removal, portable Compose import/export, deployment job tracking, or read-only 機器與容器狀態 queries. For installing or upgrading LaFenice itself, use deploy-lafenice-instances.
---

# 管理 LaFenice 自訂容器

從目標實例「開發工具」的「自訂容器」或「機器與容器狀態」操作。使用 API 時，沿用該實例已授權的使用者工作階段與 API base。先釐清使用者指定的是哪個實例，所有查詢和變更都留在該實例。監控不可用時回報原因，勿改查本機 Docker 或另一個 dev 環境。

- **只查狀態**：讀取機器快照，依其涵蓋範圍、採樣時間及可用欄位回答。要找某個已部署服務時，用 Compose project 和實際容器名稱比對。監控能看見的容器可能由其他工具管理；執行變更前須在自訂部署清單找到對應記錄。
- **建立或匯入**：把 Compose 檔案內容或支援的單一 docker run 指令放進新草稿。有附件時匯入部署包 ZIP，預覽每個來源檔案、變更與容器掛載位置。先預覽，檢查服務、連接埠、資料卷與缺少的參數。使用者只要求範本或預覽時，交付檔案或預覽結果即可。已要求部署時，用安全輸入取得必要值並送出，避免將密碼寫入匯出檔或操作報告。
- **腳本附件**：先確認預期是首次初始化、每次啟動，或只提供檔案。若要每次啟動執行 ZIP 的 start.sh，唯讀掛載腳本，設定 Compose 的 entrypoint 呼叫映像內直譯器，並用 command 傳入參數。覆寫前核對映像原有的初始化流程。若使用者要求驗證執行結果，檢查腳本預期產生的效果，例如資料表是否建立。部署工作完成只證明部署成功。
- **更新**：從清單找出目標部署的 ID、現行設定與 revision。名稱重複時以 project 或 ID 消除歧義。沿用原 ID 與 revision 預覽差異，留意服務刪除與資料卷掛載點變更；已保存的參數可省略。送出完整的新設定。
- **移除**：依原部署 ID 與最新 revision 移除，預設保留具名資料卷。只有使用者明確指定永久刪除該部署資料時，才啟用刪除資料卷。一般部署清單排除 removed；要處理先前保留的資料卷時，可從移除記錄定位原 ID。
- **匯出**：單檔設定可匯出 YAML；含腳本或設定檔時匯出整包 ZIP。跨主機使用時，在目的實例建立新部署並重新預覽、填入參數。說明哪些參數需補，資料卷內的資料須另行遷移。
- **追蹤結果**：建立、更新及移除會回傳工作 ID。輪詢到 completed 或 failed，再重讀部署清單。回報部署名稱、revision、Compose project、已採集的實際容器名稱及失敗原因。若連線中斷，保留已知工作 ID 並恢復查詢；送出結果不明時先比對清單與歷史，避免重複建立。

操作時查閱 [API 契約與可匯入的 PostgreSQL 範例](references/api.md)。
