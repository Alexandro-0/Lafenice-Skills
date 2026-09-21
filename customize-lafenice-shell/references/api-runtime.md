# API 與 runtime 契約

以下路徑相對於 `<project-url>/api`；前端設定頁相對於 `<project-url>/config/settings/styles`。project URL 可能有不同路徑，保留使用者提供的實際前綴。範例 ID 僅為佔位，不可直接提交。

## 登入與權限

1. GET `/auth-password-public-key` → `public_key_pem`。
2. 用公鑰 RSA-OAEP（SHA-256、MGF1 SHA-256）加密 UTF-8 密碼，再 Base64。
3. POST `/auth-login`：`{"account":"<provided-account>","password_ciphertext":"<base64>","password_encryption":"RSA-OAEP-256"}`。
4. 用回傳 `access_token` 作 `Authorization: Bearer ...`；GET `/auth-me` 回傳 user，可能有 `capabilities.codeRegistryEditor`。顯示 roles 可能將 super 映射成 admin，後端仍以真實角色授權。

不要把使用者憑證寫成可重用範例。TLS 使用環境信任或明確可信任的 CA／憑證；不要固定關閉驗證。

## Registry

| 操作 | Endpoint | Response |
| --- | --- | --- |
| 列出 HTML | GET `/_code/modules?code_type=html&status=active` | `{items:[...]}` |
| 讀模組 | GET `/_code/modules/{moduleKey}` | `{item:...}` |
| 建立模組 | POST `/_code/modules` | `{item:...}` |
| 列出版本 | GET `/_code/modules/{moduleKey}/versions?code_type=html` | `{items:[...]}` |
| 讀指定原始碼 | GET `/_code/modules/{moduleKey}/versions/{versionId}` | `{item:{id,content,code_type,...}}` |
| 儲存新版本 | POST `/_code/modules/{moduleKey}/versions` | `{item:{id,version,...},...}` |

建立模組：

```json
{"module_key":"my_topbar","code_type":"html","group":"shell","description":"Custom top bar","status":"active"}
```

儲存版本：

```json
{"code_type":"html","content":"<style>...</style><header>...</header>","message":"Reduce topbar height","gateway":{"preserve_existing":true}}
```

module key 使用小寫識別字格式，例如 `my_topbar`。版本 ID 使用 API 回傳值，不假設是 ObjectId、數字或 latest；模組必須 active，版本必須屬於該模組且為非空 HTML。先檢查是否已有同名模組，不覆蓋未知模組。

## 全站設定

GET `/style-settings` → `{item:{project,theme,language,shell,...}}`。

PATCH `/style-settings` 需要完整 `project`、`theme`；沿用最新 `language`，不要意外重設預設語系。只送可編輯設定，不帶 `_id`、審計時間等欄位。

```js
const payload = {
  project: current.item.project,
  theme: current.item.theme,
  ...(current.item.language ? { language: current.item.language } : {}),
  shell: {
    topbar: { moduleKey: savedModuleKey, versionId: savedVersionId },
    sidebar: current.item.shell?.sidebar ?? null,
  },
};
```

- `shell` 省略：保留既有 Shell 設定。
- `shell` 有提供：送完整 `{topbar,sidebar}`；未指定的區域會正規化成 null。
- slot 為 null：使用系統 React UI。
- 更換 shell 或恢復預設需 super／ai，普通 admin 仍可保存原範圍的品牌／主題。
- GET `/style-shell?slot=topbar` 或 `sidebar` 是公開 API，回傳 `{item:{moduleKey,versionId,content,...}}`；預設區域的 item 為 null。不能指定任意模組取代當前已套用版本。
- 品牌／主題匯出入不會搬移 Shell 原始碼或版本參照。不要把來源環境版本 ID 直接用於另一環境；先保存目的環境版本。

## HTML 動作綁定

| HTML action | JS action |
| --- | --- |
| `home` | `shell.actions.home()` |
| `navigate` | `shell.actions.navigate(path)` |
| `login` / `logout` | `shell.actions.login()` / `logout()` |
| `toggle-sidebar` / `close-sidebar` | `toggleSidebar()` / `closeSidebar()` |
| `set-theme` / `set-locale` | `setTheme(mode)` / `setLocale(locale)` |

```html
<style>
:host { display: block; height: auto; color: var(--text); }
header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--surface); }
button { color: inherit; font: inherit; }
</style>
<header>
  <button data-lf-action="toggle-sidebar" data-lf-bind="messages.openMenu"></button>
  <button data-lf-action="home" data-lf-bind="project.name"></button>
</header>
```

`data-lf-bind` 更新 textContent。`data-lf-visible` 支援 `guest`、`authenticated` 或 state 欄位路徑。action 參數来自 select.value、`data-lf-value` 或 href；`navigate` 只接受系統 menu 可解析的同源路徑。

## 狀態與生命週期

`shell.state`：`project`、`user`（displayName/avatarUrl 或 null）、`authenticated`、`menu`、`activePath`、`locale`、`locales`、`messages`、`themeMode`、`theme`、`themes`、`logoUrl`、`sidebarCollapsed`、`mobileSidebarOpen`。沒有 accessToken、refreshToken、authFetch。

```html
<div class="menu"></div>
<script type="application/lafenice-shell">
const node = shell.root.querySelector('.menu');
return shell.subscribe(state => {
  // 訂閱立即呼叫，之後收到語系、路由及使用者狀態更新。
  node.dataset.activePath = state.activePath;
  // 以 createElement/textContent 顯示 state.menu，避免將文字插入 innerHTML。
});
</script>
```

每個 script 以獨立函式作用域執行，`shell` 為參數。初始化同步完成；return 清理函式或 `shell.onCleanup(fn)`，事件／請求可用 `shell.signal`。僅初始化、subscription 或受管 action 的錯誤可由 runtime 接住；自行註冊的非同步錯誤需自行處理。無限迴圈無法靠 Shadow DOM 隔離。

缺少模組、disabled、版本無效、初始化失敗或載入逾時會顯示系統預設 UI。自訂 host 的可見內容與實際操作才是成功依據。
