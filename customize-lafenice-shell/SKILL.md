---
name: customize-lafenice-shell
description: 透過 LaFenice Code Registry 自訂或修改頂欄、側邊欄 HTML/CSS/JS，連接現有導覽、登入、語系與主題功能，並在網頁風格設定中套用固定版本、驗證與還原。適用調整頂欄高度、隱藏小標、替換側邊欄或恢復系統樣式；單純調整選單分類與 route metadata 不屬於此 skill。
---

# 自訂 LaFenice 頂欄與側邊欄

## 範圍與連線

以使用者指定的專案 URL 為目標，沿用本次工作已授權的登入方式與環境。可以在沒有平台原始碼的情況下，透過部署 API 完成操作。沒有目標 URL 或有效身分時，只詢問缺少的資訊；可先準備離線 HTML，但不可宣稱已上線。

- 使用 `super` 或 `ai` 的既有權限；不要硬編碼帳號密碼或猜測預設憑證。使用者明確指定的 localhost 開發環境可以使用。
- 密碼登入使用 `/auth-password-public-key` 的公鑰，以 RSA-OAEP-256 加密密碼後送往 `/auth-login`。JWT 只保存在程序記憶體，不寫入 skill、HTML、紀錄或交付檔案。
- **角色顯示不等於實際授權。** 平台可能將 super 顯示為 admin；先檢查 `/auth-me` 的 `capabilities.codeRegistryEditor`，再以 `GET /_code/modules` 驗證實際 API 存取。不要因畫面顯示 admin 就要求升權，也不要按帳號名稱授權。舊版沒有 capability 時，以實際 API 結果為準。
- 401 先處理登入；403 停止受限寫入並說明具體 endpoint；404 或不相容契約表示部署可能缺少此功能，不要透過直接寫 DB、改角色或修改生成檔繞過。

操作 API 前閱讀 [API 與 runtime 契約](references/api-runtime.md)。這份參考文件包含完整必要契約，不依賴本機 application repository。

## 保留現況與確認修改範圍

1. 讀取 `GET /style-settings`，記錄現有 `shell.topbar`、`shell.sidebar` 與品牌、主題、預設語系。備份不包含憑證。
2. 若區域已有自訂版本，依其 `moduleKey`、`versionId` 讀取完整 Registry 原始碼。以**目前套用版本**為基礎，不直接拿 latest 或本機範例覆蓋；比較 latest 是否另有尚未套用的客製修改。
3. 只修改使用者指定區域。「另一區維持目前樣式」保留原參照；明確要求恢復系統預設才設為 `null`。如果「原設定」無法從上下文辨識，先問這一點，不猜測要刪除哪一份客製設定。
4. 修改外觀不需要調整 access-control。若需求其實是新增分類、搬動選單或 route 授權，改用相鄰的 `configure-website-entry` skill。

有原始碼存取權時，先讀專案 `AGENTS.md`、`LaFeniceBackend/docs/code_registry.md`、`LaFeniceBackend/docs/collection_generate_code.md`。禁止直接新增、修改、刪除或格式化 `services/generated/`、`services/generated_html/`、`services/generated_assets/`；正常 Registry API 所產生的寫入可以使用。Registry 不可用時，在生成目錄外留存修改稿，明確標示未儲存、未生效。

## 撰寫與調整 HTML

React 保留外層布局、路由、登入與偏好狀態。HTML 掛入 Shadow DOM，不是 iframe，不需要 SDK 或 JSX。

