#!/usr/bin/env node
// ============================================================================
// remix.mjs — 把 follow-builders 的原始 feed remix 成中文日报 content.json
// 调用 Anthropic 原生 Messages API（/v1/messages，支持中转站）。无第三方依赖，仅用 Node fetch。
//
// 环境变量：
//   LLM_BASE_URL  中转站基址，如 https://ai.ssgoo.net          （必填，脚本自动补 /v1/messages）
//   LLM_API_KEY   中转站 key（作为 x-api-key 发送）            （必填）
//   LLM_MODEL     Anthropic 模型名，如 claude-3-7-sonnet-...   （必填）
//
// 用法：
//   node scripts/remix.mjs raw.json           # 调模型，写出 content.json
//   node scripts/remix.mjs raw.json --print    # 只打印将要发送的 prompt，不调用
// ============================================================================
import { readFileSync, writeFileSync } from 'fs';

const rawPath = process.argv[2] || 'raw.json';
const PRINT_ONLY = process.argv.includes('--print');
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));

// 北京日期
const now = new Date(Date.now() + 8 * 3600 * 1000);
const dateISO = now.toISOString().slice(0, 10);
const wkmap = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const dateCN = `${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月${now.getUTCDate()}日`;
const weekday = wkmap[now.getUTCDay()];
// 真实生成时间（北京 HH:MM）。now 已偏移到北京时区，故用 UTC 取数即为北京时分。
const timeHM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

// -- 把原始 feed 压缩成可读素材（控制 token）--------------------------------
function condense(d) {
  let s = '';
  const p = (d.podcasts || [])[0];
  if (p) {
    s += `【播客】${p.title}\nURL: ${p.url}\n转录(节选):\n${(p.transcript || '').slice(0, 2400)}\n\n`;
  }
  s += '【X 建造者帖子】\n';
  for (const b of (d.x || [])) {
    const tw = (b.tweets || []).slice().sort((a, c) => (c.likes || 0) - (a.likes || 0)).slice(0, 2);
    if (!tw.length) continue;
    s += `\n${b.name} (@${b.handle})\n`;
    for (const t of tw) s += `- [${t.likes || 0}♥] ${(t.text || '').replace(/https?:\/\/\S+/g, '').trim()}\n`;
  }
  const bl = (d.blogs || [])[0];
  if (bl) s += `\n【官方博客】${bl.title}\nURL: ${bl.url}\n${(bl.description || '') + (bl.content || '').slice(0, 1600)}\n`;
  return s;
}

const SCHEMA = `{
  "issue": { "vol": "Vol.NN", "date": "${dateCN}", "weekday": "${weekday}", "dateISO": "${dateISO}", "tagline": "追随建造者，而非追随影响者" },
  "lead":    { "kicker": "今日主线", "title": "一句话主标题", "paras": ["2~3段正文，每段一个字符串"] },
  "podcast": { "label": "本期播客", "title": "中文标题", "meta": "来源 · 日期", "paras": ["2~3段"], "url": "原链接" },
  "voices":  { "label": "建造者观点", "items": [ { "name": "姓名", "handle": "x账号", "org": "公司(可空)", "quote": "一句话中文转述", "tag": "短标签如 产品事故/资本/格局/工具/金句" } ] },
  "blog":    { "label": "官方博客", "title": "中文标题", "meta": "来源域名", "paras": ["1~2段"], "url": "原链接" },
  "colophon":{ "source": "follow-builders 中央 feed", "coverage": "本期覆盖 X 档播客 · Y 位建造者 · Z 篇博客", "generatedAt": "${dateISO} ${timeHM}" }
}`;

