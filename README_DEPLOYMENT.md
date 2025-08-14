# GitHub Pages + Cloudflare Workers 部署指南

## 📋 快速導航

- [使用者分配系統](#使用者分配系統) (新功能)
- [前後端分離模式部署](#前後端分離模式部署) (推薦)
- [純前端模式部署](#純前端模式部署) (簡單)
- [模式切換](#模式切換)

## 🎯 使用者分配系統

### 系統說明

現在系統具有自動使用者分配功能：
- **統一入口**: 所有使用者訪問主頁 `index.html`
- **自動分配**: 後端自動將使用者分配到 Case A 或 Case B
- **自動跳轉**: 分配完成後自動跳轉到對應的實驗頁面

### 分配邏輯
- 使用基於時間戳和客戶端資訊的雜湊演算法
- 確保 Case A 和 Case B 大致均勻分配
- 偶數雜湊值 → Case A，奇數雜湊值 → Case B

### 網址結構
- **主入口**: `https://jasonliu0101.github.io/ms-thesis-llm-kit/`
- **Case A**: `https://jasonliu0101.github.io/ms-thesis-llm-kit/case-a.html`
- **Case B**: `https://jasonliu0101.github.io/ms-thesis-llm-kit/case-b.html`

詳細設定請參考：[使用者分配系統設定指南](./USER_ASSIGNMENT_SYSTEM.md)

## 🚀 前後端分離模式部署

### 架構概述

- **前端**: GitHub Pages (靜態網站託管)
- **後端**: Cloudflare Workers (API 代理服務)  
- **API**: Google Gemini API (透過 Worker 調用)

### 部署步驟

### 第一步：部署 Cloudflare Worker

1. **安裝 Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **登入 Cloudflare**
   ```bash
   wrangler login
   ```

3. **部署 Worker**
   ```bash
   wrangler deploy --keep-vars
   ```

4. **設定環境變數**
   在 Cloudflare Dashboard 中設定：
   - 前往 Workers & Pages > 您的 Worker > Settings > Variables
   - 添加環境變數：
     - `GEMINI_API_KEY`: 您的 Google Gemini API Key
     - `GOOGLE_CLOUD_API_KEY`: 您的 Google Cloud Translation API Key (主要)
     - `AZURE_TRANSLATOR_KEY`: 您的 Azure Translator API Key (備用)
     - `AZURE_TRANSLATOR_REGION`: Azure 服務區域 (例如: eastasia)

5. **記錄 Worker URL**
   部署成功後，記住您的 Worker URL，格式通常為：
   `https://ai-qa-backend.your-subdomain.workers.dev`

### 第二步：設定 GitHub Pages

1. **推送代碼到 GitHub**
   ```bash
   git add .
   git commit -m "Add Cloudflare Workers integration"
   git push origin main
   ```

2. **啟用 GitHub Pages**
   - 前往 GitHub 倉庫 > Settings > Pages
   - 選擇 Source: Deploy from a branch
   - 選擇 Branch: main / (root)
   - 點擊 Save

3. **更新 Worker URL**
   - 編輯 `script_worker.js` 文件
   - 將第 4 行的 `this.workerUrl` 更新為您的實際 Worker URL：
   ```javascript
   this.workerUrl = 'https://ai-qa-backend.your-subdomain.workers.dev';
   ```

4. **使用正確的 HTML 文件**
   - 確認當前使用的是 `index.html` (前後端分離模式)
   - 如果需要切換模式，請使用: `./switch-mode.sh worker`

## 📱 純前端模式部署

### 快速開始 (5 分鐘)

1. **切換到純前端模式**
   ```bash
   ./switch-mode.sh standalone
   ```

2. **獲取 API Key**
   - 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)
   - 申請並複製您的 Gemini API Key

3. **本地運行**
   ```bash
   npm start
   # 或
   python3 -m http.server 8000
   ```

4. **配置設定**
   - 開啟 http://localhost:8000
   - 在設定面板輸入 API Key
   - 開始使用！

## 🔄 模式切換

您可以隨時在兩種模式間切換：

```bash
# 切換到純前端模式
./switch-mode.sh standalone

# 切換到前後端分離模式  
./switch-mode.sh worker

# 查看當前模式
./switch-mode.sh
```

### 第三步：設定 CORS（安全加固）

為了提高安全性，建議將 Worker 的 CORS 設定限制為只允許您的 GitHub Pages 域名：

1. **編輯 `worker.js`**
   將第 103 行的：
   ```javascript
   'Access-Control-Allow-Origin': '*',
   ```
   
   改為：
   ```javascript
   'Access-Control-Allow-Origin': 'https://your-username.github.io',
   ```

2. **重新部署 Worker**
   ```bash
   wrangler deploy --keep-vars
   ```

## 📂 檔案結構

```
├── index.html              # 主頁面 (預設: 前後端分離模式)
├── index_standalone.html   # 純前端模式頁面
├── script.js               # 純前端模式 JavaScript  
├── script_worker.js        # 前後端分離模式 JavaScript
├── styles.css              # 樣式表
├── worker.js               # Cloudflare Worker 後端代碼
├── wrangler.toml           # Worker 配置文件
├── package.json            # 專案配置
├── deploy.sh               # 快速部署腳本
├── switch-mode.sh          # 模式切換腳本
├── README.md               # 主要說明文件
├── README_DEPLOYMENT.md    # 詳細部署指南
└── backup/                 # 備份文件夾
```

## 優勢

### 安全性
- ✅ API 密鑰安全存儲在 Cloudflare Workers 中
- ✅ 前端代碼中不包含敏感信息
- ✅ 可以設定 CORS 限制訪問來源

### 性能
- ✅ Cloudflare 的全球 CDN 網路
- ✅ 邊緣計算降低延遲
- ✅ 自動緩存和優化

### 成本
- ✅ GitHub Pages 完全免費
- ✅ Cloudflare Workers 有慷慨的免費額度（每天 100,000 次請求）
- ✅ 只有超出免費額度才需要付費

### 可擴展性
- ✅ 可以輕鬆添加新功能到 Worker
- ✅ 支援多個前端應用使用同一個 Worker
- ✅ 可以添加緩存、日誌、監控等功能

## 疑難排解

### 常見問題

1. **Worker URL 連接失敗**
   - 檢查 `script_worker.js` 中的 `workerUrl` 是否正確
   - 確認 Worker 已成功部署

2. **API 調用失敗**
   - 檢查 Cloudflare Dashboard 中的環境變數設定
   - 確認 `GEMINI_API_KEY` 已正確設定

3. **CORS 錯誤**
   - 檢查 Worker 中的 CORS 設定
   - 確認允許的來源域名正確

### 調試

啟用前端的「調試模式」選項來查看詳細的 API 調用信息：
- 打開設定面板
- 勾選「調試模式」
- 查看瀏覽器開發者工具的 Console

## 後續優化建議

1. **添加緩存**：在 Worker 中實現回應緩存以減少 API 調用
2. **添加日誌**：記錄使用統計和錯誤信息
3. **添加監控**：設定 Cloudflare Analytics 和告警
4. **自定義域名**：使用自己的域名而不是 workers.dev 子域名
5. **API 限流**：實現用戶請求限制以防止濫用

## 費用估算

假設每天有 1000 次對話，每次對話平均 2 次 API 調用：

- **GitHub Pages**: 免費
- **Cloudflare Workers**: 
  - 免費額度：每天 100,000 次請求
  - 實際使用：2,000 次請求/天（遠低於免費額度）
  - **成本：$0/月**

只有在使用量大幅增長後才需要考慮付費計劃。
