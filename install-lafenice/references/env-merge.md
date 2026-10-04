# 更新 LaFenice 時的 env 合併規則

## 輸入與輸出

先依 [實例索引契約](../../deploy-lafenice-instances/references/instance-registry.md) 確定目標 UUID 與正式設定來源；舊 env、快照與 Docker 資源必須屬於同一實例。客戶顯示名稱可以改，歸屬以永久 ID 加實際資源核對，不按備份檔名或相似路徑猜測。新版出廠 env 不因解壓而成為正式 env。

使用同一實例的舊有效 env、新包原始 env，以及可取得時的舊版出廠 env（三方比較）。有效設定還可能來自 shell、`--env-file`、Compose override 或秘密檔；先識別來源，不將其他實例的值混入。

保留三份互不覆蓋的檔案：舊有效 env 的歷史備份、新版出廠 env、合併候選 env。不要修改舊有效 env。新包沒有清楚的設定範本時，先讀包內文件或找正確範本，不能拿舊檔冒充新版。

## 依 key 分類取值

| 類別 | 合併規則 |
| --- | --- |
| 新版才有的 key | 保留新版 key 與預設值；若是必填、秘密或 placeholder，完成設定後才能啟動。 |
| 兩版都有的使用者設定 | 保留舊有效值，包括刻意設為空字串、`false`、`0` 的設定；空值不等於缺少 key。 |
| 新版才有的套件版本 | 採新版值；不從其他版本猜測補值。 |
| 兩版都有的套件版本 | `APP_VERSION`、`MONGO_VERSION`、`MQTT_VERSION`、`VALKEY_VERSION`、`SEAWEEDFS_VERSION`、`MEDIAMTX_VERSION` 原則採新版。先看發布說明與既有資料相容性；偵測自訂 pin 或不支援的跨版升級時保留候選、釐清遷移後才啟動。不要將所有 `*_VERSION` 都當成套件版本。 |
| 僅舊版有的 key | 預設保留於「沿用自訂設定」區塊並列出，避免遺失客製設定；若有明確移除或改名契約，依契約遷移並記錄去向。不能只因新版未列出就刪除。 |
| 改名或語意變更的 key | 依新版說明轉換，記錄對應關係；不能憑名稱相似猜測，也不能同時留下互相衝突的設定。 |
| 兩版預設不同且用途不明 | 有舊出廠範本時辨別是否為使用者自訂；查新契約後再決定。三方比較提供證據，不代表舊值等於出廠值就可任意替換身份或金鑰。 |

## 必須核對的 LaFenice 設定

- **預設帳號密碼**：DEFAULT_SUPER_PASSWORD、DEFAULT_ADMIN_PASSWORD、DEFAULT_AI_AGENT_PASSWORD 合併時保留同實例舊有效值，不用新版出廠值覆蓋，也不因密碼較簡單就自行產生新值。依 [安裝 skill 的密碼規則](../SKILL.md) 尊重使用者選擇。
- **初始化與真正改密碼不同**：目前後端 services/auth.py 的 _ensure_default_password_user 在帳號已存在時保留 password_hash，只在不存在時以 env 密碼建立帳號。因此更改 env 並重啟通常不會修改既有 super/admin/ai-agent 的登入密碼；實際下載版本仍須核對其契約。若連到空資料庫或帳號被刪除，可能按新 env 建帳，這不是覆蓋原帳號。不得把此情況當成更新成功。明確要求改現有密碼時使用受支援帳號 API／管理介面；env 初始化值如需同步須明確記錄，不能把單獨 env 編輯回報為密碼已重設。
- **資料與身份**：`HOST_DATA_ROOT`、各 `HOST_*_DIR`、命名 volume、Compose project、容器與網路名稱、`PROJECT_ROOT`、資料庫名稱、replica set、Mongo/MQTT 帳密、Valkey URL、前端 image 名稱與對外埠。更新不得重設身份或換到另一組空 volumes。MQTT 帳號初始化後尤其不能隨意變更；env 改密碼也不代表既有 MongoDB 使用者密碼已同步修改。
- **秘密與加密**：保留 `JWT_SECRET`、`APP_ENV_ENCRYPTION_KEY`、`MEDIA_ENCRYPTION_KEY`、`MEDIA_SESSION_SIGNING_KEY`、`MEDIA_INTERNAL_AUTH_KEY`、`PASSWORD_ENCRYPTION_PRIVATE_KEY_*`、S3 金鑰與既有帳密。若媒體 key 空值代表回退到 `JWT_SECRET`，保留其有效金鑰來源，不趁升級生成新值。新增必要秘密只初始化新增項；既有 placeholder 需依實际初始化與遷移程序處理，不能盲目輪替。
- **相對路徑**：舊 `HOST_DATA_ROOT` 空白、`./volumes` 或其他相對掛載，在不同 release 會解析成不同目錄。先依舊 Compose 基準與實際 mount 解析原絕對位置，讓新版指向同一資料；私鑰、憑證、自訂 bind mounts 也要核對。需搬移資料時另做一致備份與遷移，不能悄悄建立新資料夾。保留舊路徑也表示舊 release 目錄尚不能刪除。
- **媒體相容性**：舊 `MEDIAMTX_API_URL=http://127.0.0.1:9997` 在 API 與 MediaMTX 分容器時不可達。核對新 Compose 後改為實際服務位址，標準包通常是 `http://mediamtx:9997`；若原為自訂遠端服務則保留其有效 URL。保留攝影機 allowlist、公開媒體 URL 與 WebRTC host/UDP 埠設定。
- **選用功能**：保留 storage backend、S3、排程 runner、proxy、外部 MQTT 等自訂設定。多 API 部署不可因新版預設開啟 runner 而讓所有實例一起執行排程。