const prompt = `你是一份面向中文读者的「AI 日报」主编。下面是今天从顶级 AI 建造者（X 帖子、播客、官方博客）抓取的英文原始素材。请把它们 remix 成一份**通顺、精炼、有编辑视角的中文日报**，并严格输出为下面结构的 JSON（只输出 JSON，不要任何解释或代码围栏）。

要求：
- lead 选取当天最大的主线话题，2~3 段，有观点不流水账；首段会做首字下沉，开头自然些。
- voices 选 4~6 条最有信息量的观点，quote 用中文转述（不是直译），每条配一个短 tag。
- 所有 url 必须取自素材里给出的真实链接，不要编造。
- coverage 里的数字按素材实际条数填。
- 中文表达地道，避免翻译腔。

JSON 结构：
${SCHEMA}

今日素材：
${condense(raw)}`;

if (PRINT_ONLY) { console.log(prompt); process.exit(0); }

let BASE = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.LLM_API_KEY;
if (!BASE || !KEY) {
  console.error('缺少环境变量 LLM_BASE_URL / LLM_API_KEY');
  process.exit(1);
}
// 候选模型：先用 LLM_MODEL（支持逗号分隔配置多个），再兜底到当前可用的 Anthropic 模型。
// 这样即使配置的模型名过期 / 被中转站下线（典型表现是 400「模型名称有误」），
// 也会自动切到下一个候选，不至于当天整条链路失败、断更。
const FALLBACK_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
const MODELS = [...new Set(
  (process.env.LLM_MODEL || '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .concat(FALLBACK_MODELS)
)];

// Anthropic 原生：endpoint = <base>/v1/messages（base 若已带 /v1 则不重复）
const endpoint = /\/v1$/.test(BASE) ? `${BASE}/messages` : `${BASE}/v1/messages`;
const headers = { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };

// 单个模型调用：5xx 自动重试（应对中转站瞬时不可用）；其它错误直接返回，交给上层换模型
async function callModel(model) {
  const body = JSON.stringify({
    model,
    max_tokens: 4000,
    temperature: 0.6,
    system: '你是严谨的中文科技日报主编，只输出符合要求的 JSON。',
    messages: [{ role: 'user', content: prompt }],
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(endpoint, { method: 'POST', headers, body });
    if (r.ok) return { ok: true, res: r };
    const errText = await r.text();
    if (r.status >= 500 && attempt < 3) {
      console.error(`模型 ${model} 第 ${attempt} 次调用失败 ${r.status}，3 秒后重试…`);
      await new Promise(rs => setTimeout(rs, 3000));
      continue;
    }
    return { ok: false, status: r.status, errText };
  }
}

let res, usedModel = '';
for (const model of MODELS) {
  const r = await callModel(model);
  if (r.ok) { res = r.res; usedModel = model; break; }
  console.error(`模型 ${model} 调用失败 ${r.status}：${(r.errText || '').slice(0, 300)}`);
  console.error('→ 尝试下一个候选模型…');
}
if (!res) {
  console.error('所有候选模型均调用失败，放弃。请检查 LLM_MODEL / LLM_API_KEY 与中转站状态。');
  process.exit(1);
}
console.error(`✓ 使用模型：${usedModel}`);
const data = await res.json();
let text = (data?.content || []).map(b => b?.text || '').join('') || '';
// 去掉可能的 ```json 围栏
text = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
// 截取第一个 { 到最后一个 }
text = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);

let content;
try { content = JSON.parse(text); }
catch (e) { console.error('解析模型输出 JSON 失败：', e.message, '\n原文：\n', text.slice(0, 800)); process.exit(1); }

// 兜底必填字段
for (const k of ['issue', 'lead', 'podcast', 'voices', 'blog', 'colophon']) {
  if (!content[k]) { console.error(`输出缺少字段 ${k}`); process.exit(1); }
}
content.issue.dateISO = dateISO;
content.issue.date = dateCN;
content.issue.weekday = weekday;
content.colophon = content.colophon || {};
content.colophon.generatedAt = `${dateISO} ${timeHM}`;   // 强制真实生成日期+时间，避免模型乱写

writeFileSync('content.json', JSON.stringify(content, null, 2));
console.log(`✓ remix 完成，写入 content.json（${dateISO}，voices ${content.voices.items?.length || 0} 条）`);
