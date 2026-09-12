---
name: manage-plugin-schedulers
description: 讓 Codex 在無 source-code access 的 production LaFenice 中，透過 deployed Scheduler API 讀取、新增、編輯、soft-delete、啟用與暫停 product plugin 的 cron/interval/date/startup 排程。Use when managing plugin scheduler handlers and state using only the exact deployed URL. Require the exact project URL and role-ai account/password before development.
---

# 管理 Plugin 排程

## 強制連線前置條件

開始規劃或管理排程前，先用 `get-plugin-edit-access` 取得使用者明確提供的專案 URL 與 role: `ai` 帳號密碼，執行 RSA-OAEP-256 加密登入，並確認 `/auth-me` 包含 `ai`；缺少任一項就詢問並停止。不得使用 localhost、API Key、預設帳密或其他環境的憑證。

## 使用範疇

使用這個 skill 管理 LaFenice 系統排程定義。假設 agent 無法查看 application repository、backend/frontend source、container、build 產物、deployment files 或資料庫；所有排程管理都經由使用者提供 URL 上的 LaFenice API 完成。若 deployed contract 不相容，記錄實際 response 並停止該能力，不要尋找或修改內部檔案。

典型任務：

- 查詢某個 plugin 目前有哪些排程。
- 新增 cron、interval、date 或 startup 排程。
- 修改排程時間、handler、payload、roles、plugin metadata。
- 啟用或暫停單一排程。
- soft delete 排程。
- 判斷 handler 是否符合 scheduler allowlist，必要時先透過 Code Registry 建立 plugin handler。

若排程 target handler 尚不存在，先使用 `develop-plugin-code` skill 透過 Code Registry 建立 `services.generated.<module_key>:handle` 類型的 handler；沿用前置檢查取得並已驗證含 `ai` role 的 JWT，不接受 `super`-only session 代替。

## API 與權限

API base 必須來自前置檢查，例如：

```text
https://project.example/lafenice/api
```

Scheduler routes：

```http
GET   /lafenice/api/scheduler
GET   /lafenice/api/scheduler/{id}
POST  /lafenice/api/scheduler
PATCH /lafenice/api/scheduler/{id}
```

所有 scheduler API 都需要：

```http
Authorization: Bearer <ai_access_token>
Content-Type: application/json
```

權限規則：

- 讀取：任何已登入使用者可讀自己的排程；`admin` 或 `ai` 可讀全部排程。
- 新增、編輯、啟用、暫停、刪除：需要 `admin` 或 `ai` role。
- 沒有 `DELETE /scheduler/{id}`。刪除是 soft delete，使用 `PATCH` 將 `status` 設為 `deleted`。

## 排程資料模型

核心欄位：

```json
{
  "id": "uuid",
  "name": "daily-report",
  "plugin": "sales",
  "status": "active",
  "schedule_type": "cron",
  "repeat": true,
  "cron": "0 9 * * *",
  "timezone": "Asia/Taipei",
  "target": {
    "type": "handler",
    "handler": "services.generated.daily_report:handle",
    "payload": {"report_type": "daily"}
  },
  "roles": ["admin"],
  "next_run_at": 1780707600000,
  "last_run_at": null,
  "last_status": null,
  "last_error": null
}
```

重要規則：

- `plugin` 是 metadata，用來標記這個排程屬於哪個 plugin；建立 plugin 排程時要填。
- `target.type` 目前只支援 `handler`。
- `target.handler` 必須是 `module:function` 格式，例如 `services.generated.sales_daily_report:handle`。
- 預設 allowlist 是 `services.generated.*`，由 `SCHEDULER_TARGET_ALLOWLIST` 控制。封裝 plugin 的 handler 優先放在 Code Registry 產生的 `services.generated.*`。
- `target.payload` 必須是 JSON object。
- `roles` 會傳給 scheduled handler；建議填執行該 job 所需的最小角色，例如 `["admin"]` 或 plugin 自訂 role。
- `status` 可用值：`active`、`disabled`、`deleted`、`completed`。

Scheduled handler 會收到與 Gateway handler 相同的 keyword arguments：

```python
def handle(
    *,
    method: str,
    query_params: dict,
    resource_id: str | None,
    payload: dict,
    header: dict[str, str],
    uid: str | None,
    roles: list[str],
) -> tuple[int, dict] | dict:
    ...
```

排程執行時：

- `method` 是 `"SCHEDULE"`。
- `resource_id` 是 scheduler id。
- `payload` 是 `target.payload`。
- `uid` 是排程建立者。
- `roles` 是 scheduler 文件內的 `roles`。

## 讀取排程

列出排程，預設不包含 `deleted`：

```powershell
$ApiBase = $env:LAFENICE_API_BASE
$Headers = @{ Authorization = "Bearer $AccessToken" }

$schedulers = Invoke-RestMethod `
  -Uri "$ApiBase/scheduler?sort=updated_at&direction=desc" `
  -Method Get `
  -Headers $Headers

