# 使用者分配系統設定指南

## 📋 系統架構

本系統實現了自動使用者分配功能，將訪問者自動分配到兩個不同的實驗版本：

- **Case A**: `case-a.html` - 實驗版本 A
- **Case B**: `case-b.html` - 實驗版本 B

## 🚀 工作流程

### 1. 統一入口
- 所有使用者首先訪問 `index.html`（主頁）
- 頁面會自動啟動分配流程

### 2. 後端分配邏輯
- Worker 的 `/assign` 端點處理分配請求
- 使用基於時間戳和客戶端資訊的雜湊演算法
- 確保相對均勻的分配比例

### 3. 自動跳轉
- 分配完成後自動跳轉到對應的實驗頁面
- Case A: `https://jasonliu0101.github.io/ms-thesis-llm-kit/case-a.html`
- Case B: `https://jasonliu0101.github.io/ms-thesis-llm-kit/case-b.html`

## ⚙️ 技術實現

### 前端 (index.html)
- 使用 fetch API 調用後端分配服務
- 包含本地備用分配邏輯（網路問題時使用）
- 優雅的載入動畫和錯誤處理

### 後端 (worker.js)
```javascript
// 新增的路由處理
if (path === '/assign' && request.method === 'POST') {
  return handleUserAssignment(request, env);
}
```

### 分配演算法
```javascript
// 基於客戶端資訊創建雜湊值
const hashInput = `${timestamp}-${userAgent}-${referrer}`;
let hash = 0;
for (let i = 0; i < hashInput.length; i++) {
  const char = hashInput.charCodeAt(i);
  hash = ((hash << 5) - hash) + char;
  hash = hash & hash;
}

// 偶數分配到 Case A，奇數分配到 Case B
const shouldUseCaseA = Math.abs(hash) % 2 === 0;
```

## 📊 日誌與分析

### 分配日誌
每次分配都會記錄以下資訊：
- 時間戳
- 分配結果 (Case A/B)
- 客戶端資訊 (User Agent, Referrer)
- 雜湊值
- 跳轉 URL

### 查看日誌
在 Cloudflare Dashboard 中的 Worker 即時日誌可以看到：
```
📊 分配日誌: {
  "timestamp": "2024-XX-XX...",
  "assignedCase": "Case A",
  "clientInfo": {...},
  "hash": 12345,
  "redirectUrl": "https://..."
}
```

## 🔧 配置選項

### 更新 Worker URL
在 `index.html` 中修改：
```javascript
const workerUrl = 'https://ai-qa-backend.jasonliu01010.workers.dev';
```

### 更新跳轉 URL
在 `worker.js` 的 `handleUserAssignment` 函數中修改：
```javascript
const redirectUrl = shouldUseCaseA 
  ? 'https://your-domain.github.io/repo-name/case-a.html'
  : 'https://your-domain.github.io/repo-name/case-b.html';
```

## 🌐 部署步驟

### 1. 部署 Worker 更新
```bash
wrangler deploy --keep-vars
```

### 2. 確認 GitHub Pages 設定
- 確保 `index.html` 是倉庫根目錄的主頁
- 確認 `case-a.html` 和 `case-b.html` 都可正常訪問

### 3. 測試分配功能
1. 訪問主頁：`https://jasonliu0101.github.io/ms-thesis-llm-kit/`
2. 觀察是否正確跳轉到 case-a 或 case-b
3. 檢查 Worker 日誌確認分配記錄

## 🛠️ 故障排除

### 常見問題

#### 1. 分配服務無回應
- 檢查 Worker URL 是否正確
- 確認 Worker 已正確部署
- 查看 Worker 即時日誌中的錯誤

#### 2. 跳轉失敗
- 確認 case-a.html 和 case-b.html 檔案存在
- 檢查 GitHub Pages 是否正常運作
- 驗證跳轉 URL 是否正確

#### 3. 本地備用方案啟用
- 這是正常行為，在網路問題時會自動啟用
- 本地方案也會進行隨機分配

### 除錯方法
1. 開啟瀏覽器開發者工具查看 Console 日誌
2. 檢查 Network 選項卡中的 API 請求
3. 在 Cloudflare Dashboard 查看 Worker 即時日誌

## 📈 效果驗證

### 分配比例檢查
定期檢查 Worker 日誌以確認：
- Case A 和 Case B 的分配比例大致相等
- 沒有明顯的分配偏差

### 使用者體驗
- 分配流程應該在 1-2 秒內完成
- 載入動畫應該提供良好的視覺回饋
- 錯誤情況下應該有適當的提示

---

**注意事項**：
- 分配是基於雜湊演算法，不是完全隨機
- 相同的客戶端在短時間內可能會被分配到相同的版本
- 如需完全隨機分配，可以考慮使用 Cloudflare KV 或 Durable Objects 來實現持久計數器
