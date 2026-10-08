# LaFenice Email API 契約

本文件對應 `services.email_delivery` 與預設 Gateway 設定。API base 以下以
`https://project.example/lafenice/api` 示意，實際以目標環境設定為準。

## 認證與能力

所有下列端點都需要 `Authorization: Bearer <ACCESS_TOKEN>`，角色為 `admin` 或 `super`。
不接受 API Key；`ai` 單獨不具權限。設定為全站共用，不依租戶或 Plugin 分開。

| 方法 | Endpoint | 功能 |
| --- | --- | --- |
| GET | `email-provider-settings` | 非敏感設定與驗證狀態 |
| PATCH | `email-provider-settings` | 儲存設定或切換啟用 |
| POST | `email-provider-test` | SMTP 登入驗證，不寄出郵件 |
| POST | `email-send` | 使用儲存的設定寄出郵件 |

只有 Gmail App Password，固定 `smtp.gmail.com:465`、SSL/TLS，驗證伺服器憑證。
寄件帳號、顯示名稱及 Reply-To 取自全站設定。每次建立 SMTP 連線，socket timeout 為 20 秒；
這不是整次 HTTP 請求的總時間上限。無附件、CC/BCC、佇列、排程、冪等鍵或投遞查詢介面。

## 寄送請求

```http
POST <API_BASE>/email-send
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "to": "first@example.com, second@example.com",
  "subject": "訂單狀態通知",
  "text": "您的訂單已更新，請登入平台查看。",
  "html": "<p>您的訂單已更新，請登入平台查看。</p>"
}
```

| 欄位 | 規則 |
| --- | --- |
| `to` | 必填字串。半形逗號分隔最多 100 段，計數在去重前；整體最多 25,500 字元。每個地址去除前後空白後驗證，每段原始長度最多 254 字元。 |
| `subject` | 必填非空文字，原始長度最多 200 字元，不可含換行或其他 ASCII 控制字元。 |
| `text` | 選填字串，與 html 至少一項非空白。 |
| `html` | 選填字串，與 text 的 UTF-8 bytes 合計最多 262,144（256 KiB）。兩者都有時使用 MIME alternatives。 |

地址僅接受 ASCII Email，不接受顯示名稱、陣列、分號、全形逗號或空項目。
不得含換行／ASCII 控制字元；例如尾端逗號與 `a@example.com,,b@example.com` 會回 400。
所有地址先驗證完成才寄送；完全相同的地址會去重並保留順序，**大小寫不同不會被合併**。
所有收件者可見完整 To 名單。額外欄位（例如 `from`、`cc`、`bcc`、`attachments`）回 400。

## 呼叫範例

以下 JavaScript 範例適用具有管理者登入 session 的 LaFenice UI。
`authFetch` 與 `apiBase` 應從平台現有 runtime 取得；不要 hardcode token。

