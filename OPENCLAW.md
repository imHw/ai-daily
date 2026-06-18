# 云端自动化部署手册（OpenClaw on 飞书妙搭）

目标：每天 10:00（Asia/Shanghai）自动生成中文 AI 日报 → 更新 GitHub Pages → 飞书发链接给你。

OpenClaw 是常驻云端的 AI agent，飞书妙搭可一键部署它。下面分两段：**A 一次性部署** / **B 每日定时任务**。

---

## A. 一次性部署（约 15 分钟，需你在妙搭操作一次）

### A1. 在飞书妙搭部署 OpenClaw
1. 打开飞书妙搭，搜索/选择「OpenClaw」一键部署模板，按引导完成部署（免费）。
2. 部署后 OpenClaw 会以一个**飞书机器人**的身份和你私聊——这就是后面发日报链接的通道，无需再单独配 lark-cli。

### A2. 让 OpenClaw 能跑我们的生成器
在 OpenClaw 的会话里依次让它执行（它有终端能力）：
```bash
# 1) 装 follow-builders skill（中文日报内容来源）
git clone https://github.com/zarazhangrui/follow-builders.git ~/.claude/skills/follow-builders

# 2) 拉取本仓库（杂志风生成器 + 发布脚本）
git clone https://github.com/imHw/ai-daily.git ~/ai-daily

# 3) 写入 follow-builders 配置（中文 / 每日 / 10:00）
mkdir -p ~/.follow-builders && cat > ~/.follow-builders/config.json <<'EOF'
{ "platform":"openclaw","language":"zh","timezone":"Asia/Shanghai",
  "frequency":"daily","deliveryTime":"10:00","delivery":{"method":"stdout"},
  "onboardingComplete":true }
EOF
```

### A3. 给 OpenClaw 配 GitHub 推送权限
GitHub Pages 更新需要 push 权限。在 OpenClaw 环境里设置一个有 `repo` 权限的 GitHub Token：
```bash
git -C ~/ai-daily remote set-url origin https://<GITHUB_TOKEN>@github.com/imHw/ai-daily.git
```
（Token 在 GitHub → Settings → Developer settings → Personal access tokens 生成）

---

## B. 每日定时任务

让 OpenClaw 添加一条 cron（每天 10:00），运行下面这段**日报流水线 Prompt**：

> **每日 AI 日报任务**：
> 1. 运行 `node ~/.claude/skills/follow-builders/scripts/prepare-digest.js`，拿到当天 feed JSON。
> 2. 把其中的播客、X 帖子、博客 remix 成一份**中文日报**，按 `~/ai-daily/content.json` 的结构（issue / lead / podcast / voices / blog / colophon）填好，写回 `~/ai-daily/content.json`。日期用今天。
> 3. 运行 `node ~/ai-daily/scripts/build.js` 生成 `index.html`。
> 4. 运行 `bash ~/ai-daily/scripts/publish.sh "$(date +%F)"` 推送到 GitHub Pages。
> 5. 在飞书给我发一条消息：「📰 今天的 AI 日报来啦：https://imhw.github.io/ai-daily/ 」。

对应 OpenClaw 命令（示意，按实际 CLI 调整）：
```bash
openclaw cron add --schedule "0 10 * * *" --tz "Asia/Shanghai" \
  --channel feishu --target <你的飞书 user_id> \
  --prompt-file ~/ai-daily/scripts/daily-prompt.txt
```
> ⚠️ 按 follow-builders 文档提示：**不要用 `--channel last`**，要显式指定 `feishu` 通道和目标 ID，否则隔离的 cron 会话里没有 "last" 上下文会失败。

---

## 验证
部署完成后，让 OpenClaw **立即手动跑一次** B 里的流水线，确认：
- GitHub Pages 链接内容更新为当天日期；
- 飞书收到带链接的消息。
两者都 OK，定时任务即闭环。
