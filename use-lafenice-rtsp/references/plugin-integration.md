# Plugin 整合契約與應用

以下路徑皆相對於 `ApiBase = <origin>/{PROJECT_ROOT}/api`，使用 LaFenice Bearer token。來源與錄影操作不要求 active tenant，依來源角色 ACL 授權。`GET /media/capabilities` 的 `source_scope: "global"`、`requires_active_tenant: false` 表示全站模式，頁面不可因未選 tenant 而禁用功能。舊版部署未提供這些欄位時仍需遵循舊版 tenant 契約。

既有來源及錄影保留原 tenant_id 作相容資料，查詢不再依目前 tenant 過濾；新來源使用 `__global__` 標記。Plugin 的業務 MDC 是否需要 tenant 仍依其自身設定，不因 Media Core 全站化而改變。

## 來源與 API

| 操作 | API | 回應／注意事項 |
| --- | --- | --- |
| 功能探查 | `GET /media/capabilities` | 檢查 `provider_enabled`、協定與 session TTL |
| 可見來源 | `GET /media/sources` | `{items: [...]}`，全站來源，經 view ACL 過濾 |
| 新增 | `POST /media/sources` | `201 {item: ...}`；需要 source manager |
| 讀取／修改 | `GET/PATCH /media/sources/{id}` | `{item: ...}`；修改需要 source manager |
| 退役 | `DELETE /media/sources/{id}` | 停用並標記退役，不是刪除全部歷史錄影 |
| 連線測試 | `POST /media/sources/{id}/test` | `{status: ...}`；manage ACL，會 upsert Provider path |
| 即時狀態 | `GET /media/sources/{id}/status` | `{status: ...}`；view ACL |
| 即時授權 | `POST /media/sources/{id}/live-session` | `{session: {source_id, token, expires_at, whep_url, hls_url}}` |
| 錄影查詢 | `GET /media/recordings?source_id=...&start_at=...&end_at=...` | `{items: [...]}`；playback ACL；時間交集查詢 |
| 回放授權 | `POST /media/sources/{id}/playback-session?start_at=...&end_at=...` | `{session: {source_id, token, expires_at, url, start_at, end_at}}` |

新增來源的 JSON 範例（角色名稱、位址及路徑依實際環境替換）：

```json
{
  "name": "入口攝影機",
  "scheme": "rtsp",
  "host": "192.168.10.20",
  "port": 554,
  "source_path": "Streaming/Channels/101",
  "username": "camera-reader",
  "password": "replace-at-request-time",
  "transport": "tcp",
  "enabled": true,
  "recording_enabled": true,
  "segment_duration_seconds": 300,
  "retention_days": 30,
  "access": {
    "view": ["camera-viewer", "camera-operator"],
    "live": ["camera-viewer", "camera-operator"],
    "playback": ["camera-operator"],
    "manage": ["camera-operator"]
  }
}
```

`host` 只放主機名稱／IP，不放完整 URL。攝影機的 `source_path` 和 Core 自動產生的 `stream_path` 不同，通常省略後者。`scheme` 支援 `rtsp/rtsps`；`port` 預設 554，RTSPS 亦應明確填設備實際埠。

帳號與密碼必須一起提供／更新；PATCH 省略兩者表示保留，兩者同時設 `null` 或空字串可清除。不要把讀取回應裡沒有帳密解讀成未設定：看 `credentials_configured`。回應 endpoint 欄位為 `{scheme, host, port, path}`，輸入欄位則為 `source_path`。

`segment_duration_seconds` 範圍 10–86400，`retention_days` 為 1–3650。未指定時錄影預設啟用；只需要 Live 的應用應明確設 `recording_enabled: false`。來源建立成功後仍須檢查 `sync_status`，因為資料保存不代表 Provider 同步成功。

source ACL 預設為 `admin/ai`；目前 `admin/ai/super` 可通過 action 檢查。自訂角色需明確配置對應 action。上例的 `camera-operator` 可測試來源，但只有同時符合 source manager 設定才可新增／修改／退役；不要為了讓範例通過而自行擴大系統角色權限。

