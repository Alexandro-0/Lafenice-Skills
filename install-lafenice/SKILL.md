---
name: install-lafenice
description: 下載公開 Google Drive 中更新時間最新的 LaFenice ZIP，協助初次安裝設定與備份 .env，或更新既有安裝並合併新版 env keys、保留使用者設定及資料。適用於下載、安裝與升級 LaFenice 平台，不是安裝 AI skills 或匯入業務 Plugin。
---

# 下載、安裝與更新 LaFenice

## 判斷目標與安裝狀態

先依使用者提供的位置檢查既有 release、根目錄 `.env`、Compose 設定、Docker 實例與設定備份。只檢查本次目標，不因新下載的資料夾沒有 env 就認定是初次安裝。

- 初次安裝：確認目標實例沒有既有設定或資料後，依新版範本設定。
- 更新：找到同一實例的舊安裝、資料掛載或設定備份，先備份再 merge。
- 有既有資料但 env 遺失：找回備份或原部署的設定來源，不能生成新金鑰當作全新安裝。
- 多個實例：辨識這次更新哪一個；只缺必要資訊時詢問安裝路徑、作業系統或實例名稱。額外實例的隔離配置可參考 [deploy-lafenice-instances](../deploy-lafenice-instances/SKILL.md)。

僅要求下載時，交付 ZIP 與來源資訊即可。要求安裝或更新時，在已授權範圍內完成設定、備份與驗證，不以提供指令代替可執行的工作。

## 下載前先確認資料夾路徑

下載或安裝前，必須先與使用者確認本次 LaFenice 資料夾的完整路徑。若本次任務已明確指定下載／安裝目的路徑，直接沿用，不重複詢問；目前工作目錄、偵測到的舊安裝位置或範例路徑，都不等於使用者已確認本次目的地。

尚未指定時，先詢問：「你希望將 LaFenice 放在哪個資料夾？例如 `D:/LaFenice`；若資料夾不存在，我會協助建立。」依使用者的作業系統提供合適範例。等待回答前可檢查安裝狀態與下載清單，但不得自行決定目的地、建立安裝目錄或開始下載 ZIP。

- 使用者只提供上層目錄時，明確確認是否在其下建立 `lafenice` 子資料夾，例如選擇 `D:/apps` 時，確認最終位置為 `D:/apps/lafenice`；不要默默多加一層。
- 路徑確認後，檢查完整路徑、存取權限、可用空間與既有內容。資料夾不存在時，依已確認的路徑建立；已存在時保留其內容，不清空或直接覆蓋舊 release。無法寫入或空間不足時，說明原因並請使用者指定另一個位置，不擅自改存其他磁碟。
- 在已確認的 LaFenice 根目錄下，可建立 `downloads/` 保存 ZIP、`releases/<release-name>/` 解壓各版本；採用包內實際結構，避免重複巢狀解壓。下載暫存也放在已確認目的地範圍內。
- 更新時分別辨識舊 release 與本次下載／新 release 的目的地。新版本存放位置改變，不代表授權搬移既有資料；沿用已核對的 volume／資料路徑。
- 向使用者說明安裝目錄、持久資料目錄 `HOST_DATA_ROOT` 與 env 備份目錄的用途不同。安裝目錄確認不能取代資料掛載核對；資料與備份位置仍依下方規則配置，避免放進會隨版本替換的 release 內。

## 取得更新時間最新的 ZIP

