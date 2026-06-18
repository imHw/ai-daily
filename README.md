# AI 日报 · Builders Digest

每天自动生成的 AI 中文日报，极简杂志风，托管于 GitHub Pages。

- **内容来源**：[follow-builders](https://github.com/zarazhangrui/follow-builders) 中央 feed（顶级 AI builder 的 X 帖子 / 播客 / 官方博客）
- **生成**：`node scripts/build.js` 读取 `content.json` → 渲染 `index.html`，并归档到 `issues/<date>.html`
- **线上地址**：https://imhw.github.io/ai-daily/

## 自动化链路

```
每天 10:00（OpenClaw on 飞书妙搭）
  → follow-builders 拉取中央 feed，remix 成中文日报
  → 写入 content.json
  → node scripts/build.js 生成杂志风 index.html
  → git push（GitHub Pages 更新链接）
  → 飞书 bot 把链接发给我
```

## 本地手动生成

```bash
node scripts/build.js          # 用当前 content.json 生成
node scripts/build.js path.json # 指定内容文件
```
