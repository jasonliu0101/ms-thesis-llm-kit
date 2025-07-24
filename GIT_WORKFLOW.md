# 🔧 Git 工作流程參考

## 🚀 快速命令

### 基本操作
```bash
# 檢查狀態
git status

# 添加文件
git add .                    # 添加所有變更
git add filename.js          # 添加特定文件

# 提交變更
git commit -m "描述您的變更"

# 查看提交歷史
git log --oneline
```

### 分支操作
```bash
# 創建並切換到新分支
git checkout -b feature/new-feature

# 切換分支
git checkout main
git checkout feature/new-feature

# 合併分支
git checkout main
git merge feature/new-feature

# 刪除分支
git branch -d feature/new-feature
```

### 遠程倉庫
```bash
# 添加遠程倉庫
git remote add origin https://github.com/username/repository.git

# 推送到遠程倉庫
git push -u origin main

# 從遠程倉庫拉取
git pull origin main
```

## 📋 提交訊息規範

使用語義化提交訊息：

- `feat:` 新功能
- `fix:` 修復錯誤
- `docs:` 文檔變更
- `style:` 代碼格式變更
- `refactor:` 重構代碼
- `test:` 測試相關
- `chore:` 其他雜項

### 範例
```bash
git commit -m "feat: add user authentication system"
git commit -m "fix: resolve API connection timeout issue"
git commit -m "docs: update deployment guide"
```

## 🔄 常見工作流程

### 開發新功能
```bash
git checkout -b feature/user-profile
# 進行開發...
git add .
git commit -m "feat: implement user profile page"
git checkout main
git merge feature/user-profile
git branch -d feature/user-profile
```

### 修復錯誤
```bash
git checkout -b hotfix/api-bug
# 修復錯誤...
git add .
git commit -m "fix: resolve API endpoint URL issue"
git checkout main
git merge hotfix/api-bug
git branch -d hotfix/api-bug
```

## 🚨 緊急情況

### 撤銷變更
```bash
# 撤銷工作區變更
git checkout -- filename.js

# 撤銷已暫存的變更
git reset HEAD filename.js

# 撤銷最後一次提交（保留變更）
git reset --soft HEAD~1

# 撤銷最後一次提交（不保留變更）
git reset --hard HEAD~1
```

### 查看差異
```bash
# 查看工作區變更
git diff

# 查看已暫存的變更
git diff --cached

# 查看兩次提交間的差異
git diff HEAD~1 HEAD
```

## 📁 .gitignore 檔案

當前專案已配置忽略：
- `node_modules/` - Node.js 依賴
- `.env*` - 環境變數檔案
- `.wrangler/` - Wrangler 臨時檔案
- `backup/` - 備份檔案
- `.DS_Store` - macOS 系統檔案
