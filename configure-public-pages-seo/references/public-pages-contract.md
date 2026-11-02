# Deployed Core SEO v1 contract

## Core 固定爬蟲路由（需部署新版 Core）

新版提供 GET / HEAD `/sitemap.xml`、`/robots.txt`，以及
`/{PROJECT_ROOT}/api/sitemap.xml`、`/{PROJECT_ROOT}/api/robots.txt` 與
`/{PROJECT_ROOT}/api/public-seo/` 下同名別名。固定端點不需要 dispatch header。
舊版僅能用 `/dispatch` 搭配 `X-LaFenice-Public-Path` 讀取；先探測部署版本，
不得將新版別名的 404 直接判為沒有 SEO 資料。

API 輸出正常而根路徑回傳 HTML 表示代理接線問題。前端需設定容器可達的
`SEO_BACKEND_ORIGIN`，重新建立容器，並由外層代理轉送兩個根路徑。
新版前端未接線時回傳 503 文字。合法空 `urlset` 表示沒有符合發布／索引／權限
條件的頁面，不能假裝已收錄。管理者可使用「網站設定 → 檢查 Sitemap 與 robots.txt」。
不得用 Plugin 建立同名 Gateway route；它們是 Core 保留路徑。

Base `/{PROJECT_ROOT}/api/public-seo`。先探測 `/capabilities`，不要以技能版本推測部署能力。
回應需有 `version:1,native_seo:true,renderers:["registry-html-v1"],dynamic_rendering:false,plugin_required:false`。

管理 JWT roles 為 super 或 ai；一般 admin 不足以發布 Registry HTML。
GET `/settings` 回 `{site,revision,pages}`；GET `/sources` 回 `{items:[{module_key,version_id,source_base}]}`。
站台與各頁面有各自 revision，所有寫入需帶目前 revision，新記錄 0；409 不可盲目覆寫。

PUT `/settings`：

```json
{"revision":0,"site":{"enabled":true,"name":"Example","origin":"https://example.com","page_prefix":"","description":"網站摘要","image":"","google_verification":""}}
```

page_prefix 僅允許空字串或 `/{PROJECT_ROOT}`，必須與前端 URL_MODE 一致。origin 不含路徑與帳密。
google_verification 只填網址前置字元資源的 meta content；Domain 資源用 DNS TXT。

PUT `/pages`：

```json
{"revision":0,"page":{"path":"/about","module_key":"about_page","title":"關於我們","description":"實際內容摘要","image":"","indexable":true,"structured_data":null}}
```

path 不含專案前綴，只接受 `/` 或 ASCII 字母／數字／`_`／`-` 路徑，不允許參數模板、query、系統路徑。
canonical 是 origin+page_prefix+path；不支援跨站 canonical 或自動 301。
structured_data 可為含 `"@context":"https://schema.org"` 的 JSON object，上限 20KB。

POST `/inspect` 傳 `{page}` 回 publishable、errors、body_characters、h1_count、iframe_count、source_noindex、source_version、public_url。
來源需一個 head/body、H1、至少 40 字元原始正文、無 iframe／已知 Shell runtime 依賴。
只接受啟用的固定 HTML module、匿名 GET Gateway 與無繼承登入／角色限制的公開選單。

POST `/pages/action`：`{revision,path,action:"publish"}`；其他 action 為 unpublish、rollback。
發布版釘選 Registry version；Registry 更新後需要重新發布。發布仍會重查來源公開資格。
來源原有 noindex 不能由設定覆蓋，取消索引不列入 Sitemap。
站台設定立即生效，不在逐頁 rollback 範圍。

正式輸出 `X-LaFenice-SEO: core-v1`、no-store；未發布／來源失效 404。
GET/HEAD `/dispatch` 加 `X-LaFenice-Public-Path` 是代理用入口，418 僅代表可回退 Shell 的未匹配；不可把任何 404／503 回退成 SPA 200。
公開 `/routes` 回 `{paths:[...]}`，供 Shell 導覽；不含 SEO 管理資料。

完整安裝包設 SEO_BACKEND_ORIGIN；分離前端需設定該 origin 並重建容器。根 `/robots.txt` 與 `/sitemap.xml` 必須由外層代理送至前端，prefix 部署也不例外。
驗收依序看匿名 HTTP 原始正文、無 JS 可讀性、JS 正常互動、唯一 metadata、robots text/plain、Sitemap application/xml 與正式網址。
網站 API 正常不證明外層代理完成。不要在報告中把 HTTP 驗證寫成 Google 已收錄。

第一版沒有站台設定匯出／匯入 API、Plugin archive SEO section、動態列舉、舊 lfx_seo 自動移轉或 Joanna SSR。

## Google 上線教學注意事項

Core UI 的「上線與 Google 指引」提供六步操作與官方連結，使用已儲存的 origin／prefix／發布設定產生範例。優先說明 Domain 資源＋DNS TXT；子網域 TXT 名稱相對於 DNS Zone，不能一律填 @。網址前置字元若要涵蓋根 Sitemap，使用正式 origin 根網址。HTML meta 驗證必須在 Google 所檢查的資源首頁出現（含重新導向後的頁面）；Core 只在已發布公開 HTML 注入標記，首頁仍是 App Shell 時，內頁有 token 不代表整站可驗證。不要混用 DNS 完整 TXT 值與 HTML content 值。空 Sitemap／noindex 測試頁不應為了示範而自動開放索引。各步分別確認發布、擁有權、Sitemap 讀取、即時檢查與實際收錄，不宣稱 UI 能自動操作 Google。


## Core v2 動態快照

若 capability 支援 browser-snapshot-v1，依 [動態發布契約](dynamic-rendering.md) 使用 render／preview／reviewed publish；前文第一階段固定來源限制不代表 iframe 永遠不能做 SEO。不要將 fixtures 的測試結果套用到未驗收的業務頁。
