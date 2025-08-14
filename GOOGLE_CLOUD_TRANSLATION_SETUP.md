# Google Cloud Translation API 設定指南

本指南將協助您設定 Google Cloud Translation API，以便在系統中使用翻譯功能。

## 步驟 1：Google Cloud Console 設定

### 1.1 建立或選擇專案
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 登入您的 Google 帳戶
3. 建立新專案或選擇現有專案

### 1.2 啟用 Cloud Translation API
1. 在 Google Cloud Console 中，前往 **API 和服務** > **程式庫**
2. 搜尋 "Cloud Translation API"
3. 點擊 **Cloud Translation API**
4. 點擊 **啟用** 按鈕

### 1.3 建立服務帳戶和 API 金鑰
1. 前往 **API 和服務** > **憑證**
2. 點擊 **建立憑證** > **API 金鑰**
3. 複製產生的 API 金鑰並妥善保存
4. （建議）設定 API 金鑰限制：
   - 點擊剛建立的 API 金鑰進行編輯
   - 在 **API 限制** 中選擇 **限制金鑰**
   - 選擇 **Cloud Translation API**
   - 點擊 **儲存**

## 步驟 2：Cloudflare Workers 環境變數設定

### 2.1 登入 Cloudflare Dashboard
1. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 登入您的帳戶

### 2.2 設定 Worker 環境變數
1. 進入 **Workers & Pages**
2. 找到您的 Worker（例如：`ai-qa-backend`）
3. 點擊 Worker 名稱進入詳細頁面
4. 前往 **Settings** 頁籤
5. 向下捲動找到 **Environment Variables** 區塊
6. 點擊 **Add variable** 按鈕

### 2.3 新增必要的環境變數
添加以下環境變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `GOOGLE_CLOUD_API_KEY` | 您的 Google Cloud API 金鑰 | 從步驟 1.3 取得的 API 金鑰 |

**設定步驟：**
1. **Variable name:** `GOOGLE_CLOUD_API_KEY`
2. **Value:** 貼上您的 Google Cloud API 金鑰
3. **Type:** 選擇 **Text**（不要選擇 Secret，除非您需要額外的安全性）
4. 點擊 **Add variable**

### 2.4 部署更新
1. 在添加環境變數後，點擊 **Save and deploy** 按鈕
2. 等待部署完成

## 步驟 3：測試翻譯功能

### 3.1 檢查環境變數
確認環境變數已正確設定：
1. 在 Cloudflare Dashboard 的 Worker 設定頁面
2. 檢查 **Environment Variables** 區塊是否顯示 `GOOGLE_CLOUD_API_KEY`

### 3.2 測試翻譯
1. 開啟您的應用程式
2. 啟用 **顯示思考流程** 選項
3. 提出問題並檢查思考流程是否正確翻譯為繁體中文

## API 使用規格

### 請求格式
```json
{
  "q": "Hello world",
  "target": "zh-TW",
  "source": "en"
}
```

### 回應格式
```json
{
  "data": {
    "translations": [
      {
        "translatedText": "你好世界",
        "detectedSourceLanguage": "en"
      }
    ]
  }
}
```

### 支援的語言代碼
- 英文：`en`
- 繁體中文：`zh-TW` 或 `zh-Hant`
- 簡體中文：`zh-CN` 或 `zh-Hans`
- 日文：`ja`
- 韓文：`ko`

更多語言代碼請參考：[Google Cloud Translation 支援的語言](https://cloud.google.com/translate/docs/languages)

## 計費資訊

Google Cloud Translation API 按字元數計費：
- 前 500,000 字元/月：免費
- 超過部分：每 100 萬字元 $20 USD

詳細計費資訊請參考：[Google Cloud Translation 定價](https://cloud.google.com/translate/pricing)

## 疑難排解

### 常見錯誤

#### 1. "GOOGLE_CLOUD_API_KEY not configured"
**解決方案：**
- 確認已在 Cloudflare Workers 中設定 `GOOGLE_CLOUD_API_KEY` 環境變數
- 檢查環境變數名稱是否正確（區分大小寫）

#### 2. "Google Cloud Translation API error: 403"
**解決方案：**
- 確認 Google Cloud Translation API 已啟用
- 檢查 API 金鑰是否正確
- 確認 API 金鑰權限設定正確

#### 3. "Google Cloud Translation API error: 400"
**解決方案：**
- 檢查請求參數是否正確
- 確認目標語言代碼是否有效

### 除錯方法
1. 檢查 Cloudflare Workers 的即時日誌
2. 確認 Google Cloud Console 中的 API 使用情況
3. 檢查瀏覽器的網路開發者工具

## 安全性建議

1. **API 金鑰限制：** 設定 API 金鑰只能存取 Cloud Translation API
2. **HTTP 限制：** 如果可能，限制 API 金鑰只能從特定來源使用
3. **定期輪換：** 定期更新 API 金鑰
4. **監控使用量：** 定期檢查 API 使用情況以避免異常使用

---

**注意：** 請妥善保管您的 API 金鑰，避免在公開程式碼中暴露。
