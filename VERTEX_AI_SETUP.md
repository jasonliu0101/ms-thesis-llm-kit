# Vertex AI 遷移設置指南

## 概述
已將現有的 Google AI API 調用遷移至 Vertex AI 端點。本文檔說明如何設置必要的認證和配置。

## 變更內容

### API 端點變更
- **之前**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- **現在**: `https://europe-west1-aiplatform.googleapis.com/v1beta1/projects/gen-lang-client-0481163611/locations/europe-west1/publishers/google/models/gemini-2.5-flash:generateContent`

### 認證方式變更
- **之前**: API Key (`?key=YOUR_API_KEY`)
- **現在**: Bearer Token (`Authorization: Bearer YOUR_TOKEN`)

### 項目配置
- **Project ID**: `gen-lang-client-0481163611`
- **Location**: `europe-west1`
- **Model**: `gemini-2.5-flash`

## 設置步驟

### 1. Google Cloud 認證設置

#### 選項 A: Service Account Key (推薦)
1. 在 Google Cloud Console 中創建或獲取 Service Account
2. 下載 Service Account JSON 密鑰文件
3. 使用 Google Cloud SDK 生成 access token:
```bash
# 使用 Service Account 密鑰文件
gcloud auth activate-service-account --key-file=path/to/service-account-key.json

# 生成 access token
gcloud auth print-access-token
```

#### 選項 B: Application Default Credentials
1. 設置 Application Default Credentials:
```bash
gcloud auth application-default login
gcloud auth print-access-token
```

### 2. Cloudflare Worker 環境變數設置

將生成的 access token 設置為環境變數：

```bash
# 在 Cloudflare Dashboard 或使用 wrangler CLI
wrangler secret put GEMINI_API_KEY
# 輸入您的 Google Cloud access token
```

**重要**: Access tokens 通常有 1 小時的有效期限，需要定期更新。

### 3. 自動化 Token 更新 (可選)

對於生產環境，建議實現自動 token 更新機制：

```javascript
// 示例：在 Worker 中實現 token 更新邏輯
async function getValidToken(env) {
  // 檢查 token 是否即將過期
  // 如果需要，請求新的 token
  // 這可能需要額外的設置和實現
}
```

## 權限要求

確保您的 Service Account 或用戶帳戶具有以下權限：
- `aiplatform.endpoints.predict`
- `aiplatform.models.predict`

可以通過以下角色獲得這些權限：
- `roles/aiplatform.user`
- `roles/ml.developer`

## 測試驗證

部署後，可以通過以下方式驗證 Vertex AI 集成：

1. 檢查 Cloudflare Worker 日誌
2. 測試 API 調用是否成功
3. 確認回應格式正確

## 故障排除

### 常見錯誤

1. **401 Unauthorized**
   - 檢查 access token 是否有效
   - 確認 token 未過期
   - 驗證權限設置

2. **403 Forbidden**
   - 檢查項目權限
   - 確認 Service Account 角色
   - 驗證 API 是否已啟用

3. **404 Not Found**
   - 檢查項目 ID 是否正確
   - 確認區域設置
   - 驗證模型名稱

### 日誌檢查
查看 Cloudflare Worker 日誌中的以下訊息：
- `=== 開始 Vertex AI API 調用`
- `🌐 Vertex AI 請求 URL`
- API 回應狀態碼

## 效能優化

1. **Token 緩存**: 實現 token 緩存機制以減少認證請求
2. **區域選擇**: 選擇距離用戶最近的 Vertex AI 區域
3. **請求重試**: 實現智能重試邏輯處理臨時錯誤

## 成本考量

- Vertex AI 計費方式可能與 Google AI API 不同
- 監控 API 使用量和成本
- 考慮實現用量限制和監控
