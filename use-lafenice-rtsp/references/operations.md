# 啟用、測試與排錯

部署完整說明位於專案 `LaFeniceBackend/docs/media-core.md`。環境變數以 Backend 的 `.env.*.example`、`services/media_core/config.py` 與相應 compose 為準；以下是 Plugin 整合需要知道的要點。

## 啟用條件

- MediaMTX 服務可供 Backend 存取；設定 `MEDIA_PROVIDER_ENABLED=true` 與 `MEDIAMTX_API_URL`。
- 固定且妥善保存 `MEDIA_ENCRYPTION_KEY`；任意輪替可能導致既有攝影機帳密無法解密。另設定 `MEDIA_SESSION_SIGNING_KEY`。
- `MEDIA_INTERNAL_AUTH_KEY` 與 `MEDIA_INTERNAL_AUTH_URL` 的 query key 一致。開發 HTTPS Backend 的憑證更換後，同步更新 `MEDIA_INTERNAL_AUTH_FINGERPRINT`。
- 支援即時白名單的版本，使用 `/{PROJECT_ROOT}/config/system/media` 的「網路白名單」分頁管理；儲存後立即套用於後續位址驗證，不必重啟。尚未儲存網頁設定時才沿用 `MEDIA_SOURCE_NETWORK_ALLOWLIST` / `MEDIA_SOURCE_HOSTNAME_ALLOWLIST`。完整設定、CIDR 範例及 API 見 [network-allowlist.md](network-allowlist.md)。loopback、link-local、multicast、unspecified、reserved 位址不能靠白名單解禁。
- 瀏覽器可連線至 `MEDIA_PUBLIC_WEBRTC_BASE_URL`、`MEDIA_PUBLIC_HLS_BASE_URL`、`MEDIA_PUBLIC_PLAYBACK_BASE_URL`。正式環境規劃 TLS reverse proxy、WebRTC public candidate／TURN、錄影儲存與備份。

由 Backend 目錄啟動已設定的開發環境：

```powershell
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile media up -d mediamtx
```

## 網路分段

| 流向 | 常見埠 | 用途 |
| --- | --- | --- |
| MediaMTX → 攝影機 | 554/TCP 或設備設定 | RTSP 拉流；UDP 模式另需 RTP/RTCP 規則 |
| 編碼器 → MediaMTX | 8554/TCP | RTSP 推流，僅需要時開放 |
| 瀏覽器 → WHEP | 8889/TCP，對外通常 443 | WebRTC signaling |
| 瀏覽器 ↔ MediaMTX | 8189/UDP | WebRTC media |
| 瀏覽器 → HLS／Playback | 8888／9996 TCP，對外通常 443 | 播放傳輸 |
| Backend → Control API | 9997/TCP | 限內部網路，不供 Plugin 存取 |

來源 `transport: tcp` 只影響攝影機到 MediaMTX，並不使瀏覽器 WebRTC 改走 TCP。一般先用 TCP；UDP 要確認網路及效益，auto 由 Provider 選擇。現有 SDK 未提供 TURN 或 WebRTC TCP fallback 的完整整合。

## FFmpeg 模擬攝影機

開發 compose 的例外允許 `camera<number>` 路徑匿名 publish，讀取仍驗證。準備相容的測試影片後，於主機執行：

```powershell
ffmpeg -re -stream_loop -1 -i test.mp4 -c copy -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/camera01
```

這是 publisher 連到主機映射埠的範例，**不能直接拿 `127.0.0.1` 當 Core source host**。若要由 Core 建立拉取該測試流的來源，必須選擇 Backend 能解析且 MediaMTX 能到達的服務名稱／網路位址、對應實際 listener 埠，並符合 allowlist；同時確認測試來源讀取授權。匿名 publish 不授權匿名 read，不要為測試關閉整體認證。`-c copy` 不會修正不相容 codec，推流成功仍要驗證瀏覽器畫面。

## 排錯順序

1. `/media/capabilities` 確認 Provider 已啟用。需要全域管理資訊時使用 `GET /media/system/status`；此 API 需要 source manager。`POST /media/system/reconcile` 會同步所有啟用來源，僅在任務涉及全域同步時使用。
2. 來源不可見：先確認 Backend capabilities 為全站模式，再檢查 `view` ACL；若頁面仍要求 tenant，更新頁面的 capability 判斷。403 依操作分辨 source manager、`manage`、`live`、`playback`，不要透過改帳號角色掩蓋錯誤。
3. 建立來源遭拒：檢查 host 格式、DNS、port、私有網段 allowlist、帳密成對，以及來源路徑。政策阻擋或加入白名單後仍無法連線，依 [network-allowlist.md](network-allowlist.md) 區分政策、攝影機網路與瀏覽器播放。不要把密碼或完整 credential URL 放進診斷輸出。
4. `sync_status` 錯誤或 Provider 502：檢查 MediaMTX 健康、Backend 到 Control API、MediaMTX 到攝影機、設備帳密及來源路徑。`POST /test` 會建立／更新 Provider path；只想查看時先用 GET status。
5. Provider online 但無畫面：檢查 WHEP HTTP 回應、public URL、TLS／CORS、媒體 session、8189/UDP、NAT／ICE 及 codec。取得 session 成功不等於媒體已連通。
6. 無錄影／回放 404：確認 recording enabled、實際已產生片段、索引同步、毫秒時間與區間交集。回放開始後失敗則查看授權、缺段及 MP4 支援，不假設 API 可保證整段覆蓋。

目前文件仍列出實體 camera/NVR codec、斷線重連、跨片段回放與 24 小時 soak test 未完成；reconcile lock 只有單一 Backend process 範圍，多副本部署需額外設計。交付時依實測結果報告，不把此文件視為現場驗收證據。
