#!/usr/bin/env node
// ============================================================================
// AI 日报 — 杂志风 HTML 生成器
// 读取 content.json → 渲染:
//   index.html              最新一期（飞书/About 用的"最新"入口）
//   issues/<date>.html      当天永久存档（不被覆盖）
//   issues/index.json       存档清单（每天 upsert 一条）
//   archive.html            往期目录页（从清单生成）
// 用法: node scripts/build.js [path/to/content.json]
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = 'https://imhw.github.io/ai-daily';   // 用绝对地址，保证 index 与 issues/ 子目录链接都正确
const contentPath = process.argv[2] || join(ROOT, 'content.json');
const d = JSON.parse(readFileSync(contentPath, 'utf8'));

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paras = (arr = []) => arr.map(p => `<p>${esc(p)}</p>`).join('\n          ');

const STYLE = `
  :root{
    --paper:#faf8f3; --ink:#1a1816; --muted:#6e6a63; --faint:#a9a39a;
    --rule:#1a1816; --accent:#c0452f; --hair:#d9d2c6;
    --serif:Georgia,"Times New Roman","Songti SC","Noto Serif SC",serif;
    --sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;background:var(--paper);color:var(--ink);}
  body{font-family:var(--serif);line-height:1.78;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:760px;margin:0 auto;padding:56px 28px 80px;}
  a{color:inherit;}
  .masthead{text-align:center;border-bottom:3px double var(--rule);padding-bottom:18px;}
  .masthead .meta{display:flex;justify-content:space-between;font-family:var(--sans);
    font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);}
  .wordmark{font-size:54px;font-weight:700;letter-spacing:.04em;margin:14px 0 6px;line-height:1;}
  .wordmark small{display:block;font-size:13px;letter-spacing:.42em;font-weight:400;
    color:var(--muted);margin-top:12px;text-transform:uppercase;font-family:var(--sans);}
  .tagline{font-style:italic;color:var(--muted);font-size:14px;margin-top:4px;}
  .section-label{display:flex;align-items:center;gap:16px;margin:54px 0 22px;}
  .section-label::before,.section-label::after{content:"";flex:1;height:1px;background:var(--hair);}
  .section-label span{font-family:var(--sans);font-size:12px;letter-spacing:.28em;
    text-transform:uppercase;color:var(--accent);font-weight:600;}
  .lead{margin-top:40px;}
  .kicker{font-family:var(--sans);font-size:12px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--accent);font-weight:700;margin-bottom:10px;}
  .lead h1{font-size:34px;line-height:1.28;margin:0 0 22px;font-weight:700;letter-spacing:.01em;}
  .lead p{margin:0 0 18px;text-align:justify;font-size:17px;}
  .lead p:first-of-type::first-letter{float:left;font-size:62px;line-height:.82;
    padding:6px 12px 0 0;font-weight:700;color:var(--accent);}
  .article h2{font-size:24px;line-height:1.32;margin:0 0 6px;font-weight:700;}
  .article .meta-line{font-family:var(--sans);font-size:12px;letter-spacing:.06em;
    color:var(--faint);margin-bottom:16px;text-transform:uppercase;}
  .article p{margin:0 0 16px;text-align:justify;font-size:16px;}
  .read-more{font-family:var(--sans);font-size:12px;letter-spacing:.1em;text-transform:uppercase;
    color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent);padding-bottom:1px;}
  .voices{column-count:1;}
  .voice{padding:18px 0;border-top:1px solid var(--hair);}
  .voice:first-child{border-top:none;}
  .voice-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:6px;}
  .voice-name{font-weight:700;font-size:17px;}
  .voice-handle{font-family:var(--sans);font-size:12px;color:var(--faint);}
  .voice-tag{margin-left:auto;font-family:var(--sans);font-size:10px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);
    border-radius:2px;padding:1px 7px;}
  .voice-quote{margin:0;font-size:16px;color:#2c2925;}
  .colophon{margin-top:60px;padding-top:20px;border-top:3px double var(--rule);
    font-family:var(--sans);font-size:12px;color:var(--muted);line-height:1.9;text-align:center;}
  .colophon strong{color:var(--ink);font-weight:600;}
  .nav{margin-top:14px;font-family:var(--sans);font-size:12px;letter-spacing:.06em;}
  .nav a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent);padding-bottom:1px;}
  .nav span{color:var(--faint);margin:0 8px;}
  /* 往期目录 */
  .arch{margin-top:42px;}
  .arch-item{display:flex;gap:20px;align-items:baseline;padding:16px 0;border-top:1px solid var(--hair);}
  .arch-item:first-child{border-top:none;}
  .arch-date{font-family:var(--sans);font-size:12px;letter-spacing:.08em;color:var(--faint);
    white-space:nowrap;min-width:108px;}
  .arch-title{font-size:17px;font-weight:600;text-decoration:none;line-height:1.45;}
  .arch-title:hover{color:var(--accent);}
  .arch-empty{color:var(--muted);text-align:center;margin-top:30px;}
  @media (max-width:540px){
    .wrap{padding:36px 20px 60px;}
    .wordmark{font-size:40px;}
    .lead h1{font-size:27px;}
    .lead p,.article p{text-align:left;}
    .arch-item{flex-direction:column;gap:2px;}
  }`;

