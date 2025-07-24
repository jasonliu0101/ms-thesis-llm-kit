#!/bin/bash

# GitHub Pages + Cloudflare Workers 快速部署腳本

echo "🚀 開始部署 AI 問答系統..."

# 檢查是否已安裝 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安裝，請先執行："
    echo "   npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI 已安裝"

# 檢查是否已登入 Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "🔑 請先登入 Cloudflare："
    wrangler login
fi

echo "✅ Cloudflare 登入狀態正常"

# 部署 Worker
echo "📦 部署 Cloudflare Worker..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo "✅ Cloudflare Worker 部署成功！"
    
    # 獲取 Worker URL
    echo ""
    echo "📋 重要信息："
    echo "1. 請記錄您的 Worker URL（格式類似：https://ai-qa-backend.your-subdomain.workers.dev）"
    echo "2. 前往 Cloudflare Dashboard 設定環境變數："
    echo "   - 變數名：GEMINI_API_KEY"
    echo "   - 變數值：您的 Google Gemini API Key"
    echo "3. 編輯 script_worker.js，更新第 4 行的 workerUrl"
    echo "4. 將 index_worker.html 重命名為 index.html"
    echo "5. 推送到 GitHub 並啟用 GitHub Pages"
    echo ""
    echo "🎉 部署完成！詳細說明請參考 README_DEPLOYMENT.md"
else
    echo "❌ Worker 部署失敗，請檢查錯誤信息"
    exit 1
fi
