#!/bin/bash

echo "🧹 開始清理專案..."

# 刪除已棄用的檔案
echo "🗑️ 刪除已棄用的檔案..."
rm -f AZURE_TRANSLATOR_SETUP_DEPRECATED.md
rm -f index_standalone_backup.html
rm -f script_simple.js
rm -f clear_session.js
rm -f switch-mode.sh

# 刪除備份資料夾
echo "🗑️ 刪除備份資料夾..."
rm -rf backup/

# 刪除 Wrangler 快取
echo "🗑️ 清理 Wrangler 快取..."
rm -rf .wrangler/

# 刪除 node_modules (稍後重新安裝)
echo "🗑️ 清理 node_modules..."
rm -rf node_modules/

# 重新安裝依賴
echo "📦 重新安裝依賴..."
npm install

echo "✅ 專案清理完成！"
echo ""
echo "📋 剩餘檔案："
ls -la
