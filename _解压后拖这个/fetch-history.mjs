// fetch-history.mjs —— 抓康美中药网「历史价格」曲线数据
// 用法：
//   node fetch-history.mjs --index       只建品种索引 data/herbs.json
//   node fetch-history.mjs --probe 菊花   探测单个品种能拿到什么
//   node fetch-history.mjs              全量抓目标品种（TIER1+FOCUS）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://www.kmzyw.com.cn';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(DIR, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

const H = {
  'User-Agent': UA,
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': BASE + '/jiage/history_price_0321-0001-01.html',
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(pathname, params) {
  const body = new URLSearchParams(params).toString();
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + pathname, { method: 'POST', headers: H, body });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = (await r.text()).trim();
      return JSON.parse(t);
    } catch (e) {
      if (i === 2) throw e;
      await sleep(600);
    }
  }
}

async function getPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (i === 2) throw e;
      await sleep(600);
    }
  }
}

// ── 1. 品种索引（拼音 a-z） ──────────────────────────────
async function buildIndex() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const map = new Map();
  for (const L of letters) {
    let j;
    try { j = await post('/jiage/resouces/jsp/herb_spell.jsp', { key: L }); } catch { continue; }
    (j.result || []).forEach(it => {
      if (it.herb_id) map.set(it.herb_id, it.herb_name);
    });
    process.stdout.write(`\r索引 ${L} → 累计 ${map.size}`);
    await sleep(120);
  }
  const out = [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  fs.writeFileSync(path.join(DATA, 'herbs.json'), JSON.stringify(out, null, 0), 'utf8');
  console.log(`\n✅ 品种索引 ${out.length} 个 → data/herbs.json`);
  return out;
}

// ── 2. 抓一个品种页，提取规格与市场 ──────────────────────
async function fetchHerbMeta(herbId) {
  const html = await getPage(`${BASE}/jiage/history_price_${herbId}-01.html`);
  const specs = [];
  const seen = new Set();
  // onclick="setdata('菊花','亳菊','安徽',$(this),'D-022-01','0321-0001')"
  const re = /setdata\('([^']*)','([^']*)','([^']*)',\$\(this\),'([^']*)','([^']*)'\)/g;
  let m;
  while ((m = re.exec(html))) {
    const [, name, standard, origin, dataid, seq] = m;
    const key = standard + '|' + origin;
    if (seen.has(key)) continue;
    seen.add(key);
    specs.push({ name, standard, origin, dataid, seq });
  }
  // 市场：data-site="亳州"
  const sites = [...new Set([...html.matchAll(/data-site="([^"]+)"/g)].map(x => x[1]))];
  return { specs, sites };
}

// ── 3. 抓一条历史序列 ────────────────────────────────────
async function fetchSeries(name, standard, origin, site) {
  const enc = v => encodeURI(v); // 注意：接口要双重编码
  const j = await post('/jiage/resouces/jsp/price_history_todaylist.jsp', {
    name: enc(name), standard: enc(standard), origin: enc(origin), site: enc(site),
  });
  if (!j || j.success !== true || !j.data) return null;
  let arr;
  try { arr = typeof j.data === 'string' ? JSON.parse(j.data) : j.data; } catch { return null; }
  if (!Array.isArray(arr) || !arr.length) return null;
  return { points: arr, price: j.price, unit: j.measureunit };
}

export { buildIndex, fetchHerbMeta, fetchSeries, post, getPage, sleep, DATA, BASE, UA };

// ── 4. 目标品种 ─────────────────────────────────────────
const TARGET_NAMES = [
  '菊花', '野菊花', '玫瑰花', '金银花', '枸杞子', '陈皮', '黄芪', '当归', '党参', '甘草',
  '茯苓', '白术', '白芍', '丹参', '山楂', '决明子', '罗汉果', '胖大海', '荷叶', '桑叶',
  '薄荷', '三七', '西洋参', '天麻', '百合', '莲子', '桂圆肉', '大枣', '玫瑰茄', '贡菊', '杭菊',
];

async function fetchTargets(all) {
  let idx = JSON.parse(fs.readFileSync(path.join(DATA, 'herbs.json'), 'utf8'));
  let picked;
  if (all) {
    picked = idx;
    console.log(`全量模式：${picked.length} 个品种`);
  } else {
    picked = idx.filter(h => TARGET_NAMES.some(t => h.name.includes(t) || t.includes(h.name)));
    console.log(`目标品种 ${picked.length} 个:`, picked.map(h => h.name).join(' '));
  }

  const series = {};
  const markets = ['亳州'];
  let ok = 0, fail = 0, pts = 0;

  for (let i = 0; i < picked.length; i++) {
    const h = picked[i];
    let meta;
    try { meta = await fetchHerbMeta(h.id); } catch (e) { console.log(`  ✗ ${h.name} 页面失败`); continue; }
    process.stdout.write(`\r[${i + 1}/${picked.length}] ${h.name} 规格${meta.specs.length} `);
    for (const s of meta.specs) {
      for (const mk of markets) {
        let se;
        try { se = await fetchSeries(s.name, s.standard, s.origin, mk); } catch { se = null; }
        if (!se) { fail++; continue; }
        const t0 = se.points[0][0];
        const d = [], p = [];
        for (const [ts, price] of se.points) {
          d.push(Math.round((ts - t0) / 86400000));
          p.push(Math.round(price * 100)); // 存「分」，前端 /100 得两位小数
        }
        series[`${h.name}|${s.standard}`] = { n: h.name, s: s.standard, o: s.origin, m: mk, u: se.unit || '元/千克', t0, d, p };
        ok++; pts += p.length;
        await sleep(110);
      }
    }
  }
  const out = { generated: new Date().toISOString(), count: ok, series };
  fs.writeFileSync(path.join(DATA, 'history.json'), JSON.stringify(out), 'utf8');
  console.log(`\n✅ 曲线 ${ok} 条 / ${pts} 个数据点 / 失败 ${fail} → data/history.json`);
  return out;
}

// ── CLI ─────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--index') {
    await buildIndex();
  } else if (argv[0] === '--probe') {
    const kw = argv[1] || '菊花';
    const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'herbs.json'), 'utf8'));
    const hits = idx.filter(h => h.name.includes(kw) || kw.includes(h.name));
    console.log('品种命中:', hits.map(h => `${h.name}(${h.id})`).join(' · ') || '无');
    for (const h of hits.slice(0, 2)) {
      const meta = await fetchHerbMeta(h.id);
      console.log(`\n【${h.name}】${h.id}  规格 ${meta.specs.length} 个 | 市场 ${meta.sites.join('/')}`);
      meta.specs.slice(0, 8).forEach(s => console.log(`   - ${s.standard}/${s.origin}  seq=${s.seq}`));
      const s0 = meta.specs[0];
      if (s0) {
        const se = await fetchSeries(s0.name, s0.standard, s0.origin, '亳州');
        console.log(`   序列(${s0.standard}/亳州): ${se ? se.points.length + ' 点' : '空'}`, se ? JSON.stringify(se.points[0]) + ' → ' + JSON.stringify(se.points.at(-1)) : '');
      }
    }
  } else if (argv[0] === '--all') {
    await fetchTargets(true);
  } else {
    await fetchTargets();
  }
}
