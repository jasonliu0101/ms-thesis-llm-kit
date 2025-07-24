# AI 問答系統 - Gemini 驅動

一個現代化的 AI 問答系統，支援兩種部署模式：傳統的純前端模式和安全的前後端分離模式。

## 🚀 部署模式

### 模式一：純前端模式（簡單部署）
- 直接在瀏覽器中運行
- API Key 存儲在本地瀏覽器
- 適合個人使用和快速測試

### 模式二：前後端分離模式（推薦）
- **前端**: GitHub Pages (靜態網站託管)
- **後端**: Cloudflare Workers (API 代理服務)
- **優勢**: 更安全、可擴展、免費額度充足

## ✨ 功能特色

- 🤖 **Gemini 2.5 Flash AI**: 使用 Google 最新的 Gemini 2.5 Flash 模型
- 🧠 **雙重 API 架構**: 同時獲取搜尋結果和推理流程
- 🔗 **智能引用**: 自動搜尋並顯示相關網頁資源
- 🔍 **思考流程**: 可視化 AI 的推理過程
- 📱 **響應式設計**: 完美支援桌面和行動裝置
- 💾 **設定記憶**: 自動儲存使用者偏好
- 🔒 **安全保護**: 支援 API Key 安全存儲

## 📂 檔案結構

```
├── index.html              # 純前端模式主頁面
├── index_worker.html       # 前後端分離模式主頁面
├── script.js               # 純前端模式 JavaScript
├── script_worker.js        # 前後端分離模式 JavaScript
├── styles.css              # 樣式表
├── worker.js               # Cloudflare Worker 後端代碼
├── wrangler.toml           # Worker 配置文件
├── package.json            # 專案配置
├── deploy.sh               # 快速部署腳本
├── README.md               # 主要說明文件
├── README_DEPLOYMENT.md    # 詳細部署指南
└── backup/                 # 備份文件夾
```

## 🚀 快速開始

### 選項 A：純前端模式（5 分鐘設置）

1. **獲取 API Key**
   - 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)
   - 申請並複製您的 Gemini API Key

2. **運行應用**
   ```bash
   # 使用 Python 簡易伺服器
   python3 -m http.server 8000
   # 或使用 Node.js
   npx serve .
   ```

3. **配置設定**
   - 開啟 http://localhost:8000
   - 在設定面板中輸入 API Key
   - 開始使用！

### 選項 B：前後端分離模式（推薦）

詳細步驟請參考 [部署指南](README_DEPLOYMENT.md)

```bash
# 快速部署
./deploy.sh
```

## 🎯 使用方法

1. **提問**: 在輸入框中輸入您的問題
2. **快速問題**: 點擊預設的問題按鈕快速開始
3. **查看回答**: AI 會提供詳細回答，包含：
   - 主要回答內容
   - 思考流程（可選）
   - 引用來源（可選）
4. **調整設定**: 點擊設定按鈕自訂顯示選項

## 🔧 技術架構

### 核心技術
- **前端**: HTML5, CSS3, Vanilla JavaScript
- **AI 模型**: Google Gemini 2.5 Flash
- **後端** (可選): Cloudflare Workers
- **部署**: GitHub Pages + Cloudflare Workers

### 特色功能
- **雙重 API 調用**: 同時獲取搜尋結果和推理過程
- **智能引用處理**: 自動提取和格式化網頁引用
- **響應式設計**: 適配各種設備尺寸
- **本地存儲**: 安全保存用戶設定

## 💡 開發說明

### 本地開發
```bash
# 克隆專案
git clone <repository-url>
cd ms_thesis_llm_kit

# 安裝依賴（可選，用於 Worker 開發）
npm install

# 啟動本地伺服器
python3 -m http.server 8000
```

### Worker 開發
```bash
# 本地測試 Worker
npx wrangler dev

# 部署到 Cloudflare
npx wrangler deploy
```

## 📄 授權

此專案採用 MIT 授權條款。

### 前端技術
- **HTML5**: 語義化結構
- **CSS3**: 現代化視覺設計，包含漸層背景和動畫效果
- **原生 JavaScript**: 無依賴的純 JavaScript 實作
- **響應式設計**: 使用 CSS Grid 和 Flexbox

### 功能實作
- **API 整合**: 直接與 Google Gemini API 通訊
- **註腳系統**: 自動為引用資料加入註腳標記
- **本地儲存**: 使用 localStorage 儲存設定
- **錯誤處理**: 完整的錯誤提示和處理機制
- **載入狀態**: 優雅的載入動畫

## 常見問題

### Q: 如何獲得 Google Gemini API Key？
A: 請前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 註冊帳號並申請 Gemini API Key。

### Q: API Key 安全嗎？
A: 您的 API Key 僅儲存在本地瀏覽器中，不會被傳送到其他地方。

### Q: 為什麼看不到思考流程？
A: 思考流程功能取決於使用的模型版本。目前使用 Gemini 2.5 Flash，主要專注於快速回應和網頁搜尋功能。

### Q: 網頁搜尋何時會觸發？
A: 當您啟用「顯示參照網頁」選項時，AI 會在需要最新資訊或外部資源時自動進行網頁搜尋。

### Q: 註腳是如何運作的？
A: 當啟用「顯示參照網頁」時，系統會自動在回答中加入註腳標記，並在底部顯示完整的參考資料。

### Q: Gemini 2.5 Flash 與其他版本有什麼不同？
A: Gemini 2.5 Flash 針對速度進行優化，提供更快的回應時間，適合需要快速互動的應用場景。

### Q: 如何清除儲存的設定？
A: 您可以清除瀏覽器的本地儲存，或在開發者工具中刪除相關的 localStorage 項目。

## API 使用說明

本應用程式使用以下 Gemini API 功能：

1. **基本對話**：
   ```javascript
   {
       contents: [{ parts: [{ text: question }] }],
       generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
   }
   ```

2. **網頁搜尋（可選）**：
   ```javascript
   tools: [{ googleSearch: {} }]
   ```

**注意事項**：
- 網頁搜尋功能需要額外的 API 配額
- Gemini 2.5 Flash 針對速度優化，適合快速互動
- 建議先測試基本功能，再啟用進階選項

## 效能特點

### Gemini 2.5 Flash 優勢
- ⚡ **超快回應**: 針對速度優化的模型
- 🎯 **高效率**: 更低的延遲和更快的處理速度
- 💰 **成本效益**: 通常具有更優惠的 API 定價
- 🔄 **即時互動**: 適合需要快速回應的對話場景

## 授權

本專案採用 MIT 授權條款。

## 聯絡方式

如有問題或建議，歡迎提出 Issue 或聯絡開發者。
