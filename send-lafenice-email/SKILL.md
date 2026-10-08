---
name: send-lafenice-email
description: 透過 LaFenice 已設定的 Gmail 整合 API 寄送單一或逗號分隔的多收件者 Email，處理部分成功與寄送錯誤。用於寄信、測試郵件或開發 Plugin 郵件呼叫；不適用 Gmail 收件匣管理。
---

# 透過 LaFenice 寄送 Email

## 使用前確認

- 使用使用者指定的環境 URL 與既有授權，不猜測 host、project root 或預設帳密。API base 從該環境的 runtime config 或既有已驗證連線取得，可能為 `/api` 或 `/<project-root>/api`。
- 寄信與郵件設定 API 均要求 `admin` 或 `super` 的 JWT Bearer token；只有 `ai` 的 session 與 API Key 不適用。不要為了寄信自行新增角色、放寬 Gateway 或建立繞過權限的 handler。
- 缺少登入 session 時，使用該環境的 `auth-password-public-key` 取得 RSA 公鑰，以 RSA-OAEP/SHA-256 加密密碼，再 POST `auth-login`，欄位為 `account`、`password_ciphertext`、`password_encryption: "RSA-OAEP-256"`。使用 `auth-me` 確認身分，再以 `GET email-provider-settings` 驗證實際存取權限；UI 可能將 super 顯示為 admin。
- 保留 TLS 驗證。不要將 token、密碼或 ciphertext 寫入文件、Plugin 程式碼、排程 payload、URL 或日誌。已有郵件設定時不需取得 Gmail App Password。
- 撰寫文件、程式碼或預覽不代表授權寄信。只有使用者已授權明確的收件人、用途與內容範圍，才執行 `email-send`；資訊缺少時先完成可供檢視的內容，再詢問缺少項目。

## 執行方式

呼叫前閱讀 [Email API 契約](references/email-api.md)，其中包含參數、回應、錯誤及設定 API。

1. 讀取 `email-provider-settings`，確認 `enabled`、`secret_configured` 與 `tested_revision`。未設定或停用時說明狀態；只有使用者要求設定或啟用時才變更它。管理頁為「第三方整合 → Email 寄送」，沿用 `/config/settings/login`。
2. 準備 `to` 字串，多個地址以半形逗號分隔。不要送陣列、CC/BCC、附件或自行指定 From。收件者會看到完整 To 名單；若任務要求隱藏彼此地址，先改為符合授權的個別寄送設計，不宣稱此 API 支援 BCC。
3. 提供主旨及 `text`／`html` 至少一項。將外部資料插入 HTML 時依其用途適當 escape。API 不接受額外欄位，格式錯誤的名單會整批拒絕。
4. 用 `POST email-send` 送出已授權內容。不要自動寄送額外測試信。
5. 同時檢查 HTTP status、JSON `status`、`ok`、`accepted`、`rejected`；HTTP 200 也可能部分失敗。記錄 message_id 與必要的結果，避免記錄完整郵件內容或敏感地址。

## 結果與重試

- `accepted`：回報「Gmail 已接受」，不能宣稱已送達收件匣或已閱讀。
- `partial`：回報接受數量與遭拒地址。不要重寄整份名單；修正原因後，只在原有授權內針對 `rejected` 重試。
- 全部遭拒、驗證失敗、未啟用或權限不足：依錯誤碼處理，不切換其他帳號或寄送服務來繞過限制。
- 逾時、連線中斷或 `EMAIL_DELIVERY_FAILED`：結果可能不明。API 沒有冪等鍵、寄送狀態查詢、佇列或自動去重紀錄；先確認既有收件結果，無法確認就回報不確定，停止自動重試。

## Plugin 開發邊界

Plugin UI 必須使用既有登入 session 的 authenticated fetch，不得內嵌管理者 token 或 Gmail 密碼。一般使用者 session 會收到 403；使用者要求一般帳號觸發郵件時，先說明需要獨立、經授權的業務流程設計，不偽造 `uid`／`roles` 或直接暴露核心 SMTP handler。

若任務涉及修改 Plugin，沿用該專案的 Code Registry 流程及開發權限要求；本 skill 的管理者寄信能力不代表具有 Plugin 編輯權限。不要直接修改生成目錄。排程寄信僅在使用者明確要求時另行設計，不能將此 HTTP 呼叫當成已建立的排程功能。

完成時說明環境、已執行或僅準備的操作、接受／拒絕結果及是否需要後續處理，不輸出憑證。