$schedulers.items | Select-Object id,name,plugin,status,schedule_type,next_run_at,last_status,last_error
```

依 plugin 篩選：

```powershell
$plugin = "sales"
$schedulers = Invoke-RestMethod `
  -Uri "$ApiBase/scheduler?plugin=$([uri]::EscapeDataString($plugin))&sort=updated_at&direction=desc" `
  -Method Get `
  -Headers $Headers
```

讀取單一排程：

```powershell
$schedulerId = "scheduler-id"
$scheduler = Invoke-RestMethod `
  -Uri "$ApiBase/scheduler/$([uri]::EscapeDataString($schedulerId))" `
  -Method Get `
  -Headers $Headers

$item = $scheduler.item
```

需要查看已刪除排程時，加 `include_deleted=true`：

```http
GET /lafenice/api/scheduler?include_deleted=true
```

## 新增排程

新增前先確認：

1. 具備記憶體內、已驗證 role: `ai` 的 access token。
2. `target.handler` 已存在並可 import。
3. handler 符合 `SCHEDULER_TARGET_ALLOWLIST`；預設可用 `services.generated.*`。
4. 已設定 `plugin` metadata。
5. `payload` 是 JSON object，不要把 token、密碼或長期 secret 放進 payload。

### Cron recurring

```powershell
$body = @{
  name = "sales-daily-report"
  plugin = "sales"
  schedule_type = "cron"
  repeat = $true
  cron = "0 9 * * *"
  timezone = "Asia/Taipei"
  target = @{
    type = "handler"
    handler = "services.generated.sales_daily_report:handle"
    payload = @{ report_type = "daily" }
  }
  roles = @("admin")
} | ConvertTo-Json -Depth 20

$created = Invoke-RestMethod `
  -Uri "$ApiBase/scheduler" `
  -Method Post `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

### Interval recurring 或 once

每 60 秒執行一次：

```json
{
  "name": "sales-poll-orders",
  "plugin": "sales",
  "schedule_type": "interval",
  "interval_seconds": 60,
  "repeat": true,
  "timezone": "Asia/Taipei",
  "target": {
    "type": "handler",
    "handler": "services.generated.sales_poll_orders:handle",
    "payload": {}
  },
  "roles": ["admin"]
}
```

五分鐘後只執行一次：

```json
{
  "name": "sales-run-once",
  "plugin": "sales",
  "schedule_type": "interval",
  "interval_seconds": 300,
  "repeat": false,
  "target": {
    "type": "handler",
    "handler": "services.generated.sales_run_once:handle",
    "payload": {}
  },
  "roles": ["admin"]
}
```

### Specific date once

```json
{
  "name": "sales-export-at-time",
  "plugin": "sales",
  "schedule_type": "date",
  "run_at": "2026-06-25T09:30:00+08:00",
  "repeat": false,
  "target": {
    "type": "handler",
    "handler": "services.generated.sales_export_once:handle",
    "payload": {}
  },
  "roles": ["admin"]
}
```

`run_at` 與 `start_at` 可用 Unix milliseconds 或 ISO datetime。若 ISO datetime 沒有 timezone，backend 會視為 UTC；建議明確寫 `+08:00` 或 `Z`。

### Startup once

```json
{
  "name": "sales-startup-warmup",
  "plugin": "sales",
  "schedule_type": "startup",
  "order": 0,
  "repeat": false,
  "target": {
    "type": "handler",
    "handler": "services.generated.sales_warmup:handle",
    "payload": {}
  },
  "roles": ["admin"]
}
```

`startup` 排程是在 scheduler runner 啟動時標記為 due 的一次性 job。同一批 startup jobs 依 `next_run_at`、`order`、`created_at` 排序。

## 編輯排程

`PATCH /scheduler/{id}` 是 partial update，可以只送要改的欄位。修改 schedule 相關欄位後，backend 會重新計算 `next_run_at`。

修改 cron：

```powershell
$schedulerId = "scheduler-id"
$body = @{
  cron = "*/15 * * * *"
  timezone = "Asia/Taipei"
} | ConvertTo-Json

