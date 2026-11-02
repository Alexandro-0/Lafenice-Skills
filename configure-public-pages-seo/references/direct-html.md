# Direct HTML contract

Capability v3 提供 preferred_renderer=direct-html-v1。保留既有管理 API 與 revision。
page 使用 renderer=direct-html-v1、presentation=standalone、module_key 與明確 source_path。
儲存草稿、inspect、publish 即可；不呼叫 render 或要求 Chromium。

每次請求使用最新 Registry 來源、公開 Gateway GET 與 menu 權限檢查。Python handler
須回傳 200 HTMLResponse，含完整正文、H1、head/body；只回 JSON 或 iframe 不合格。
不傳登入者資料；業務 handler 自行保障僅查詢已發布公開內容並 escape HTML。
來源正文更新即時生效，SEO 設定仍需發布；rollback 僅回復 SEO 綁定，不回復來源資料。

舊模式不自動刪除。Joanna 的 JS builder 不會因 Core 支援此模式而自動變成 SSR，
需另行透過正常 Registry 版本流程適配公開 HTML provider，且保持現有外觀與互動。
直接模式不顯示 App Shell 外框，頁面需提供自己的公開導覽、登入／預約連結。

Sitemap 沿用發布時 noindex 檢查並驗證最新路由權限，不逐頁執行 handler；來源索引政策
改變後重新 inspect／publish。公開頁面每次仍遵守最新 meta／HTTP noindex。
目前部署仍需前端代理到 Core；App Env 不會自動改 Nginx。