## Live 與 SDK

App Shell 原始碼可重用 `LaFeniceFrontend/src/media/mediaClient.ts`：

```ts
// 函式由專案 mediaClient 模組匯入；authFetch 使用現有登入流程。
const { session } = await createLiveMediaSession(authFetch, sourceId);
const detach = await attachWhepSession(videoElement, session);
// 切換來源／離頁時：
await detach();
```

`attachWhepSession` 建立 WebRTC peer、交換 SDP，並以 `Authorization: Bearer <media session token>` 呼叫 WHEP。回傳的 cleanup 關閉 peer 並刪除 WHEP resource。畫面可用 `muted`、`playsInline`；若 autoplay 被瀏覽器拒絕，提供播放按鈕。

Code Registry HTML 不能假設能直接 import 本機 TypeScript 檔。依既有頁面的 runtime context 取得 ApiBase 與登入狀態，呼叫相同 Core API，並將 SDK 所需的 WHEP／cleanup 邏輯適配成頁面可執行的 JavaScript。不要從 localStorage 抽取 token，也不要臆造全域 SDK 名稱。需要此模式時，參照相鄰 `develop-plugin-code` 的 runtime context 契約。

每個監控格子持有獨立 session／peer。限制同時播放數，隱藏或移出頁面的格子依需求停止；測量實際攝影機 codec、瀏覽器解碼與頻寬，不承諾任意路數。處理非同步建立完成晚於離頁的情況：過期的 attach 結果立即 cleanup。SDK 沒有自動續期／重連，依 session 到期與連線錯誤重新取得授權，採有限重試並顯示失敗狀態。

## 錄影與事件回放

`start_at`、`end_at` 都是 Unix epoch **毫秒**，`end_at > start_at`；回放 API 的時間是 query parameters，不是 JSON body。日期輸入先轉成明確時區的時間，再用 `Date.parse(...)` 等方式轉成毫秒。

```ts
const { items } = await listMediaRecordings(authFetch, sourceId, startAt, endAt);
if (items.length === 0) {
  // 顯示此區間沒有錄影。
} else {
  const { session } = await createPlaybackMediaSession(
    authFetch, sourceId, startAt, endAt,
  );
  const detach = await attachPlaybackSession(videoElement, session);
  // 切換／離頁時呼叫 detach()，撤銷 Blob URL。
}
```

查詢預設最多 200 筆，可傳 `limit`（1–1000），按開始時間降冪排列；現有 `listMediaRecordings` SDK 沒有 limit 參數，需要時透過已授權 fetch 呼叫 API。大量片段可縮小查詢時間窗，避免把截斷結果當成完整歷史。

事件回放可在 Plugin 事件記錄保存 `media_source_id`、事件毫秒時間與業務資訊，開啟事件前後的短時間窗。API 只檢查有無相交錄影，不保證所選區間全程連續；UI 應處理缺段與回放失敗。

目前 `attachPlaybackSession` 下載完整 MP4 為 Blob 再播放，適合短區間；長區間須另外實作串流／MSE 或分段方案。回應有 `hls_url` 不代表 SDK 已封裝授權 HLS fallback；manifest 與 segment 的授權流程須另行實作與驗證。

## 業務資料與畫面

設備 MDC 可保存設備名称、位置及 `media_source_id`；事件 MDC 可保存發生時間及來源關聯。Core 來源與業務記錄不在同一交易，建立流程須處理中途失敗，讓使用者重用已建立來源；不要以盲目重試產生重複 source。

一般 viewer 頁面提供可見來源與 Live；operator 可另顯示有權限的回放與測試。設備維護頁須依 source manager 權限安排來源 CRUD。刪除業務設備是否連帶退役共享來源應依需求決定。退役後不承諾歷史回放仍可用：目前 source 查詢與媒體授權會排除退役來源。
