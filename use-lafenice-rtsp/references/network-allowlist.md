# 攝影機白名單設定與連線排查

## 適用環境與界線

先確認目標 origin、`PROJECT_ROOT`、攝影機實際 IP／主機名稱、port、部署版本及目前錯誤。不要把本機開發環境的成功推論為客戶環境也成功。此白名單控制 Backend 接受的攝影機目的位址，不是使用者登入網站的來源 IP，也不會建立 VPN、路由或防火牆放行。

`ApiBase = <origin>/{PROJECT_ROOT}/api`；以下 API 路徑皆相對於 ApiBase，使用該環境既有 LaFenice 登入。不要保存帳密、Bearer token 或含帳密的 RTSP URL 到技能、日誌或診斷報告。

只要求診斷時先讀取與檢查；要求設定時，修改其授權的攝影機／網段，保留其他現有規則，不因範例而自行放行所有私有網段。

## 網頁操作

1. 開啟 `/{PROJECT_ROOT}/config/system/media`，第一個、預設分頁為「網路白名單」。僅 `super` 可儲存；source manager 可讀取與檢查，來源的 `manage` ACL 不等於全站白名單修改權。
2. 新增「IP / CIDR 網段」或「主機名稱」規則及用途備註。欄位不填 `rtsp://`、帳密、port 或 path。
3. 儲存並立即生效，重新載入確認實際保存的規則；再以攝影機的**實際位址**使用「檢查攝影機位址」。此檢查使用已儲存規則，未儲存的表單修改不算生效。
4. 政策允許後，回攝影機設定頁重新提交之前被拒絕的新增／修改。白名單儲存不會自動重送失敗的攝影機操作。

### 單一 IP 與網段不可混淆

以攝影機 `192.168.1.20` 為例：

| 輸入 | 儲存／解讀 | 是否包含該攝影機 |
| --- | --- | --- |
| `192.168.0.0` | `192.168.0.0/32`，只有一個 IP | 否 |
| `192.168.0.0/16` | `192.168.0.0` 至 `192.168.255.255` | 是 |
| `192.168.0.0/24` | `192.168.0.0` 至 `192.168.0.255` | 否 |
| `192.168.1.20` | `192.168.1.20/32`，只有這台攝影機 | 是 |

IPv6 單一位址相當於 `/128`。未附前綴長度的位址不會自動擴大成網段；沒有確切子網資訊時，使用已確認的攝影機單一 IP。`strict=False` 會正規化 CIDR，例如 `192.168.1.20/24` 存為 `192.168.1.0/24`，儲存後核對範圍。

主機名稱可填 `camera.example.com` 或 `*.example.com`；萬用規則匹配子網域，不包含根網域 `example.com`。Backend 仍會解析 DNS 並檢查所有解析位址；loopback、link-local、multicast、unspecified、reserved 位址即使列入規則仍拒絕。公開 IP 依目前設計不需列入白名單，所以這不是所有目的位址的全面預設拒絕清單。

## API 設定與驗證

| 操作 | API | 重點 |
| --- | --- | --- |
| 讀取 | `GET /media/system/network-policy` | `item.rules`、`item.revision`、`item.origin`、`can_manage` |
| 儲存 | `PUT /media/system/network-policy` | 送回最新 revision 與**完整規則清單**，僅 super |
| 檢查 | `POST /media/system/network-policy/check` | `{ "host": "192.168.1.20", "port": 554 }`；讀取政策並解析 DNS，不登入攝影機 |

儲存 body 範例（`revision` 必須來自剛讀取的回應，不可照抄；規則須合併需要保留的既有項目）：

```json
{
  "revision": 3,
  "rules": [
    { "kind": "network", "value": "192.168.1.20", "note": "入口攝影機" }
  ]
}
```

