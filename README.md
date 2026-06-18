# AI 日报 · Builders Digest

每天自动生成的 AI 中文日报，极简杂志风，托管于 GitHub Pages。

- **内容来源**：[follow-builders](https://github.com/zarazhangrui/follow-builders) 中央 feed（顶级 AI builder 的 X 帖子 / 播客 / 官方博客）
- **生成**：`node scripts/build.js` 读取 `content.json` → 渲染 `index.html`，并归档到 `issues/<date>.html`
- **线上地址**：https://imhw.github.io/ai-daily/

## 自动化链路（GitHub Actions，零服务器）

```
每天 02:00 UTC = 北京 10:00（.github/workflows/daily.yml）
  → 抓取 follow-builders 中央 feed
  → scripts/remix.mjs 调中转站(Anthropic 原生 /v1/messages)remix 成中文日报 content.json
  → scripts/build.js 生成杂志风 index.html
  → 提交回 main（GitHub Pages 自动更新链接）
  → scripts/notify-feishu.mjs 把链接推给飞书自定义群机器人
```

### 需要配置的 GitHub Secrets
仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 说明 | 示例 |
|--------|------|------|
| `LLM_BASE_URL` | 中转站基址（Anthropic 原生，自动补 `/v1/messages`） | `https://ai.ssgoo.net` |
| `LLM_API_KEY` | 中转站 key（作为 `x-api-key`） | `sk-...` |
| `LLM_MODEL` | Anthropic 模型名 | `claude-3-7-sonnet-20250219` |
| `FEISHU_WEBHOOK` | 飞书自定义群机器人 webhook URL | `https://open.feishu.cn/open-apis/bot/v2/hook/xxx` |
| `FEISHU_SECRET` | 仅当机器人开启「签名校验」时填，否则不建此项 | — |

飞书 webhook 获取：飞书群 → 设置 → 群机器人 → 添加「自定义机器人」→ 复制 webhook。
安全设置选「自定义关键词」并填 `日报`（推送内容含此词），或开签名校验后把密钥填到 `FEISHU_SECRET`。

配好后到 Actions 页面手动点 **Run workflow** 即可测试整条链路。

## 本地手动生成

```bash
node scripts/build.js          # 用当前 content.json 生成
node scripts/build.js path.json # 指定内容文件
```
