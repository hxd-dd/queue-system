#!/bin/bash

cd /Users/huangxiaodan11/cursor小白/my-first-app

echo "正在初始化 Git 仓库..."

# 如果 .git 存在但损坏，先删除
if [ -d .git ]; then
    rm -rf .git
fi

# 重新初始化
git init

# 配置 Git
git config user.name "hxd-dd"
git config user.email "hxd-dd@users.noreply.github.com"

# 添加所有文件
echo "正在添加文件..."
git add .

# 提交
echo "正在提交..."
git commit -m "feat: 办事排号系统完整版"

# 设置主分支
git branch -M main

# 添加远程仓库
git remote remove origin 2>/dev/null
git remote add origin https://github.com/hxd-dd/queue-system.git

# 推送
echo ""
echo "准备推送到 GitHub..."
echo "如果需要输入用户名，请输入: hxd-dd"
echo "如果需要输入密码，请输入你的 Personal Access Token（不是 GitHub 密码）"
echo ""
git push -u origin main

echo ""
echo "完成！如果推送成功，请刷新 GitHub 页面查看代码。"