固定來源：[LaFenice 公開下載資料夾](https://drive.google.com/drive/folders/1TEHFEVfZ2Q_KM6ao1THBRfYiaahyZ6YI?usp=sharing)。

1. 每次執行都重新讀取資料夾清單，以 Google Drive「更新時間／最後修改時間」（API 的 `modifiedTime`）由新到舊排序；API 有分頁時讀完候選檔。從 LaFenice 安裝 ZIP 中選更新時間最新者，不用名稱中的日期、版本號、建立時間、本機下載時間或畫面預設順序推定最新。
2. 記錄檔名、file ID 或檔案連結、Drive 更新時間與時區、大小（可取得時）。若同時存在完整包、後端包或其他 ZIP，辨認用途；一般完整安裝使用 full-export。若最上方 ZIP 用途不明，先確認，不能把 skills ZIP 當成平台安裝包。時間相同且無法辨識時列出候選，不自行宣稱某一個最新。
3. 使用可用的 Drive 工具、瀏覽器或正常公開下載流程；不要求使用者為公開檔案提供帳號密碼。無法讀取更新時間時，改用可用的瀏覽器；仍受限則提供資料夾連結，請使用者依更新時間排序後下載並提供本機路徑。明確標示尚未驗證最新版本，不改抓不明鏡像或猜測 file ID。
4. 下載到獨立暫存目錄，確認實際為可完整讀取的 ZIP，而不是 HTML 登入／下載確認頁；若有發布者校驗碼則核對。可記錄本機 SHA-256 作追蹤，但它本身不能證明來源可信。
5. 檢查 ZIP 項目不會以絕對路徑、`..` 或連結逸出解壓目錄，解壓到新的 release 資料夾，保留舊版。讀取包內 README、`.env.example`、出廠 `.env`、Compose 與啟動腳本，以實際下載版本為準。

本 skill 不固定最新 ZIP 名稱或版本。完整包通常包含根目錄 `.env`、`docker-compose.yml`、`backend/`、`frontend/`；合併部署使用根目錄 `.env`，不要誤改 standalone 的 `backend/.env` 或 `frontend/.env`。

## 初次安裝與設定備份

1. 檢查 Docker daemon、Docker Compose 是否可用，並閱讀包內平台需求。依使用者現有本機、LAN 或網域入口設定連線位址；缺少必要偏好才詢問。
2. 保留新版出廠 env，以它為基底建立實際 `.env`，不要用目前開發機的 env 當作客戶範本。
3. 設定穩定的絕對 `HOST_DATA_ROOT`，放在 release 外，例如 Windows `D:/LaFeniceData/main`、Linux `/opt/lafenice/data/main`。檢查可寫入、埠與實例名稱是否衝突；初裝不得直接接上來源不明的既有資料目錄。
4. 設定 `PROJECT_ROOT`、`FRONTEND_PORT`、`FRONTEND_BIND_ADDRESS` 與入口相關值。完整包的 `API_BASE` 通常為 `/<PROJECT_ROOT>/api`，仍以該包契約為準。保留容器內部 MQTT `1883`、Valkey `6379` 及包內 FastAPI 連接方式，不拿 host port 取代內部埠。
5. 使用安全亂數或使用者安全提供的值設定 `MONGO_ROOT_PASSWORD`、`MQTT_PASSWORD`、`JWT_SECRET`、`MEDIA_INTERNAL_AUTH_KEY`，並替換啟用中的 `DEFAULT_SUPER_PASSWORD`、`DEFAULT_ADMIN_PASSWORD`、`DEFAULT_AI_AGENT_PASSWORD`。其他金鑰依包內要求的格式設定；選用空值只有在該功能明確允許時保留。避免部署出廠密碼或 setup marker。
6. 在 release、原始碼 repository 與資料目錄之外建立限制存取的設定備份，例如 `D:/LaFeniceConfigBackups/main/<timestamp>/`。以原始位元組保存完成的 `.env`，核對備份與原檔雜湊；同時記錄實例名稱、Compose project、release、啟動參數與資料路徑。驗證成功後再存一份 accepted 備份，後續每次設定異動均新增歷史，不覆蓋唯一備份。

env 與其備份包含秘密，不提交 Git、不上傳公开空間、不在對話或 log 印出值。需要使用者填入秘密時使用安全輸入或本機檔案。備份私鑰檔、憑證與 override 時一併保留必要的權限與掛載資訊；env 備份不是資料庫備份。

## 更新：先 merge，再切換

更新時必須先閱讀 [env 合併規則](references/env-merge.md)。

1. 記錄舊版實際使用的 env、Compose project、所有 `-f` override、profile、資料掛載與啟動方式；把 shell 環境覆蓋、外部秘密檔等設定來源納入核對。備份舊 env 與設定，保留新包出廠 env。
2. 在新 release 中產出合併候選檔。用新版作基底、依 key 分類取值；不得整份舊 env 蓋掉新版，也不能只補上新 keys 卻忽略版本相容性。輸出只含 key 名稱、來源及待處理項目的摘要。
3. 驗證新 keys、舊自訂 keys、秘密、資料路徑及版本選擇都正確，再以暫存檔加原子替換寫入新 `.env` 並備份。任何未解決的必要設定或 merge 歧義都應停在候選階段，保留舊服務運行。
4. 先完成新設定預檢與可先做的建置。檢查發布說明中的資料遷移與服務版本相容性；切換前取得與部署方式相符的可還原資料備份。不能把运行中的 MongoDB 資料夾直接複製當作一致備份。
5. 切換時才依舊實例原本的 Compose 參數停止該實例，再由新 release 啟動。保留同一實例的 project、網路、資料卷與資料目錄。普通更新不得執行 `down -v`、清除資料卷或建立空資料目錄冒充原資料。
6. 更新失敗時保留診斷資訊。確認資料格式仍相容後才以舊 release、舊 env 及原掛載回復；若新版已遷移資料，依一致的升級前備份與還原程序處理，不能假設退回程式就能復原。

## Volume、port 與實例名稱衝突

初裝與更新在啟動前都執行以下檢查；Compose 語法驗證通過不代表資源沒有衝突。

1. **先辨識歸屬**：檢查 Docker 容器（含已停止者）的 Compose labels、名稱、網路、實際 mounts 與 published ports，以及目標 volume 的 labels、使用它的容器及 bind mount 的實際絕對路徑。只讀取需要的欄位，避免完整 inspect 洩漏 env。名稱相同、沒有 labels 或目前無容器使用，都不能單獨證明資源屬於本次安裝或可刪除。資料夾還要核對 symlink／junction 解析後的位置，避免不同路徑實際共用資料。
2. **檢查所有對外埠**：依實際 Compose 與 override 列出 host IP、port、TCP／UDP，不只檢查 `FRONTEND_PORT`；另含實際發布的 API、外部 MQTT、`MEDIA_WEBRTC_UDP_PORT` 等。核對 Docker 映射及主機非 Docker 程序的 listener，例如 Windows 的 `Get-NetTCPConnection`／`Get-NetUDPEndpoint`，或 Linux 的 `ss`。考慮 `0.0.0.0`／IPv6 wildcard 的重疊及主機保留埠；TCP 與 UDP 分別檢查，不只根據 port 數字判定。

| 情境 | 處理方式 |
| --- | --- |
| 初裝的 host port 被其他服務占用 | 使用者未指定固定埠時，自動選擇並驗證可用 host port，例如 `11701` 被占用時可檢查 `11801`；不可假定例子必然可用。更新本次 `.env` 及實際 host mapping，保留原本 bind address，不擴大對外暴露。不要停掉或修改占用埠的其他服務。 |
| 使用者要求固定埠，或更新時原埠被其他服務占用 | 先列出占用者與可用替代方案。若現有授權未允許改入口，詢問是否改埠；保留已完成的新設定候選與舊服務，不自行 kill 程序、移除容器或改動其他部署。 |
| 更新時埠／容器名稱由同一實例舊版占用 | 這是預期的切換前狀態。保留原埠與身份，完成備份、merge 與預檢後，依更新流程只停止目標舊版，再啟動新版；不為了並行啟動而改名或改接空資料。 |
| 初裝的 named volume 或資料目錄已屬於其他實例 | 為本次新實例選用獨立名稱與新的專用 `HOST_DATA_ROOT`，連同各 `HOST_*_DIR`、Compose project、network、container names 及必要服務引用一起配置。不要重用、清空或刪除既有資料；Docker 可能直接重用同名 volume，未報錯不表示沒有衝突。 |
| 更新時找到同一實例的既有 volume／資料目錄 | 這是應保留的資料來源，核對實際 mount 後沿用。不要用新 volume 名稱「排除衝突」，否則服務可能啟動成功卻看不到原資料；也不要讓兩套 MongoDB 同時掛載寫入相同資料。 |
| 資源歸屬不明或多個實例已共用資料 | 停止依賴此判斷的啟動／搬移，保留候選，先釐清歸屬。已有資料的分離需另做備份與遷移，不當成一般改名處理。 |

只有 host 發布埠冲突時，保留容器內部 MQTT `1883`、Valkey `6379` 與 FastAPI 的既有設定。像 `1983:1883` 是更換 MQTT host port，不是把 `MQTT_PORT` 改成 `1983`。媒體 UDP 埠如受包內服務監聽及 ICE 宣告共同控制，依該版契約同步設定，不能只改 host mapping；必要的反向代理、用戶端 URL、防火牆或 NAT 更新也要納入檢查，在授權範圍內操作。

新實例的成套命名可參考 [多實例部署](../deploy-lafenice-instances/SKILL.md)，但 `configure_second_instance.ps1` 不會完整檢查資源占用，也未配置所有媒體資源與 UDP 埠；使用後仍須依實際新版 Compose 核對，不能只看腳本成功訊息。

調整完成後重新檢查 mounts、身份與埠，備份最終 env 和 override，再啟動驗證。檢查與啟動間仍可能被其他程序搶占埠；若啟動回報衝突，重新查明占用者，依同一規則處理，不無限重試。交付時列出本次改動的資源名稱、host port 與最終 URL，確認其他實例未受影響。不得以 `down -v`、`volume rm/prune` 或刪除資料目錄解決普通安裝／更新的衝突。

## 啟動及驗證

以下命令適用於含 host-volume 腳本的完整包，在已設定好的新 release 根目錄執行；既有 named-volume 部署維持原模式，不自動改成 host bind。

```powershell
docker compose --env-file .env -f docker-compose.yml -f docker-compose.host-volumes.yml config --quiet
```

先檢查必要值、預設密碼與 setup marker；`config --quiet` 僅驗證 Compose，不能證明秘密設定與資料掛載正確。避免把完整 `docker compose config` 或 `.env` 輸出到對話。以非互動工具執行 Windows 啟動時可直接呼叫包內 `.ps1`，避免 `.bat` 的 pause 等待輸入；人工操作可用 `.bat`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-with-host-volumes.ps1
```

Linux／macOS：

```sh
sh ./start-with-host-volumes.sh
```

如果選擇其他 Compose 模式，使用包內對應流程，並自行執行相同的 env 預檢。啟動後檢查容器健康、前端入口與 `/<PROJECT_ROOT>/api/ping`，更新時另確認原有資料與登入功能仍可使用；其他實例應保持正常。

交付下載檔名與 Drive 更新時間、安裝或更新模式、release 路徑、env 備份位置、merge 的新增／保留／採新版／待確認 keys、入口 URL 及實測結果。未下載、未啟動或未驗證的部分如實標示，不宣稱已安裝完成。
