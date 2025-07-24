#!/bin/bash

# 快速切換部署模式腳本

echo "🔄 AI 問答系統 - 模式切換工具"
echo ""

if [ "$1" = "standalone" ]; then
    echo "📱 切換到純前端模式..."
    mv index.html index_worker.html 2>/dev/null
    mv index_standalone.html index.html 2>/dev/null
    echo "✅ 已切換到純前端模式"
    echo "   使用 index.html + script.js"
    echo "   執行: npm start 或 python3 -m http.server 8000"
    
elif [ "$1" = "worker" ]; then
    echo "🚀 切換到前後端分離模式..."
    mv index.html index_standalone.html 2>/dev/null
    mv index_worker.html index.html 2>/dev/null
    echo "✅ 已切換到前後端分離模式"
    echo "   使用 index.html + script_worker.js"
    echo "   記得先部署 Cloudflare Worker!"
    
else
    echo "📖 使用方法:"
    echo "   ./switch-mode.sh standalone  # 切換到純前端模式"
    echo "   ./switch-mode.sh worker      # 切換到前後端分離模式"
    echo ""
    
    # 檢查當前模式
    if [ -f "index_standalone.html" ]; then
        echo "📊 當前模式: 前後端分離模式"
    else
        echo "📊 當前模式: 純前端模式"
    fi
fi
