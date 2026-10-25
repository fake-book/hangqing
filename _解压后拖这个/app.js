/* 行情表前端逻辑 · 由 行情.html 加载 */
(function () {
  var D = window.__D__ || [];
  var tb = document.querySelector('#t tbody');
  var mk = document.getElementById('mk');
  var hr = document.getElementById('hardreload');
  if (hr) hr.addEventListener('click', function (e) {
    e.preventDefault();
    var u = location.href.split('?')[0] + '?t=' + Date.now();
    location.replace(u);
  });
  var helpBox = document.getElementById('help');
  var helpToggle = document.getElementById('helptoggle');
  if (helpBox && helpToggle) helpToggle.addEventListener('click', function (e) {
    e.preventDefault();
    helpBox.hidden = !helpBox.hidden;
    helpToggle.textContent = helpBox.hidden ? '这张表怎么看' : '收起说明';
  });
  var seen = {};
  D.forEach(function (r) { seen[r.m] = 1; });
  Object.keys(seen).forEach(function (m) {
    var o = document.createElement('option');
    o.value = m; o.textContent = m; mk.appendChild(o);
  });

  var sortK = 'f', sortDir = -1;

  // ── 我的置顶，存在本机浏览器里，不随文件走 ──
  var PIN_DEFAULT = ['贡菊', '杭菊', '亳菊', '菊花', '玫瑰', '玫瑰花', '金银花'];
  // 不是元/公斤的品种（源站按这个单位报的价）
  var UNIT = { '罗汉果': '个', '蛤蚧': '对', '蜈蚣': '条', '全蝎': '只', '土鳖虫': '公斤' };
  var PINS = PIN_DEFAULT.slice();
  try {
    var rawPin = localStorage.getItem('hc_pins');
    if (rawPin !== null) PINS = JSON.parse(rawPin) || [];
  } catch (e) {}
  function savePins() {
    try { localStorage.setItem('hc_pins', JSON.stringify(PINS)); } catch (e) {}
  }
  function isPin(n) { return PINS.indexOf(n) >= 0; }
  function fOf(r) { return isPin(r.n) ? 3 : (r.f || 0); }

  // 有历史曲线的品种名
  var HNAMES = [], HSET = {};
  (function () {
    var hs = (window.__H__ && window.__H__.series) || {};
    var sk = {};
    Object.keys(hs).forEach(function (k) {
      var v = hs[k];
      if (v && v.n && !sk[v.n]) { sk[v.n] = 1; HNAMES.push(v.n); HSET[v.n] = 1; }
    });
  })();
  function hasCurve(n) { return HSET[n] === 1; }

  // ── 判断这一行点进去到底出不出曲线（规格也要对得上才算）──
  var HBYNAME = {};
  (function () {
    var hs = (window.__H__ && window.__H__.series) || {};
    Object.keys(hs).forEach(function (k) {
      var v = hs[k];
      if (v && v.n) (HBYNAME[v.n] = HBYNAME[v.n] || []).push(v);
    });
  })();
  var ORIGIN = /较广|进口|国产|家种|野生|春七|冬七|安徽|河北|河南|山东|甘肃|云南|浙江|广西|湖南|宁夏|四川|内蒙|东北|湖北|江苏|陕西|贵州|江西|福建|广东|新疆/g;
  function normS(s) {
    return String(s || '').replace(ORIGIN, '').replace(/克/g, 'g')
      .replace(/[\s\-·、,，/\\]/g, '').replace(/混等|混级|通统|统装货|统装/g, '统')
      .replace(/统货/g, '统');
  }
  function numsOf(s) { var m = String(s || '').match(/\d+(\.\d+)?/g); return m || []; }
  function lcsLen(a, b) {
    if (!a || !b) return 0;
    var m = a.length, n = b.length, prev = [], best = 0, i, j;
    for (j = 0; j <= n; j++) prev[j] = 0;
    for (i = 1; i <= m; i++) {
      var cur = [0];
      for (j = 1; j <= n; j++) {
        var v = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0;
        cur[j] = v;
        if (v > best) best = v;
      }
      prev = cur;
    }
    return best;
  }
  function bagInS(a, b) {
    var m = {}, i;
    for (i = 0; i < b.length; i++) m[b[i]] = (m[b[i]] || 0) + 1;
    for (i = 0; i < a.length; i++) { if (!m[a[i]]) return false; m[a[i]]--; }
    return true;
  }
  function bestSpecS(spec, list) {
    var a = normS(spec) || String(spec || '').trim(), av = numsOf(spec), hit = null, sc = 0;
    for (var i = 0; i < list.length; i++) {
      var cv = list[i];
      if (cv.s === spec) return cv;
      var b = normS(cv.s), bv = numsOf(cv.s);
      if (/野/.test(spec) !== /野/.test(cv.s)) continue;
      if (av.length && bv.length) {
        if (av.length !== bv.length) continue;
        var same = true;
        for (var j = 0; j < av.length; j++) if (av[j] !== bv[j]) { same = false; break; }
        if (!same) continue;
      }
      if (!a || !b) continue;
      var s = 0;
      if (a === b) s = 900;
      else if (b.length < a.length && a.indexOf(b) >= 0) s = 600 + b.length;
      else if (a.length < b.length && b.indexOf(a) >= 0) {
        if (b.slice(b.length - a.length) !== a && a[0] !== b[0] && a.length >= 2) continue;
        s = 600 + a.length;
      } else if (a.length <= 5 && b.length <= 6 && bagInS(a, b)) {
        s = 420;
      } else {
        var L = lcsLen(a, b), short = Math.min(a.length, b.length);
        if (!short || L < 2 || L / short < 0.5) continue;
        if (a[0] !== b[0] && a.length >= 2 && b.length >= 2) continue;
        s = 300 + L;
      }
      if (s > sc) { sc = s; hit = cv; }
    }
    return hit;
  }
  function curveState(r) {
    var list = HBYNAME[r.n];
    if (!list || !list.length) return 'nocurve';
    return bestSpecS(r.s, list) ? 'yes' : 'nospec';
  }

  function pct(v) {
    if (v > 0) return '<span class="up">+' + v.toFixed(2) + '%</span>';
    if (v < 0) return '<span class="dn">' + v.toFixed(2) + '%</span>';
    return '<span class="flat">—</span>';
  }
  function dv(v) {
    if (v > 0) return '<span class="up">+' + v + '</span>';
    if (v < 0) return '<span class="dn">' + v + '</span>';
    return '<span class="flat">—</span>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function hl(text, words) {
    var t = esc(text);
    if (!words || !words.length) return t;
    words.forEach(function (w) {
      if (!w) return;
      var safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>');
    });
    return t;
  }

  // ── 置顶面板 ──
  function drawPinBox() {
    var n = document.getElementById('pinN');
    if (n) n.textContent = PINS.length;
    var box = document.getElementById('pinlist');
    if (!box) return;
    if (!PINS.length) {
      box.innerHTML = '<span class="pinbox-empty">还没置顶任何品种。在表格里点品名左边的 ☆ 就行。</span>';
      return;
    }
    box.innerHTML = PINS.map(function (name) {
      return '<span>' + esc(name) + '<i data-x="' + esc(name) + '" title="取消置顶">×</i></span>';
    }).join('');
  }

  function render() {
    var raw = document.getElementById('q').value.trim();
    var words = raw ? raw.split(/\s+/).filter(Boolean).map(function (w) { return w.toLowerCase(); }) : [];
    var m = mk.value;
    var fl = document.getElementById('fl').value;
    var rows = D.filter(function (r) {
      if (words.length) {
        var hay = (r.n + ' ' + r.s + ' ' + r.m).toLowerCase();
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      }
      if (m && r.m !== m) return false;
      if (fl === 'my' && !isPin(r.n)) return false;
      if (fl === 'focus' && !r.f) return false;
      if (fl === 'up' && !(r.w > 0 || r.mo > 0)) return false;
      if (fl === 'dn' && !(r.w < 0 || r.mo < 0)) return false;
      if (fl === 'chg' && !r.d) return false;
      if (fl === 'curve' && !hasCurve(r.n)) return false;
      return true;
    });
    rows.sort(function (a, b) {
      if (sortK === 'f') {
        var fa = fOf(a), fb = fOf(b);
        if (fb !== fa) return fb - fa;
        if (fa === 3) return PINS.indexOf(a.n) - PINS.indexOf(b.n);
        return (b.mo || 0) - (a.mo || 0);
      }
      var x = a[sortK], y = b[sortK];
      if (typeof x === 'string' || typeof y === 'string') {
        return sortDir * String(x).localeCompare(String(y), 'zh');
      }
      return sortDir * ((x || 0) - (y || 0));
    });

    var cnt = document.getElementById('cnt');
    if (cnt) cnt.textContent = rows.length;

    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="9" class="empty">没搜到「' + esc(raw) + '」<br>'
        + '<span style="color:#6b7684;font-size:13px">'
        + '换个说法试试：菊花 / 贡菊 / 玫瑰 / 金银花 / 黄芪 / 亳州<br>'
        + '搜历史曲线里有货的：' + HNAMES.slice(0, 16).join(' · ')
        + '</span></td></tr>';
      return;
    }

    tb.innerHTML = rows.slice(0, 800).map(function (r) {
      var f = fOf(r);
      var cls = f === 3 ? 'mypin' : (f === 2 ? 'focus' : (f === 1 ? 'focus2' : ''));
      var on = isPin(r.n);
      var cs = curveState(r);
      var hcTag = cs === 'yes' ? '<i class="hc on">（有曲线）</i>'
        : cs === 'nospec' ? '<i class="hc mid">（没这规格）</i>'
        : '<i class="hc off">（没曲线）</i>';
      return '<tr class="' + cls + '">'
        + '<td class="nm"><i class="pin' + (on ? ' on' : '') + '" data-n="' + esc(r.n) + '">'
        + (on ? '★' : '☆') + '</i>' + hl(r.n, words) + hcTag + '</td>'
        + '<td class="sp">' + (r.s ? hl(r.s, words) : '—') + '</td>'
        + '<td class="mkt">' + hl(r.m, words) + '</td>'
        + '<td class="px">' + (r.p == null ? '—' : r.p.toFixed(2)
            + (UNIT[r.n] && UNIT[r.n] !== '公斤' ? '<small class="u">/' + UNIT[r.n] + '</small>' : '')) + '</td>'
        + '<td class="tdb"><span class="badge">' + esc(r.t || '—') + '</span></td>'
        + '<td class="wk">' + pct(r.w) + '</td>'
        + '<td class="mo">' + pct(r.mo) + '</td>'
        + '<td class="yr">' + pct(r.y) + '</td>'
        + '<td class="df">' + (r.d ? dv(r.d) : '<span class="flat">—</span>') + '</td>'
        + '</tr>';
    }).join('');
  }

  // ── 点星：置顶 / 取消（capture，抢在曲线弹窗前面）──
  tb.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('pin')) {
      e.preventDefault();
      e.stopPropagation();
      var name = t.dataset.n;
      var i = PINS.indexOf(name);
      if (i >= 0) PINS.splice(i, 1); else PINS.push(name);
      savePins();
      render();
      drawPinBox();
      return false;
    }
  }, true);

  var pinbar = document.getElementById('pinbar');
  if (pinbar) {
    pinbar.onclick = function () {
      var b = document.getElementById('pinbox');
      b.hidden = !b.hidden;
      if (!b.hidden) drawPinBox();
    };
  }
  var pinlist = document.getElementById('pinlist');
  if (pinlist) {
    pinlist.addEventListener('click', function (e) {
      var x = e.target && e.target.dataset ? e.target.dataset.x : null;
      if (!x) return;
      var i = PINS.indexOf(x);
      if (i >= 0) PINS.splice(i, 1);
      savePins();
      render();
      drawPinBox();
    });
  }

  var qt = null;
  document.getElementById('q').oninput = function () {
    clearTimeout(qt);
    qt = setTimeout(render, 160);
  };
  document.getElementById('q').onkeydown = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      render();
      var first = tb.querySelector('tr');
      if (first && first.querySelector('.nm')) first.click();
    }
    if (e.key === 'Escape') {
      this.value = ''; render();
    }
  };
  mk.onchange = render;
  document.getElementById('fl').onchange = render;
  document.getElementById('reset').onclick = function () {
    document.getElementById('q').value = '';
    mk.value = '';
    document.getElementById('fl').value = '';
    render();
  };
  Array.prototype.forEach.call(document.querySelectorAll('th'), function (th) {
    th.onclick = function () {
      var k = th.dataset.k;
      if (sortK === k) sortDir *= -1; else { sortK = k; sortDir = -1; }
      render();
    };
  });

  drawPinBox();
  render();
})();
