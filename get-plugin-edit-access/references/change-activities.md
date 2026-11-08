# 開發任務追蹤

適用於已取得使用者授權、完成登入，且接下來要修改部署系統的工作。
純規劃或離線原始碼工作不建立遠端任務，也不為了建立紀錄而索取遠端憑證。

平台自動記錄經核心資料存取層完成的寫入。任務 API 補充任務目的、Agent
與實際使用的 Skills，並將同一次開發的 API 操作串接。操作者由後端驗證。

1. `GET /change-activities?limit=1` 確認能力。只有 404/405 可判定舊版未支援；
   如實說明缺少任務追蹤，可繼續原本已授權工作。401/403、網路錯誤、5xx
   不等於未支援，應排除認證或連線問題。
2. `POST /change-activities/tasks`，傳入 `title`（160 字內）、`source: "ai"`、
   `agent`、`skills`（最多 16 個實際使用的名稱，每個 100 字內）。
   不要寫密碼、Token、個資或完整對話。
3. 後續同一環境的 API 請求帶上 `X-Lafenice-Activity-ID: <item.id>`、
   `X-Lafenice-Source: ai`、`X-Lafenice-Agent: <名稱>`。
   用 [共用 helper](../scripts/change_activity.mjs) 包裝記憶體內的 authenticated fetch。
   不跨使用者、環境或 active tenant 共用任務；多 Agent 工作分別建立任務。
4. `PATCH /change-activities/tasks/{id}` 結案，傳入
   `status: completed|failed|cancelled`、`summary`（2000 字內）及
   `verification`（1000 字內）。區分已儲存、已載入和實際驗證。
   中斷或無法結案時如實提供任務編號，不重試原業務寫入來補紀錄。

未關聯任務仍保留個別變更。結案不會重新執行任何變更。
查詢預設七天、25 筆，上限 100 筆／31 天；翻頁重用回傳的 `from`、`to`
與 `next_cursor`，篩選改變時清除 cursor。

```js
import { createTrackedTask } from './scripts/change_activity.mjs';
const task = await createTrackedTask({
  apiBase, authFetch: authenticatedFetch,
  title: '新增訂單日期篩選', agent: 'Codex', skills: ['develop-plugin-code'],
});
await task.fetch(`${apiBase}/_code/modules/order_page/versions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(version),
});
await task.finish({ status: 'completed', summary: '完成日期篩選', verification: '日期邊界測試通過' });
```

本機檔案修改、外部工具活動與直接連資料庫的外部程序不會自動出現在紀錄。
可在摘要中標明為 Agent 回報，不聲稱已被平台確認。
