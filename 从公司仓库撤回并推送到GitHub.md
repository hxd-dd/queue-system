# 误推到公司仓库后的处理步骤

## 一、从公司仓库（JD Coding）撤掉这次提交

在项目目录下执行（会多一个「撤销」的提交，不会改历史）：

```bash
cd /Users/huangxiaodan11/cursor小白/my-first-app

# 撤销最近一次提交（保留本地文件不变）
git revert HEAD --no-edit

# 推回公司仓库，相当于把「这次提交」在公司那边抵消掉
git push origin main
```

如果没有该仓库的写权限，就联系仓库管理员说明误推，请对方帮忙删除或回滚那次提交。

---

## 二、把个人 GitHub 加为远程，以后推 GitHub

1. 在 GitHub 上新建一个空仓库（例如名字叫 `my-first-app`），**不要**勾选初始化 README。

2. 在公司仓库撤掉提交之后，在项目目录执行：

```bash
# 把个人 GitHub 加为远程，名字叫 github（可改成别的）
git remote add github https://github.com/你的用户名/my-first-app.git

# 推送到 GitHub（第一次推送）
git push -u github main
```

3. 以后要推送到 **GitHub** 就用：

```bash
git push github main
```

要推送到 **公司仓库** 就用：

```bash
git push origin main
```

---

## 三、（可选）让默认 push 只到 GitHub

如果希望 `git push` 默认只推 GitHub，可以把 GitHub 设为默认远程：

```bash
# 把 GitHub 远程改名为 origin，公司仓库改名为 jd
git remote rename origin jd
git remote rename github origin

# 之后直接 git push origin main 就是推 GitHub
# 推公司用：git push jd main
```

---

按顺序做完「一」和「二」，就不会再误推到公司，并且可以正常用 GitHub Pages。