- 新建模組使用 `code_type: html`、`group: shell`。此群組避免儲存時新增 Code Pages 選單項目；既有選單項目不會自動刪除。
- 使用 `:host`、`.bar` 等區域 CSS，沿用 `var(--surface)`、`var(--text)`、`var(--line)`、`var(--active-bg)`、`var(--active-text)`。背景與文字顏色搭配，驗證深淺色。
- 頂欄以內容決定高度；縮小 padding、控制項尺寸與間距，不用 `height:100%` 撐滿父層。隱藏 category／小標只改指定顯示節點，不刪除系統分類資料。
- 側邊欄沿用系統寬度和手機抽屜；自訂內部需處理捲動、收合與 `mobileSidebarOpen`，不能假設桌面固定寬度。
- 既有功能使用 `data-lf-action` 或 `shell.actions`，不要自行複製登入或偏好儲存邏輯。由 `state.menu` 顯示目前可用選單；導航使用其實際 path，不硬編碼 `/lafenice`。
- 系統文字使用 `state.messages`，選单依 `messages.menuLabels[item.key]`、`messages.menuLabels[item.label]`、`item.label` 依序 fallback；自訂文字補齊支援語系。訂閱 state 更新，切換語系、主題、頁面時更新內容，而非僅初始化一次。
- 以 `textContent` 呈現選單及使用者文字。只用 inline classic script 或 `application/lafenice-shell`；不支援 `<script src>`、module script、JSX。
- 使用 `shell.root` 查找元件；以 `shell.signal`、`shell.onCleanup` 或回傳清理函式釋放事件、訂閱及計時器。
- HTML 與 JS 是可信任管理者程式碼，會公開提供且與主頁同權限。Shadow DOM 只隔離樣式，不是安全沙箱。不要嵌入 token 或秘密。

## 儲存與套用

1. 透過 Registry 儲存新版本，記錄 response 的版本 ID。保存版本可能同時更新模組正常公開 route，但不會自動替換已固定的 Shell 版本。
2. 預覽授權範圍內的程式碼。設定頁預覽會執行 JS，系統 actions 僅回報操作提示；自訂 fetch 等副作用仍會執行。
3. 要實際套用時，使用「網頁風格設定 → 頂欄／側邊欄 → 選模組及版本 → 儲存並套用」，或 PATCH `/style-settings`。沿用使用者已授權的修改範圍；只要求草稿／預覽時不要套用。
4. PATCH 前重新讀設定，比對是否有其他人更新並合併；此 API 沒有已知的 optimistic-lock version。保留最新 `project`、`theme`、`language` 及未修改區域，送出完整 shell 兩個欄位，不能只送單一區域。
5. 讀回設定確認固定版本；無 Authorization 讀 `GET /style-shell?slot=topbar` 或 `sidebar`，確認供應的是預期版本。檢查 `item` 是否為 null，不只看 HTTP 200。
6. 重新整理**使用者指定的真正網站**驗證。獨立示範頁、儲存成功或 `data-custom-*` 為 true 都不等於實際自訂 HTML 已載入。

## 驗證與交付

- 確認自訂 host 可見、Shadow DOM 有預期內容，而不是錯誤 fallback；檢查頁面與控制台錯誤。
- 實測導覽、目前頁面狀態、語系、深淺色、側邊欄收合、手機抽屜及水平溢出。修改高度時量測實際高度。測試後恢復使用者偏好與測試 viewport。
- 若修改涉及權限判斷，確認真正 super／ai 可編輯，一般 admin 未被擴大權限。不要為展示介面修改帳號角色。
- 登出會中斷使用者工作，只有在任務需要且可恢復登入時才測試。可先用隔離測試確認 action 綁定。
- 刷新後仍顯示舊版，依序檢查 persisted shell、公開 delivery 版本、`lf-shell=default`、host fallback、前端部署版本，而非反覆另存相同程式碼。
- 回報實際狀態：修改稿、Registry 已儲存、全站已套用，三者分清楚；提供網站連結與模組／版本資訊。要求保留時，保留正式設定及查看分頁，不只保留臨時伺服器。

## 還原與救援

- 單區恢復系統預設：該 slot 設為 `null`，保留另一區；不需要刪除 Registry 模組或版本。
- 還原客製版：重新選擇備份的 module/version 參照，套用並讀回驗證。
- 無法操作時開啟 `<project-url>/config/settings/styles?lf-shell=default`。這只在此次 Shell 掛載停用自訂 UI，不會變更儲存設定；需要永久還原仍須儲存。
- 若自己的發布造成介面故障，在授權範圍內恢復先前已知正常參照並驗證，再修正草稿。
