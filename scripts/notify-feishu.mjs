#!/usr/bin/env node
// ============================================================================
// notify-feishu.mjs — 把今日日报链接通过飞书自定义群机器人 webhook 推送
// 读取 content.json 取日期与主标题，发一张可点击卡片。
//
// 环境变量：
//   FEISHU_WEBHOOK   飞书自定义机器人 webhook 完整 URL        （必填）
//   FEISHU_SECRET    若机器人开启了「签名校验」则填，否则留空   （可选）
//   PAGES_URL        日报线上地址（默认 imHw 的 Pages）
//
// 用法：
//   node scripts/notify-feishu.mjs            # 发送
//   node scripts/notify-feishu.mjs --print     # 只打印 payload，不发送
// ============================================================================
import { readFileSync } from 'fs';
import crypto from 'crypto';

const PRINT_ONLY = process.argv.includes('--print');
const PAGES_URL = process.env.PAGES_URL || 'https://imhw.github.io/ai-daily/';

let date = '', lead = 'AI 日报';
try {
  const c = JSON.parse(readFileSync('content.json', 'utf8'));
  date = `${c.issue?.date || ''} ${c.issue?.weekday || ''}`.trim();
  lead = c.lead?.title || lead;
} catch { /* content.json 不存在时用默认 */ }

const card = {
  config: { wide_screen_mode: true },
  header: { template: 'red', title: { tag: 'plain_text', content: '📰 今日 AI 日报' } },
  elements: [
    { tag: 'div', text: { tag: 'lark_md', content: `**${date}**\n${lead}` } },
    { tag: 'hr' },
    { tag: 'action', actions: [
      { tag: 'button', text: { tag: 'plain_text', content: '阅读今日刊 →' }, url: PAGES_URL, type: 'primary' },
    ] },
  ],
};

const body = { msg_type: 'interactive', card };

// 飞书签名校验（仅当机器人开启了「签名校验」时需要）
const SECRET = process.env.FEISHU_SECRET;
if (SECRET) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = crypto.createHmac('sha256', `${ts}\n${SECRET}`).update('').digest('base64');
  body.timestamp = String(ts);
  body.sign = sign;
}

if (PRINT_ONLY) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }

const url = process.env.FEISHU_WEBHOOK;
if (!url) { console.error('缺少 FEISHU_WEBHOOK'); process.exit(1); }

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const out = await res.json().catch(() => ({}));
if (out.code && out.code !== 0) { console.error('飞书返回错误：', JSON.stringify(out)); process.exit(1); }
console.log('✓ 飞书推送成功：', PAGES_URL);
