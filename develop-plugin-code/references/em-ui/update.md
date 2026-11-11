# 更新 EM-UI 設計參考

目前收錄 v24，來源為 `em-ui-template-system-v24.zip` 內的 `em-ui-template-system-v24.html`。目前 HTML 的 SHA-256 為 `16894016c85d9db089b6c82cf056e1e2d2f427112503856c688a9cecfc62c1fc`。

1. 在暫存資料夾開啟新版 ZIP，確認根目錄只有一份完整的設計系統 HTML。核對標題版本，並比較新舊版的 Agent Build Contract、元件章節與範例。如果新版需要額外的 CSS、JS 或圖片，先確認新的封裝方式再替換。
2. 將新版 HTML 原樣複製到本文件同目錄，取代 `current.html`。這個固定名稱讓 skill 的連結可以跨版本沿用。分別對解出的 HTML 與取代後的檔案執行 PowerShell 的 `Get-FileHash -Algorithm SHA256 <檔案路徑>`，確認兩者相同。
3. 更新本文件首段的版本、ZIP 名稱、HTML 名稱及雜湊值。從 skill 的「UI 設計參考」連結開啟檔案，核對新版標題及表單、表格範例；若章節更名，同步調整 skill 的搜尋提示。
4. 發佈更新後的 skills，並在使用端依原安裝方式更新整個 `develop-plugin-code` 資料夾，包含 `references/`。用新任務指定「只參考 EM-UI 的表格」即可檢查選用流程。既有頁面只會在後續要求改版時更新。