```javascript
const response = await authFetch(`${apiBase}/email-send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'first@example.com, second@example.com',
    subject: '訂單狀態通知',
    text: '您的訂單已更新，請登入平台查看。',
  }),
});
const result = await response.json();
if (!response.ok) {
  throw new Error(result.message ?? result.detail ?? `HTTP ${response.status}`);
}
if (result.status === 'partial') {
  // 顯示 accepted / rejected；不可重送整份名單。
  showPartialResult(result.accepted, result.rejected, result.message_id);
} else if (result.status === 'accepted' && result.ok) {
  showAcceptedResult(result.accepted, result.message_id);
} else {
  throw new Error('Unexpected email response; do not retry automatically.');
}
```

`showPartialResult`／`showAcceptedResult` 是呼叫端自行實作的 UI 回饋，不是平台 API。
只有明確寄送操作才執行此範例，不要在 mount、render 或一般讀取重試迴圈中呼叫。

## 回應

全部接受：HTTP 200。

```json
{
  "ok": true,
  "status": "accepted",
  "message_id": "<message-id>",
  "accepted": ["first@example.com", "second@example.com"],
  "rejected": []
}
```

部分收件者遭 SMTP 拒絕：同樣 HTTP 200。

```json
{
  "ok": false,
  "status": "partial",
  "message_id": "<message-id>",
  "accepted": ["first@example.com"],
  "rejected": ["second@example.com"]
}
```

accepted 代表 SMTP 已接受，不保證最終投遞或收件匣位置。部分成功時只處理 rejected；
不要重寄已接受的收件者。全部遭拒回 502，沒有成功／失敗陣列。SMTP 原始錯誤不回傳。
同一封信的 message_id 是追蹤參考，不是冪等鍵；重新呼叫會產生新郵件。

## 錯誤

此應用的錯誤通常為 `{ "message": "EMAIL_...", "request_id": "..." }`；
相容呼叫端也可讀取 `detail`。認證、Gateway 與平台錯誤不保證有 EMAIL_* 代碼。

| HTTP | 代碼 | 處理方式 |
| --- | --- | --- |
| 400 | `EMAIL_INVALID_ADDRESS` | 檢查每個地址、分隔符與空項目，修正後再寄。 |
| 400 | `EMAIL_TOO_MANY_RECIPIENTS` | 超過 100 段；縮小名單或在授權範圍內分批。 |
| 400 | `EMAIL_INVALID_SUBJECT` / `EMAIL_BODY_REQUIRED` | 修正主旨或內容。 |
| 400 | `EMAIL_INVALID_FIELD` | 檢查型別、控制字元及不支援的欄位。 |
| 400 | `EMAIL_INVALID_PASSWORD` | 設定時應使用 16 個英文字母的 App Password；可含顯示用空格。 |
| 400 | `EMAIL_NOT_CONFIGURED` / `EMAIL_TEST_REQUIRED` | 先完成設定與驗證。 |
| 401 | 平台認證錯誤 | 重新取得合法 session，不使用 API Key 替代。 |
| 403 | `EMAIL_ADMIN_REQUIRED` | 需要 admin／super；不自動提權。 |
| 409 | `EMAIL_DISABLED` | 尚未啟用或沒有通過驗證。 |
| 409 | `EMAIL_CONFIG_CHANGED` | 重新讀取 revision，保留並比對使用者編輯。 |
| 413 | `EMAIL_BODY_TOO_LARGE` | text + html 合計超過 256 KiB。 |
| 502 | `EMAIL_AUTH_FAILED` | 檢查 Gmail 帳號及應用程式密碼。 |
| 502 | `EMAIL_RECIPIENT_REJECTED` | 全部收件者被拒絕，檢查地址／供應商限制。 |
| 502 | `EMAIL_DELIVERY_FAILED` | 連線、TLS 或寄送錯誤；結果可能不明，禁止盲目重送。 |

HTTP 逾時／中斷、502 delivery failure 可能發生在 SMTP 接受後。沒有可安全自動重試的保證。
確認收件結果後再決定重送；結果無法確認時回報不確定，不宣稱完全失敗。

## 設定與驗證

GET 回傳以下欄位，無密碼明文或密文：

```json
{
  "enabled": false,
  "username": "",
  "sender_name": "",
  "reply_to": "",
  "revision": "",
  "tested_revision": "",
  "provider": "gmail",
  "secret_configured": false,
  "host": "smtp.gmail.com",
  "port": 465,
  "security": "SSL/TLS"
}
```

PATCH 接受 `revision` 與任意需要變更的欄位：`username`（單一地址）、`sender_name`
（最多 100 字元）、`reply_to`（單一地址或空字串）、`app_password`、`enabled`（boolean）。
revision 必須是最新 GET／PATCH 回傳值；首次未設定時為空字串。
省略或留空 app_password 保留現有密碼，不會刪除。

儲存寄件設定有變更時，後端自動停用並清除驗證，即使同時送 `enabled: true` 亦如此。
使用新的 revision POST `email-provider-test`：`{ "revision": "<current-revision>" }`。
成功回傳更新的設定與非空 tested_revision；驗證只登入 SMTP，不寄信，也不會自動啟用。
再 PATCH `{ "revision": "<latest-revision>", "enabled": true }` 啟用。
每次 PATCH 都更新 revision，不重複使用舊值。停用同樣以最新 revision PATCH enabled=false。

開發新環境或升版時若端點 404／405，回報該部署尚未提供此契約，不猜測其他 endpoint，
也不要因文件任務自動建立 Gateway 路由或修改伺服器。