- 資料存於 MongoDB `media_network_policy` 全站 singleton，不隨租戶切換；透過 API 管理，不直接改資料庫或建立 Plugin MDC。
- 尚未有資料庫設定時，`origin: environment` 代表使用環境變數。首次儲存後，資料庫規則**完整取代**環境變數，不會合併；存空清單也不會回退到環境變數。
- 每次新增／修改攝影機位址與政策檢查都讀取資料庫，不使用程序快取。儲存規則不需要重啟 container／服務；首次部署新功能的程式碼則仍需正常部署流程。
- `409` 是版本衝突：重新讀取、比對並保留他人修改，不可盲目重試整份舊清單。`401/403` 查登入與角色；`404` 查 API base 與客戶部署版本，不要先判斷是白名單拒絕。
- 本功能不提供修改歷史。revision 用於併發控制，不是可回復的歷史版本。
- 檢查 HTTP 200 仍可能回傳 `allowed: false`。以 `allowed` 與 `code` 判斷，不以 HTTP 成功或翻譯後文字判斷。
- 常見 code：`MEDIA_PRIVATE_NOT_ALLOWED`（未匹配白名單）、`MEDIA_HOST_BLOCKED`（固定禁止位址）、`MEDIA_HOST_UNRESOLVED`（DNS）、`MEDIA_HOST_REQUIRED`／`MEDIA_PORT_INVALID`（格式）、`MEDIA_ALLOWED`（政策允許）。儲存錯誤可能為 `MEDIA_INVALID_NETWORK`、`MEDIA_INVALID_HOSTNAME`、`MEDIA_DUPLICATE_RULE`、`MEDIA_POLICY_CONFLICT`。
- 應用程式通常將錯誤物件放在 `message`，FastAPI 原生回應放在 `detail`；讀取內部 `code`／`value`，不要假定 message 永遠是字串。畫面使用既有語系字典顯示，保留原始 code 供排查。

## 已加入白名單仍連不上：分層判斷

1. **仍被政策拒絕**：讀回同一環境已存規則，比對真實攝影機 IP 與 CIDR；使用 hostname 時確認 Backend 的全部 DNS 解析結果。檢查 API base、後端版本、多副本部署及是否使用相同資料庫。設定頁與攝影機頁若對同一位址結果不同，保留兩者請求／回應與 request ID，比對實際路徑和 payload，不要直接推論為快取。
2. **政策允許，但 MediaMTX 尚未連上攝影機**：檢查 source `sync_status`／`sync_error`、`GET /media/system/status` 與 `GET /media/sources/{id}/status`。由實際 MediaMTX 所在 container／主機的網路環境確認 DNS、路由、攝影機 port、防火牆、RTSP path、帳密及 TCP／UDP 設定。使用者電腦能播放不代表 MediaMTX 能連上。
3. **服務在雲端、攝影機在客戶 LAN**：`192.168.x.x` 等私有位址需要已配置的 VPN、站點網路或可達的轉送／推流方案。白名單不會讓雲端自動連入 LAN；先確認網路拓撲，不直接把攝影機公開到網際網路。
4. **MediaMTX 來源 ready，但瀏覽器無畫面**：查 WHEP／HLS、播放 session、TLS／CORS、NAT／ICE、WebRTC UDP 與 codec，詳見 [operations.md](operations.md)。此時擴大攝影機白名單通常無助於定位問題。

必要時取得連線時間附近的 MediaMTX 錯誤日誌，遮蔽帳密與 token。依錯誤區分 DNS、timeout／no route、connection refused、認證失敗、來源 path 錯誤；以設備回應確認原因，不把所有連線失敗統稱為白名單失效。

## 已知驗證缺口與報告方式

2026-09-17 檢查的版本中，`POST /media/sources/{id}/test`、僅更新 `enabled` 的 PATCH、啟動／手動 reconcile 可能直接設定 Provider，未重新驗證最新白名單。後續版本可能修正，先核對 `router.py`、`runtime.py`、`security.py` 與實際部署。

這是「應擋未擋」的檢查缺口，**不能用它解釋「已允許卻仍被擋」**，也不能用測試連線成功證明白名單已正確執行。不要利用此路徑繞過政策。移除規則本來也不會立即切斷既有串流。

`POST /test` 會建立／更新 MediaMTX path；`POST /media/system/reconcile` 影響全站啟用來源，僅在任務授權該範圍時使用，不作為純讀取檢查。模擬 Provider 測試只證明程式流程，不代表實體設備可連線。

交付時分別報告：已保存且讀回的規則、政策檢查結果、MediaMTX 連線結果、瀏覽器播放結果；尚未取得客戶環境證據時，明確保留原因未確認，不宣稱客戶問題已修復。
