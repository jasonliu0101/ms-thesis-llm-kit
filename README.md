# 🤖 AI 智能問答系統

> 基於 Google Gemini 2.5 Flash 的現代化 AI 問答平台，提供智能搜索、思考流程可視化與引用追溯功能

![AI 問答系統](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blue) ![版本](https://img.shields.io/badge/版本-v2.0-green) ![授權](https://img.shields.io/badge/授權-MIT-yellow)

## 🌟 產品特色

### 💡 核心優勢
- **🧠 先進 AI 引擎**: 採用 Google 最新 Gemini 2.5 Flash 模型，提供快速且準確的回答
- **� 智能網頁搜索**: 自動搜索相關網頁資源，確保回答內容的時效性與準確性
- **� 引用追溯系統**: 每個回答都附帶完整的資料來源，支持點擊跳轉查看原文
- **🧠 思考流程透明**: 可視化 AI 的推理過程，讓您了解答案的產生邏輯
- **📱 跨設備適配**: 完美支持桌面、平板與手機，隨時隨地獲得智能協助

### 🎯 適用場景
- **學術研究**: 快速獲取學術資料與相關文獻
- **工作諮詢**: 解決工作中的專業問題
- **生活助手**: 日常生活中的各種疑問
- **學習輔導**: 教育學習的智能陪伴

## � 立即體驗

### 方式一：在線使用（推薦）
直接訪問我們的在線版本：
- **主版本**: [AI 問答系統 - 完整版](https://jasonliu0101.github.io/ms-thesis-llm-kit/)
- **輕量版**: [AI 問答系統 - 精簡版](https://jasonliu0101.github.io/ms-thesis-llm-kit/index_standalone.html)

### 方式二：本地部署
```bash
# 1. 下載專案
git clone https://github.com/jasonliu0101/ms-thesis-llm-kit.git
cd ms-thesis-llm-kit

# 2. 啟動本地服務
python3 -m http.server 8080
# 或使用 Node.js
npx serve .

# 3. 打開瀏覽器訪問
open http://localhost:8080
```

## � 使用指南

### 🔑 API Key 設置
1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 獲取免費的 Gemini API Key
2. 點擊系統右上角的 ⚙️ 設置按鈕
3. 輸入您的 API Key 並儲存

> **安全提示**: 您的 API Key 僅儲存在本地瀏覽器中，我們不會收集或儲存任何個人資訊

### 💬 開始提問
1. **直接輸入**: 在底部輸入框中輸入您的問題
2. **快速開始**: 點擊預設的問題按鈕快速體驗
3. **個性化設置**: 根據需要開啟/關閉思考流程、引用來源等功能

### 🎛️ 功能設置
- **🧠 思考流程**: 顯示 AI 的推理過程
- **🔗 引用來源**: 顯示參考資料來源
- **🌐 網路搜尋**: 啟用實時網頁搜索

## 🏗️ 技術架構

### 前端技術棧
- **HTML5 + CSS3**: 現代化響應式設計
- **Vanilla JavaScript**: 無依賴的純 JavaScript 實現
- **Progressive Web App**: 支持離線使用與安裝

### 後端服務
- **Google Gemini API**: 核心 AI 能力
- **Cloudflare Workers**: 可選的 API 代理服務
- **GitHub Pages**: 靜態網站託管

### 安全特性
- **本地存儲**: API Key 僅存儲在用戶本地
- **HTTPS 加密**: 全站 HTTPS 保護
- **無追蹤設計**: 不收集用戶數據

## 🎨 界面預覽

### 桌面版界面
- 現代化的漸層背景設計
- 浮動式輸入框，支持自動擴展
- 清晰的對話氣泡區分用戶與 AI 回答
- 右上角便捷設置面板

### 移動端適配
- 響應式佈局自動適配屏幕尺寸
- 觸屏友好的交互設計
- 優化的字體大小與間距

## � 版本特色

### v2.0 更新內容
- ✨ **全新 UI 設計**: 更加現代化的用戶界面
- 🔧 **設置面板優化**: 移至右上角，操作更便捷
- 📏 **輸入框改進**: 單行起始，自動擴展至合適高度
- 📱 **響應式增強**: 更好的移動端體驗
- 🎯 **引用系統優化**: 更緊湊的引用來源顯示
- 🚀 **性能提升**: 更快的載入速度與響應時間

## 🆚 產品對比

| 特性 | 本系統 | ChatGPT Web | Gemini Web |
|------|--------|-------------|------------|
| 免費使用 | ✅ | ❌ (有限制) | ✅ |
| 自定義部署 | ✅ | ❌ | ❌ |
| 引用追溯 | ✅ | 部分支持 | 部分支持 |
| 思考流程 | ✅ | ❌ | 部分支持 |
| 無註冊使用 | ✅ | ❌ | ❌ |
| 開源透明 | ✅ | ❌ | ❌ |

## 💼 商業應用

### 教育機構
- 智能答疑系統
- 學習輔導工具
- 研究資料助手

### 企業應用
- 內部知識庫查詢
- 客服智能化
- 員工培訓助手

### 個人用戶
- 學習伴侶
- 工作助手
- 生活顧問

## 🛠️ 開發者資源

### 快速部署
```bash
# 使用我們的一鍵部署腳本
chmod +x deploy.sh
./deploy.sh
```

### 自定義配置
- 修改 `styles.css` 自定義界面風格
- 編輯 `script_worker.js` 調整功能邏輯
- 配置 `wrangler.toml` 設置 Worker 部署

### API 集成
```javascript
// 基本使用示例
const response = await callGeminiAPI(question, {
    includeSearch: true,
    showThinking: true,
    temperature: 0.7
});
```

## 📋 系統需求

### 瀏覽器支持
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- 移動端瀏覽器全面支持

### API 需求
- Google Gemini API Key（免費額度充足）
- 穩定的網路連接

## 🤝 社群與支持

### 獲得幫助
- 📖 查看 [詳細文檔](README_DEPLOYMENT.md)
- 🐛 [回報問題](https://github.com/jasonliu0101/ms-thesis-llm-kit/issues)
- 💡 [功能建議](https://github.com/jasonliu0101/ms-thesis-llm-kit/discussions)

### 貢獻指南
我們歡迎各種形式的貢獻：
- 🔧 代碼貢獻
- 📝 文檔改進
- 🐛 Bug 回報
- 💡 新功能建議

## 📄 開源協議

本專案採用 [MIT License](LICENSE) 開源協議，您可以自由使用、修改和分發。

## 🌟 致謝

- Google Gemini Team - 提供強大的 AI 能力
- Cloudflare - 提供優秀的 Workers 平台
- GitHub - 提供代碼託管與 Pages 服務
- 開源社群 - 持續的支持與貢獻

---

<div align="center">

**🚀 [立即體驗 AI 問答系統](https://jasonliu0101.github.io/ms-thesis-llm-kit/) • [查看源碼](https://github.com/jasonliu0101/ms-thesis-llm-kit) • [加入討論](https://github.com/jasonliu0101/ms-thesis-llm-kit/discussions)**

*讓 AI 成為您最得力的智能助手*

</div>