## 解析與寫入要求

使用支援實際 dotenv／Compose 語法且能保留值語意的方式處理檔案，不執行或 `source` env。不得以單純逐行 split 或正則取代宣稱涵蓋所有格式。

- key 大小寫有別；只在賦值分隔符拆分，值可含 `=`、`#`、空白、引號、反斜線、`$`、`${VAR}` 或 `$$`。不要把註解誤讀為 key，也不要展開或重寫秘密。
- 保留新版註解與順序、舊值必要的 quoting／escaping，正確處理 UTF-8 BOM、CRLF/LF 與多行值。引用其他 key 的值，合併後須核對引用的有效來源與 Compose 插值結果。
- 任一輸入出現重複 key、無法理解的多行／export 語法或解析錯誤，先列出 key／行號並釐清，不採靜默 last-wins；錯誤摘要不包含秘密原文。
- 合併前後均不輸出秘密值。候選成功解析且驗證後才原子替換目標；失敗保留原檔。對真正消費設定的 Compose／啟動腳本驗證語意，避免檔案可讀但啟動器解讀不同。

相鄰部署 skill 的 `manage_instance_env.ps1 -Action Backup` 可協助 Windows 備份。其 `Restore` 是有限的逐行 merge，套件版本清單亦未涵蓋 `MEDIAMTX_VERSION`；不能直接把執行成功當作符合本規則。若使用它，僅在新 release 的候選副本操作，先確認輸入語法受支援，之後逐項核對所有分類與值。對多行、特殊替代字元、重複 key 等情形改用經驗證的解析方式，勿直接寫正式 env。

## 完成合併的驗收條件

1. 新版所有有效 keys 均存在；舊自訂 keys 均保留或有明確遷移紀錄；最終無重複 key。
2. 所有應保留的設定在解析後語意相同；版本採新版或有可說明的相容性決策。加密與資料來源未意外變更。
3. 必填項與新增秘密均已設定，沒有未解決的 placeholder；選用空值符合該版本規則。
4. Compose 預檢通過，實際 mount、project 與入口符合目標實例；輸出摘要僅列 key、取值來源與變更原因。
5. 舊 env、新版出廠 env 與最後採用的 env 均有獨立可驗證備份，含外部秘密檔與 override 的必要還原資訊。

可用合成資料核對決策：舊 `JWT_SECRET` 保留，新 `APP_VERSION` 採新值、新 key 不遺失、舊自訂 key 不遺失、刻意空值不被新預設蓋掉；含 `$`／`#`／`=` 的引號值語意不變；重复 key 先停止；舊 `./volumes` 換 release 後仍指向原目錄。不要用真實秘密作測試範例。
