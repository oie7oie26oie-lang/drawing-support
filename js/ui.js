/* 画面共通：描画ループ、イベントの振り分け、ポスター・月相の部品、色ピッカー、演出
 *
 * 約束ごと
 *   data-action="x"  … クリックで DS.actions.x(el, event)
 *   data-change="x"  … change で DS.actions.x(el, event)（select / checkbox / date）
 *   data-input="x"   … input で DS.actions.x(el, event)（入力中の部分更新）
 *   data-hover="x"   … マウスが乗ったら DS.actions.x(el, event)
 *   data-bind="path" … 入力値を題材（または data-scope="settings" なら設定）の path に保存
 *   data-file="x"    … ファイル選択で DS.fileActions.x(files, el)
 *   data-drop="x"    … ドロップで DS.fileActions.x(files, el)
 *   data-img="id"    … IndexedDB の画像を <img> に流し込む
 *   data-countdown   … 次の 7:00 までの残り時間を自動更新
 */
(function () {
  'use strict';
  const DS = window.DS;
  const C = DS.color;
  const L = DS.logic;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  DS.$ = $;
  DS.$$ = $$;

  DS.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = DS.esc;

  DS.views = {};
  DS.actions = {};
  DS.fileActions = {};
  DS.afterRender = {};

  // [id, 名前, 携帯の下部メニュー用の短い名前]
  const NAV = [
    ['queue', '次の一枚', '次の一枚'],
    ['subject', '制作', '制作'],
    ['grid', 'グリッド', 'グリッド'],
    ['stock', '写真ストック', 'ストック'],
    ['colors', '和色', '和色'],
    ['settings', '設定', '設定'],
  ];

  /* ---------- 描画 ---------- */

  let lastKey = '';

  DS.render = function () {
    const ui = DS.state.ui;
    if (!DS.views[ui.view]) ui.view = 'queue';
    document.documentElement.dataset.theme = ui.theme === 'day' ? 'day' : 'night';
    $('#theme').innerHTML = ui.theme === 'day' ? '☾<span class="tl"> 夜にする</span>' : '☀<span class="tl"> 昼にする</span>';
    $('#nav').innerHTML = NAV.map(([id, label, short]) => '<button class="' + (ui.view === id ? 'on' : '') + '" data-action="nav" data-view="' + id + '"><span class="nl">' + label + '</span><span class="ns">' + short + '</span></button>').join('');
    const main = $('#main');
    const y = window.scrollY;
    main.innerHTML = DS.views[ui.view]();
    DS.hydrate(main);
    DS.renderNextSlot();
    if (DS.afterRender[ui.view]) DS.afterRender[ui.view](main);
    // 画面が切り替わったときだけ、ふわっと入る
    const key = ui.view + '|' + (ui.view === 'subject' ? ui.subjectId + '|' + ui.tab : '');
    if (key !== lastKey) {
      main.classList.remove('enter');
      void main.offsetWidth;
      main.classList.add('enter');
      lastKey = key;
    }
    window.scrollTo(0, y);
  };

  /** ヘッダー：次の 7:00 までの残り時間と、その枠の月相 */
  DS.renderNextSlot = function () {
    const next = L.upcomingSlots(1)[0];
    const s = L.subjectsAt(next)[0];
    const a = s ? L.alert(s) : { level: 'warn' };
    $('#brand-moon').innerHTML = DS.moon(s ? Math.min(L.stage(s), 4) : 0, 34);
    const el = $('#nextslot');
    el.className = 'nextslot ' + a.level;
    el.innerHTML = '<span class="ns-label">次の 7:00 まで</span><b data-countdown>' + L.countdown() + '</b><span class="ns-name">' + (s ? esc(s.name || '（無題）') : '題材が未定') + '</span>';
  };
  setInterval(() => {
    if (!DS.state) return;
    $$('[data-countdown]').forEach((el) => (el.textContent = L.countdown()));
  }, 20000);

  DS.badge = (s) => '<span class="badge st-' + s.status + '">' + L.statusLabel(s.status) + '</span>';

  /** 画像を非同期で流し込む */
  DS.hydrate = function (root) {
    $$('[data-img]', root).forEach((el) => {
      DS.images.url(el.dataset.img).then((u) => {
        if (u) el.src = u;
      });
    });
  };

  /* ---------- ポスター（ベタ塗りの下絵） ---------- */

  function posterSvg(bg, moon, main, sub, building) {
    const dark = bg ? C.textOn(bg) === '#ffffff' : true;
    const ghost = dark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.2)';
    const body = main || ghost;
    const cut = sub || bg || 'rgba(127,127,127,.35)'; // 窓。副色がなければ背景色で抜く
    let s = '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    // 月：横幅を白銀比（1:√2）に分ける点
    if (moon) s += '<circle cx="234.3" cy="112" r="36" fill="' + moon + '"/>';
    if (building) {
      s += '<rect x="182" y="214" width="36" height="46" fill="' + body + '"/><rect x="112" y="258" width="176" height="136" fill="' + body + '"/>';
      for (let i = 0; i < 5; i++) s += '<rect x="' + (131 + i * 31) + '" y="284" width="14" height="56" fill="' + cut + '"/>';
      s += '<rect x="98" y="392" width="204" height="18" fill="' + (sub || body) + '"/>';
    }
    return s + '</svg>';
  }

  /** o: { bg, moon, main, sub, imageId, label, cls, building } */
  DS.poster = function (o) {
    const bg = C.safe(o.bg);
    const inner = o.imageId ? '<img data-img="' + esc(o.imageId) + '" alt="">' : posterSvg(bg, C.safe(o.moon), C.safe(o.main), C.safe(o.sub), o.building !== false);
    return (
      '<div class="poster ' + (bg ? '' : 'blank ') + (o.cls || '') + '"' + (bg ? ' style="background:' + bg + '"' : '') + '>' + inner +
      (o.label ? '<span class="poster-label" style="color:' + C.textOn(bg || '#222222') + '">' + esc(o.label) + '</span>' : '') + '</div>'
    );
  };

  /** 題材のポスター。pid を省くとマスター（なければ最初の候補） */
  DS.posterOf = function (s, cls, pid) {
    const p = (pid && L.patternsOf(s).find((x) => x.id === pid)) || L.featured(s);
    return DS.poster({
      bg: p && p.bg ? (p.isMaster && C.safe(s.measuredHex)) || p.bg.hex : '',
      moon: p && p.moon ? p.moon.hex : '',
      main: s.buildingMain.hex,
      sub: s.buildingSub.hex,
      imageId: p && p.imageId,
      cls,
    });
  };

  /** 月相アイコン。stage: 0 新月 … 4 満月 */
  DS.moon = function (stage, size) {
    const f = [0, 0.22, 0.5, 0.8, 1][Math.max(0, Math.min(4, stage))];
    let lit = '';
    if (f >= 1) lit = '<circle class="lit" cx="12" cy="12" r="10"/>';
    else if (f > 0) lit = '<path class="lit" d="M12 2A10 10 0 0 1 12 22A' + (10 * Math.abs(1 - 2 * f)).toFixed(2) + ' 10 0 0 ' + (f < 0.5 ? 0 : 1) + ' 12 2Z"/>';
    return '<svg class="moonph p' + stage + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><circle class="dark" cx="12" cy="12" r="10"/>' + lit + '</svg>';
  };

  /** 新月 → 満月 の進み具合 */
  DS.phases = function (s, size) {
    const st = L.stage(s);
    return (
      '<ol class="phases">' +
      L.STAGES.map((label, i) => '<li class="' + (i <= st ? 'done' : '') + (i === Math.min(st, 4) ? ' cur' : '') + '">' + DS.moon(i, size || 26) + '<span><small>' + L.PHASES[i] + '</small>' + label + '</span></li>').join('') +
      '</ol>'
    );
  };

  DS.chip = (hex, cls) => '<span class="chip ' + (cls || '') + '" style="background:' + (C.safe(hex) || 'transparent') + '"></span>';

  /* ---------- トースト・コピー・ダウンロード ---------- */

  let toastTimer = null;
  DS.toast = function (msg, level) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'show ' + (level || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = ''), 2600);
  };

  DS.copy = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  };

  /** 押したボタンそのものを「コピーしました」に変える */
  function flash(el) {
    if (el._flash) return;
    const html = el.innerHTML;
    el.classList.add('copied');
    el.innerHTML = '✓ コピーしました';
    el._flash = setTimeout(() => {
      el.classList.remove('copied');
      el.innerHTML = html;
      el._flash = null;
    }, 1500);
  }

  /** 携帯では共有シート（「画像を保存」「ファイルに保存」）を開く。PCでは通常のダウンロード。 */
  DS.download = function (blob, filename) {
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare) {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch((err) => {
          if (err && err.name !== 'AbortError') saveByLink(blob, filename);
        });
        return;
      }
    }
    saveByLink(blob, filename);
  };

  function saveByLink(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- モーダル ---------- */

  DS.modal = function (html, cls) {
    const root = $('#modal-root');
    root.innerHTML = '<div class="modal-back" data-action="modalBackdrop"><div class="modal ' + (cls || '') + '">' + html + '</div></div>';
    DS.hydrate(root);
    return root;
  };
  DS.closeModal = function () {
    $('#modal-root').innerHTML = '';
    pickCallback = null;
  };
  DS.actions.modalBackdrop = (el, e) => {
    if (e.target === el) DS.closeModal();
  };
  DS.actions.modalClose = () => DS.closeModal();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') DS.closeModal();
  });

  /** マスターが決まった瞬間：その和色で画面を染める */
  DS.celebrate = function (s) {
    const m = L.masterOf(s);
    if (!m || !m.bg) return;
    const bg = m.bg.hex;
    const ink = C.textOn(bg);
    $('#modal-root').innerHTML =
      '<div class="celebrate" data-action="modalClose" style="--c:' + bg + ';--k:' + ink + '">' +
      '<i class="cel-moon" style="background:' + (m.moon ? m.moon.hex : ink) + '"></i>' +
      '<div class="cel-inner"><div class="cel-poster">' + DS.posterOf(s, '', m.id) + '</div>' +
      '<div class="cel-text"><small>MASTER DECIDED</small><b>マスター決定</b><span>' + esc(s.name || '') + '</span><em>' + esc(m.bg.name) + (m.moon ? ' × ' + esc(m.moon.name) : '') + '</em>' +
      '<div class="row"><button class="btn onc" data-action="tab" data-tab="caption">キャプションを作る →</button><button class="btn ghostc" data-action="modalClose">閉じる</button></div></div></div></div>';
    DS.hydrate($('#modal-root'));
  };

  /* ---------- 色ピッカー（和色リストから選ぶ。乗せるとポスターが変わる） ---------- */

  let pickCallback = null;
  let pickOpts = null;
  const isTouch = () => !!(window.matchMedia && window.matchMedia('(hover: none)').matches);

  function pickerBody(filter) {
    const used = pickOpts.showUsed ? L.usedColors(pickOpts.exceptId) : new Map();
    const f = (filter || '').trim().toLowerCase();
    const match = (c) => !f || c.name.includes(f) || (c.en || '').toLowerCase().includes(f) || (c.gloss || '').toLowerCase().includes(f) || c.hex.includes(f);
    const sw = (c) => {
      const u = used.get(c.name);
      return (
        '<button class="swatch' + (u ? ' used' : '') + (pickOpts.current === c.name ? ' on' : '') + '" data-action="pickChoose" data-hover="pickPreview" data-name="' + esc(c.name) + '"' + (u ? ' data-used="' + esc(u.join('、')) + '"' : '') + '>' +
        '<span class="sw-color" style="background:' + c.hex + '">' + (u ? '<em>済</em>' : '') + '</span>' +
        '<span class="sw-name">' + esc(c.name) + '</span><span class="sw-hex">' + c.hex + '</span></button>'
      );
    };
    let html = '';
    if (pickOpts.favorites && !f) {
      html += '<h4>月の定番</h4><div class="swatches">' + pickOpts.favorites.map((n) => C.find(n)).filter(Boolean).map(sw).join('') + '</div>';
    }
    const groups = [];
    C.all()
      .filter(match)
      .forEach((c) => {
        const g = c.group || '追加した色';
        let grp = groups.find((x) => x.name === g);
        if (!grp) groups.push((grp = { name: g, items: [] }));
        grp.items.push(c);
      });
    html += groups.map((g) => '<h4>' + esc(g.name) + '</h4><div class="swatches">' + g.items.map(sw).join('') + '</div>').join('');
    return html || '<p class="empty">該当する色がありません。</p>';
  }

  function pickSide(name, usedBy) {
    const c = C.find(name);
    return (
      '<div class="pick-poster">' + (pickOpts.preview ? pickOpts.preview(name) : '') + '</div>' +
      (c
        ? '<div class="pick-name"><b>' + esc(c.name) + '</b><span>' + esc(c.en || '') + (c.gloss ? '　' + esc(c.gloss) : '') + '</span><code>' + c.hex + '</code>' + (usedBy ? '<p class="warnline">背景に使用済み：' + esc(usedBy) + '</p>' : '') +
          (isTouch() && name !== pickOpts.current ? '<button class="btn primary" data-action="pickChoose" data-confirm="1" data-name="' + esc(c.name) + '">この色にする</button>' : '') + '</div>'
        : '<div class="pick-name"><span>' + (isTouch() ? '色を押すと、ポスターの下絵が変わります。' : '色に乗せると、ポスターの下絵が変わります。') + '</span></div>')
    );
  }

  /** opts: { title, current, showUsed, exceptId, favorites, preview(name) → HTML, onPick(name) } */
  DS.pickColor = function (opts) {
    pickOpts = opts;
    DS.modal(
      '<div class="picker"><div class="picker-side" id="pick-side">' + pickSide(opts.current) + '</div><div class="picker-main">' +
        '<div class="modal-head"><h3>' + esc(opts.title) + '</h3><input type="search" id="pick-search" placeholder="色名・ローマ字・HEXで絞り込み" data-input="pickFilter"><button class="btn ghost" data-action="modalClose">閉じる</button></div>' +
        (opts.showUsed ? '<p class="hint">「済」は背景に使用済みの色です（選ぶことはできます）。</p>' : '') +
        '<div id="pick-body" class="pick-body">' + pickerBody('') + '</div></div></div>',
      'wide'
    );
    pickCallback = opts.onPick;
  };
  DS.actions.pickFilter = (el) => {
    $('#pick-body').innerHTML = pickerBody(el.value);
  };
  DS.actions.pickPreview = (el) => {
    const side = $('#pick-side');
    if (side && side.dataset.name !== el.dataset.name) {
      side.dataset.name = el.dataset.name;
      side.innerHTML = pickSide(el.dataset.name, el.dataset.used);
      DS.hydrate(side);
    }
  };
  DS.actions.pickChoose = (el) => {
    // 指で操作する端末では、1回目のタップで下絵に当てはめ、「この色にする」で決める
    const side = $('#pick-side');
    if (isTouch() && !el.dataset.confirm && side && side.dataset.name !== el.dataset.name) {
      DS.actions.pickPreview(el);
      $$('#pick-body .swatch').forEach((b) => b.classList.toggle('on', b === el));
      return;
    }
    const cb = pickCallback;
    DS.closeModal();
    if (cb) cb(el.dataset.name);
  };

  /* ---------- 共通アクション ---------- */

  DS.actions.nav = (el) => {
    DS.state.ui.view = el.dataset.view;
    DS.save();
    DS.render();
    window.scrollTo(0, 0);
  };

  DS.actions.themeToggle = () => {
    DS.state.ui.theme = DS.state.ui.theme === 'day' ? 'night' : 'day';
    DS.save();
    DS.render();
  };

  DS.actions.openSubject = (el) => {
    const ui = DS.state.ui;
    ui.subjectId = el.dataset.id;
    ui.view = 'subject';
    if (el.dataset.tab) ui.tab = el.dataset.tab;
    DS.closeModal();
    DS.save();
    DS.render();
    window.scrollTo(0, 0);
  };

  DS.actions.copy = (el) => {
    const target = $(el.dataset.target);
    if (!target) return;
    DS.copy('value' in target ? target.value : target.textContent);
    flash(el);
    if (el.dataset.mark) {
      const s = DS.current();
      if (s) {
        s[el.dataset.mark] = true;
        DS.save();
      }
    }
  };

  DS.actions.zoom = (el) => {
    DS.modal('<div class="zoom"><img data-img="' + esc(el.dataset.id) + '" alt=""><div class="zoom-cap">' + esc(el.dataset.caption || '') + '<button class="btn" data-action="modalClose">閉じる</button></div></div>', 'bare');
  };

  /* ---------- イベントの振り分け ---------- */

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }

  function bindTarget(el) {
    const scope = el.closest('[data-scope]');
    if (scope && scope.dataset.scope === 'settings') return DS.state.settings;
    const holder = el.closest('[data-sid]');
    if (holder) return DS.state.subjects.find((s) => s.id === holder.dataset.sid);
    return DS.current();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = DS.actions[el.dataset.action];
    if (fn) fn(el, e);
  });

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-hover]');
    if (el && DS.actions[el.dataset.hover]) DS.actions[el.dataset.hover](el, e);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset) return;
    if (el.dataset.bind) {
      const target = bindTarget(el);
      if (target) {
        setPath(target, el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
        DS.save();
        if (DS.softRefresh) DS.softRefresh();
      }
    }
    if (el.dataset.input && DS.actions[el.dataset.input]) DS.actions[el.dataset.input](el, e);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset) return;
    if (el.type === 'file' && el.dataset.file) {
      const files = Array.from(el.files || []);
      if (files.length && DS.fileActions[el.dataset.file]) DS.fileActions[el.dataset.file](files, el);
      el.value = '';
      return;
    }
    if (el.dataset.change && DS.actions[el.dataset.change]) DS.actions[el.dataset.change](el, e);
  });

  document.addEventListener('dragover', (e) => {
    const zone = e.target.closest && e.target.closest('[data-drop]');
    if (zone) {
      e.preventDefault();
      zone.classList.add('dragover');
    }
  });
  document.addEventListener('dragleave', (e) => {
    const zone = e.target.closest && e.target.closest('[data-drop]');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('dragover');
  });
  document.addEventListener('drop', (e) => {
    const zone = e.target.closest && e.target.closest('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length && DS.fileActions[zone.dataset.drop]) DS.fileActions[zone.dataset.drop](files, zone);
  });

  window.addEventListener('DOMContentLoaded', () => {
    DS.load();
    DS.render();
    // ブラウザに「このデータは勝手に消さないで」と頼む（携帯での消失対策）
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    // Web上に置いたときだけ、オフラインでも開けるようにする（file:// では使わない）
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})();
