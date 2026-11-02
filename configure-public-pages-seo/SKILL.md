---
name: configure-public-pages-seo
description: Configure and verify LaFenice Core native SEO, existing public HTML page bindings, publication, robots.txt, Sitemap and Search Console guidance through deployed APIs. Use for site or page SEO; no SEO Plugin or Cloudflare Worker is required.
---

# Core 原生 SEO

新部署先讀 capability：v4 有 `independent_publication:true` 時，新增獨立公開頁優先使用
`published-html-v1` / `delivery:api`。讀 [獨立公開頁](references/independent-publication.md)，
儲存 → render → preview → reviewed publish → 匿名驗證；公開頁不包含 App Shell。
若任務明確要求原正式路徑即時輸出，且有 `direct-html-v1`，使用直接 HTML 來源，流程是
儲存 → inspect → publish → 匿名驗證，不使用 render/preview 快照流程。
來源可為公開 Registry HTML 或回傳完整 HTML 的 Python handler，填明確 source_path；
JS builder 空殼需要先適配業務頁面，不能改 renderer 就宣稱完成 SSR。
詳細契約見 [直接 HTML](references/direct-html.md)。瀏覽器快照僅適用既有相容資料。

SEO 是 LaFenice Core 功能；不要建立或要求安裝 lfx_seo，也不要把設定成功當成搜尋收錄。
既有內容可以由業務 Plugin 或 Registry 提供，SEO 設定與輸出由核心負責。

## 操作流程

1. 使用使用者已授權的精確環境與帳號；授權包含 localhost／super 時可沿用，不重問已提供資訊。無憑證時先讀公開 capability，再只詢問缺少資訊。Token 只保留於程序記憶體。
2. GET `/{PROJECT_ROOT}/api/public-seo/capabilities`。需 `native_seo:true` 與 `registry-html-v1`；404 或不相容代表需升級 Core，不能猜 API 或改 generated。
3. 讀 [API 與發布契約](references/public-pages-contract.md)。管理 API 限 super／ai；登入沿用 LaFenice RSA-OAEP-256／Bearer JWT。
4. 先讀 settings 與 sources，比對實際正式 origin、URL_MODE、既有頁面與 revision。只更動任務要求範圍。
5. 綁定既有 HTML 來源。獨立公開頁依上述新契約；直接模式用 inspect；既有 browser-snapshot-v1 才使用 ready_selector／replay_scripts。不得建立與原內容脫節的人工 SEO 正文副本。
6. 匿名檢查正式 URL、HTTP 原始 HTML、canonical、H1、正文、無 iframe、robots MIME 與 Sitemap。來源檢查或 API dispatch 成功不等於正式代理已接入。
7. 提供 Search Console 的 DNS TXT／HTML token 驗證與 Sitemap 提交指引；沒有 Google／DNS 操作授權就只提供教學，不宣稱完成驗證。

## 判斷與限制

- capability 的 `dynamic_rendering:false` 表示不能直接處理動態 `{slug}`、iframe 或 JS builder。Joanna 這類來源須先完成 Core 獨立渲染，不能使用 Worker metadata 注入冒充已完成。
- 收到 409 重新讀 revision 並比對，不盲目重試覆寫。422 列出具體來源問題；不放寬來源權限來讓測試通過。
- public-seo 設定是站台 Core 資料，不在第一版 Plugin archive 裡。搬站後重新設定 origin、綁定來源並發布驗證；不複製舊版發布狀態。
- 不直接修改 generated；頁面程式需要調整時使用 Registry 正常儲存流程。Core SSR 能力不足應回報核心工項，不要求客戶安裝另一個 SEO plugin。
- 報告分開列出「設定／發布」「正式輸出」「Google 驗證／收錄」，並標記未完成項目。

## 動態 HTML 注意事項

`dynamic_rendering:true` 不等於任意頁面都相容；讀 [動態發布契約](references/dynamic-rendering.md)。不用把使用者 iframe 網頁全部重做。先用 noindex 獨立網址測試匿名初始化、正文與 JS 互動，再綁定正式頁。不可使用登入 session 截取 DOM 作為公開快照。來源內容撤回時取消 SEO 發布；失敗不代表舊快照自動刪除。正式域名／URL_MODE 變更後需重新產生。瀏覽器套件安裝與頁面相容性是不同檢查。
