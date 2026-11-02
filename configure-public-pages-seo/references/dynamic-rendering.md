# Core browser-snapshot-v1

來源：LaFeniceBackend/docs/public_seo_rendering.md（Core 維護的完整契約）。以下只列操作判斷。

- sources 現在可列具名參數模組。source_path 填具體 Gateway HTML 路徑，不含 API／project prefix，並依既有 route priority 驗證同 module。
- page 新欄位 renderer、source_path、ready_selector、replay_scripts。預設固定 HTML；動態模式預設移除腳本，必須清楚告知靜態閱讀限制。replay_scripts=true 需檢查重初始化與父頁依賴，不能僅測 raw H1。
- PUT pages → POST render {path,revision} → GET preview?path=... → 檢查 HTML → POST pages/action {path,revision,action:"publish",preview_id,reviewed:true}。所有步驟限 super/ai。不得繞過 review 或以另一份 HTML 代替回傳預覽。
- render 成功會增加 revision。頁面／站台／來源版本改變要重新產生；409 先重讀，429 等目前工作完成，422 回報來源具體阻礙，不放寬公開權限。
- 匿名 renderer 不使用管理員身分，只有同站 Gateway anonymous GET；外部 API/JS/CSS 不支援，不能改成任意 URL fetch。每 worker 1 job、45 秒渲染、2 MB 上限。
- 發布固定快照；業務內容更新後重新產生，撤回內容時同步 unpublish。更換 origin／prefix 需重新產生。權限／handler 變更會阻擋原依賴。
- 測試時不要動正式首頁，先建立獨立 noindex 路徑，確認原始正文、canonical、正常 JS、robots/Sitemap、撤回與回復。正常 Registry API 建立測試來源，禁止直接寫 generated。
- 將「Core 能力測試通過」與「Joanna 或另一個實際頁面相容性通過」分開報告；不能以 fixture 取代實際頁面驗收。

## 搜尋入口與原本網站體驗

新動態頁預設 `presentation:app-shell`，source_path 必須等於 page.path；在來源 API 文件位置捕捉，發布到同一正式 URL，前端透過 seo-shell.js 啟動原本 App Shell／iframe。不要誤用 standalone 靜態閱讀版替換使用者的完整首頁。

原始 HTTP 回應要有正文；JS 完成後 iframe 與原選單出現是預期行為。所有訪客與 Google 收到相同初始內容；不依 UA／Referer 分流。預覽為受保護 JSON，下載為本機 blob，不能當 Sitemap URL。source API 的 noindex,indexifembedded 防止獨立索引並允許 Google 嵌入索引；原來源 noindex 不解除。需實測 frontend shell-ready 與 iframe 內容；不能只測 raw H1 就報完成。Google 選定 canonical 與歷史索引需要 Search Console 另驗。