$updated = Invoke-RestMethod `
  -Uri "$ApiBase/scheduler/$([uri]::EscapeDataString($schedulerId))" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

修改 handler 與 payload：

```json
{
  "target": {
    "type": "handler",
    "handler": "services.generated.sales_daily_report_v2:handle",
    "payload": {
      "report_type": "daily",
      "include_drafts": false
    }
  }
}
```

修改 startup order：

```json
{"order": 10}
```

注意：

- `order` 只支援 `schedule_type: "startup"`。
- `name` 有唯一索引，撞名會回 `409 Scheduler name already exists.`。
- 如果把 `status` 改成 `disabled`、`deleted` 或 `completed`，backend 會清除 job lock。

## 開始、暫停與刪除

開始或恢復單一排程：

```powershell
$body = @{ status = "active" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri "$ApiBase/scheduler/$([uri]::EscapeDataString($schedulerId))" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

暫停單一排程：

```powershell
$body = @{ status = "disabled" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri "$ApiBase/scheduler/$([uri]::EscapeDataString($schedulerId))" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

刪除排程是 soft delete：

```powershell
$body = @{ status = "deleted" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri "$ApiBase/scheduler/$([uri]::EscapeDataString($schedulerId))" `
  -Method Patch `
  -Headers $Headers `
  -ContentType "application/json" `
  -Body $body
```

不要呼叫 `DELETE /scheduler/{id}`，目前 gateway 沒有這個 route。

## 啟停 Scheduler Runner

單一排程的啟停用 `status` 控制；整個 scheduler runner 的啟停由部署環境設定：

```env
SCHEDULER_RUNNER_ENABLED=true
```

只在應執行排程的機器設為 `true`。其他 API 機器應保持：

```env
SCHEDULER_RUNNER_ENABLED=false
```

即使多台誤開，runner 仍會用 Valkey leader lock：

```text
scheduler:leader
```

建立或更新排程後，API 會 publish：

```text
scheduler:changed
```

已啟動的 runner 會收到通知並提早掃描 due jobs。若需要開啟或關閉 runner，修改部署環境變數後重啟 backend 服務；不要嘗試透過 `/scheduler` API 開關整個 runner。

`GET /scheduler` 回應的 `runner` 可用來確認目前 API instance 的執行狀態：

```json
{
  "runner": {
    "enabled": true,
    "runner_alive": true,
    "listener_alive": true
  }
}
```

不要用 App Env 是否存在 `SCHEDULER_RUNNER_ENABLED` 判斷部署設定；App Env
是 MongoDB 內的 plugin/Agent 設定，並不是 API container 的 process env。
Handler 預設受 `SCHEDULER_HANDLER_TIMEOUT_SECONDS=300` 限制，執行期間 runner
會自動續租。逾時會終止 handler process，並將該次 run 記錄為 failed。

## 常見錯誤處理

- `401`：AI access token 無效或過期；依 `get-plugin-edit-access` 規則 refresh 一次，失敗就停止並重新登入。
- `403 Scheduler requires admin or ai role.`：登入 session 的角色不足；重新確認 `/auth-me` 包含 `ai`。
- `404 Scheduler was not found.`：id 不存在，或排程已是 `deleted` 且未用列表查 deleted。
- `400 target.handler is not allowed.`：handler 不符合 `SCHEDULER_TARGET_ALLOWLIST`。優先改用 `services.generated.*`，或請系統管理者調整 allowlist。
- `400 cron is invalid.`：cron expression 不合法。
- `400 timezone is invalid.`：timezone 必須是 IANA timezone，例如 `Asia/Taipei` 或 `UTC`。
- `400 target.payload must be an object.`：payload 不能是 array、string、number 或 null。
- `409 Scheduler name already exists.`：排程名稱重複，改名後再送。

## Codex 操作流程

1. 確認使用者提供且已驗證的 API base URL 與記憶體內 AI JWT session。
2. 先用 `GET /scheduler?plugin=<plugin>&sort=updated_at&direction=desc` 盤點 plugin 現有排程，避免重複建立。
3. 若 target handler 不存在，先透過 Code Registry 建立或更新 plugin handler，並使用 `services.generated.<module_key>:handle`。
4. 新增排程時填 `plugin`、`name`、`schedule_type`、對應 schedule 欄位、`target`、`roles`。
5. 編輯排程時只 PATCH 需要變更的欄位。
6. 啟用用 `status: "active"`，暫停用 `status: "disabled"`，刪除用 `status: "deleted"`。
7. 操作後重新 `GET /scheduler/{id}` 或列表確認 `status`、`next_run_at`、`last_status`、`last_error`。
8. 回報使用者時摘要 affected scheduler id/name、plugin、status、schedule_type、handler，以及是否需要部署層重啟 runner。

## UTF-8 API request rule

When sending API requests that may contain Chinese or any non-ASCII text, always preserve UTF-8 explicitly.
This rule overrides older examples in this skill that show `-ContentType "application/json"` without `charset=utf-8` or that pass non-ASCII JSON strings directly as `-Body`.

PowerShell:
- Prefer building JSON first, then send UTF-8 bytes.
- Use `Content-Type: application/json; charset=utf-8`.
- Do not pass a non-ASCII JSON string directly to `Invoke-RestMethod -Body` with only `-ContentType "application/json"`; Windows PowerShell can encode the request body incorrectly.

```powershell
$json = $payload | ConvertTo-Json -Depth 40
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)

Invoke-RestMethod `
  -Uri $Uri `
  -Method Post `
  -Headers $Headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $bodyBytes
```

For `PATCH` requests, use the same pattern with `-Method Patch`.
