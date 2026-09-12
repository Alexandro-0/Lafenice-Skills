# LaFenice Skills

[English](README.md) | **繁體中文**

讓 AI Agent 依照 LaFenice 的平台契約，協助你規劃、開發、測試與交付業務 Plugin。

本 repository 收錄供 Codex 使用的 skills，以及搭配的 API / runtime 參考文件、需求與測試範本、驗證腳本和範例。主要開發流程透過已部署的 LaFenice API 操作，適合沒有 Backend / Frontend 原始碼存取權的 Plugin 開發情境；另提供架構說明、Schema 設計與部署維護等專用 skills。

**第一次使用：** 從 [快速開始](#快速開始) 安裝，再依 [Skills 一覽](#skills-一覽) 選擇工作入口。建立新 Plugin 可先使用 [`orchestrate-lafenice-plugin-lifecycle`](orchestrate-lafenice-plugin-lifecycle/SKILL.md)。

## 可以協助你完成什麼？

- 將產品需求整理成 PRD、可行性評估、設計與驗收項目。
- 將外部 Schema 轉為 MDC（Metadata-Driven Collection），建立欄位、驗證、權限與主從關聯。
- 產生 CRUD / history API 與資料頁，再透過 Code Registry 擴充 Python Handler 和 HTML 頁面。
- 整合選單、語系、角色、App Env、排程、PWA 與 RTSP 媒體功能。
- 驗證部署結果、匯出 Plugin 封裝，或在環境之間匯入與轉移。
- 說明 LaFenice 核心架構，或維護同一 Docker host 上的獨立部署實例。

這裡的 **skill** 是 Agent 的工作指引；**LaFenice Plugin** 是部署在平台上的業務功能封裝。下載這份 repository 不會安裝 LaFenice 伺服器，也不會自動把範例 Plugin 匯入你的環境。

## 快速開始

### 1. 安裝 skills

如果你的 Codex 提供 `skill-installer`，可直接提出以下請求：

```text
使用 $skill-installer，從 https://github.com/Alexandro-0/Lafenice-Skills
安裝 repository 根目錄下所有包含 SKILL.md 的 skill 資料夾。
請保留各資料夾內的 references、assets、scripts 與 agents，
以及各 skill 之間的同層相對路徑。
```

也可以手動下載：

```sh
git clone https://github.com/Alexandro-0/Lafenice-Skills.git
```

將下載內容中每個包含 `SKILL.md` 的資料夾，完整複製到以下其中一個位置，讓它們保持同層：

| 使用範圍 | 目的位置 |
| --- | --- |
| 特定專案 | `<你的專案>/.agents/skills/` |
| 個人所有專案 | `~/.agents/skills/`（Windows：`%USERPROFILE%\.agents\skills\`） |

例如安裝後應有 `.agents/skills/build-lafenice-plugin/SKILL.md`。只複製 `SKILL.md` 會遺失契約、腳本與範本；只安裝單一 skill 時，也需要保留它引用的其他 skills。完整安裝適合需要端到端開發的使用者。

Codex 的本機探索位置、明確指定 skill 與安裝說明，參見 [OpenAI 官方 Skills 文件](https://learn.chatgpt.com/docs/build-skills)。若新安裝的 skill 未出現，可重新啟動 Codex。

### 2. 準備任務資訊

純架構說明、文件規劃或離線 Schema 轉換，可以先提供問題、需求或輸入檔案。

要操作已部署系統時，請準備：

| 資訊 | 說明 |
| --- | --- |
| 專案 URL | 完整、正確的目標環境網址，包含實際 project path。 |
| 開發身分 | roles 包含 `ai` 的 LaFenice 帳號，以及透過安全方式提供的密碼。 |
| Plugin 範圍 | 名稱、版本、新建或修改、預期功能及可操作的環境。 |
| 驗收條件 | 要完成的流程、使用角色、資料規則，以及希望停在哪個階段。 |

API 登入與角色驗證由 [`get-plugin-edit-access`](get-plugin-edit-access/SKILL.md) 處理。可依執行環境以 process-scoped `LAFENICE_AI_ACCOUNT` / `LAFENICE_AI_PASSWORD` 提供憑證；不要將密碼或 token 寫入需求文件、程式碼、公開 Issue 或封裝檔。

API 型開發需要 Agent 能連線目標部署；有 UI 的驗收需要瀏覽器操作能力。Python / Node.js / PowerShell 等執行工具依各 skill 所用腳本準備，部署維護則另需對應 Docker 環境。實際前置條件以該 skill 為準。

### 3. 指定工作入口

以下範例可直接作為任務起點；網址是示意值，請替換成你的目標環境。

**先完成需求文件，停在 PRD：**

```text
使用 $orchestrate-lafenice-plugin-lifecycle，規劃一個設備維護 Plugin。
需要設備清單、保養紀錄、附件及逾期提醒。
這次只產出 PRD 與待確認問題，先不要操作部署系統。
```

**在已部署系統建置 Plugin：**

```text
使用 $build-lafenice-plugin，依我提供的已確認需求建立 maintenance Plugin。
目標專案：https://example.com/lafenice
開發憑證將透過安全輸入提供。
請完成 API 與頁面驗收，交付平台匯出的封裝及需求文件。
```

**修改既有功能：**

```text
使用 $orchestrate-lafenice-plugin-lifecycle，修正 maintenance Plugin
保養紀錄無法篩選日期的問題。我會提供現有需求與測試資料。
請從受影響的階段接續，評估需要同步更新的文件與測試。
```

**先轉換資料結構：**

```text
使用 $convert-external-schema-to-mdc，將附上的 SQL DDL 轉成 MDC 設計稿。
請指出 collection 邊界、關聯、附件欄位與需要我確認的地方。
這次只做設計，不寫入部署系統。
```

**只了解平台架構：**

```text
使用 $explain-lafenice-architecture，說明 App Shell、Gateway、
Code Registry、MDC 與 MongoDB 的關係，以及 Core / Plugin 的分工。
```

## Skills 一覽

### 規劃與核心開發

| Skill | 適用工作 |
| --- | --- |
| [`orchestrate-lafenice-plugin-lifecycle`](orchestrate-lafenice-plugin-lifecycle/SKILL.md) | 串接需求、可行性、設計、實作、測試與文件；支援單一階段、接續工作和局部修正。 |
| [`build-lafenice-plugin`](build-lafenice-plugin/SKILL.md) | 透過已部署 API 完整建置、測試與匯出 Plugin，交付封裝和需求文件。 |
| [`get-plugin-edit-access`](get-plugin-edit-access/SKILL.md) | 確認專案 URL、登入、驗證 `ai` 角色並預檢開發 API。 |
| [`convert-external-schema-to-mdc`](convert-external-schema-to-mdc/SKILL.md) | 將 JSON Schema、SQL、OpenAPI、樣本資料或文字結構轉成 MDC 設計稿。 |
| [`manage-metadata-driven-collection`](manage-metadata-driven-collection/SKILL.md) | 管理 MDC 欄位、驗證、權限、關聯、檔案欄位及 Generate Code。 |
| [`develop-plugin-code`](develop-plugin-code/SKILL.md) | 建立或修改 Code Registry Python / HTML、進階資料行為及外部整合。 |

### 功能整合與交付

| Skill | 適用工作 |
| --- | --- |
| [`configure-website-entry`](configure-website-entry/SKILL.md) | 管理選單分類、頁面入口、前端路由與 Gateway 驗證設定。 |
| [`configure-language-settings`](configure-language-settings/SKILL.md) | 設定語系、預設語言與 Plugin Language Pack。 |
| [`manage-plugin-settings`](manage-plugin-settings/SKILL.md) | 管理 Plugin 自訂角色與加密 App Env；不包含使用者角色指派。 |
| [`manage-plugin-schedulers`](manage-plugin-schedulers/SKILL.md) | 管理 cron / interval / date / startup 排程及啟停狀態。 |
| [`develop-lafenice-pwa`](develop-lafenice-pwa/SKILL.md) | 處理明確的 PWA 安裝、manifest、service worker 與離線需求。 |
| [`use-lafenice-rtsp`](use-lafenice-rtsp/SKILL.md) | 透過 Media Core API / Browser SDK 整合攝影機、即時監看與錄影回放。 |
| [`transfer-lafenice-plugin`](transfer-lafenice-plugin/SKILL.md) | 預覽、匯出、檢查、匯入 Plugin 封裝與跨環境驗證。 |

### 架構與部署

| Skill | 適用工作 |
| --- | --- |
| [`explain-lafenice-architecture`](explain-lafenice-architecture/SKILL.md) | 架構導覽、元件責任、資料流與 Core / Plugin 邊界說明。 |
| [`deploy-lafenice-instances`](deploy-lafenice-instances/SKILL.md) | 安裝、配置、備份、還原與升級同一 Docker host 上的 full-export 實例。 |

## Skills 如何分工？

Agent 應依目前任務選擇相關 skill，再按需讀取 reference。**安裝整組 skills，不代表每次都要閱讀整組內容。**

一般開發由生命週期或相應專用 skill 進入；`explain-lafenice-architecture` 僅用於架構說明，不是所有 LaFenice 任務的前置閱讀。PWA skill 也不應只因為需求包含手機版畫面就啟用。

典型的完整建置會經過「需求與設計 → 權限確認 → MDC 與生成基線 → 自訂程式與整合 → 驗收 → 匯出」。既有 Plugin 的局部修正可從受影響階段接續；只要求 PRD 時則停在 PRD，不會自動推進到部署。

## 交付與驗證

完整 API 建置流程的兩個主要交付物為：

```text
<plugin>-<version>/
├── <plugin>-<version>.tar.gz
└── <plugin>-<version>-requirements.md
```

封裝應來自 LaFenice 的 Plugin Export，需求文件記錄資源、驗收證據、匯出結果與限制。純規劃、局部修正或部署維護任務，則依該任務範圍交付。

儲存成功或 code validation 通過不等於功能驗收完成。開發流程還需檢查實際 Gateway 路由、權限、資料邊界與使用者流程；缺少角色測試帳號或瀏覽器時，應如實記錄未驗證項目。重新 Generate Code 可能取代客製版本，修改時需保留並核對自訂差異。

Plugin 封裝保存設定與程式，不是業務資料備份。App Env 匯出預設遮蔽值，實際部署能力與 API 相容性仍需由目標環境確認。

## 目錄結構與參考資源

每個 skill 使用獨立資料夾；以下子目錄依需要提供：

```text
<skill-name>/
├── SKILL.md          適用情境與工作指引
├── agents/           顯示資訊與調用設定
├── references/       API、runtime 契約與詳細說明
├── assets/           文件範本與範例
└── scripts/          操作或驗證工具
```

可直接查閱的資源：

- [Plugin 開發契約](build-lafenice-plugin/references/plugin-contract.md)
- [Python Runtime 契約](develop-plugin-code/references/python-runtime-contract.md)
- [需求文件範本](build-lafenice-plugin/assets/plugin-requirements-template.md)
- [Plugin 生命週期文件範本](orchestrate-lafenice-plugin-lifecycle/assets/)
- [完整 Plugin 範例與說明](build-lafenice-plugin/assets/lafenice-status-example-1.0.0/README.md)
- [系統架構摘要](explain-lafenice-architecture/references/system-architecture.md)

## 問題回報與貢獻

歡迎透過 [Issues](https://github.com/Alexandro-0/Lafenice-Skills/issues) 回報契約差異、範例問題或使用情境，也可以提交 Pull Request。

回報時請附上相關 skill、LaFenice 版本、預期與實際行為，以及已移除敏感內容的重現步驟。修改 skill 時請維持清楚的觸發範圍、有效的相對連結，並同步更新受影響的 references、範例與本頁索引。
