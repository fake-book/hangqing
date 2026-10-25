#!/usr/bin/env node
/**
 * 中药材 / 花茶 行情表
 * 数据源：中药材天地网 zyctd.com（全市场品种 + 周月年涨跌）
 *         康美中药网 kmzyw.com.cn（菊花类 六市场比价）
 *
 * 用法：
 *   node fetch-price.mjs            全量抓取（122 页，约 1-2 分钟）
 *   node fetch-price.mjs --quick    只抓前 10 页（约 10 秒，先看效果）
 *
 * 输出：
 *   行情.html      ← 双击打开，可搜索/排序/筛选（单文件，可直接发人）
 *   行情.csv       ← Excel 能开
 *   data/…json     ← 历史快照，用于「较上次」对比
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HDR = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const QUICK = process.argv.includes('--quick');

/* 自家主营（置顶）：贡菊 / 杭菊 / 亳菊 / 玫瑰 / 金银花 */
const TIER1 = ['贡菊', '杭菊', '亳菊', '菊花', '玫瑰', '玫瑰花', '金银花'];
/* 其他常看品种（大宗药材 + 花茶原料）*/
const FOCUS = [
  '枸杞', '枸杞子', '黑枸杞', '陈皮', '黄芪', '当归', '党参', '甘草',
  '茯苓', '白术', '白芍', '丹参', '山楂', '决明子', '罗汉果', '胖大海',
  '荷叶', '桑叶', '薄荷', '三七', '西洋参', '天麻', '百合', '莲子',
  '桂圆', '大枣', '野菊花', '玫瑰茄',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: HDR, redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries) throw e;
      await sleep(800 * i);
    }
  }
}

const clean = s => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- 中药材天地网 ---------- */
function parseZyctd(html) {
  const rows = [];
  const body = (html.split('<tbody>')[1] || '').split('</tbody>')[0] || '';
  const trRe = /<tr>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = trRe.exec(body))) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1]);
    if (tds.length < 8) continue;
    const name = clean(tds[0]);
    if (!name) continue;
    const idM = tds[0].match(/jh(\d+)\.html/);
    // 规格单元格被页面 CSS 截断成「贡菊朵菊统..」，完整值在 title 属性里
    const specTitle = (tds[1].match(/title="([^"]*)"/) || [])[1];
    rows.push({
      name,
      id: idM ? +idM[1] : null,
      spec: clean(specTitle || tds[1]),
      market: clean(tds[2]),
      price: parseFloat(clean(tds[3])) || null,
      trend: clean(tds[4]),
      w: clean(tds[5]),
      mo: clean(tds[6]),
      y: clean(tds[7]),
    });
  }
  return rows;
}

