# 翻譯服務備援機制說明

## 🔄 備援架構

系統現在實現了雙重翻譯服務備援機制：

1. **主要服務**: Google Cloud Translation API
2. **備用服務**: Azure Translator API

## 🚀 工作流程

### 1. 翻譯請求處理流程

```
用戶請求翻譯
    ↓
嘗試 Google Cloud Translation API
    ↓
成功? ────→ 返回翻譯結果
    ↓ (失敗)
切換到 Azure Translator API
    ↓
成功? ────→ 返回翻譯結果
    ↓ (失敗)
返回錯誤信息 (兩個服務都不可用)
```

### 2. 自動容錯切換

- **無縫切換**: 前端不需要知道使用了哪個翻譯服務
- **錯誤處理**: 詳細記錄每個服務的失敗原因
- **一致格式**: 兩個服務的回應都統一為 Google Cloud 格式

## ⚙️ 配置要求

### 必要環境變數

| 變數名稱 | 服務 | 必要性 | 說明 |
|----------|------|--------|------|
| `GOOGLE_CLOUD_API_KEY` | Google Cloud Translation | 必要 | 主要翻譯服務 |
| `AZURE_TRANSLATOR_KEY` | Azure Translator | 必要 | 備用翻譯服務 |
| `AZURE_TRANSLATOR_REGION` | Azure Translator | 建議 | Azure 服務區域 (預設: eastasia) |

### 語言代碼對應

| 語言 | Google Cloud | Azure Translator |
|------|--------------|------------------|
| 繁體中文 | `zh-TW` | `zh-Hant` |
| 簡體中文 | `zh-CN` | `zh-Hans` |
| 英文 | `en` | `en` |
| 日文 | `ja` | `ja` |

## 📊 監控與日誌

### 成功情況
```
🌏 嘗試 Google Cloud Translation API...
✅ Google Cloud Translation 成功
```

### 備援切換情況
```
🌏 嘗試 Google Cloud Translation API...
⚠️ Google Cloud Translation 失敗: API key invalid
🔄 切換到 Azure Translator 備用方案...
✅ Azure Translator 備用方案成功
```

### 完全失敗情況
```
🌏 嘗試 Google Cloud Translation API...
⚠️ Google Cloud Translation 失敗: API key invalid
🔄 切換到 Azure Translator 備用方案...
❌ Azure Translator 備用方案也失敗: Service unavailable
翻譯服務不可用 - Google: API key invalid, Azure: Service unavailable
```

## 🔧 故障排除

### 常見故障情況

#### 1. Google Cloud API 問題
- **API 金鑰無效**: 檢查 `GOOGLE_CLOUD_API_KEY` 設定
- **配額用盡**: 檢查 Google Cloud Console 中的使用量
- **服務未啟用**: 確認 Cloud Translation API 已啟用

#### 2. Azure Translator 問題
- **訂閱金鑰無效**: 檢查 `AZURE_TRANSLATOR_KEY` 設定
- **區域設定錯誤**: 確認 `AZURE_TRANSLATOR_REGION` 正確
- **資源不存在**: 確認 Azure 資源仍然有效

#### 3. 兩個服務都失敗
- **網路問題**: 檢查 Cloudflare Workers 的網路連接
- **環境變數**: 確認所有必要的 API 金鑰都已設定
- **API 限制**: 檢查是否達到速率限制

## 💡 最佳實踐

### 1. 監控建議
- 定期檢查 Cloudflare Workers 日誌
- 監控兩個翻譯服務的使用量
- 設定告警以便及時發現問題

### 2. 成本優化
- Google Cloud 提供每月 500,000 字元免費
- Azure Translator 提供每月 2,000,000 字元免費
- 主要使用 Google Cloud 可以更好地控制成本

### 3. 效能考量
- Google Cloud Translation 通常延遲較低
- Azure Translator 在某些語言對上可能更準確
- 備援機制會增加一些延遲，但提高了可靠性

## 🔄 升級與維護

### 定期檢查項目
1. **API 金鑰有效性**: 確保金鑰沒有過期
2. **服務可用性**: 測試兩個翻譯服務是否正常
3. **配額使用**: 監控使用量避免超限
4. **錯誤率**: 檢查備援切換的頻率

### 測試方法
使用提供的 `translate_test.html` 工具：
1. 測試正常翻譯功能
2. 模擬 Google Cloud API 失敗（移除金鑰）
3. 確認自動切換到 Azure Translator
4. 檢查錯誤處理和日誌記錄

---

**重要提醒**: 確保同時設定 Google Cloud 和 Azure 的 API 金鑰，以獲得最佳的服務可靠性。
