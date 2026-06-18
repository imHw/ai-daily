# 自托管自动化部署手册（Hermes Agent）

目标：每天 10:00（Asia/Shanghai）自动生成中文 AI 日报 → 更新 GitHub Pages → 飞书发链接给你。

Hermes Agent 是 Nous Research 开源的常驻式自学习 AI agent，自带 Gateway，原生支持飞书等 20+ 平台，并内置 cron 调度（gateway 守护进程每 60 秒检查一次到期任务，在隔离会话里执行）。下面分两段：**A 一次性部署** / **B 每日定时任务**。

> 与 OpenClaw 版（见 `OPENCLAW.md`）结构一一对应，差别只在运行载体与命令；内容生成/发布脚本完全复用本仓库。

---

## A. 一次性部署（约 15 分钟，需在你的服务器/机器上操作一次）

### A1. 安装 Hermes 并接入飞书
```bash
# 1) 安装 Hermes（命令行版）
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# 2) 安装并启动 Gateway（投递与 cron 都由它驱动）
hermes gateway install            # 用户级服务
# 服务器常驻可用：sudo hermes gateway install --system

# 3) 在 Gateway 里连接「飞书」通道（按交互引导填飞书自建应用凭证）
#    连好后，cron 的 --deliver feishu 就会把结果发到飞书。
```
> 飞书通道是 Gateway 支持的 20+ 平台之一。这一步配好后，**无需再单独配 lark-cli**，投递直接走 Hermes 的飞书通道。

### A2. 让 Hermes 能跑我们的生成器
Hermes 有终端能力，在其会话里或服务器上执行：
```bash
# 1) 内容源脚本（follow-builders，纯 node 脚本）
git clone https://github.com/zarazhangrui/follow-builders.git ~/follow-builders

# 2) 拉取本仓库（杂志风生成器 + 发布脚本）
git clone https://github.com/imHw/ai-daily.git ~/ai-daily

# 3) 写入 follow-builders 配置（中文 / 每日 / 10:00）
mkdir -p ~/.follow-builders && cat > ~/.follow-builders/config.json <<'EOF'
{ "platform":"other","language":"zh","timezone":"Asia/Shanghai",
  "frequency":"daily","deliveryTime":"10:00","delivery":{"method":"stdout"},
  "onboardingComplete":true }
EOF
```

### A3. 给 Hermes 配 GitHub 推送权限
GitHub Pages 更新需要 push 权限。设置一个有 `repo` 权限的 GitHub Token：
```bash
git -C ~/ai-daily remote set-url origin https://<GITHUB_TOKEN>@github.com/imHw/ai-daily.git
```
（Token 在 GitHub → Settings → Developer settings → Personal access tokens 生成）

---

## B. 每日定时任务

用 Hermes 内置 cron 添加一条每天 10:00 的任务，投递到飞书：

```bash
hermes cron create "0 10 * * *" \
  "每日 AI 日报任务（提示自包含，勿依赖对话历史）：
   1. 运行 node ~/follow-builders/scripts/prepare-digest.js 拿到当天 feed JSON。
   2. 把播客/X帖子/博客 remix 成中文日报，按 ~/ai-daily/content.json 的结构
      (issue/lead/podcast/voices/blog/colophon) 填好并写回，日期用今天。
   3. 运行 node ~/ai-daily/scripts/build.js 生成 index.html。
   4. 运行 bash ~/ai-daily/scripts/publish.sh \"\$(date +%F)\" 推送 GitHub Pages。
   5. 最后输出一条消息：📰 今天的 AI 日报来啦：https://imhw.github.io/ai-daily/" \
  --deliver feishu \
  --name "daily-ai-digest"
```

也可以在聊天里用斜杠命令：
```text
/cron add "every 1d at 10:00" "<同上 prompt>" --deliver feishu
```

> ⚠️ **时区**：Hermes 的 cron 表达式按运行机器的本地时区解释，且无独立 `--tz` 参数。
> - 若服务器时区已是 Asia/Shanghai：用 `"0 10 * * *"`。
> - 若服务器是 UTC：改用 `"0 2 * * *"`（= 北京 10:00），或先把系统时区设为 Asia/Shanghai。

常用管理命令：
```bash
hermes cron list             # 查看所有任务
hermes cron status           # 调度器状态
hermes cron run daily-ai-digest    # 立即手动跑一次（测试用）
hermes cron pause/resume daily-ai-digest
hermes cron remove daily-ai-digest
```

---

## 验证
部署完成后，执行 `hermes cron run daily-ai-digest` **立即手动跑一次**，确认：
- GitHub Pages 链接内容更新为当天日期；
- 飞书收到带链接的消息。
两者都 OK，定时任务即闭环。

---

## 三种自动化方案怎么选

| 方案 | 文档 | 适合 |
|------|------|------|
| **GitHub Actions** | `README.md` | 零服务器、免维护，**推荐**。只是 remix 需调中转站 key |
| **Hermes Agent** | 本文件 | 已有/想要一台常驻自托管 agent，且希望它跨平台、能自学习沉淀 skill |
| **OpenClaw on 妙搭** | `OPENCLAW.md` | 想用飞书妙搭一键部署、深度绑定飞书生态 |

三者内容生成与发布脚本完全复用，可并存、可随时切换。