async function fetchZyctd() {
  const first = await get('https://www.zyctd.com/jiage/1-0-0.html');
  const totalM = first.match(/共\s*(\d+)\s*页/);
  const total = totalM ? +totalM[1] : 122;
  const pages = QUICK ? Math.min(10, total) : total;
  console.log(`天地网：共 ${total} 页，本次抓 ${pages} 页`);

  let all = parseZyctd(first);
  for (let p = 2; p <= pages; p++) {
    const html = await get(`https://www.zyctd.com/jiage/1-0-0-${p}.html`);
    all = all.concat(parseZyctd(html));
    if (p % 10 === 0 || p === pages) console.log(`  …第 ${p}/${pages} 页，累计 ${all.length} 行`);
    await sleep(250);
  }
  // 天地网跨页有重复行，按 品名|规格|市场 去重
  const seen = new Set();
  const uniq = all.filter(r => {
    const k = `${r.name}|${r.spec}|${r.market}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (uniq.length !== all.length) console.log(`  去重：${all.length} → ${uniq.length} 行`);
  return uniq;
}

/* ---------- 康美菊花页（花茶重点比价）---------- */
function parseKmzyw(html) {
  const rows = [];
  const tbl = (html.split('<table')[1] || '').split('</table>')[0] || '';
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = trRe.exec(tbl))) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => clean(x[1]));
    if (cells.length < 8) continue;
    if (!cells[0] || cells[0] === '品名') continue;
    if (!/^\d+(\.\d+)?$/.test(cells[3]) && cells[3] !== '--') continue;
    rows.push({
      name: cells[0], spec: cells[1], origin: cells[2],
      bz: cells[3], ag: cells[4], cd: cells[5], yl: cells[6], lq: cells[7], pn: cells[8] || '--',
    });
  }
  return rows;
}

async function fetchKmzyw() {
  try {
    const html = await get('https://www.kmzyw.com.cn/jiage/today_price_0321.html');
    const rows = parseKmzyw(html);
    console.log(`康美菊花页：${rows.length} 条`);
    return rows;
  } catch (e) {
    console.log('康美页抓取失败（不影响主表）：' + e.message);
    return [];
  }
}

/* ---------- 与上次快照对比 ---------- */
function loadPrev() {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('snap-') && f.endsWith('.json')).sort();
    if (!files.length) return null;
    const last = files[files.length - 1];
    return { file: last, data: JSON.parse(fs.readFileSync(path.join(DATA_DIR, last), 'utf8')) };
  } catch { return null; }
}

/* ---------- 输出 ---------- */
function toCsv(rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['品名', '规格', '市场', '价格(元/公斤)', '走势', '周涨跌', '月涨跌', '年涨跌', '较上次'];
  const body = rows.map(r => [r.name, r.spec, r.market, r.price, r.trend, r.w, r.mo, r.y, r.diff]
    .map(esc).join(','));
  return '\uFEFF' + [head.map(esc).join(','), ...body].join('\r\n');
}

const num = v => { const n = parseFloat(String(v).replace('%', '')); return isNaN(n) ? 0 : n; };

const APP_JS = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const CHART_JS = fs.readFileSync(path.join(ROOT, 'chart.js'), 'utf8');
let HISTORY = { generated: '', series: {} };
try {
  HISTORY = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'history.json'), 'utf8'));
} catch {
  console.log('（提示：data/history.json 还没生成，曲线功能暂不可用。先跑 node fetch-history.mjs）');
}

const CSS = `
:root{--bg:#0f1115;--card:#171a21;--line:#262b36;--tx:#e6e9ef;--dim:#8b94a7;
--up:#e5484d;--dn:#2f9e6b;--gold:#d9a441;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.6 -apple-system,"Microsoft YaHei",sans-serif}
header{padding:16px 20px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:9}
h1{margin:0 0 6px;font-size:17px;font-weight:600}
.meta{color:var(--dim);font-size:12px;line-height:1.9}
.meta b{color:var(--gold);font-weight:500}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
input,select{background:var(--card);border:1px solid var(--line);color:var(--tx);
border-radius:6px;padding:7px 10px;font-size:13px;outline:none;font-family:inherit}
input:focus,select:focus{border-color:#3d4a63}
input[type=search]{flex:1;min-width:180px}
.chip{cursor:pointer;user-select:none;padding:7px 12px;border-radius:6px;
background:var(--card);border:1px solid var(--line);font-size:13px}
.chip:hover{border-color:#3d4a63;color:#9fc3ff}
.hint{color:var(--dim);font-size:12px;margin-top:10px}
main{padding:0 20px 40px}
table{width:100%;border-collapse:collapse;margin-top:12px;font-variant-numeric:tabular-nums}
th{position:sticky;top:0;background:#12151b;text-align:right;font-weight:500;color:var(--dim);
font-size:12px;padding:9px 10px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap;z-index:2}
th:nth-child(1),th:nth-child(2),th:nth-child(3){text-align:left}
th:hover{color:#9fc3ff}
td{padding:8px 10px;border-bottom:1px solid #1c212b;text-align:right;white-space:nowrap}
td:nth-child(1),td:nth-child(2),td:nth-child(3){text-align:left}
td.sp{color:#8b94a7}
tbody tr:hover{background:#1a1f28}
.nm{font-weight:500}
.pin{cursor:pointer;font-style:normal;font-size:12px;color:#39424f;margin-right:5px;
  transition:color .12s;user-select:none;display:inline-block}
.pin:hover{color:var(--gold)}
.pin.on{color:var(--gold)}
.mypin .nm{color:var(--gold);font-weight:600}
.focus .nm{color:var(--gold)}
.focus2 .nm{color:#c2c9ad}
.hc{font-style:normal;font-size:10.5px;margin-left:6px;vertical-align:1px;
  user-select:none;white-space:nowrap}
.hc.on{color:#5a9fd4}
.hc.mid{color:#a08a4e}
.hc.off{color:#39414b}
tr:hover .hc.on{color:#78bdf0}
tr:hover .hc.mid{color:#c8ac62}
tr:hover .hc.off{color:#4a5560}
.helpbtn{display:inline-block;width:14px;height:14px;line-height:14px;text-align:center;
  border:1px solid #3a4350;border-radius:50%;font-size:10px;color:#7b8698;margin-right:3px}
#helptoggle{color:#5a9fd4;text-decoration:none;border-bottom:1px dashed #2c4a63}
#helptoggle:hover{color:#78bdf0}
.legend{display:flex;flex-wrap:wrap;gap:3px 20px;padding:8px 13px;margin:9px 0 4px;
  background:#12161d;border:1px solid #232a35;border-left:3px solid #2f6a9e;border-radius:5px;
  font-size:12px;line-height:1.75;color:#8e98a6}
.lg{display:inline-flex;align-items:baseline;gap:0}
.lg b{color:#c3ccd8;font-weight:600;margin-right:5px;white-space:nowrap}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;
  position:relative;top:-1px;flex:0 0 auto}
.dot.on{background:#5a9fd4;box-shadow:0 0 6px rgba(90,159,212,.55)}
.dot.mid{background:#a08a4e;box-shadow:0 0 6px rgba(160,138,78,.5)}
.dot.off{background:#39414b}
.help{background:var(--card);border:1px solid var(--line);border-radius:8px;
  padding:13px 16px;margin-top:10px;font-size:12.5px;line-height:2.05;color:#9aa4b2}
.help b{color:#d6dde6;font-weight:600}
.pinbar{cursor:pointer}
.pinbar b{color:var(--gold);font-weight:600}
.pinbox{background:var(--card);border:1px solid var(--line);border-radius:8px;
  padding:12px 14px;margin-top:10px}
.pinbox-h{color:var(--dim);font-size:12px;margin-bottom:10px;line-height:1.7}
.pinbox-list{display:flex;flex-wrap:wrap;gap:8px}
.pinbox-list span{background:#1a212b;border:1px solid var(--line);border-radius:6px;
  padding:5px 10px;font-size:13px;display:inline-flex;align-items:center}
.pinbox-list span i{cursor:pointer;color:#6b7684;font-style:normal;margin-left:8px;font-size:15px;line-height:1}
.pinbox-list span i:hover{color:#ff6b6b}
.pinbox-empty{color:#4a5261;font-size:12.5px}
.up{color:var(--up)}.dn{color:var(--dn)}.flat{color:#4a5261}
.badge{display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;background:#222831;color:var(--dim)}
.empty{text-align:center;color:var(--dim);padding:48px}
footer{color:var(--dim);font-size:12px;padding:20px;border-top:1px solid var(--line);margin-top:20px;line-height:2}
.kw{color:var(--gold)}
.own{padding:14px 0 4px}
.own-t{color:var(--gold);font-size:12px;margin-bottom:10px;letter-spacing:.5px}
.own-row{display:flex;gap:10px;flex-wrap:wrap}
.own-c{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;min-width:134px}
.own-n{font-size:13px;font-weight:600;color:var(--gold)}
.own-s{color:var(--dim);font-size:11px;margin-bottom:6px}
.own-p{font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
.own-p small{font-size:11px;color:var(--dim);font-weight:400}
.own-y{font-size:12px;margin-top:3px}
mark{background:#3b3410;color:var(--gold);border-radius:2px;padding:0 1px}
td.px small.u{font-size:10px;color:var(--dim);font-weight:400;margin-left:1px}
.own-p small.u{font-size:11px;color:var(--dim);font-weight:400}
/* ───── 手机 / 窄屏 ───── */
@media (max-width: 860px){
  body{overflow-x:hidden}
  header{padding:11px 12px 9px;position:static}
  h1{font-size:15.5px}
  .meta{font-size:11px;line-height:1.8}
  main{padding:0 10px 30px}
  .bar{gap:6px;margin-top:9px}
  input[type=search]{flex:1 1 100%;min-width:0;font-size:15px;padding:10px 12px}
  select{flex:1 1 auto;font-size:14px;padding:9px 8px}
  .chip{padding:9px 14px;font-size:14px}
  .hint{font-size:11px;line-height:1.7}
  .own{padding:10px 0 2px}
  .own-row{gap:8px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}
  .own-c{min-width:104px;padding:8px 11px;flex:0 0 auto}
  .own-p{font-size:17px}
  .own-n{font-size:12.5px}
  .own-s{font-size:10.5px}
  .own-y{font-size:11.5px}
  table{margin-top:8px}
  thead{display:none}
  tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:2px 9px;
    padding:9px 4px;border-bottom:1px solid #1c212b;align-items:center}
  td{border:none;padding:0;white-space:nowrap;text-align:left;min-width:0}
  td.nm{grid-column:1;grid-row:1;font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis}
  td.sp{grid-column:1;grid-row:2;font-size:11.5px;color:#8b94a7;overflow:hidden;text-overflow:ellipsis}
  td.mkt,td.tdb,td.wk,td.df{display:none}
  td.px{grid-column:2;grid-row:1 / span 2;font-size:16px;font-weight:700;text-align:right}
  td.mo{grid-column:3;grid-row:1;font-size:11.5px;text-align:right;min-width:66px}
  td.yr{grid-column:3;grid-row:2;font-size:11.5px;text-align:right;min-width:66px}
  td.mo::before{content:"月 ";color:#5c6675;font-size:10px}
  td.yr::before{content:"年 ";color:#5c6675;font-size:10px}
  footer{padding:16px 12px;font-size:11px;line-height:1.9}
  .focus .nm{font-size:14.5px}
}
`;

function toHtml(zyctd, kmzyw, meta) {
  const data = zyctd.map(r => ({
    n: r.name, s: r.spec, m: r.market, p: r.price, t: r.trend,
    w: num(r.w), mo: num(r.mo), y: num(r.y), d: r.diff,
    f: TIER1.includes(r.name) ? 2 : (FOCUS.includes(r.name) ? 1 : 0),
  }));

  /* 自家品种速览：只取亳州市场，按 TIER1 顺序 */
  const own = zyctd
    .filter(r => r.market === '亳州' && TIER1.includes(r.name))
    .sort((a, b) => TIER1.indexOf(a.name) - TIER1.indexOf(b.name));

  const ownCard = own.length
    ? `<div class="own">`
      + `<div class="own-t">自家品种 · 亳州今日</div>`
      + `<div class="own-row">`
      + own.map(r => {
        const yy = num(r.y);
        const cls = yy > 0 ? 'up' : yy < 0 ? 'dn' : 'flat';
        const sign = yy > 0 ? '+' : '';
        return `<div class="own-c"><div class="own-n">${r.name}</div>`
          + `<div class="own-s">${r.spec || '—'}</div>`
          + `<div class="own-p">${r.price == null ? '—' : r.price.toFixed(2)}<small> 元/公斤</small></div>`
          + `<div class="own-y ${cls}">年 ${sign}${yy.toFixed(2)}%</div></div>`;
      }).join('')
      + `</div></div>`
    : '';

  const kwBlock = kmzyw.length
    ? `<div style="margin-bottom:16px"><b class="kw">花茶重点 · 六市场比价（元/公斤）</b><br>`
      + kmzyw.map(k => `${k.name} ${k.spec}｜产地 ${k.origin}｜亳州 <b class="kw">${k.bz}</b>｜安国 ${k.ag}｜成都 ${k.cd}｜玉林 ${k.yl}｜廉桥 ${k.lq}｜普宁 ${k.pn}`).join('<br>')
      + `</div>`
    : '';

  const prevLine = meta.prevFile
    ? `（对比 <code>${meta.prevFile}</code>）`
    : '（首次抓取，无对比基线）';

  return [
    '<!doctype html>',
    '<html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<title>药材 · 花茶 行情表</title>',
    '<link rel="manifest" href="manifest.json">',
    '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">',
    '<link rel="apple-touch-icon" href="icon-192.png">',
    '<meta name="theme-color" content="#0d1117">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="行情表">',
    '<meta name="application-name" content="行情表">',
    `<style>${CSS}</style></head><body>`,
    '<header>',
    '  <h1>药材 · 花茶 行情表</h1>',
    `  <div class="meta">数据源：中药材天地网 · 康美中药网　|　行情时间 <b>${meta.time}</b>　|　`
      + `品种规格 <b>${data.length}</b> 条　|　较上次变动 <b>${meta.changed}</b> 条 ${prevLine}</div>`,
    `  <div class="meta" style="font-size:11.5px;color:#5c6675">本页生成于 <b style="color:#8b94a7">${new Date().toLocaleString('zh-CN', { hour12: false })}</b>　`
      + `<a href="#" id="hardreload" style="color:#4a9eff;text-decoration:none">⟳ 如果看着是旧内容，点这里强制刷新</a></div>`,
    '  <div class="legend">',
    '    <span class="lg"><i class="dot on"></i><b>（有曲线）</b>点进去直接出这货近一年走势</span>',
    '    <span class="lg"><i class="dot mid"></i><b>（没这规格）</b>这品种有历史价，但这一行的大小/产地/野家它没记，点进去让你从它能查的几档里挑</span>',
    '    <span class="lg"><i class="dot off"></i><b>（没曲线）</b>整个品种都没收录，点不出图</span>',
    '  </div>',
    '  <div class="bar">',
    '    <input type="search" id="q" placeholder="搜品种 / 规格 / 产地，例如：菊花、贡菊、黄芪">',
    '    <select id="mk"><option value="">全部市场</option></select>',
    '    <select id="fl">',
    '      <option value="">全部</option>',
    '      <option value="my">只看我的置顶</option>',
    '      <option value="focus">只看 ★ 重点</option>',
    '      <option value="up">只看涨</option>',
    '      <option value="dn">只看跌</option>',
    '      <option value="chg">只看有变动</option>',
    '      <option value="curve">只看能看曲线的</option>',
    '    </select>',
    '    <span class="chip pinbar" id="pinbar">我的置顶 <b id="pinN">0</b></span>',
    '    <span class="chip" id="reset">重置</span>',
    '  </div>',
    '  <div class="pinbox" id="pinbox" hidden>',
    '    <div class="pinbox-h">这些品种会一直排在最前面，存在这台设备上，换浏览器就没了。点右边 × 取消。</div>',
    '    <div class="pinbox-list" id="pinlist"></div>',
    '  </div>',
    `  <div class="hint">点表头切换排序　·　<b class="kw">点任意一行看这只货近一年的价格曲线</b>　·　点品名旁的 ☆ 置顶（<b>★</b> 已经是置顶）　·　当前显示 <b id="cnt">0</b> 条　·　<span class="helpbtn" id="helpbtn">?</span> <a href="#" id="helptoggle">这张表怎么看</a></div>`,
    '  <div class="help" id="help" hidden>',
    '    <b>价格</b>：药材市场里公开挂出来的报价，不是你能卖出去的价。一次出五吨十吨，人家给的价往往比这个低。<br>',
    '    <b>走势</b>：<b>平</b>=最近没动、<b>慢</b>=小步走、<b>快</b>=在明显调价、<b>缺</b>=挂着价但没货（有价无市，涨跌幅常常是 0.00%）。<br>',
    '    <b>周 / 月 / 年</b>：比一周前、一月前、一年前涨了还是跌了。红是涨、绿是跌。<br>',
    '    <b>较上次</b>：跟这次刷新之前的报价比，变了多少。<br>',
    '    <b>（有曲线）</b>：点进去就能看它近一年每一天的价格。<br>',
    '    <b>（没这规格）</b>：这个品种有曲线，但你现在看的这个**规格**数据源没记（比如天麻「野统」、三七「20头春七」）。点进去会让你从它能查的几个规格里挑一个，绝不拿别的规格冒充。<br>',
    '    <b>（没曲线）</b>：这个品种整个都没有历史价格数据。<br>',
    '    <b>★ / ☆</b>：☆ 点一下变成 ★，这个品种会一直排在最前面（存在你自己的手机/电脑里，不上传）。<br>',
    '    <b>单位</b>：默认 元/公斤。罗汉果是 元/个，行内会标出来。',
    '  </div>',
    '</header>',
    '<main>',
    ownCard,
    '<table id="t"><thead><tr>',
    '<th data-k="n">品名</th><th data-k="s">规格</th><th data-k="m">市场</th>',
    '<th data-k="p">价格<small style="font-weight:400;display:block">元/公斤</small></th>',
    '<th data-k="t">走势</th><th data-k="w">周</th><th data-k="mo">月</th><th data-k="y">年</th><th data-k="d">较上次</th>',
    '</tr></thead><tbody></tbody></table></main>',
    '<footer>',
    kwBlock,
    '说明：价格为各市场公开报价，单位 元/公斤（罗汉果 元/个、蛤蚧 元/对）。<br>',
    '本页仅汇总公开行情，不构成交易建议。行情随时变动，以实际成交为准。<br>',
    '刷新方式：双击 <b>刷新行情.bat</b>。历史快照存在 <code>data/</code> 目录。',
    '</footer>',
    `<script>window.__D__=${JSON.stringify(data)};</script>`,
    `<script>window.__H__=${JSON.stringify(HISTORY)};</script>`,
    `<script>${APP_JS}</script>`,
    `<script>${CHART_JS}</script>`,
    '</body></html>',
  ].join('\n');
}

/* ---------- 主流程 ---------- */
(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // --rebuild：不联网，只用最近一次快照重新生成 行情.html
  if (process.argv.includes('--rebuild')) {
    const prev = loadPrev();
    if (!prev) { console.error('data/ 里还没有快照，先正常跑一次抓取。'); process.exit(1); }
    const rows = prev.data.rows;
    const html = toHtml(rows, [], { time: prev.data.time, changed: 0, prevFile: null });
    fs.writeFileSync(path.join(ROOT, '行情.html'), html, 'utf8');
    fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
    console.log(`已用快照 ${prev.file}（${rows.length} 条）重建 行情.html + index.html`);
    return;
  }

  const t0 = Date.now();
  const now = new Date();
  const d = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const stamp = `${d}-${h}`;
  const timeStr = now.toLocaleString('zh-CN', { hour12: false });

  const zyctd = await fetchZyctd();
  const kmzyw = await fetchKmzyw();

  const prev = loadPrev();
  const oldMap = new Map();
  let changed = 0;
  if (prev) {
    for (const r of prev.data.rows) oldMap.set(`${r.name}|${r.spec}|${r.market}`, r.price);
    for (const r of zyctd) {
      const o = oldMap.get(`${r.name}|${r.spec}|${r.market}`);
      r.diff = (o == null || r.price == null) ? 0 : +(r.price - o).toFixed(4);
      if (r.diff) changed++;
    }
  } else {
    for (const r of zyctd) r.diff = 0;
  }

  fs.writeFileSync(path.join(DATA_DIR, `snap-${stamp}.json`),
    JSON.stringify({ time: timeStr, rows: zyctd }), 'utf8');
  fs.writeFileSync(path.join(ROOT, '行情.csv'), toCsv(zyctd), 'utf8');
  const fullHtml = toHtml(zyctd, kmzyw, { time: timeStr, changed, prevFile: prev?.file || null });
  fs.writeFileSync(path.join(ROOT, '行情.html'), fullHtml, 'utf8');
  // index.html 是给 Cloudflare Pages / 静态托管用的（它们只认 index.html）
  fs.writeFileSync(path.join(ROOT, 'index.html'), fullHtml, 'utf8');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n完成：${zyctd.length} 条，较上次变动 ${changed} 条，用时 ${secs}s`);
  console.log(`输出：行情.html / index.html / 行情.csv / data/snap-${stamp}.json`);
})().catch(e => { console.error('抓取失败：', e.message); process.exit(1); });
