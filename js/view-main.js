/* 次の一枚（投稿キュー） / グリッドプレビュー / 写真ストック / 和色 / 設定 */
(function () {
  'use strict';
  const DS = window.DS;
  const L = DS.logic;
  const C = DS.color;
  const esc = DS.esc;
  const $ = DS.$;
  const A = DS.actions;
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  const byId = (id) => DS.state.subjects.find((s) => s.id === id);
  function changed() {
    DS.save();
    DS.render();
  }
  const nameOf = (s) => esc(s.name || '（無題）');

  /* ================= 次の一枚（投稿キュー） ================= */

  function relDay(ymd) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const n = Math.round((new Date(ymd + 'T00:00:00') - today) / 864e5);
    return n === 0 ? '今日' : n === 1 ? '明日' : n > 0 ? n + '日後' : -n + '日前';
  }

  function queueButtons(s) {
    const st = L.stage(s);
    const b = (action, label, cls) => '<button class="btn ' + (cls || '') + '" data-action="' + action + '" data-id="' + s.id + '">' + label + '</button>';
    const overdue = s.slot && L.slotDate(s) < new Date();
    let html = '';
    if (st < 2) {
      const next = L.nextAction(s);
      html += '<button class="btn primary" data-action="openSubject" data-id="' + s.id + '" data-tab="' + next.tab + '">' + next.label + ' →</button>';
    }
    if (st === 2) html += '<button class="btn primary" data-action="openSubject" data-id="' + s.id + '" data-tab="caption">キャプションを作る →</button>' + b('qSchedule', 'Instagramで予約した', '');
    if (st === 3) html += b('qVerify', '「予約済みコンテンツ」で確認した', 'primary') + b('qUnschedule', '予約を取り消す', 'ghost');
    if (st === 4) html += b('qVerify', 'もう一度確認した', '') + b('qUnschedule', '予約を取り消す', 'ghost');
    if (st >= 2 && st < 5 && (overdue || st >= 3)) html += b('qPosted', '投稿済みにする', overdue ? 'primary' : '');
    return html;
  }

  const ALERT_ICON = { ok: '●', warn: '▲', danger: '▲', none: '' };

  function heroHtml(next) {
    const s = L.subjectsAt(next)[0];
    const eyebrow = '<div class="eyebrow">NEXT POST　' + L.fmtSlot(next) + '　' + relDay(next) + '</div>';
    if (!s) {
      return (
        '<section class="hero empty"><div class="hero-poster">' + DS.poster({ building: true }) + '</div><div class="hero-body">' + eyebrow +
        '<h1>次の枠は、まだ空いています</h1><div class="hero-count">あと <b data-countdown>' + L.countdown() + '</b></div>' +
        '<p class="hero-sub">題材を入れて、次の一枚を始めましょう。</p>' +
        '<div class="hero-cta"><button class="btn primary" data-action="slotAssignOpen" data-date="' + next + '">この枠に題材を入れる</button></div></div></section>'
      );
    }
    const p = L.featured(s);
    const bg = p && p.bg ? (p.isMaster && C.safe(s.measuredHex)) || p.bg.hex : '';
    const a = L.alert(s);
    const facts = [s.architect, s.year, p && p.bg ? p.bg.name + (p.moon ? ' × ' + p.moon.name : '') + (p.isMaster ? '' : '（仮：' + p.id + '）') : ''].filter(Boolean);
    return (
      '<section class="hero' + (bg ? ' tinted' : '') + '"' + (bg ? ' style="--hero:' + bg + ';--hero-ink:' + C.textOn(bg) + '"' : '') + '>' +
      '<button class="hero-poster" data-action="openSubject" data-id="' + s.id + '" title="制作画面を開く">' + DS.posterOf(s) + '</button>' +
      '<div class="hero-body">' + eyebrow + '<h1>' + nameOf(s) + '</h1>' +
      (facts.length ? '<p class="hero-sub">' + facts.map(esc).join('　・　') + '</p>' : '') +
      '<div class="hero-count">あと <b data-countdown>' + L.countdown() + '</b></div>' +
      DS.phases(s, 30) +
      '<div class="hero-alert ' + a.level + '">' + ALERT_ICON[a.level] + ' ' + esc(a.text) + '</div>' +
      '<div class="hero-cta">' + queueButtons(s) + '</div></div></section>'
    );
  }

  function dayCard(ymd) {
    const d = new Date(ymd + 'T07:00:00');
    const head = '<span class="day-date"><b>' + d.getDate() + '</b><small>' + WEEK[d.getDay()] + '</small></span>';
    const at = L.subjectsAt(ymd);
    if (!at.length) {
      return '<button class="day empty" data-action="slotAssignOpen" data-date="' + ymd + '" title="' + L.fmtSlot(ymd) + ' に題材を入れる">' + head + '<span class="day-plus">＋</span><span class="day-name">空き</span></button>';
    }
    const s = at[0];
    const a = L.alert(s);
    return (
      '<button class="day ' + a.level + '" data-action="openSubject" data-id="' + s.id + '" title="' + nameOf(s) + ' ／ ' + esc(a.text) + '">' + head + DS.posterOf(s) +
      '<span class="day-name">' + nameOf(s) + '</span><span class="day-moon">' + DS.moon(Math.min(L.stage(s), 4), 18) + (at.length > 1 ? '<em>重複</em>' : '') + '</span></button>'
    );
  }

  function queueRow(s, dupe) {
    const a = L.alert(s);
    return (
      '<div class="qrow ' + a.level + '"><button class="qposter" data-action="openSubject" data-id="' + s.id + '">' + DS.posterOf(s) + '</button>' +
      '<div class="qbody"><div class="eyebrow">' + L.fmtSlot(s.slot) + '　' + relDay(s.slot) + '</div><h3>' + nameOf(s) + '</h3>' + DS.phases(s, 22) +
      '<div class="qalert ' + a.level + '">' + ALERT_ICON[a.level] + ' ' + esc(a.text) + (dupe ? '　／　同じ枠に複数の題材があります' : '') + '</div></div>' +
      '<div class="qactions">' + queueButtons(s) + '</div></div>'
    );
  }

  DS.views.queue = function () {
    const now = new Date();
    const subs = DS.state.subjects;
    const slotted = subs.filter((s) => s.slot && s.status !== 'posted');
    const overdue = slotted.filter((s) => L.slotDate(s) < now).sort((a, b) => (a.slot < b.slot ? -1 : 1));
    const dates = L.upcomingSlots(14);
    const later = slotted.filter((s) => L.slotDate(s) >= now && s.slot !== dates[0]).sort((a, b) => (a.slot < b.slot ? -1 : 1));
    const pending = slotted.filter((s) => L.alert(s).level !== 'ok').sort((a, b) => (a.slot < b.slot ? -1 : 1));
    const danger = pending.some((s) => L.alert(s).level === 'danger');
    const waiting = subs.filter((s) => !s.slot && s.status !== 'posted').length;

    const banner = pending.length
      ? '<div class="banner ' + (danger ? 'danger' : 'warn') + '"><b>▲ 「アプリで確認済み」になっていない枠が ' + pending.length + ' 件</b><ul>' +
        pending.map((s) => '<li><b>' + L.fmtSlot(s.slot) + '</b>　' + nameOf(s) + '　' + esc(L.alert(s).text) + '</li>').join('') + '</ul></div>'
      : slotted.length
      ? '<div class="banner ok"><b>● 題材が入っている枠は、すべて満月（アプリで確認済み）です</b></div>'
      : '';

    const rows = overdue.concat(later).map((s) => queueRow(s, L.subjectsAt(s.slot).length > 1)).join('');

    return (
      '<div class="page">' + heroHtml(dates[0]) + banner +
      '<section class="sec"><div class="sec-head"><h2>これからの14日</h2><span class="hint">毎朝 7:00　／　空いている日を押すと題材を入れられます' + (waiting ? '　／　枠待ちの題材 ' + waiting + ' 件' : '') + '</span></div>' +
      '<div class="strip">' + dates.map(dayCard).join('') + '</div></section>' +
      (rows ? '<section class="sec"><div class="sec-head"><h2>そのほかの枠</h2></div><div class="queue">' + rows + '</div></section>' : '') +
      '<p class="hint foot">予約が消える事故を防ぐため、Instagramで予約したあと、アプリの「予約済みコンテンツ」を目で見て確かめてから確認ボタンを押してください。このアプリからInstagramへ投稿・予約することはありません。</p></div>'
    );
  };

  A.qSchedule = (el) => {
    L.setStatus(byId(el.dataset.id), 'scheduled');
    changed();
    DS.toast('十三夜。アプリの「予約済みコンテンツ」で確かめたら満月です', 'warn');
  };
  A.qVerify = (el) => {
    const s = byId(el.dataset.id);
    s.verified = true;
    s.verifiedAt = new Date().toISOString();
    changed();
    DS.toast('満月。確認時刻を記録しました');
  };
  A.qUnschedule = (el) => {
    const s = byId(el.dataset.id);
    L.setStatus(s, s.masterId ? 'master' : 'generating');
    changed();
  };
  A.qPosted = (el) => {
    L.setStatus(byId(el.dataset.id), 'posted');
    changed();
    DS.toast('投稿済みにしました。おつかれさまでした');
  };

  A.slotAssignOpen = (el) => {
    const date = el.dataset.date;
    const free = DS.state.subjects.filter((s) => !s.slot && s.status !== 'posted');
    DS.modal(
      '<div class="modal-head"><h3>' + L.fmtSlot(date) + ' の一枚を選ぶ</h3><span class="sep"></span><button class="btn ghost" data-action="modalClose">閉じる</button></div>' +
        (free.length
          ? '<div class="assign">' + free.map((s) => '<button class="assign-item" data-action="slotAssignPick" data-id="' + s.id + '" data-date="' + date + '">' + (s.refPhotos[0] && !L.featured(s) ? '<div class="poster"><img data-img="' + s.refPhotos[0] + '" alt=""></div>' : DS.posterOf(s)) + '<b>' + nameOf(s) + '</b>' + DS.badge(s) + '</button>').join('') + '</div>'
          : '<p class="empty">枠待ちの題材はありません。新しく作るか、「写真ストック」に参考写真を入れてください。</p>') +
        '<div class="row end"><button class="btn primary" data-action="slotAssignNew" data-date="' + date + '">＋ 新しい題材を作ってこの枠に入れる</button></div>',
      'wide'
    );
  };
  A.slotAssignPick = (el) => {
    byId(el.dataset.id).slot = el.dataset.date;
    DS.closeModal();
    changed();
    DS.toast(L.fmtSlot(el.dataset.date) + ' の枠に入れました');
  };
  A.slotAssignNew = (el) => {
    const s = DS.newSubject({ slot: el.dataset.date });
    DS.state.subjects.push(s);
    Object.assign(DS.state.ui, { subjectId: s.id, tab: 'info', view: 'subject' });
    DS.closeModal();
    changed();
    window.scrollTo(0, 0);
  };

  /* ================= グリッドプレビュー ================= */

  const CLASH = 20; // この色差（ΔE）未満を「色が近い」とみなす

  DS.views.grid = function () {
    const ui = DS.state.ui;
    const items = L.gridItems();
    const clashes = L.gridClashes(items, CLASH);
    const clashIds = new Set();
    clashes.forEach((c) => {
      clashIds.add(c.a.s.id);
      clashIds.add(c.b.s.id);
    });

    const tiles = items
      .map((it) => {
        const cls = 'gtile' + (it.tentative ? ' tent' : '') + (ui.gridSel === it.s.id ? ' sel' : '') + (clashIds.has(it.s.id) ? ' clash' : '');
        const title = (it.s.name || '（無題）') + ' ／ ' + it.p.bg.name + (it.p.moon ? ' × ' + it.p.moon.name : '') + (it.tentative ? '（仮置き）' : '');
        return (
          '<button class="' + cls + '" data-action="gridSel" data-id="' + it.s.id + '" title="' + esc(title) + '" style="background:' + it.bgHex + ';color:' + C.textOn(it.bgHex) + '">' +
          (it.p.imageId ? '<img data-img="' + it.p.imageId + '" alt="">' : (it.moonHex ? '<i class="moon" style="background:' + it.moonHex + '"></i>' : '') + '<span class="gname">' + nameOf(it.s) + '<small>' + esc(it.p.bg.name) + '</small></span>') +
          (it.tentative ? '<em class="tag">仮</em>' : it.s.status !== 'posted' ? '<em class="tag soft">' + L.statusLabel(it.s.status) + '</em>' : '') +
          '</button>'
        );
      })
      .join('');

    const cands = DS.state.subjects.filter((s) => s.status !== 'posted' && L.patternsOf(s).some((p) => p.bg));
    const t = ui.gridTentative;
    const tSub = t ? byId(t.sid) : null;
    const tPatterns = tSub ? L.patternsOf(tSub).filter((p) => p.bg) : [];
    const sel = items.find((it) => it.s.id === ui.gridSel);
    const selClashes = sel ? clashes.filter((c) => c.a.s.id === sel.s.id || c.b.s.id === sel.s.id) : [];
    const aspects = [['3 / 4', '3:4（現在のプロフィール表示）'], ['4 / 5', '4:5（投稿の比率）'], ['1 / 1', '1:1（旧表示）']];
    const handle = esc((DS.state.settings.handle || '').replace(/^@/, ''));

    return (
      '<div class="page"><div class="page-head"><div class="eyebrow">GRID PREVIEW</div><h1>色の並びを確かめる</h1><p class="hint">Instagramの3列表示。左上が最新です。「昼／夜」の切り替えで、ライトモード・ダークモードの見え方も比べられます。</p></div>' +
      '<div class="gridwrap"><div class="phone"><div class="phone-head"><span class="avatar">' + DS.moon(4, 44) + '</span><div><b>' + handle + '</b><small>投稿 ' + items.length + ' 件' + (t ? '（仮置きを含む）' : '') + '</small></div></div>' +
      '<div class="iggrid" style="--ar:' + esc(ui.gridAspect || '3 / 4') + '">' + (tiles || '<p class="empty">マスターが決まった題材がまだありません。</p>') + '</div></div>' +

      '<div class="gridside">' +
      '<div class="card"><h3>候補を仮置きする</h3><label class="f"><span>題材</span><select data-change="gridTentSubject"><option value="">（仮置きなし）</option>' +
      cands.map((s) => '<option value="' + s.id + '"' + (t && t.sid === s.id ? ' selected' : '') + '>' + nameOf(s) + (s.slot ? '　' + L.fmtSlot(s.slot) : '') + '</option>').join('') + '</select></label>' +
      (tSub
        ? '<div class="f"><span>パターン</span><div class="patpick">' +
          tPatterns.map((p) => '<button class="patbtn' + (t.pid === p.id ? ' on' : '') + '" data-action="gridTentPattern" data-pid="' + p.id + '" title="' + esc(p.bg.name + (p.moon ? ' × ' + p.moon.name : '')) + '">' + DS.posterOf(tSub, '', p.id) + '<b>' + p.id + (p.isMaster ? ' ★' : '') + '</b></button>').join('') +
          '</div></div>'
        : '') +
      '<p class="hint">並び順は投稿枠の日付順です。投稿枠のない過去の投稿は、タイルを選んで順番を入れ替えられます。</p></div>' +

      '<div class="card"><h3>色被りチェック <small>色差 ΔE ' + CLASH + ' 未満</small></h3>' +
      (clashes.length
        ? '<ul class="clashes">' + clashes.map((c) => '<li><span class="pair"><i style="background:' + c.a.bgHex + '"></i><i style="background:' + c.b.bgHex + '"></i></span><span><b>' + nameOf(c.a.s) + '</b>（' + esc(c.a.p.bg.name) + '）と <b>' + nameOf(c.b.s) + '</b>（' + esc(c.b.p.bg.name) + '）<br><small>' + c.kind + '　ΔE ' + Math.round(c.d) + '</small></span></li>').join('') + '</ul>'
        : '<p class="okline">● 隣り合う投稿で、色が近い組み合わせはありません。</p>') +
      '<p class="hint">グリッドは投稿のたびに1つずつずれるので、「連続する投稿」と「3つ違いの投稿（常に縦に並ぶ）」を比べています。</p></div>' +

      (sel
        ? '<div class="card"><h3>選択中：' + nameOf(sel.s) + '</h3><p>' + DS.chip(sel.bgHex) + ' ' + esc(sel.p.bg.name) + ' <code>' + sel.bgHex + '</code>' + (sel.p.moon ? '　' + DS.chip(sel.moonHex, 'round') + ' ' + esc(sel.p.moon.name) : '') + '<br><small>' + L.statusLabel(sel.s.status) + (sel.s.slot ? '　' + L.fmtSlot(sel.s.slot) : '　投稿枠なし') + '</small></p>' +
          (selClashes.length ? '<p class="warnline">色が近い投稿：' + selClashes.map((c) => nameOf((c.a.s.id === sel.s.id ? c.b : c.a).s)).join('、') + '</p>' : '') +
          '<div class="row">' +
          (sel.s.slot ? '' : '<button class="btn small" data-action="gridMove" data-dir="1">← 新しい側へ</button><button class="btn small" data-action="gridMove" data-dir="-1">古い側へ →</button>') +
          '<button class="btn small ghost" data-action="openSubject" data-id="' + sel.s.id + '">制作画面を開く</button></div></div>'
        : '') +

      '<div class="card"><label class="f"><span>タイルの比率</span><select data-change="gridAspect">' + aspects.map(([v, label]) => '<option value="' + v + '"' + (ui.gridAspect === v ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></label>' +
      '<p class="hint">マスター画像を読み込んでいない投稿は、背景色と月の色だけのタイルで表示します。</p></div>' +
      '</div></div></div>'
    );
  };

  A.gridSel = (el) => {
    const ui = DS.state.ui;
    ui.gridSel = ui.gridSel === el.dataset.id ? null : el.dataset.id;
    changed();
  };
  A.gridAspect = (el) => {
    DS.state.ui.gridAspect = el.value;
    changed();
  };
  A.gridTentSubject = (el) => {
    const s = byId(el.value);
    if (!s) DS.state.ui.gridTentative = null;
    else {
      const ps = L.patternsOf(s).filter((x) => x.bg);
      DS.state.ui.gridTentative = { sid: s.id, pid: (ps.find((x) => !x.isMaster) || ps[0]).id };
      DS.state.ui.gridSel = s.id;
    }
    changed();
  };
  A.gridTentPattern = (el) => {
    DS.state.ui.gridTentative.pid = el.dataset.pid;
    changed();
  };
  A.gridMove = (el) => {
    const s = byId(DS.state.ui.gridSel);
    if (!s || s.slot) return;
    const undated = L.sortedForGrid(DS.state.subjects.filter((x) => !x.slot && x.masterId));
    const other = undated[undated.findIndex((x) => x.id === s.id) + +el.dataset.dir];
    if (!other) return DS.toast('これ以上は動かせません', 'warn');
    const tmp = s.seq;
    s.seq = other.seq;
    other.seq = tmp;
    changed();
  };

  /* ================= 写真ストック ================= */

  function stockCard(s, n) {
    const photo = s.refPhotos[0];
    return (
      '<div class="stock-card" data-sid="' + s.id + '">' +
      '<div class="stock-photo">' +
      (photo
        ? '<img data-img="' + photo + '" data-action="zoom" data-id="' + photo + '" alt="">' + (s.refPhotos.length > 1 ? '<em class="tag">' + s.refPhotos.length + '枚</em>' : '')
        : '<label class="dropzone plain"><span>参考写真なし<br><small>クリックして追加</small></span><input type="file" accept="image/*" multiple hidden data-file="stockPhoto"></label>') +
      (n ? '<span class="order">' + n + '</span>' : '') +
      '<span class="stock-moon">' + DS.moon(Math.min(L.stage(s), 4), 22) + '</span>' +
      '</div><div class="stock-body">' +
      '<input type="text" class="stock-name" data-bind="name" value="' + esc(s.name) + '" placeholder="題材名を入力">' +
      '<div class="row">' + DS.badge(s) + '<span class="' + (s.slot ? '' : 'muted') + '">' + (s.slot ? L.fmtSlot(s.slot) : '枠未定') + '</span></div>' +
      '<div class="row">' + (s.slot || s.status === 'posted' ? '' : '<button class="btn small" data-action="stockSlot" data-id="' + s.id + '">次の空き枠へ</button>') +
      '<button class="btn small ghost" data-action="openSubject" data-id="' + s.id + '" data-tab="info">制作する →</button></div>' +
      '</div></div>'
    );
  }

  DS.views.stock = function () {
    const subs = DS.state.subjects;
    const slotted = subs.filter((s) => s.slot && s.status !== 'posted').sort((a, b) => (a.slot < b.slot ? -1 : 1));
    const waiting = subs.filter((s) => !s.slot && s.status !== 'posted').sort((a, b) => a.seq - b.seq);
    const posted = L.sortedForGrid(subs.filter((s) => s.status === 'posted')).reverse();
    const next = L.upcomingSlots(3).map((d) => {
      const at = L.subjectsAt(d);
      return '<li><small>' + L.fmtSlot(d) + '</small>' + (at.length ? at.map((s) => '<b>' + nameOf(s) + '</b> ' + DS.badge(s)).join('、') : '<b class="warnline">未定</b>') + '</li>';
    });
    return (
      '<div class="page"><div class="page-head"><div class="eyebrow">PHOTO STOCK</div><h1>次に描く建物を、ためておく</h1></div>' +
      '<ul class="nextlist">' + next.join('') + '</ul>' +
      '<label class="dropzone wide" data-drop="stockAdd"><span><b>参考写真をここにドロップ</b>、またはクリックして選択<br><small>1枚につき1つ、「未着手」の題材として登録します（題材名はあとで直せます）</small></span><input type="file" accept="image/*" multiple hidden data-file="stockAdd"></label>' +
      '<section class="sec"><div class="sec-head"><h2>投稿枠が決まっているもの</h2><span class="hint">' + slotted.length + ' 件</span></div><div class="stock">' + (slotted.map((s) => stockCard(s)).join('') || '<p class="empty">ありません。</p>') + '</div></section>' +
      '<section class="sec"><div class="sec-head"><h2>枠待ちのストック</h2><span class="hint">' + waiting.length + ' 件　／　登録順</span></div><div class="stock">' + (waiting.map((s, i) => stockCard(s, i + 1)).join('') || '<p class="empty">ストックは空です。写真を入れておくと、次の題材に困りません。</p>') + '</div></section>' +
      '<details class="sec"><summary>投稿済み（' + posted.length + '）</summary><div class="stock">' + posted.map((s) => stockCard(s)).join('') + '</div></details></div>'
    );
  };

  DS.fileActions.stockAdd = async (files) => {
    for (const f of files) {
      const id = await DS.images.put(f);
      DS.state.subjects.push(DS.newSubject({ name: (f.name || '').replace(/\.[^.]+$/, ''), refPhotos: [id] }));
    }
    changed();
    DS.toast(files.length + '件をストックに登録しました');
  };
  DS.fileActions.stockPhoto = async (files, el) => {
    const s = byId(el.closest('[data-sid]').dataset.sid);
    for (const f of files) s.refPhotos.push(await DS.images.put(f));
    changed();
  };
  A.stockSlot = (el) => {
    const s = byId(el.dataset.id);
    s.slot = L.nextFreeSlot();
    changed();
    DS.toast(L.fmtSlot(s.slot) + ' の枠に入れました');
  };

  /* ================= 和色 ================= */

  DS.views.colors = function () {
    const usedList = L.usedList();
    const used = L.usedColors();
    const custom = DS.state.customColors;
    const groups = [];
    C.all().forEach((c) => {
      const g = c.group || '追加した色';
      let grp = groups.find((x) => x.name === g);
      if (!grp) groups.push((grp = { name: g, items: [] }));
      grp.items.push(c);
    });
    const sw = (c) => {
      const u = used.get(c.name);
      return (
        '<div class="swatch static' + (u ? ' used' : '') + '" title="' + esc((c.en || '') + (c.gloss ? ' — ' + c.gloss : '')) + '"><span class="sw-color" style="background:' + c.hex + '">' + (u ? '<em>済</em>' : '') + '</span>' +
        '<span class="sw-name">' + esc(c.name) + '</span><span class="sw-hex">' + c.hex + '</span>' + (u ? '<span class="sw-used">' + esc(u.join('、')) + '</span>' : '') + '</div>'
      );
    };
    return (
      '<div class="page"><div class="page-head"><div class="eyebrow">WAIRO</div><h1>和色の見本帳</h1></div>' +
      '<section class="sec"><div class="sec-head"><h2>これまでの背景色</h2><span class="hint">投稿順（左が古い）　／　マスターが決まると自動で加わります</span></div>' +
      '<div class="band">' + usedList.map((u, i) => '<div class="rb" style="background:' + (u.measuredHex || u.hex) + ';color:' + C.textOn(u.measuredHex || u.hex) + '" title="' + esc(u.subject.name) + '"><small>' + (i + 1) + '</small><b>' + esc(u.name) + '</b><span>' + esc(u.subject.name) + '</span></div>').join('') + '</div>' +
      '<label class="f" data-scope="settings"><span>使用済みの色についてのメモ</span><textarea data-bind="usedNote" rows="2">' + esc(DS.state.settings.usedNote) + '</textarea></label></section>' +
      '<section class="sec"><div class="sec-head"><h2>和色リスト</h2><span class="hint">' + C.all().length + ' 色　／　「済」は背景に使用済み</span></div>' +
      groups.map((g) => '<h4>' + esc(g.name) + '</h4><div class="swatches large">' + g.items.map(sw).join('') + '</div>').join('') +
      '<p class="hint">HEXは一般に流通している代表値です（出典によって少し差があります）。直したい場合は、下で同じ色名を登録すると上書きできます。</p></section>' +
      '<div class="card"><h3>色を追加・上書きする</h3><div class="grid4">' +
      '<label class="f"><span>色名（日本語）</span><input type="text" id="cc-name" placeholder="例：青鈍"></label>' +
      '<label class="f"><span>ローマ字 <small>ファイル名・キャプション用</small></span><input type="text" id="cc-en" placeholder="Aonibi"></label>' +
      '<label class="f"><span>英語の説明 <small>任意</small></span><input type="text" id="cc-gloss" placeholder="bluish grey"></label>' +
      '<label class="f"><span>HEX</span><input type="text" id="cc-hex" placeholder="#6b7b6e"></label>' +
      '</div><button class="btn primary" data-action="colorAdd">登録する</button>' +
      (custom.length
        ? '<ul class="customlist">' + custom.map((c) => '<li>' + DS.chip(c.hex, 'big') + ' <b>' + esc(c.name) + '</b> ' + esc(c.en || '') + ' <code>' + c.hex + '</code> <button class="btn small ghost" data-action="colorRemove" data-name="' + esc(c.name) + '">削除</button></li>').join('') + '</ul>'
        : '') +
      '</div></div>'
    );
  };

  A.colorAdd = () => {
    const name = $('#cc-name').value.trim();
    const hex = C.safe($('#cc-hex').value);
    const en = $('#cc-en').value.trim();
    if (!name) return DS.toast('色名を入れてください', 'warn');
    if (!hex) return DS.toast('HEXは #83ccd2 のような形式で入れてください', 'warn');
    const base = DS.WAIRO.find((c) => c.name === name);
    const color = { name, hex, en: en || (base ? base.en : ''), gloss: $('#cc-gloss').value.trim() || (base ? base.gloss : ''), group: base ? base.group : '追加した色' };
    DS.state.customColors = DS.state.customColors.filter((c) => c.name !== name).concat(color);
    changed();
    DS.toast('「' + name + '」を登録しました');
  };
  A.colorRemove = (el) => {
    DS.state.customColors = DS.state.customColors.filter((c) => c.name !== el.dataset.name);
    changed();
  };

  /* ================= 設定 ================= */

  DS.views.settings = function () {
    const st = DS.state.settings;
    const f = (label, key) => '<label class="f"><span>' + label + '</span><input type="text" data-bind="' + key + '" value="' + esc(st[key]) + '"></label>';
    return (
      '<div class="page narrow" data-scope="settings"><div class="page-head"><div class="eyebrow">SETTINGS</div><h1>設定</h1></div>' +
      '<div class="card"><h3>共通プロンプト</h3><textarea data-bind="promptTemplate" rows="14" class="prompt">' + esc(st.promptTemplate) + '</textarea>' +
      '<p class="hint">差し替え箇所は <code>【建物の説明文】</code> <code>【月の色】</code> <code>【背景色】</code> の3つです。この3つの文字列は消さないでください。</p>' +
      '<div class="row"><label class="check"><input type="checkbox" data-bind="includeHex"' + (st.includeHex ? ' checked' : '') + '> 色名にHEXを併記する（例：白群（#83ccd2））</label>' +
      '<button class="btn small ghost" data-action="promptReset">初期の文面に戻す</button></div></div>' +
      '<div class="card"><h3>キャプション</h3>' +
      f('固定タグ（英語）', 'fixedTags') + f('日本語タグ', 'jpTags') + f('AI開示の一文（英語）', 'disclosureEn') + f('AI開示の一文（日本語）', 'disclosureJa') + f('アカウント名 <small>データカードとグリッドに表示</small>', 'handle') +
      '</div>' +
      '<div class="card"><h3>バックアップ</h3><p class="hint">データはこのブラウザの中（localStorage と IndexedDB）にだけ保存されています。ブラウザのデータを消すと失われるので、ときどきファイルに書き出しておくと安心です。</p>' +
      '<div class="row"><button class="btn" data-action="exportAll" data-images="1">書き出す（画像を含む）</button><button class="btn" data-action="exportAll">書き出す（画像なし・軽い）</button>' +
      '<label class="btn">バックアップから読み込む<input type="file" accept="application/json,.json" hidden data-file="importAll"></label></div></div>' +
      '<div class="card"><h3>サンプルデータ</h3><p class="hint">使用済みの背景色と、題材サンプル（プレミアホテル門司港）が入った初期状態に戻します。いま入っているデータと画像はすべて消えます。</p>' +
      '<button class="btn danger" data-action="resetSample">初期のサンプルデータに戻す</button></div></div>'
    );
  };

  A.promptReset = () => {
    if (!confirm('共通プロンプトを初期の文面に戻します。よろしいですか？')) return;
    DS.state.settings.promptTemplate = DS.DEFAULT_PROMPT;
    changed();
  };
  A.exportAll = async (el) => {
    const blob = await DS.exportAll(!!el.dataset.images);
    DS.download(blob, 'drawing-support-backup-' + DS.ymd(new Date()) + '.json');
  };
  DS.fileActions.importAll = async (files) => {
    if (!confirm('いまのデータをすべて、バックアップの内容で置き換えます。よろしいですか？')) return;
    try {
      await DS.importAll(files[0]);
      DS.render();
      DS.toast('バックアップを読み込みました');
    } catch (err) {
      DS.toast('読み込めませんでした：' + err.message, 'danger');
    }
  };
  A.resetSample = async () => {
    if (!confirm('すべてのデータと画像を消して、初期のサンプルデータに戻します。元に戻せません。よろしいですか？')) return;
    await DS.resetToSample();
    DS.render();
    DS.toast('サンプルデータに戻しました');
  };
})();
