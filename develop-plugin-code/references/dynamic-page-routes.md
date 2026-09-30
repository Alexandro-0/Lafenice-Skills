# 動態路徑與具名參數 production contract

適用於已支援 named path templates 的 LaFenice core。沿用本 skill 的已授權專案 URL、
AI JWT 與 Registry workflow；不要求 repository 或 DB 存取。

動態片段只代表一般字串參數。名稱如 slug、category、locale、item_id 均由設定者選擇，
沒有內建帳號或頁面主人語意；即使名稱是 username，core 也不查帳號或對應 user ID。
業務程式自行解讀參數、查詢資源及驗證有效性。個人頁面僅是其中一種應用。

使用者管理可另儲存選填的 `url_slug`：管理員透過 `POST /admin-users` 或
`PATCH /admin-users/{id}` 設定，回應及登入 user context 會包含此欄位。
使用者維護要求 admin 或 super；只有 ai 的 JWT 不足以修改此欄位，不得自行加角色。
若目前授權只有 ai，可完成 plugin 對此欄位的支援，並交由有權限的管理員設定值。
它會 trim、轉小寫，限 1–64 英數字或單一連字號分隔的字詞；有值時跨使用者唯一，
重複回 409。PATCH 省略為保留，null／空白為清除。此欄位只是使用者資料，
不自動註冊路由或綁定任何 path parameter，也不改變登入帳號。
新增未提供時為未設定；舊使用者讀取為 null，舊版 backend 也可能省略欄位。
停用帳號仍佔用其識別碼。不得透過註冊或 account-profile 修改此欄位。
需要依此查詢使用者時，由有適當授權的業務 API 實作，不要將 admin-users API 公開。

## 設定

Gateway endpoint 使用 `{slug}`、`{slug}/course` 或
`{slug}/course/{course_id}`，不包含 `/lafenice/api`、網域、query 或 fragment。
每個 `{name}` 必須佔完整一段，name 使用英數底線且不能數字開頭，不可重複。
不支援 regex、catch-all、optional segment；使用不含 trailing slash 的 URL。

建立或讀取 HTML module 後，儲存版本時在原有 payload 加上：

```json
{
  "gateway": {
    "endpoint": "{slug}/course",
    "plugin": "your-plugin",
    "menu_label": "Courses"
  }
}
```

這只是部分 payload；`content` 必須是完整且保留客製化的 HTML。不要為設定路由重產
整個 collection 或覆蓋既有 module。新增 alias 可 PATCH
`/_gateway/config/routes/{slug}/course/GET`，body 為已存在的 HTML handler、
`auth_required: false` 與 plugin。管理 URL 的 braces 做 URL encoding，各段 slash 保留。
不會自動刪除舊 endpoint。

存 HTML 會建立 `/{slug}/course` 的 Access Control path。模板選單項目不直接顯示
為導航連結；在列表／按鈕使用具體 URL，例如 `/lafenice/alessandro/course`，
其中 alessandro 只是範例參數值。根目錄以實際部署為準。
不要逐一替每個參數值建立 HTML 或 Gateway route；`{slug}` 也可指向共用入口 HTML。

## 路由相容性

優先順序為固定完整路徑、既有兩段 `endpoint/resource_id`、模板。
例如既有 `users` API 會攔住 `users/course`，該網址不會落入 `{slug}/course`。
系統 UI 路由如 config、login、account、legal、ai 也必須保留。
`GET /_gateway/config` 的 `routing_warnings` 提示固定路由遮蔽。
兩個可能匹配相同 URL 的模板會拒絕儲存，即使 methods 不同；合併在同一模板下設定。
405 或認證失敗不會轉送其他 route。

先讀取部署現有設定，保留非本 plugin 的 routes；不要整包覆蓋設定。
舊 core 回傳最多兩段／不支援模板時，回報需要更新 core，不要用大量固定路由繞過。

## Runtime

瀏覽器 `/lafenice/alessandro/course` 會呼叫
`GET /_gateway/resolve-page?path=alessandro%2Fcourse`，解析成功後載入
iframe `/lafenice/api/alessandro/course`。解析入口只提供公開 Registry HTML route 的
`endpoint`、`routePattern`、`pathParams`，不提供 handler 或其他設定。

iframe 初始 `lf-runtime` fragment 及 `lafenice:runtime-context` 都含：

```js
{
  pathParams: { slug: 'alessandro' },
  route: {
    pathname: '/lafenice/alessandro/course',
    routePattern: '/lafenice/{slug}/course',
    pathParams: { slug: 'alessandro' }
  }
}
```

沿用既有 runtime 接收器處理 fragment／postMessage，不另從 localStorage 讀 token。
驗證 parent source 及預期 parent origin；API base 不一定與 parent 同源。
讀取 `context.pathParams.slug` 的字串值，由 plugin 決定用途及是否需呼叫資料 API。
`context.user` 仍是獨立的登入訪客資訊，不得用參數值取代。若頁面資料依賴參數，
切換參數時清除舊資料並重新載入；非同步回應必須確認仍屬目前參數，失敗時顯示錯誤。
core 不建立 pageOwner、不驗證資源存在，也不要求 slug 必須唯一或已註冊。
參數格式、資源查詢、唯一性及轉址等需求由 plugin 按實際業務決定。

Python handler 保持七個標準 keyword arguments，另可使用：

```python
from gateway.request_context import get_request_context

context = get_request_context()
slug = context.get("path_params", {}).get("slug")
```

另外有 `route_pattern` 和 `request_path`。模板匹配的 `resource_id` 是 None；
舊 CRUD 的 resource_id 不變。Query 與 path params 分開，不相互覆蓋。
Registry version preview 不會自動模擬模板參數，須以實際 Gateway URL 測試。

## 授權與驗證

HTML 是公開頁殼，敏感資料不能直接嵌在其中。UI 的 auth_require 不等於資料授權，
匿名訪客不載入完整 Access Control menu。資料 API 使用正常 authenticated uid、roles
和 tenant context；網址參數是未信任的輸入，不是登入或 tenant 證明。

驗證匿名和登入訪客、不同參數、業務上無效的值、direct link、refresh、history back／forward、
query 保留、切換參數、固定 API 及原有 CRUD、405／401、路由遮蔽。
Plugin archive 的 gateway_routes 保留原始模板鍵及 plugin 歸屬；目標 core 也需支援
此功能。匯入／重啟後重新驗證具體 URL，不以匯入 HTTP 200 代替功能驗證。
