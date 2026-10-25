/* 历史价格曲线 · 点击表格任意一行弹出
   数据来自 window.__H__（由 fetch-history.mjs 抓取的康美历史价格）
   价格一律保留两位小数 */
(function () {
  var H = window.__H__;
  if (!H || !H.series) return;

  var S = H.series;
  var byName = {};
  Object.keys(S).forEach(function (k) {
    var v = S[k]; v.__k = k;
    (byName[v.n] = byName[v.n] || []).push(v);
  });

  /* ── 样式 ─────────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '#cmask{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);',
    'z-index:99;display:none;align-items:center;justify-content:center;padding:24px}',
    '#cmask.on{display:flex}',
    '#cbox{background:#12161c;border:1px solid #2a3340;border-radius:14px;width:min(920px,100%);',
    'max-height:92vh;overflow:auto;padding:20px 22px 16px;box-shadow:0 24px 70px rgba(0,0,0,.6)}',
    '.chead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}',
    '.ctitle{font-size:19px;font-weight:700;color:#e8edf4;letter-spacing:.5px}',
    '.ctitle small{font-weight:400;color:#7d8896;font-size:13px;margin-left:8px}',
    '.cclose{cursor:pointer;color:#7d8896;font-size:26px;line-height:1;padding:0 4px;user-select:none}',
    '.cclose:hover{color:#e8edf4}',
    '.cstats{display:flex;flex-wrap:wrap;gap:22px;margin:14px 0 6px;padding:12px 14px;',
    'background:#0d1116;border:1px solid #222a35;border-radius:10px}',
    '.cstats div{font-size:12px;color:#7d8896;line-height:1.9}',
    '.cstats b{display:block;font-size:20px;font-weight:700;color:#e8edf4;font-variant-numeric:tabular-nums}',
    '.cstats .up b{color:#ff5d5d}.cstats .dn b{color:#25c26e}',
    '.cstats b.sm{font-size:15px;white-space:nowrap}',
    /* 价格位置条 */
    '.cpos{flex:0 0 100%;margin:10px 0 0}',
    '.cpos-bar{position:relative;height:5px;border-radius:3px;margin:11px 0 14px;',
    '  background:linear-gradient(90deg,#1d7a4a,#3f4a5a 50%,#a33a3a)}',
    '.cpos-bar i{position:absolute;top:-4px;width:4px;height:13px;border-radius:2px;',
    '  background:#f5c45e;box-shadow:0 0 7px #f5c45eaa;transform:translateX(-2px)}',
    '.cpos-bar span{position:absolute;top:-24px;font-size:10.5px;',
    '  font-variant-numeric:tabular-nums;color:#7d8896}',
    '.cpos-bar .cpos-lo{left:0}.cpos-bar .cpos-hi{right:0}',
    '.cpos p{margin:0;font-size:11.5px;color:#8b94a7}',
    '.cpos p b{display:inline;font-size:12.5px;color:#f5c45e}',
    '.ctabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 10px}',
    '.ctab{cursor:pointer;padding:5px 13px;border-radius:16px;font-size:13px;color:#9aa6b4;',
    'border:1px solid #2a3340;background:#161c24;user-select:none}',
    '.ctab:hover{border-color:#3d4b5c;color:#e8edf4}',
    '.ctab.on{background:#1f6feb;border-color:#1f6feb;color:#fff;font-weight:600}',
    '.cchart{position:relative;background:#0d1116;border:1px solid #222a35;border-radius:10px;',
    'padding:10px 6px 4px}',
    '.cchart svg{display:block;width:100%;height:auto}',
    '.ctip{position:absolute;pointer-events:none;background:#1b232e;border:1px solid #33404f;',
    'border-radius:8px;padding:7px 10px;font-size:12px;color:#e8edf4;white-space:nowrap;',
    'display:none;box-shadow:0 6px 18px rgba(0,0,0,.5);font-variant-numeric:tabular-nums}',
    '.ctip i{font-style:normal;color:#8b96a5;display:block;font-size:11px;margin-bottom:2px}',
    '.crange{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}',
    '.cnote{margin-top:10px;font-size:11.5px;color:#6b7684;line-height:1.7}',
    /* 对不上号时的提醒条 */
    '.cwarn{display:none;margin:10px 0 0;padding:11px 14px;border-radius:9px;font-size:12.5px;',
    '  line-height:1.75;background:#2a2314;border:1px solid #5c4a1e;color:#e8c877}',
    '.cwarn b{color:#f5c45e}',
    '.cwarn.on{display:block}',
    '.cpick{display:none}.cpick.on{display:block}',
    '.cpick-note{margin:2px 0 0;font-size:13px;color:#9aa6b4;line-height:1.85}',
    '.cpick-note b{color:#e8edf4;font-size:15px}',
    '.cpick-list{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 2px}',
    '.cpick-list .ctab{font-size:13px}',
    '.nochart{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);background:#1b232e;',
    'border:1px solid #33404f;color:#cfd8e3;padding:11px 20px;border-radius:10px;font-size:13px;',
    'z-index:100;box-shadow:0 8px 26px rgba(0,0,0,.5)}',
    '#t tbody tr{cursor:pointer}',
    '#t tbody tr:hover{background:#181f28}',
    '@media(max-width:860px){',
    '#cmask{padding:0}',
    '#cbox{width:100%;height:100vh;max-height:100vh;border-radius:0;border:none;padding:14px 12px 20px}',
    '.ctitle{font-size:16px;line-height:1.4}.ctitle small{display:block;margin:3px 0 0;font-size:11.5px}',
    '.cclose{font-size:30px}',
    '.cstats{gap:12px 16px;padding:10px 11px;margin:10px 0 4px}',
    '.cstats b.sm{font-size:13px}',
    '.cpos{margin-top:8px}.cpos-bar{margin:10px 0 13px}',
    '.cpos-bar span{font-size:9.5px;top:-21px}.cpos p{font-size:10.5px}',
    '.cstats div{font-size:10.5px;line-height:1.7}.cstats b{font-size:17px}',
    '.ctabs{gap:6px;margin:10px 0 8px}',
    '.ctab{padding:6px 11px;font-size:12.5px}',
    '.cchart{padding:6px 2px 2px}',
    '.cnote{font-size:10.5px;line-height:1.6;margin-top:8px}',
    '.crange{justify-content:center;margin-top:10px}',
    '}',
  ].join('');
  document.head.appendChild(css);

  /* ── 弹窗骨架 ─────────────────────────── */
  var mask = document.createElement('div');
  mask.id = 'cmask';
  mask.innerHTML = '<div id="cbox">'
    + '<div class="chead"><div class="ctitle"></div><span class="cclose">×</span></div>'
    + '<div class="cwarn"></div>'
    + '<div class="cpick"></div>'
    + '<div class="cstats"></div>'
    + '<div class="ctabs"></div>'
    + '<div class="cchart"><svg></svg><div class="ctip"></div></div>'
    + '<div class="crange"></div>'
    + '<div class="cnote">曲线数据来自康美中药网历史价格（亳州市场），<b>站方免费只开放最近一年</b>，'
    + '十年以上的逐日价格是他们的付费数据，我没有入口。'
    + '图上价格是市场报价，不是你的成交价。单位 元/公斤。</div>'
    + '</div>';
  document.body.appendChild(mask);

  var box = mask.querySelector('#cbox');
  var elTitle = mask.querySelector('.ctitle');
  var elWarn = mask.querySelector('.cwarn');
  var elPick = mask.querySelector('.cpick');
  var chartBox = mask.querySelector('.cchart');
  var elStats = mask.querySelector('.cstats');
  var elTabs = mask.querySelector('.ctabs');
  var elRange = mask.querySelector('.crange');
  var elSvg = mask.querySelector('svg');
  var elTip = mask.querySelector('.ctip');

  var cur = null;      // 当前曲线
  var curName = '';    // 当前品种名（无规格那一屏要用）
  var curRange = 365;  // 当前区间天数

  /* ── 规格匹配 ─────────────────────────── */
  /* 规格对不上就直说，绝不拿别的规格顶替。
     两个网站叫法本来就不一样：天地网写「野统 较广」，康美只记「一等/二等/三等/统」。 */
  var ORIGIN = /较广|进口|国产|家种|野生|春七|冬七|安徽|河北|河南|山东|甘肃|云南|浙江|广西|湖南|宁夏|四川|内蒙|东北|湖北|江苏|陕西|贵州|江西|福建|广东|新疆/g;
  function norm(s) {
    return String(s || '').replace(ORIGIN, '').replace(/克/g, 'g')
      .replace(/[\s\-·、,，/\\]/g, '').replace(/混等|混级|通统|统装货|统装/g, '统')
      .replace(/统货/g, '统');
  }
  function numOf(s) { var m = String(s || '').match(/\d+(\.\d+)?/g); return m || []; }
  function lcs(a, b) {
    if (!a || !b) return 0;
    var m = a.length, n = b.length, prev = new Array(n + 1).fill(0), best = 0;
    for (var i = 1; i <= m; i++) {
      var curRow = [0];
      for (var j = 1; j <= n; j++) {
        var v = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0;
        curRow[j] = v;
        if (v > best) best = v;
      }
      prev = curRow;
    }
    return best;
  }
  /* 字一样但顺序不同（统白椒 / 白胡椒统），国标里是同一档货 */
  function bagIn(a, b) {
    var m = {}, i;
    for (i = 0; i < b.length; i++) m[b[i]] = (m[b[i]] || 0) + 1;
    for (i = 0; i < a.length; i++) { if (!m[a[i]]) return false; m[a[i]]--; }
    return true;
  }

  function bestSpec(spec, list) {
    var a = norm(spec) || String(spec || '').trim(), av = numOf(spec), hit = null, sc = 0;
    for (var i = 0; i < list.length; i++) {
      var cv = list[i];
      if (cv.s === spec) return { v: cv, score: 1000, lv: 'exact' };
      var b = norm(cv.s), bv = numOf(cv.s);
      /* 野生的和家种的不是一个价（天麻野统 600、家种统 100），不能混为一谈 */
      if (/野/.test(spec) !== /野/.test(cv.s)) continue;
      /* 两边都写数字，数字必须一模一样 —— 20头 和 120头 差着五倍价，不能混 */
      if (av.length && bv.length) {
        if (av.length !== bv.length) continue;
        var same = true;
        for (var j = 0; j < av.length; j++) if (av[j] !== bv[j]) { same = false; break; }
        if (!same) continue;
      }
      var s = 0;
      if (!a || !b) continue;
      if (a === b) s = 900;
      else if (b.length < a.length && a.indexOf(b) >= 0) s = 600 + b.length;   /* 表格写得更细，比如「空心白统个」对「统」 */
      else if (a.length < b.length && b.indexOf(a) >= 0) {
        /* 后缀一致可以（中条 ⊂ 白条党中条）；前缀不同才是两种货（短支 ≠ 长支） */
        if (b.slice(b.length - a.length) !== a && a[0] !== b[0] && a.length >= 2) continue;
        s = 600 + a.length;
      } else if (a.length <= 5 && b.length <= 6 && bagIn(a, b)) {
        /* 字一样、语序不同：统白椒 vs 白胡椒统、肉统条 vs 统肉（国标里都是同一档货） */
        s = 420;
      } else {
        var L = lcs(a, b), short = Math.min(a.length, b.length);
        if (!short || L < 2 || L / short < 0.5) continue;
        if (a[0] !== b[0] && a.length >= 2 && b.length >= 2) continue;
        s = 300 + L;
      }
      if (s > sc) { sc = s; hit = cv; }
    }
    return hit ? { v: hit, score: sc, lv: sc >= 900 ? 'exact' : sc >= 600 ? 'close' : 'weak' } : null;
  }

  /* 数据只存「价格变过的那几天」，这里按天展开成完整曲线 */
  function expand(sv) {
    if (!sv || sv.d) return sv || { d: [], p: [] };
    var len = sv.len || 364, c = sv.c || [], d = [], p = [], ci = 0, cur = 0;
    for (var i = 0; i < len; i++) {
      while (ci < c.length && c[ci][0] <= i) { cur = c[ci][1]; ci++; }
      d.push(i); p.push(cur);
    }
    sv.d = d; sv.p = p;
    return sv;
  }

  /* ── 数字格式 ─────────────────────────── */
  function f2(cents) { return (cents / 100).toFixed(2); }
  function sign(cents) {
    var v = cents / 100;
    return (v > 0 ? '+' : '') + v.toFixed(2);
  }
  function pctTxt(a, b) {
    if (!a) return '—';
    var v = (b - a) / a * 100;
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  }
  function dateOf(sv, dayOffset) {
    var t = sv.t0 + dayOffset * 86400000;
    var dt = new Date(t);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── 统计条 ───────────────────────────── */
  function stats(sv, from) {
    sv = expand(sv);
    var d = sv.d, p = sv.p, idx = [];
    for (var i = 0; i < d.length; i++) if (d[i] >= from) idx.push(i);
    if (!idx.length) idx = [d.length - 1];
    var first = idx[0], last = idx[idx.length - 1];
    var lo = Infinity, hi = -Infinity, loI = last, hiI = last;
    idx.forEach(function (i) { if (p[i] < lo) { lo = p[i]; loI = i; } if (p[i] > hi) { hi = p[i]; hiI = i; } });
    var chg = p[last] - p[first];
    var cls = chg > 0 ? 'up' : (chg < 0 ? 'dn' : '');
    // 当前价在区间里的位置（0=最低，1=最高）
    var pos = hi > lo ? (p[last] - lo) / (hi - lo) : 0.5;
    var posTxt = pos >= 0.8 ? '偏高' : pos >= 0.55 ? '中间偏上'
               : pos >= 0.35 ? '中间偏下' : pos >= 0.15 ? '偏低' : '低位';
    var toHi = pos >= 0.999 ? '最高' : '−' + ((hi - p[last]) / hi * 100).toFixed(2) + '%';
    var toLo = pos <= 0.001 ? '最低' : '+' + ((p[last] - lo) / lo * 100).toFixed(2) + '%';
    return '<div><span>最新价 ' + dateOf(sv, d[last]) + '</span><b>' + f2(p[last]) + '</b></div>'
      + '<div class="' + cls + '"><span>区间涨跌</span><b>' + sign(chg) + '</b></div>'
      + '<div class="' + cls + '"><span>区间涨跌幅</span><b>' + pctTxt(p[first], p[last]) + '</b></div>'
      + '<div><span>区间最高 ' + dateOf(sv, d[hiI]) + '</span><b>' + f2(hi) + '</b></div>'
      + '<div><span>区间最低 ' + dateOf(sv, d[loI]) + '</span><b>' + f2(lo) + '</b></div>'
      + '<div><span>距最高 / 离最低</span><b class="sm">' + toHi + ' / ' + toLo + '</b></div>'
      + '<div class="cpos"><div class="cpos-bar">'
        + '<span class="cpos-lo">' + f2(lo) + '</span>'
        + '<span class="cpos-hi">' + f2(hi) + '</span>'
        + '<i style="left:' + (pos * 100).toFixed(1) + '%"></i>'
      + '</div><p>现在是这区间里的 <b>' + posTxt + '</b>（' + Math.round(pos * 100) + '% 位置）'
        + (pos >= 0.8 ? '，接近这段时间的高点' : pos <= 0.2 ? '，接近这段时间的低点' : '')
      + '</p></div>';
  }

  /* ── 画图 ─────────────────────────────── */
  var geo = null;
  function draw(sv, range) {
    sv = expand(sv);
    var d = sv.d, p = sv.p;
    var maxDay = d[d.length - 1];
    var from = range >= maxDay ? 0 : maxDay - range;
    var pts = [];
    for (var i = 0; i < d.length; i++) if (d[i] >= from) pts.push({ i: i, x: d[i], y: p[i] / 100 });
    if (pts.length < 2) pts = d.map(function (day, j) { return { i: j, x: day, y: p[j] / 100 }; });

    var W = Math.max(560, (box.querySelector('.cchart').clientWidth || 860) - 12);
    var Hh = 320, L = 62, R = 14, T = 14, B = 30;
    var iw = W - L - R, ih = Hh - T - B;

    var xs = pts.map(function (o) { return o.x; });
    var ys = pts.map(function (o) { return o.y; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    if (xmax === xmin) xmax = xmin + 1;
    var padY = (ymax - ymin) * 0.12 || (ymax * 0.05 || 1);
    ymin -= padY; ymax += padY;
    if (ymin < 0) ymin = 0;

    function X(v) { return L + (v - xmin) / (xmax - xmin) * iw; }
    function Y(v) { return T + ih - (v - ymin) / (ymax - ymin) * ih; }

    var up = pts[pts.length - 1].y >= pts[0].y;
    var line = up ? '#ff5d5d' : '#25c26e';
    var grad = up ? 'rgba(255,93,93,.22)' : 'rgba(37,194,110,.22)';

    var s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '">';
    s += '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + grad + '"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>'
      + '</linearGradient></defs>';

    // 横向网格 + Y 轴刻度（两位小数）
    for (var g = 0; g <= 4; g++) {
      var yv = ymin + (ymax - ymin) * g / 4;
      var yy = Y(yv);
      s += '<line x1="' + L + '" y1="' + yy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + yy.toFixed(1)
        + '" stroke="#1e2731" stroke-width="1"/>';
      s += '<text x="' + (L - 8) + '" y="' + (yy + 4).toFixed(1) + '" fill="#6b7684" font-size="11"'
        + ' text-anchor="end" font-family="ui-monospace,Consolas,monospace">' + yv.toFixed(2) + '</text>';
    }

    // X 轴日期刻度
    var ticks = 6;
    for (var k = 0; k <= ticks; k++) {
      var idx = Math.round(k / ticks * (pts.length - 1));
      var o = pts[idx];
      var xx = X(o.x);
      var lbl = dateOf(sv, o.x).slice(5);
      s += '<text x="' + xx.toFixed(1) + '" y="' + (T + ih + 18) + '" fill="#6b7684" font-size="11"'
        + ' text-anchor="middle" font-family="ui-monospace,Consolas,monospace">' + lbl + '</text>';
      s += '<line x1="' + xx.toFixed(1) + '" y1="' + T + '" x2="' + xx.toFixed(1) + '" y2="' + (T + ih)
        + '" stroke="#161d25" stroke-width="1"/>';
    }

    // 面积
    var poly = pts.map(function (o) { return X(o.x).toFixed(1) + ',' + Y(o.y).toFixed(1); });
    s += '<path d="M' + X(pts[0].x).toFixed(1) + ',' + (T + ih) + ' L' + poly.join(' L')
      + ' L' + X(pts[pts.length - 1].x).toFixed(1) + ',' + (T + ih) + ' Z" fill="url(#cg)"/>';
    // 折线
    s += '<polyline points="' + poly.join(' ') + '" fill="none" stroke="' + line
      + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';

    // 末点
    var lp = pts[pts.length - 1];
    s += '<circle cx="' + X(lp.x).toFixed(1) + '" cy="' + Y(lp.y).toFixed(1) + '" r="3.5" fill="' + line + '"/>';

    // 悬浮十字线层
    s += '<line id="cx" x1="0" y1="' + T + '" x2="0" y2="' + (T + ih) + '" stroke="#4a5b70"'
      + ' stroke-width="1" stroke-dasharray="3 3" opacity="0"/>';
    s += '<circle id="cd" r="4" fill="#fff" stroke="' + line + '" stroke-width="2" opacity="0"/>';
    s += '</svg>';

    elSvg.outerHTML = s;
    elSvg = mask.querySelector('svg');
    geo = { pts: pts, X: X, Y: Y, L: L, T: T, W: W, H: Hh, ih: ih };

    var cx = mask.querySelector('#cx'), cd = mask.querySelector('#cd');
    elSvg.addEventListener('mousemove', function (e) {
      var rect = elSvg.getBoundingClientRect();
      var scale = W / rect.width;
      var mx = (e.clientX - rect.left) * scale;
      var best = null, bd = Infinity;
      geo.pts.forEach(function (o) {
        var dd = Math.abs(geo.X(o.x) - mx);
        if (dd < bd) { bd = dd; best = o; }
      });
      if (!best) return;
      var px = geo.X(best.x), py = geo.Y(best.y);
      cx.setAttribute('x1', px); cx.setAttribute('x2', px); cx.setAttribute('opacity', '1');
      cd.setAttribute('cx', px); cd.setAttribute('cy', py); cd.setAttribute('opacity', '1');
      elTip.style.display = 'block';
      elTip.innerHTML = '<i>' + dateOf(sv, best.x) + '</i>' + best.y.toFixed(2) + ' 元/公斤';
      var tipW = elTip.offsetWidth, tipH = elTip.offsetHeight;
      var left = px / scale + 12;
      if (left + tipW > rect.width - 8) left = px / scale - tipW - 12;
      var top = py / scale - tipH - 10;
      if (top < 0) top = py / scale + 14;
      elTip.style.left = left + 'px';
      elTip.style.top = top + 'px';
    });
    elSvg.addEventListener('mouseleave', function () {
      elTip.style.display = 'none';
      if (cx) cx.setAttribute('opacity', '0');
      if (cd) cd.setAttribute('opacity', '0');
    });
  }

  /* ── 打开弹窗 ─────────────────────────── */
  var RANGES = [[30, '近 1 月'], [90, '近 3 月'], [180, '近半年'], [365, '近一年']];

  function tabsHtml(list, pick) {
    return list.map(function (v) {
      return '<span class="ctab' + (v === pick ? ' on' : '') + '" data-k="' + esc(v.__k) + '">'
        + esc(v.s) + '</span>';
    }).join('');
  }

  /* 表格这一行的规格，曲线里没有对应记录 —— 不硬凑，摊开让人自己挑 */
  function openNoMatch(name, spec, list, mkt) {
    cur = null;
    curName = name;
    curRange = 365;
    mask.classList.add('on');
    elTitle.innerHTML = esc(name) + ' · ' + esc(spec)
      + '<small>' + (mkt ? esc(mkt) + ' 市场 · ' : '') + '表格里的一行 · 元/公斤</small>';
    elWarn.className = 'cwarn on';
    elWarn.innerHTML = '康美的历史价格里<b>没有「' + esc(spec) + '」这个规格</b>。'
      + '两个网站的叫法不是一套，我没有拿别的规格冒名顶替它。';
    elPick.className = 'cpick on';
    elPick.innerHTML = '<div class="cpick-note">「' + esc(name) + '」在康美能查历史的一共 <b>'
      + list.length + '</b> 种规格，点一个看：</div>'
      + '<div class="cpick-list">' + tabsHtml(list, null) + '</div>';
    elStats.style.display = 'none';
    elTabs.style.display = 'none';
    chartBox.style.display = 'none';
    elRange.style.display = 'none';
    box.scrollTop = 0;
  }

  function open(name, spec, mkt) {
    var list = byName[name];
    if (!list || !list.length) {
      toast('「' + name + '」还没有历史曲线数据。目前预载了 ' + Object.keys(byName).length + ' 个常卖品种，例如菊花、玫瑰、金银花、黄芪、枸杞。');
      return;
    }
    var m = bestSpec(spec, list);
    if (!m) { openNoMatch(name, spec, list, mkt); return; }

    var pick = m.v;
    cur = pick;
    curRange = 365;
    mask.classList.add('on');
    elPick.className = 'cpick'; elPick.innerHTML = '';
    elStats.style.display = ''; elTabs.style.display = '';
    chartBox.style.display = ''; elRange.style.display = '';
    elTitle.innerHTML = esc(pick.n) + ' · ' + esc(pick.s)
      + '<small>' + esc(pick.o) + ' · ' + esc(pick.m) + '市场 · 元/公斤</small>';

    var warn = '';
    if (m.lv !== 'exact') {
      warn += '表格这一行是「<b>' + esc(spec) + '</b>」，康美记的是「<b>' + esc(pick.s) + '</b>」——'
        + (m.lv === 'close'
          ? '叫法不一样（表格写得细、康美写得简）。'
          : '<b>不一定是同一种货</b>，只是名字最像。')
        + '看走势可以，但别把这条线的价钱直接当成你那一行。';
    }
    if (mkt && mkt !== pick.m) {
      warn += (warn ? '<br>' : '') + '表格这一行是 <b>' + esc(mkt) + '</b> 市场的报价，'
        + '曲线取的是 <b>' + esc(pick.m) + '</b> 市场 —— 同一个品种，两个市场差几块钱是常事。';
    }
    if (warn) { elWarn.className = 'cwarn on'; elWarn.innerHTML = warn; }
    else { elWarn.className = 'cwarn'; elWarn.innerHTML = ''; }

    elTabs.innerHTML = tabsHtml(list, pick);
    elRange.innerHTML = RANGES.map(function (r) {
      return '<span class="ctab' + (r[0] === curRange ? ' on' : '') + '" data-r="' + r[0] + '">' + r[1] + '</span>';
    }).join('');

    elStats.innerHTML = stats(pick, 0);
    draw(pick, curRange);
    box.scrollTop = 0;
  }

  function close() {
    mask.classList.remove('on');
    elTip.style.display = 'none';
    elWarn.className = 'cwarn';
    elWarn.innerHTML = '';
  }

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'nochart';
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (toastEl) toastEl.remove(); toastEl = null; }, 4200);
  }

  /* ── 事件 ─────────────────────────────── */
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('cclose') || e.target === mask) { close(); return; }
    var cp = e.target.closest ? e.target.closest('.cpick-list .ctab') : null;
    if (cp) { open(curName, cp.textContent.trim()); return; }
    var tab = e.target.closest ? e.target.closest('.ctab') : null;
    if (tab && mask.contains(tab)) {
      if (tab.dataset.r) {
        if (!cur) return;
        curRange = +tab.dataset.r;
        Array.prototype.forEach.call(elRange.querySelectorAll('.ctab'), function (t) {
          t.classList.toggle('on', +t.dataset.r === curRange);
        });
        elStats.innerHTML = stats(expand(cur), Math.max(0, expand(cur).d.length - 1 - curRange));
        draw(cur, curRange);
      } else if (tab.dataset.k) {
        var sv = S[tab.dataset.k];
        if (!sv) return;
        cur = sv;
        elWarn.className = 'cwarn'; elWarn.innerHTML = '';
        elPick.className = 'cpick'; elPick.innerHTML = '';
        elStats.style.display = ''; elTabs.style.display = '';
        chartBox.style.display = ''; elRange.style.display = '';
        Array.prototype.forEach.call(elTabs.querySelectorAll('.ctab'), function (t) {
          t.classList.toggle('on', t.dataset.k === tab.dataset.k);
        });
        elTitle.innerHTML = esc(sv.n) + ' · ' + esc(sv.s)
          + '<small>' + esc(sv.o) + ' · ' + esc(sv.m) + '市场 · 元/公斤</small>';
        elRange.innerHTML = RANGES.map(function (r) {
          return '<span class="ctab' + (r[0] === curRange ? ' on' : '') + '" data-r="' + r[0] + '">' + r[1] + '</span>';
        }).join('');
        elStats.innerHTML = stats(expand(sv), Math.max(0, expand(sv).d.length - 1 - curRange));
        draw(sv, curRange);
      }
      return;
    }
    if (e.target.closest && e.target.closest('.pin')) return;
    var tr = e.target.closest ? e.target.closest('#t tbody tr') : null;
    if (!tr || mask.classList.contains('on')) return;
    var nmEl = tr.querySelector('.nm'), spEl = tr.querySelector('.sp'), mkEl = tr.querySelector('.mkt');
    if (!nmEl) return;
    var nmText = nmEl.textContent.replace(/[★☆]/g, '')
      .replace(/（(?:有曲线|没曲线|没这规格)）/g, '').trim();
    open(nmText, spEl ? spEl.textContent.trim() : '', mkEl ? mkEl.textContent.trim() : '');
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
