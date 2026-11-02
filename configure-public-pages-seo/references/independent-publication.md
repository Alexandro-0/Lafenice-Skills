# API 獨立公開頁（Capability v4）

先讀 capabilities，須支援 published-html-v1 與 independent_publication。
這是 Core 功能，不建立 SEO Plugin、不修改原 App Shell 頁面、不要求設定主機。
保留來源樣式及自己的腳本；Google 和訪客進入同一個獨立網址，沒有 App Shell 外殼。

1. 讀 settings、sources?delivery=api，確認 origin/PROJECT_ROOT、原設定與 revision。
2. 新增 page：renderer=published-html-v1、delivery=api、presentation=standalone，
   module_key、明確 source_path、path、title、description、image、indexable、structured_data。
   管理 API 基底為 /{PROJECT_ROOT}/api/public-seo。來源必須已啟用、非 shell 群組、匿名 GET。
3. PUT pages 儲存；POST render 帶 path/revision；GET preview?path=...。
   完整正文和 H1 必須已在 HTML，不能只是 JS 載入畫面或 iframe。
   JS-only 來源需另建公開 HTML provider，使用 Registry 正常流程，禁止直接修改 generated。
4. 檢查預覽（腳本停用），POST pages/action，action=publish，帶目前 revision、preview_id、reviewed=true。
   初次建議 indexable=false，開公開網址實測互動後，重新儲存、預覽、發布 indexable=true。
   若來源變更回409，重讀且重新確認；不盲目重試。
5. 公開網址使用 capabilities.public_base + path，例如 /lafenice/api/public/joanna。
   匿名檢查 HTTP200、text/html、正文、canonical、自有腳本、圖片和操作；不只檢查 API 成功訊息。
6. POST changes 帶 path 比對最新來源。固定發布版本不自動更新；再次 render/review/publish 才更新正文。
   unpublish 回404並移出Sitemap；rollback 回復上一發布版本，不回復業務資料。
7. Sitemap 使用 capabilities.api_sitemap，不必要求 /sitemap.xml 接線。Google 仍讀根目錄 /robots.txt；
   API robots 不是替代品。必要時在已授權範圍配置 Cloudflare 精確 rewrite；不修改整站路由。

同一 path 不支援 site/api 雙綁定；不能直接改既有 delivery，應用不同 path。
源碼版本變更會提示，業務資料變更需 changes 手動比對。來源撤權後公開頁拒絕輸出。
原始 noindex 優先。來源 provider 必須只回公開資料，避免隨機時間戳造成預覽雜湊每次不同。
來源 JS、CSS 與 API 依賴不會一起封存，腳本可能仍依賴外部服務；需實測，不能保證任意 iframe 一鍵轉換。
只宣稱實際驗證結果；技術通過不代表 Google 已收錄。既有雲端手工公開頁不會自動搬移，需另建綁定並驗證後處理 canonical。