const pageShell = (titleText, inner) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titleText)}</title>
<style>${STYLE}
</style>
</head>
<body>
  <div class="wrap">
${inner}
  </div>
</body>
</html>`;

// -- 单期日报 ---------------------------------------------------------------
const voices = (d.voices.items || []).map(v => `
          <article class="voice">
            <div class="voice-head">
              <span class="voice-name">${esc(v.name)}</span>
              <span class="voice-handle">@${esc(v.handle)}${v.org ? ' · ' + esc(v.org) : ''}</span>
              ${v.tag ? `<span class="voice-tag">${esc(v.tag)}</span>` : ''}
            </div>
            <p class="voice-quote">${esc(v.quote)}</p>
          </article>`).join('\n');

const issueInner = `    <header class="masthead">
      <div class="meta"><span>${esc(d.issue.vol)}</span><span>${esc(d.issue.date)} · ${esc(d.issue.weekday)}</span></div>
      <div class="wordmark">AI 日报<small>Builders Digest</small></div>
      <div class="tagline">${esc(d.issue.tagline)}</div>
    </header>

    <section class="lead">
      <div class="kicker">${esc(d.lead.kicker)}</div>
      <h1>${esc(d.lead.title)}</h1>
      ${paras(d.lead.paras)}
    </section>

    <div class="section-label"><span>${esc(d.podcast.label)}</span></div>
    <section class="article">
      <h2>${esc(d.podcast.title)}</h2>
      <div class="meta-line">${esc(d.podcast.meta)}</div>
      ${paras(d.podcast.paras)}
      <a class="read-more" href="${esc(d.podcast.url)}">收听原片 ↗</a>
    </section>

    <div class="section-label"><span>${esc(d.voices.label)}</span></div>
    <section class="voices">${voices}
    </section>

    <div class="section-label"><span>${esc(d.blog.label)}</span></div>
    <section class="article">
      <h2>${esc(d.blog.title)}</h2>
      <div class="meta-line">${esc(d.blog.meta)}</div>
      ${paras(d.blog.paras)}
      <a class="read-more" href="${esc(d.blog.url)}">阅读原文 ↗</a>
    </section>

    <footer class="colophon">
      数据来源 · <strong>${esc(d.colophon.source)}</strong><br>
      ${esc(d.colophon.coverage)}<br>
      生成于 ${esc(d.colophon.generatedAt)}
      <div class="nav"><a href="${SITE}/">最新一期</a><span>·</span><a href="${SITE}/archive.html">往期目录</a></div>
    </footer>`;

const html = pageShell(`AI 日报 · ${d.issue.date}`, issueInner);
writeFileSync(join(ROOT, 'index.html'), html);
const issuesDir = join(ROOT, 'issues');
mkdirSync(issuesDir, { recursive: true });
writeFileSync(join(issuesDir, `${d.issue.dateISO}.html`), html);

// -- 更新存档清单 + 往期目录 -------------------------------------------------
const manifestPath = join(issuesDir, 'index.json');
let manifest = [];
if (existsSync(manifestPath)) {
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { manifest = []; }
}
manifest = manifest.filter(x => x.date !== d.issue.dateISO);   // 同日去重
manifest.push({ date: d.issue.dateISO, dateCN: d.issue.date, weekday: d.issue.weekday, title: d.lead.title });
manifest.sort((a, b) => b.date.localeCompare(a.date));         // 新→旧
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const archItems = manifest.map(x => `
      <div class="arch-item">
        <span class="arch-date">${esc(x.date)}</span>
        <a class="arch-title" href="${SITE}/issues/${esc(x.date)}.html">${esc(x.title || 'AI 日报')}</a>
      </div>`).join('\n');

const archiveInner = `    <header class="masthead">
      <div class="meta"><span>ARCHIVE</span><span>共 ${manifest.length} 期</span></div>
      <div class="wordmark">往期<small>AI 日报 · Archive</small></div>
      <div class="tagline">${esc(d.issue.tagline)}</div>
    </header>
    <section class="arch">${archItems || '<p class="arch-empty">暂无往期</p>'}
    </section>
    <footer class="colophon">
      <div class="nav"><a href="${SITE}/">← 返回最新一期</a></div>
    </footer>`;

writeFileSync(join(ROOT, 'archive.html'), pageShell('AI 日报 · 往期', archiveInner));

console.log(`✓ index.html + issues/${d.issue.dateISO}.html + archive.html（清单 ${manifest.length} 期，${html.length} 字节/期）`);
