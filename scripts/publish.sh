#!/usr/bin/env bash
# 把当前 index.html / issues 提交并推送到 GitHub Pages
# 用法: bash scripts/publish.sh "2026-06-18"
set -euo pipefail
cd "$(dirname "$0")/.."
DATE="${1:-$(date +%F)}"
git add -A
if git diff --cached --quiet; then
  echo "无变更，跳过推送"; exit 0
fi
git -c user.name="ai-daily-bot" -c user.email="bot@ai-daily.local" \
    commit -q -m "日报 ${DATE}"
git push -q origin main
echo "✓ 已推送，链接 https://imhw.github.io/ai-daily/  （约 1 分钟后生效）"
