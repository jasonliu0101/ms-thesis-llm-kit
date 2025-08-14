#!/bin/bash

# 翻譯備援系統部署腳本

echo "🚀 開始部署翻譯備援系統..."

# 檢查是否在正確的目錄
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 錯誤: 找不到 wrangler.toml 文件"
    echo "請確認您在項目根目錄中運行此腳本"
    exit 1
fi

# 部署 Worker
echo "� 部署更新的 Worker..."
wrangler deploy --keep-vars

if [ $? -eq 0 ]; then
    echo "✅ Worker 部署成功!"
    echo ""
    echo "📋 下一步設定："
    echo "1. 登入 Cloudflare Dashboard: https://dash.cloudflare.com/"
    echo "2. 前往 Workers & Pages > ai-qa-backend > Settings > Variables"
    echo "3. 添加以下環境變數："
    echo "   - GEMINI_API_KEY: [您的 Google Gemini API Key]"
    echo "   - GOOGLE_CLOUD_API_KEY: [您的 Google Cloud Translation API Key]"
    echo "   - AZURE_TRANSLATOR_KEY: [您的 Azure Translator API Key]"
    echo "   - AZURE_TRANSLATOR_REGION: [Azure 區域，例如: eastasia]"
    echo ""
    echo "🌐 Worker URL: https://ai-qa-backend.jasonliu1563.workers.dev"
    echo ""
    echo "🧪 測試建議："
    echo "1. 開啟 translate_test.html 進行翻譯功能測試"
    echo "2. 檢查 Cloudflare Dashboard 中的即時日誌"
    echo "3. 測試主要和備用翻譯服務"
else
    echo "❌ Worker 部署失敗"
    echo "請檢查錯誤信息並修正後重試"
    exit 1
fi

echo ""
echo "📚 相關文檔："
echo "- 翻譯備援機制: TRANSLATION_FALLBACK_SYSTEM.md"
echo "- 故障排除指南: TRANSLATION_TROUBLESHOOTING.md"
echo "- 部署指南: README_DEPLOYMENT.md"
echo ""
echo "🎉 部署腳本執行完成!"
