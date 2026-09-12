---
name: explain-lafenice-architecture
description: Explain LaFenice core system architecture, component responsibilities, request/data flows, persistence, and the boundary between Core and business Plugins. Use for architecture explanations, onboarding overviews, or architecture documentation. Do not load merely because a task mentions LaFenice. For Plugin implementation, debugging, testing, feature design, or packaging, select the relevant plugin development skills instead; this skill is not a development prerequisite.
---

# LaFenice 系統架構說明

用於回答「LaFenice 如何組成、元件如何合作、資料存在哪裡、Core 與 Plugin 如何分工」，以及撰寫或更新這些架構說明。

## 選擇時機

- 使用者要求整體架構導覽、元件責任或跨元件資料流說明時，讀取 [references/system-architecture.md](references/system-architecture.md) 的相關章節。
- 不要因為工作目錄是 LaFenice、需要背景知識，或準備開發 Plugin，就預先讀取本 skill 或其 reference。
- 開發任務直接依下表選擇相關 skill；不要先讀架構 reference，也不要一次載入所有開發 skills。
- 同時要求架構說明與實作時，本 skill 只支援架構說明部分；實作仍採用相應開發 skill 的契約。

| 工作內容 | 應讀取的開發 skill |
| --- | --- |
| Plugin 需求、可行性、設計、生命週期或既有功能修正 | [orchestrate-lafenice-plugin-lifecycle](../orchestrate-lafenice-plugin-lifecycle/SKILL.md) |
| 在已部署系統透過 API 完整建置 Plugin | [build-lafenice-plugin](../build-lafenice-plugin/SKILL.md) |
| 自訂 Python / HTML、Gateway Handler 或動態頁面 | [develop-plugin-code](../develop-plugin-code/SKILL.md) |
| MDC 欄位、關聯、權限與 Generate Code | [manage-metadata-driven-collection](../manage-metadata-driven-collection/SKILL.md) |
| 外部 Schema 轉成 MDC | [convert-external-schema-to-mdc](../convert-external-schema-to-mdc/SKILL.md) |
| API 登入與編輯權限 | [get-plugin-edit-access](../get-plugin-edit-access/SKILL.md) |
| 選單與網站入口、語系、排程、環境設定 | 分別使用 [configure-website-entry](../configure-website-entry/SKILL.md)、[configure-language-settings](../configure-language-settings/SKILL.md)、[manage-plugin-schedulers](../manage-plugin-schedulers/SKILL.md)、[manage-plugin-settings](../manage-plugin-settings/SKILL.md) |
| Plugin 匯入、匯出與封裝檢查 | [transfer-lafenice-plugin](../transfer-lafenice-plugin/SKILL.md) |
| Plugin PWA 或 RTSP 整合 | 分別使用 [develop-lafenice-pwa](../develop-lafenice-pwa/SKILL.md)、[use-lafenice-rtsp](../use-lafenice-rtsp/SKILL.md) |
| 多執行個體部署 | [deploy-lafenice-instances](../deploy-lafenice-instances/SKILL.md) |

修改 Core 原始碼時，依專案指示與相關程式處理；不要把 API 管理型 Plugin 的開發流程套用到所有 Core 修改，也不要把本 skill 當成固定前置步驟。

## 說明方法與資料來源

1. 依問題選取 reference 中的元件、流程或邊界，先回答元件的責任，再解釋它與其他元件的連接方式。只有跨元件關係需要時才畫圖。
2. Reference 是可隨 skill bundle 攜帶的架構摘要，不要求使用者另外提供原始碼或部署帳密。純說明工作不需要登入遠端系統。
3. 有專案原始碼且需要確認細節時，依 reference 末尾的來源索引只查相關檔案。文件與實作不一致時，以目前實作為準，指出差異；未驗證的部署行為應標為待確認。
4. 區分平台能力、選用基礎設施與額外安裝的業務 Plugin。不要把參考拓樸當成每個環境都已啟用的服務。
5. 回答架構問題不代表獲得部署、修改設定、Generate Code 或遠端寫入的授權。若使用者也要求實作，依該任務範圍切換相關開發 skill。
