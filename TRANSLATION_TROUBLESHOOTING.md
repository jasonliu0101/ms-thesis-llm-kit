# 翻譯 API 故障排除指南

## 🔍 問題診斷

目前系統已實現翻譯服務備援機制：
- **主要服務**: Google Cloud Translation API
- **備用服務**: Azure Translator API

錯誤：`{"error":"Text (q parameter) is required"}` 表示請求沒有正確到達後端。

## 📋 新的備援架構

系統會自動嘗試：
1. 首先使用 Google Cloud Translation API
2. 如果失敗，自動切換到 Azure Translator API
3. 如果兩個都失敗，返回詳細錯誤信息

Worker URL 已統一為：`https://ai-qa-backend.jasonliu1563.workers.dev`

## 📋 排除步驟

### 1. 檢查 Worker URL 設定

確認以下文件中的 Worker URL 是否一致：

#### `script_worker.js` (第 14 行)
```javascript
this.workerUrl = 'https://ai-qa-backend.jasonliu1563.workers.dev';
```

#### `index.html` (第 162 行)
```javascript
const workerUrl = 'https://ai-qa-backend.jasonliu1563.workers.dev';
```

**✅ 現狀**: Worker URL 已統一更新

### 2. 確認正確的 Worker URL

根據 `wrangler.toml` 的設定：
```toml
name = "ai-qa-backend"
```

正確的 URL 格式應該是：`https://ai-qa-backend.您的子域名.workers.dev`

### 3. 部署並測試

1. **部署更新的 Worker**:
   ```bash
   wrangler deploy --keep-vars
   ```

2. **檢查部署後的 URL**:
   部署完成後，Wrangler 會顯示實際的 Worker URL

3. **更新前端設定**:
   將正確的 URL 更新到：
   - `script_worker.js` 第 14 行
   - `index.html` 第 162 行

### 4. 使用測試工具

我已經創建了 `translate_test.html` 測試工具：

1. 在瀏覽器中開啟 `translate_test.html`
2. 輸入正確的 Worker URL
3. 測試翻譯功能
4. 查看瀏覽器 Console 中的詳細日誌

### 5. 檢查 Cloudflare Workers 日誌

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 前往 **Workers & Pages**
3. 點擊您的 Worker (`ai-qa-backend`)
4. 查看即時日誌中的錯誤信息

## 🔧 已新增的調試功能

### 後端調試 (worker.js)
- 詳細的請求頭部記錄
- 原始請求體內容記錄
- JSON 解析錯誤捕獲
- 參數存在性檢查
- Google Cloud Translation API 詳細日誌

### 前端調試 (translate_test.html)
- 完整的請求/回應日誌
- 錯誤信息詳細顯示
- 回應格式驗證
- 網路錯誤捕獲

## 🎯 常見問題解決

### 問題 1: CORS 錯誤
**症狀**: 瀏覽器 Console 顯示 CORS 錯誤
**解決**: 確認 Worker 正確處理 OPTIONS 預檢請求

### 問題 2: Worker URL 不正確
**症狀**: `fetch` 請求失敗或返回 404
**解決**: 使用 `wrangler deploy --keep-vars` 後顯示的正確 URL

### 問題 3: API Key 未設定
**症狀**: `GOOGLE_CLOUD_API_KEY not configured` 或 `AZURE_TRANSLATOR_KEY not configured`
**解決**: 在 Cloudflare Dashboard 中設定環境變數

### 問題 4: 翻譯服務不可用
**症狀**: `翻譯服務不可用 - Google: ..., Azure: ...`
**解決**: 
- 檢查兩個服務的 API Key 是否正確
- 確認相關 API 已啟用
- 檢查 API Key 權限設定

### 問題 5: 備援切換
**症狀**: 看到 `切換到 Azure Translator 備用方案...`
**解決**: 這是正常行為，表示備援機制正在工作

## 📝 下一步行動

1. **立即執行**:
   ```bash
   cd /Users/jasonliu/Programming/ms_thesis_llm_kit
   wrangler deploy --keep-vars
   ```

2. **記錄正確的 Worker URL** (部署後顯示)

3. **更新前端設定**:
   - 修正 `script_worker.js` 中的 URL
   - 修正 `index.html` 中的 URL

4. **使用測試工具驗證**: 開啟 `translate_test.html` 進行測試

5. **檢查 Cloudflare 日誌**: 確認請求是否到達 Worker

## 💡 預期結果

修正後應該看到：
- 前端發送正確格式的翻譯請求
- 後端成功接收並解析請求
- Google Cloud Translation API 返回翻譯結果
- 前端顯示翻譯後的思考流程

---

**重要提醒**: 請先執行 `wrangler deploy --keep-vars` 並記錄正確的 Worker URL，然後更新前端設定。
