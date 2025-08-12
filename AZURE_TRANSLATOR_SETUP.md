# Azure Translator 設置指南

本指南將幫助您設置 Azure Translator 服務，讓 case-a 版本能夠將 AI 思考流程從英文翻譯成繁體中文。

## 📋 前置需求

1. Azure 帳戶
2. 已部署的 Cloudflare Workers
3. 對 Cloudflare Dashboard 的存取權限

## 🔧 Azure Translator 服務設置

### 步驟 1：創建 Azure Translator 資源

1. 登入 [Azure Portal](https://portal.azure.com)
2. 點擊「創建資源」
3. 搜尋「Translator」
4. 選擇「Translator」服務
5. 填寫以下資訊：
   - **訂閱**：選擇您的 Azure 訂閱
   - **資源群組**：創建新的或選擇現有的
   - **區域**：選擇 `East Asia`（建議，對應 eastasia）
   - **名稱**：輸入資源名稱（例如：`ms-thesis-translator`）
   - **定價層**：選擇適合的方案（F0 免費層或 S1 標準層）

6. 點擊「檢閱 + 創建」
7. 點擊「創建」

### 步驟 2：取得 API 金鑰和區域

1. 資源創建完成後，前往該資源
2. 在左側選單中點擊「金鑰和端點」
3. 複製以下資訊：
   - **金鑰 1** 或 **金鑰 2**（選擇其中一個）
   - **區域**（例如：eastasia）

## ⚙️ Cloudflare Workers 環境變數設置

### 步驟 1：進入 Cloudflare Dashboard

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 進入 Workers & Pages
3. 找到您的 `ai-qa-backend` worker
4. 點擊進入該 worker

### 步驟 2：設置環境變數

1. 點擊「設定」（Settings）標籤
2. 點擊「變數」（Variables）
3. 在「環境變數」區段中新增以下變數：

#### Production 環境變數：
```
變數名稱: AZURE_TRANSLATOR_KEY
值: [您從 Azure 複製的 API 金鑰]
類型: Text
```

```
變數名稱: AZURE_TRANSLATOR_REGION
值: eastasia
類型: Text
```

4. 點擊「儲存並部署」

## 🚀 部署更新的 Worker

在本地專案目錄中執行：

```bash
# 部署更新的 worker 程式碼
npx wrangler deploy

# 確認部署成功
npx wrangler tail
```

## 🧪 測試翻譯功能

### 方法 1：直接測試翻譯端點

```bash
curl -X POST https://your-worker-url.workers.dev/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I am thinking about the legal implications of this case.",
    "from": "en",
    "to": "zh-Hant"
  }'
```

預期回應：
```json
{
  "translatedText": "我正在思考這個案例的法律影響。",
  "originalText": "I am thinking about the legal implications of this case."
}
```

### 方法 2：測試 case-a 完整功能

1. 開啟 `case-a.html`
2. 點擊右上角設定按鈕
3. 確保「思考流程」選項已勾選
4. 提出任何法律問題
5. 觀察思考流程區塊是否顯示繁體中文內容

## 🔍 故障排除

### 問題：翻譯功能不工作

**檢查步驟：**

1. **確認環境變數設置**：
   ```bash
   # 檢查 worker 環境變數
   npx wrangler secret list
   ```

2. **檢查 Worker 日誌**：
   ```bash
   npx wrangler tail
   ```

3. **確認 Azure 資源狀態**：
   - 登入 Azure Portal
   - 檢查 Translator 資源是否正常運行
   - 確認 API 金鑰是否有效

### 問題：翻譯品質不佳

**解決方案：**
- Azure Translator 對技術和法律術語的翻譯可能不夠精確
- 可以考慮在前端加入自定義詞彙替換邏輯
- 或者使用更專業的法律翻譯 API

### 問題：翻譯速度太慢

**優化建議：**
- 確保 Azure Translator 資源與 Cloudflare Workers 在相同或鄰近地理區域
- 考慮實施翻譯結果快取機制
- 對長文本進行分段翻譯

## 💰 費用估算

### Azure Translator 定價（參考）：
- **免費層 (F0)**：每月 2M 字元免費
- **標準層 (S1)**：每 1M 字元 $10 USD

### 預估使用量：
- 每次思考流程平均 500-1000 字元
- 每日測試 10-20 次
- 月使用量約 15,000-60,000 字元

**建議**：對於研究用途，免費層通常已足夠。

## 📚 相關文檔

- [Azure Translator 官方文檔](https://docs.microsoft.com/azure/cognitive-services/translator/)
- [Cloudflare Workers 環境變數](https://developers.cloudflare.com/workers/platform/environment-variables/)
- [Cloudflare Workers 部署指南](https://developers.cloudflare.com/workers/get-started/guide/)

## ✅ 完成確認

翻譯功能正確設置後，您應該能看到：

1. ✅ case-a 的思考流程顯示繁體中文內容
2. ✅ case-b 的行為保持不變（不顯示思考流程）
3. ✅ 翻譯品質合理，能夠理解基本含義
4. ✅ 系統回應時間在可接受範圍內

設置完成後，您的研究系統就能夠為參與者提供更好的中文體驗！
