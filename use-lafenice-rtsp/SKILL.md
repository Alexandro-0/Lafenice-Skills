---
name: use-lafenice-rtsp
description: >-
  在 LaFenice Plugin 中使用 RTSP/RTSPS 攝影機串流、即時監看、錄影查詢與回放。適用於媒體來源設定、監控牆、設備影像頁面、事件回放及 Media Core 連線排錯；透過既有 Media Core API 與 Browser SDK 整合。
---

# LaFenice RTSP 使用與應用

## 功能與責任

LaFenice Media Core 負責攝影機連線、加密帳密、MediaMTX 串流、錄影索引與短效播放授權。Plugin 負責設備／場域等業務資料、畫面與操作流程，透過 `media_source_id` 關聯 Core 來源。

- 即時監看：RTSP/RTSPS 來源經 MediaMTX，以 WHEP/WebRTC 傳到瀏覽器。
- 錄影回放：查詢來源的錄影片段，再建立指定時段的 MP4 回放 session。
- 設備管理：建立、更新、停用或退役 Core source，並維護 Plugin 的設備關聯。
- 應用方式：單一攝影機預覽、多路監控牆、場域設備頁、事件時間點回放。事件由業務系統提供；不要假設 Core 已提供影像辨識、ONVIF 發現或 PTZ 控制。

## 依任務讀取

- 實作來源設定、Live、Playback 或業務頁面：讀 [references/plugin-integration.md](references/plugin-integration.md)。
- 啟用 MediaMTX、測試串流或排查連線：讀 [references/operations.md](references/operations.md)。
- 修改 Code Registry、Gateway 或 MDC 時，再讀相鄰的 `develop-plugin-code`、`get-plugin-edit-access` 或 `manage-metadata-driven-collection` skill 中與任務相關的指引。

本 skill 位於專案 `plugin_skills/use-lafenice-rtsp`。有原始碼時，以專案根目錄下的 `LaFeniceBackend/docs/media-core.md`、`services/media_core/{router,models,config,security,provider}.py`（位於 Backend）及 `LaFeniceFrontend/src/media/mediaClient.ts` 核對版本。只有遠端環境時，先查 `/media/capabilities` 與部署版本可用的 API 文件；不要假設遠端已包含本機功能。

## 整合原則

1. 先確認目標環境、現有來源及使用者要求的功能。重用適合的來源；不要每次開啟頁面就建立 source。
2. 公開 API 使用既有 LaFenice 登入，不要求 active tenant；來源為全站共用，仍依角色 ACL 授權。`ApiBase` 是部署環境的 `/{PROJECT_ROOT}/api`，不要硬編 `/lafenice`。
3. Plugin 只保存來源 ID 與業務資料。RTSP 帳密僅透過 Core source API 提交，不寫入 Plugin collection、程式碼、匯出包、URL 或瀏覽器 storage。Core collection `media_sources`、`media_recordings` 不納入 Plugin MDC 或匯出包。
4. 瀏覽器不直接以 `<video src="rtsp://…">` 播放。使用 Core 回傳的 session 與 SDK；不要由 Plugin 操作 MediaMTX Control API 或組合錄影磁碟路徑。
5. 來源建立／更新／退役依 `MEDIA_SOURCE_MANAGER_ROLES`（預設 `admin,ai`，`super` 亦可）；source `manage` ACL 主要用於 `/test`，不等同取得 CRUD 管理權。觀看、Live、Playback 分別檢查 `view`、`live`、`playback`。
6. 切換來源、tenant、登出或頁面卸載時釋放播放器並清除舊 session。新 session 透過有效登入重新申請；不要把來源 ID 或短效 token 當成永久播放網址。

## 驗證與交付

依實際改動驗證來源可見性、連線狀態、Live 畫面、錄影片段與短區間回放；涉及權限時，以實際授權的不同角色驗證 ACL，並確認未選 tenant 與切換 tenant 時可操作相同來源，不能用管理員成功推論一般使用者也成功。監控牆要驗證切換與離頁後連線有釋放。

區分「API 建立成功」、「Provider online」與「瀏覽器真的播放成功」。`POST /test` 會設定 Provider path 並查狀態，不是純讀取，也不是 codec/FPS 全面檢測。文件或程式碼檢查只能證明相應範圍；沒有實際設備或環境時，明確列出未驗證項目。
