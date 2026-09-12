# Agent prompt examples

Use these examples as starting points for invoking `$orchestrate-lafenice-plugin-lifecycle`. Replace placeholders and remove instructions that do not apply.

## Contents

1. Prompt structure
2. PRD only
3. Feasibility only
4. Design from accepted requirements
5. Backend development only
6. Targeted bug fix
7. Midstream feature addition
8. Resume previous work
9. End-to-end work with review checkpoints
10. Packaging and deployment testing
11. Compact reusable template

## Prompt structure

State these items whenever possible:

- skill name;
- current state and authoritative artifacts;
- requested result;
- entry phase;
- stopping checkpoint;
- whether optional phases or formal reports are selected;
- document synchronization expectations.

## PRD only

```text
使用 $orchestrate-lafenice-plugin-lifecycle，為「客戶意見回饋」Plugin 撰寫 PRD。

Plugin 需要讓一般使用者提交意見，客服人員回覆與分類，管理者維護分類資料及查看處理狀態。

這次只完成 PRD，不要進行可開發性評估、設計或程式開發。完成後將狀態標記為 ready-for-review，列出需要我確認的決策。
```

## Feasibility only

```text
使用 $orchestrate-lafenice-plugin-lifecycle，讀取現有的 Plugin PRD，進行可開發性評估。

請逐項評估每個 requirement，標示為 feasible、conditional、infeasible 或 unresolved，並提供判斷依據及替代方案。

這次不要產出設計文件。若有任何必要需求尚未確認可開發，請停在 feasibility 階段。
```

## Design from accepted requirements

```text
使用 $orchestrate-lafenice-plugin-lifecycle，從現有 PRD 繼續這個 Plugin 的設計工作。

先確認 PRD 與可開發性評估是否已通過，再產出：

- 使用者 role 與權限矩陣
- MDC 資料結構
- API 契約
- 排程或其他 backend 支援
- Menu Category、route 與網頁清單
- Theme、語系及 Language Pack 規劃
- 各頁面的功能與狀態

這次只做到設計文件 ready-for-review，不要開始開發。
```

## Backend development only

```text
使用 $orchestrate-lafenice-plugin-lifecycle，根據現有 PRD 與設計文件開發 Plugin Backend。

本次範圍只有：

- 權限設定
- MDC 資料結構
- API
- 排程功能
- Backend 測試

不要修改 Frontend。若實作需求與 PRD 或設計牴觸，先判斷是實作 bug 還是產品需求變更；需要調整文件時，請同步更新既有文件並說明原因。
```

## Targeted bug fix

```text
使用 $orchestrate-lafenice-plugin-lifecycle，修正既有 Plugin 的一個 bug：

客服人員目前可以刪除其他客服人員建立的回覆，但正確行為應該是只能編輯自己的回覆，只有管理者可以刪除所有回覆。

請先檢查現有 PRD、權限設計、程式碼與測試：

- 如果程式碼違反既有 PRD，修正程式碼與測試，不要改寫正確的 PRD。
- 如果我描述的新行為改變了既有需求，請同步更新現有 PRD 與設計文件。
- 如果沒有 PRD，不需要為這次 bug fix 補寫完整 PRD。

完成實作與必要的回歸測試後停止，不需要重新封裝 Plugin。
```

## Midstream feature addition

```text
使用 $orchestrate-lafenice-plugin-lifecycle，在目前開發中的 Plugin 增加「每日未處理案件摘要」功能。

需求如下：

- 每天上午 8 點執行
- 統計仍未完成的案件
- 依負責部門產生摘要
- 管理者可以啟用、停用及調整執行時間

請從受影響的最早階段開始，不要重做整份 PRD。更新既有 PRD 中相關 requirement，重新評估新增功能的可開發性，再同步更新排程、權限、設計、程式碼與測試。
```

## Resume previous work

```text
使用 $orchestrate-lafenice-plugin-lifecycle，繼續開發這個 Plugin。

請先讀取 plugin-lifecycle-state.md，以及其中列出的 PRD、設計文件和測試結果。從記錄的 next permitted action 繼續，不要重新執行已 accepted 的階段。

本次做到 Frontend 開發與相關測試完成為止，不要進行 Plugin 封裝或部署。
```

## End-to-end work with review checkpoints

```text
使用 $orchestrate-lafenice-plugin-lifecycle，協助我完整開發「設備維修管理」Plugin。

預計流程包含：

1. PRD
2. 可開發性評估
3. 設計
4. Backend 與 Frontend 開發
5. 整合測試
6. 產品使用文件

但不要一次執行全部流程。先完成 PRD，將它標記為 ready-for-review，列出需要我確認的事項，然後停止。等我接受 PRD 後才能進入可開發性評估。
```

## Packaging and deployment testing

```text
使用 $orchestrate-lafenice-plugin-lifecycle，從整合階段繼續現有 Plugin。

先確認 PRD、設計、Backend、Frontend 與必要測試的目前狀態，再：

- 封裝 Plugin
- 檢查封裝內容與相依資源
- 進行部署或匯入預覽
- 驗證 API、權限、Menu、語系、排程及主要網頁流程
- 產出整合測試報告

不要重新開發已通過驗證的功能。任何部署覆寫或具有破壞性的操作，都必須先取得我的明確授權。
```

## Compact reusable template

```text
使用 $orchestrate-lafenice-plugin-lifecycle。

Plugin：<名稱與穩定 ID>
目前狀態：<現有 PRD、設計、程式、測試或部署狀態>
本次需求：<要新增、修正或產出的內容>
開始階段：<PRD／feasibility／design／development／integration／documentation>
停止點：<完成哪個交付物後停止>
選用項目：<戰情中心／報表／歷史／正式測試報告／整合測試／產品文件，或不適用>

若產品行為改變，更新既有 PRD 與受影響的下游文件；若只是實作違反既有需求，保留 PRD 並修正實作。完成後請列出異動檔案、驗證證據、未決事項與下一個允許執行的階段。
```
