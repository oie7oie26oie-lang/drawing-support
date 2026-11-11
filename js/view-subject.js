/* 制作画面：ポスターの下絵を横に置いたまま、6つの工程を進める
   基本情報 → 色と組み合わせ → プロンプト → 候補とマスター → キャプション → データカード */
(function () {
  'use strict';
  const DS = window.DS;
  const L = DS.logic;
  const C = DS.color;
  const esc = DS.esc;
  const $ = DS.$;

  const TABS = [
    ['info', '建物'],
    ['colors', '色と組み合わせ'],
    ['prompt', 'プロンプト'],
    ['cands', '候補とマスター'],
    ['caption', 'キャプション'],
    ['card', 'データカード'],
  ];
  const BG_IDS = ['A', 'B', 'C'];
  const STATE_LABEL = { none: '未生成', done: '済', master: '★ マスター' };

  const notice = (text, cls) => '<div class="notice ' + (cls || '') + '">' + text + '</div>';
  const complete = (s) => L.patternsOf(s).filter((p) => p.bg && p.moon);
  const nameOf = (s) => esc(s.name || '（無題）');

  function changed(rerender) {
    DS.save();
    if (rerender !== false) DS.render();
  }

  /** 横のポスターに出すパターン */
  function previewOf(s) {
    const pv = DS.state.ui.preview;
    const ps = L.patternsOf(s).filter((p) => p.bg);
    return (pv && pv.sid === s.id && ps.find((p) => p.id === pv.pid)) || L.featured(s);
  }

  function stepDone(s, id) {
    if (id === 'info') return !!s.name;
    if (id === 'colors') return complete(s).length > 0;
    if (id === 'prompt') return L.patternsOf(s).some((p) => p.state !== 'none');
    if (id === 'cands') return !!s.masterId;
    if (id === 'caption') return !!s.captionCopied;
    return !!s.cardSaved;
  }

  /* ---------- 題材の棚（左） ---------- */

  function listItem(s) {
    const on = DS.state.ui.subjectId === s.id;
    return (
      '<button class="sitem' + (on ? ' on' : '') + '" data-action="openSubject" data-id="' + s.id + '">' + DS.posterOf(s) +
      '<span class="sname">' + nameOf(s) + '</span>' +
      '<span class="smeta">' + DS.moon(Math.min(L.stage(s), 4), 14) + L.statusLabel(s.status) + '　' + (s.slot ? L.fmtSlot(s.slot).replace(' 7:00', '') : '枠未定') + '</span></button>'
    );
  }

  function subjectListHtml() {
    const subs = DS.state.subjects;
    const active = subs.filter((s) => s.status !== 'posted').sort((a, b) => {
      if (!!a.slot !== !!b.slot) return a.slot ? -1 : 1;
      if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
      return b.seq - a.seq;
    });
    const posted = L.sortedForGrid(subs.filter((s) => s.status === 'posted')).reverse();
    const openPosted = posted.some((s) => s.id === DS.state.ui.subjectId);
    return (
      '<h4>制作中 ' + active.length + '</h4>' + (active.map(listItem).join('') || '<p class="empty">制作中の題材はありません。</p>') +
      '<details' + (openPosted ? ' open' : '') + '><summary>投稿済み ' + posted.length + '</summary>' + posted.map(listItem).join('') + '</details>'
    );
  }

  /** 入力のたびに呼ばれる軽い更新（フォーカスを奪わない） */
  DS.softRefresh = function () {
    const list = $('#subject-list');
    if (list) list.innerHTML = subjectListHtml();
    const s = DS.current();
    const top = $('#work-top');
    if (top && s) top.innerHTML = headInner(s, currentTab());
    const stage = $('#stage');
    if (stage && s) {
      stage.innerHTML = stageInner(s);
      DS.hydrate(stage);
    }
    DS.renderNextSlot();
  };

  /* ---------- ポスターの下絵（常に横に出す） ---------- */

  function stageInner(s) {
    const pv = previewOf(s);
    const ps = L.patternsOf(s).filter((p) => p.bg);
    return (
      '<div class="stage-poster">' + DS.posterOf(s, 'big', pv && pv.id) + '</div>' +
      (pv
        ? '<div class="plate"><div class="plate-id"><b>' + pv.id + '</b>' + (pv.isMaster ? '<span class="star">★ マスター</span>' : '') + '</div>' +
          '<div class="plate-colors"><span>' + DS.chip(pv.bg.hex) + esc(pv.bg.name) + '<code>' + pv.bg.hex + '</code></span>' +
          (pv.moon ? '<span>' + DS.chip(pv.moon.hex, 'round') + esc(pv.moon.name) + '<code>' + pv.moon.hex + '</code></span>' : '<span class="muted">月の色が未設定</span>') + '</div></div>'
        : '<div class="plate muted">色を選ぶと、ここにポスターの下絵が現れます。</div>') +
      (ps.length > 1
        ? '<div class="pv-strip">' + ps.map((p) => '<button class="pv' + (pv && pv.id === p.id ? ' on' : '') + '" data-action="previewSet" data-pid="' + p.id + '" title="' + esc(p.bg.name + (p.moon ? ' × ' + p.moon.name : '')) + '">' + DS.posterOf(s, '', p.id) + '<span>' + p.id + (p.isMaster ? '★' : '') + '</span></button>').join('') + '</div>'
        : '')
    );
  }

  /* ---------- ① 建物 ---------- */

  function field(label, bind, value, attrs) {
    return '<label class="f"><span>' + label + '</span><input type="text" data-bind="' + bind + '" value="' + esc(value) + '" ' + (attrs || '') + '></label>';
  }

  function colorField(label, path, o) {
    const hex = C.safe(o.hex);
    return (
      '<div class="f"><span>' + label + '</span><div class="colorfield">' +
      '<input type="color" data-bind="' + path + '.hex" data-input="colorTouched" value="' + (hex || '#cccccc') + '" class="' + (hex ? '' : 'unset') + '">' +
      '<input type="text" data-bind="' + path + '.name" value="' + esc(o.name) + '" placeholder="色名（例：煉瓦色）">' +
      '<code class="hexcode">' + (hex || '未設定') + '</code></div></div>'
    );
  }

  function tabInfo(s) {
    const dup = s.slot ? L.subjectsAt(s.slot).filter((x) => x.id !== s.id) : [];
    return (
      '<div class="card"><h3>建物</h3><div class="grid2">' +
      field('題材（建物名）', 'name', s.name, 'placeholder="例：プレミアホテル門司港"') +
      field('英語表記 <small>キャプション用</small>', 'nameEn', s.nameEn, 'placeholder="Premier Hotel Mojiko"') +
      field('設計者', 'architect', s.architect) +
      field('設計者（英語） <small>キャプション用</small>', 'architectEn', s.architectEn) +
      field('竣工年', 'year', s.year, 'inputmode="numeric" placeholder="1998"') +
      '<span></span>' +
      field('場所', 'location', s.location) +
      field('場所（英語） <small>キャプション用</small>', 'locationEn', s.locationEn, 'placeholder="City, Country"') +
      colorField('建物自体の色：主色', 'buildingMain', s.buildingMain) +
      colorField('建物自体の色：副色', 'buildingSub', s.buildingSub) +
      '</div><p class="hint">建物の色は、横の下絵にすぐ反映されます。「色と組み合わせ」の色サンプリングで参考写真から拾うこともできます。</p></div>' +

      '<div class="card"><h3>参考写真</h3><div class="photos" data-drop="refAdd">' +
      s.refPhotos.map((id) => '<div class="photo"><img data-img="' + id + '" data-action="zoom" data-id="' + id + '" alt=""><button class="x" data-action="refRemove" data-id="' + id + '" title="この写真を削除">×</button></div>').join('') +
      '<label class="photo add"><span>＋ 写真を追加<br><small>ドロップも可</small></span><input type="file" accept="image/*" multiple hidden data-file="refAdd"></label>' +
      '</div><p class="hint">写真はこのブラウザの中だけに保存されます。ChatGPTへは自分で添付してください。</p></div>' +

      '<div class="card"><h3>投稿枠とステータス</h3><div class="grid2">' +
      '<div class="f"><span>投稿枠（毎朝 7:00）</span><div class="row"><input type="date" data-bind="slot" value="' + esc(s.slot) + '"><b>7:00</b>' +
      '<button class="btn small" data-action="slotNext">次の空き枠</button>' + (s.slot ? '<button class="btn small ghost" data-action="slotUnset">枠を外す</button>' : '') + '</div>' +
      (dup.length ? '<p class="warnline">同じ枠に別の題材があります：' + esc(dup.map((x) => x.name).join('、')) + '</p>' : '') + '</div>' +
      '<label class="f"><span>ステータス</span><select data-change="statusSet">' +
      DS.STATUS.map((x) => '<option value="' + x.id + '"' + (x.id === s.status ? ' selected' : '') + '>' + x.label + '</option>').join('') +
      '</select></label></div>' +
      '<p class="hint">ステータスは制作を進めると自動で変わります。ここで手動で直すこともできます。</p></div>' +

      '<div class="card"><h3>メモ</h3><textarea data-bind="note" rows="2" placeholder="制作メモ">' + esc(s.note) + '</textarea>' +
      '<div class="row end"><button class="btn danger small" data-action="subjectDelete">この題材を削除</button></div></div>'
    );
  }

  /* ---------- ② 色と組み合わせ ---------- */

  function chipHtml(kind, i, s, used) {
    const c = C.find(s[kind][i]);
    const id = kind === 'bg' ? BG_IDS[i] : '月 ' + (i + 1);
    const pick = ' data-action="slotPick" data-kind="' + kind + '" data-i="' + i + '"';
    if (!c) {
      return '<div class="pchip-wrap"><button class="pchip empty ' + kind + '"' + pick + '><span class="pchip-id">' + id + '</span><span class="pchip-plus">＋</span><span class="pchip-hint">' + (kind === 'bg' ? '背景色を選ぶ' : '月の色を選ぶ') + '</span></button></div>';
    }
    const u = kind === 'bg' && used.get(c.name);
    const sky = kind === 'moon' ? (C.find(s.bg[0]) || {}).hex || '#141a2c' : c.hex;
    return (
      '<div class="pchip-wrap"><button class="pchip ' + kind + '" style="--c:' + sky + ';--k:' + C.textOn(sky) + '"' + pick + ' title="押して選び直す">' +
      '<span class="pchip-id">' + id + '</span>' + (kind === 'moon' ? '<i class="pchip-disc" style="background:' + c.hex + '"></i>' : '') +
      '<span class="pchip-name">' + esc(c.name) + '</span><span class="pchip-en">' + esc(c.en || '') + '</span><span class="pchip-hex">' + c.hex + '</span></button>' +
      '<button class="pchip-x" data-action="slotClear" data-kind="' + kind + '" data-i="' + i + '" title="外す">×</button>' +
      (u ? '<p class="warnline">背景に使用済み：' + esc(u.join('、')) + '</p>' : '') + '</div>'
    );
  }

  function cellHtml(s, p) {
    const pos = ' style="grid-column:' + (p.bgIdx + 1) + ';grid-row:' + (p.moonIdx + 1) + '"';
    if (!p.bg || !p.moon) return '<div class="cell blank"' + pos + '><b>' + p.id + '</b><small>色が未設定</small></div>';
    return (
      '<div class="cell st-' + p.state + '"' + pos + '>' +
      '<button class="cell-poster" data-action="previewSet" data-pid="' + p.id + '" title="横の下絵に大きく出す">' + DS.posterOf(s, '', p.id) + '<span class="ribbon">' + STATE_LABEL[p.state] + '</span></button>' +
      '<div class="cell-meta"><b class="pid">' + p.id + '</b><span class="pnames">' + esc(p.bg.name) + ' × ' + esc(p.moon.name) + '</span></div>' +
      '<div class="cell-btns">' +
      (p.imageId || p.isMaster ? '' : '<button class="btn small" data-action="patToggle" data-pid="' + p.id + '">' + (p.state === 'none' ? '済にする' : '未生成に戻す') + '</button>') +
      '<button class="btn small' + (p.isMaster ? ' primary' : '') + '" data-action="patMaster" data-pid="' + p.id + '">' + (p.isMaster ? '★ 解除' : '★ マスターに') + '</button>' +
      '</div></div>'
    );
  }

  function tabColors(s) {
    const used = L.usedColors(s.id);
    const ps = L.patternsOf(s);
    const m = L.masterOf(s);
    const sel = Math.min(DS.state.ui.sampIndex || 0, Math.max(0, s.refPhotos.length - 1));
    return (
      '<div class="card"><h3>背景色 <small>和色から3つ</small></h3><div class="pchips">' + [0, 1, 2].map((i) => chipHtml('bg', i, s, used)).join('') + '</div>' +
      '<h3 class="mt">月の色 <small>2つ</small></h3><div class="pchips">' + [0, 1].map((i) => chipHtml('moon', i, s, used)).join('') + '<span></span></div></div>' +

      '<div class="card"><h3>組み合わせ表 <small>A / A2 / B / B2 / C / C2</small></h3><div class="sheet">' + ps.map((p) => cellHtml(s, p)).join('') + '</div>' +
      '<p class="hint">下絵は色の並びを確かめるための模式図です。候補画像を読み込むと画像に置き換わります。下絵を押すと横に大きく出ます。</p>' +
      (m
        ? '<div class="row"><label class="f inline"><span>マスターの仕上がり実測色（任意）</span><input type="text" data-bind="measuredHex" value="' + esc(s.measuredHex) + '" placeholder="例：#1f8f8f" size="10"></label>' +
          '<span class="hint">生成結果の背景色が色名のHEXとずれた場合に入れると、グリッドではこちらの色で表示します。</span></div>'
        : '') +
      '</div>' +

      '<div class="card"><h3>参考写真からの色サンプリング</h3>' +
      (s.refPhotos.length
        ? '<div class="sampling"><div class="samp-photo">' +
          (s.refPhotos.length > 1
            ? '<div class="thumbs">' + s.refPhotos.map((id, i) => '<button class="thumb' + (i === sel ? ' on' : '') + '" data-action="sampSelect" data-i="' + i + '"><img data-img="' + id + '" alt=""></button>').join('') + '</div>'
            : '') +
          '<canvas id="samp-canvas"></canvas><p class="hint">写真をクリックすると、その位置の色を拾えます。</p><div id="samp-picked"></div></div>' +
          '<div id="samp-out" class="samp-out"><p class="empty">解析中…</p></div></div>'
        : notice('「建物」で参考写真を追加すると、主要色の抽出と組み合わせの叩き台が表示されます。')) +
      '</div>'
    );
  }

  let lastSuggestion = null;

  function sampSwatch(c) {
    const near = C.nearest(c.hex);
    const name = near.d < 15 ? near.color.name : '';
    const btn = (which, label) => '<button class="btn small ghost" data-action="sampSet" data-which="' + which + '" data-hex="' + c.hex + '" data-name="' + esc(name) + '">' + label + '</button>';
    return (
      '<div class="samp-sw"><span class="sw-block" style="background:' + c.hex + '"></span><div class="samp-txt"><code>' + c.hex + '</code>' +
      (c.ratio != null ? ' <small>' + Math.round(c.ratio * 100) + '%</small>' : '') + '<br><small>近い和色：' + esc(near.color.name) + '</small></div>' +
      '<div class="samp-btns">' + btn('buildingMain', '主色に') + btn('buildingSub', '副色に') + '</div></div>'
    );
  }

  function sampHtml(res, sg, s) {
    const li = (x, id) => '<li><b>' + id + '</b> ' + DS.chip(x.c.hex, id.charAt(0) === '月' ? 'round' : '') + ' <b>' + esc(x.c.name) + '</b> <code>' + x.c.hex + '</code><br><small>' + esc(x.reason) + '</small></li>';
    let tiles = '';
    sg.bg.forEach((b, i) => {
      sg.moon.forEach((m, j) => {
        tiles += DS.poster({ bg: b.c.hex, moon: m.c.hex, main: sg.mainHex, sub: sg.subHex, label: BG_IDS[i] + (j ? '2' : '') });
      });
    });
    return (
      '<h4>中央部の主要色 <small>建物の色の目安</small></h4><div class="samp-list">' + res.center.map(sampSwatch).join('') + '</div>' +
      '<h4>写真全体の主要色</h4><div class="samp-list">' + res.all.map(sampSwatch).join('') + '</div>' +
      '<h4>組み合わせの叩き台</h4>' +
      '<p class="hint">建物の主色 ' + DS.chip(sg.mainHex) + ' <code>' + sg.mainHex + '</code>' + (C.safe(s.buildingMain.hex) ? '（「建物」の値）' : '（写真中央部から推定）') +
      ' を基準に、背景に未使用の和色から選んでいます。鮮やかな赤は除外しています。</p>' +
      (sg.bg.length
        ? '<div class="sugg-tiles">' + tiles + '</div>' +
          '<ul class="sugg">' + sg.bg.map((x, i) => li(x, BG_IDS[i])).join('') + sg.moon.map((x, j) => li(x, '月' + (j + 1))).join('') + '</ul>' +
          '<button class="btn primary" data-action="sampApply">この叩き台を組み合わせ表に入れる</button>'
        : notice('条件に合う和色が見つかりませんでした。'))
    );
  }

  async function runSampling(s) {
    if (!$('#samp-out')) return;
    const idx = Math.min(DS.state.ui.sampIndex || 0, s.refPhotos.length - 1);
    try {
      const res = await DS.sampling.analyze(s.refPhotos[idx]);
      const out = $('#samp-out');
      const cv = $('#samp-canvas');
      if (!out || !cv || DS.current() !== s) return;
      cv.width = 480;
      cv.height = Math.round((480 * res.img.naturalHeight) / res.img.naturalWidth);
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(res.img, 0, 0, cv.width, cv.height);
      cv.onclick = (e) => {
        const r = cv.getBoundingClientRect();
        const x = Math.round(((e.clientX - r.left) / r.width) * cv.width);
        const y = Math.round(((e.clientY - r.top) / r.height) * cv.height);
        const d = ctx.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
        let sum = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) sum = [sum[0] + d[i], sum[1] + d[i + 1], sum[2] + d[i + 2]];
        const n = d.length / 4;
        $('#samp-picked').innerHTML = '<h4>拾った色</h4>' + sampSwatch({ hex: C.hex(sum[0] / n, sum[1] / n, sum[2] / n) });
      };
      lastSuggestion = DS.sampling.suggest(res, s);
      out.innerHTML = sampHtml(res, lastSuggestion, s);
    } catch (err) {
      const out = $('#samp-out');
      if (out) out.innerHTML = notice(esc(err.message), 'warn');
    }
  }

  /* ---------- ③ プロンプト ---------- */

  function promptOut(s) {
    const ps = complete(s);
    const onlyTodo = !!DS.state.ui.batchOnlyTodo;
    const batch = onlyTodo ? ps.filter((p) => p.state === 'none') : ps;
    return (
      '<div class="card feature"><div class="row between"><h3>統合プロンプト <small>' + batch.length + 'パターンを一括で</small></h3>' +
      '<div class="row"><label class="check"><input type="checkbox" data-change="batchOnlyTodo"' + (onlyTodo ? ' checked' : '') + '> 未生成のパターンだけ</label>' +
      '<button class="btn primary" data-action="copy" data-target="#p-batch"' + (batch.length ? '' : ' disabled') + '>統合プロンプトをコピー</button></div></div>' +
      (batch.length ? '<textarea id="p-batch" class="prompt" readonly rows="14">' + esc(L.batchPrompt(s, batch)) + '</textarea>' : notice('未生成のパターンはありません。')) +
      '</div>' +
      '<div class="prompts">' +
      ps
        .map(
          (p) =>
            '<div class="card pcard st-' + p.state + '"><div class="pcard-head"><button class="pcard-poster" data-action="previewSet" data-pid="' + p.id + '">' + DS.posterOf(s, '', p.id) + '</button>' +
            '<div><b class="pid">' + p.id + '</b><span class="pstate">' + STATE_LABEL[p.state] + '</span><br><span class="pnames">' + esc(p.bg.name) + ' × ' + esc(p.moon.name) + '</span></div>' +
            '<span class="sep"></span><button class="btn primary" data-action="copy" data-target="#p-' + p.id + '">' + p.id + ' をコピー</button></div>' +
            '<textarea id="p-' + p.id + '" class="prompt" readonly rows="8">' + esc(L.prompt(s, p)) + '</textarea>' +
            '<p class="hint">保存するときのファイル名：<code>' + esc(L.candidateFilename(s, p)) + '</code></p></div>'
        )
        .join('') +
      '</div>'
    );
  }

  function tabPrompt(s) {
    if (!complete(s).length) return notice('先に「色と組み合わせ」で背景色と月の色を選んでください。');
    return (
      '<div class="card"><h3>建物の説明文 <small>共通プロンプトの【建物の説明文】に入ります</small></h3>' +
      '<textarea data-bind="description" data-input="promptRefresh" rows="3" placeholder="' + esc(L.autoDescription(s)) + '">' + esc(s.description) + '</textarea>' +
      '<div class="row"><span class="hint">空欄のときは、「建物」の内容から自動で作った文（薄く表示されている文）を使います。</span>' +
      '<button class="btn small" data-action="descFill">自動の文を入れて編集する</button></div>' +
      '<p class="hint">生成はこのアプリの外（ChatGPT）で行います。参考写真を添付して、下のプロンプトを貼り付けてください。共通プロンプトの文面は「設定」で編集できます。</p></div>' +
      '<div id="prompt-out">' + promptOut(s) + '</div>'
    );
  }

  /* ---------- ④ 候補とマスター ---------- */

  function candCard(s, p) {
    const caption = p.id + '　' + p.bg.name + ' × ' + p.moon.name;
    return (
      '<div class="cand st-' + p.state + '" style="grid-column:' + (p.bgIdx + 1) + ';grid-row:' + (p.moonIdx + 1) + '">' +
      '<div class="cand-head"><b>' + p.id + '</b><span>' + DS.chip(p.bg.hex) + esc(p.bg.name) + ' × ' + DS.chip(p.moon.hex, 'round') + esc(p.moon.name) + '</span>' + (p.isMaster ? '<span class="star">★ マスター</span>' : '') + '</div>' +
      '<div class="cand-img" data-drop="candImage" data-pid="' + p.id + '">' +
      (p.imageId
        ? '<img data-img="' + p.imageId + '" data-action="zoom" data-id="' + p.imageId + '" data-caption="' + esc(caption) + '" alt="' + esc(caption) + '">'
        : '<label class="dropzone" style="background:' + p.bg.hex + ';color:' + C.textOn(p.bg.hex) + '"><i class="moon" style="background:' + p.moon.hex + '"></i><span>画像をドロップ<br>またはクリックして選択</span><input type="file" accept="image/*" hidden data-file="candImage" data-pid="' + p.id + '"></label>') +
      '</div>' +
      '<div class="cand-file"><code id="fn-' + p.id + '">' + esc(L.candidateFilename(s, p)) + '</code><button class="btn small ghost" data-action="copy" data-target="#fn-' + p.id + '">名前をコピー</button></div>' +
      '<div class="cand-btns"><button class="btn' + (p.isMaster ? '' : ' primary') + '" data-action="patMaster" data-pid="' + p.id + '">' + (p.isMaster ? '★ マスター解除' : '★ これをマスターにする') + '</button>' +
      (p.imageId
        ? '<button class="btn small ghost" data-action="candSave" data-pid="' + p.id + '">この名前で保存</button><button class="btn small ghost" data-action="candRemove" data-pid="' + p.id + '">画像を外す</button>'
        : '') +
      '</div></div>'
    );
  }

  function tabCands(s) {
    const ps = complete(s);
    if (!ps.length) return notice('先に「色と組み合わせ」で背景色と月の色を選んでください。');
    const m = L.masterOf(s);
    return (
      (m && m.bg
        ? '<div class="masterbar" style="--c:' + m.bg.hex + ';--k:' + C.textOn(m.bg.hex) + '"><span class="star">★ マスター</span><b>' + m.id + '　' + esc(m.bg.name) + (m.moon ? ' × ' + esc(m.moon.name) : '') + '</b>' +
          '<span class="sep"></span><code id="fn-master">' + esc(L.masterFilename(s)) + '</code><button class="btn small onc" data-action="copy" data-target="#fn-master">名前をコピー</button>' +
          (m.imageId ? '<button class="btn small onc" data-action="candSave" data-pid="' + m.id + '" data-master="1">この名前で保存</button>' : '') +
          '<button class="btn small onc solid" data-action="tab" data-tab="caption">キャプションへ →</button></div>'
        : notice('候補を見比べて、いちばん良い1枚を「★ これをマスターにする」で決めてください。画像を押すと拡大できます。')) +
      '<div class="card row"><label class="btn">候補画像をまとめて読み込む<input type="file" accept="image/*" multiple hidden data-file="candBulk"></label>' +
      '<span class="hint">ファイル名に <code>candidate_A2_…</code> のようにパターンIDが入っていれば自動で振り分けます。IDが読み取れない画像は、空いている枠に順に入れます。</span></div>' +
      '<div class="cands">' + ps.map((p) => candCard(s, p)).join('') + '</div>'
    );
  }

  async function setPatternImage(s, pid, file) {
    const r = L.patternRec(s, pid);
    const old = r.imageId;
    r.imageId = await DS.images.put(file);
    r.done = true;
    if (old) await DS.images.remove(old);
    if (s.status === 'todo') L.setStatus(s, 'generating');
  }

  /* ---------- ⑤ キャプション ---------- */

  function captionCount(text) {
    const chars = Array.from(text).length;
    const tags = (text.match(/#[^\s#]+/g) || []).length;
    return '<span class="' + (chars > 2200 ? 'over' : '') + '">' + chars + ' / 2200 文字</span>　<span class="' + (tags > 30 ? 'over' : '') + '">タグ ' + tags + ' 個</span>';
  }

  /** Instagramの投稿風プレビュー用 */
  function igCaption(text) {
    const handle = esc((DS.state.settings.handle || '').replace(/^@/, ''));
    return '<b>' + handle + '</b> ' + esc(text).replace(/(#[^\s#<]+)/g, '<i>$1</i>').replace(/\n/g, '<br>');
  }

  function tabCaption(s) {
    const m = L.masterOf(s);
    if (!m || !m.bg) return notice('マスターが決まると、その色名を使ってキャプションを自動生成します。「候補とマスター」で決めてください。');
    const text = s.captionEdited != null ? s.captionEdited : L.caption(s);
    const handle = esc((DS.state.settings.handle || '').replace(/^@/, ''));
    return (
      '<div class="captab"><div>' +
      '<div class="card"><div class="row between"><h3>キャプション <small>英語 → 日本語</small></h3><span id="cap-count" class="count">' + captionCount(text) + '</span></div>' +
      '<textarea id="caption" class="caption" rows="20" data-input="captionEdit">' + esc(text) + '</textarea>' +
      '<div class="row between mt"><button class="btn small ghost" data-action="captionReset">自動生成に戻す</button>' +
      '<button class="btn primary big" data-action="copy" data-target="#caption" data-mark="captionCopied">キャプションをコピー</button></div>' +
      '<p class="hint" id="cap-note">' + (s.captionEdited != null ? '手で編集した内容を保持しています。入力値の変更を反映するには「自動生成に戻す」を押してください。' : '直接書き換えることもできます（書き換えた内容は保存されます）。') + '</p></div>' +
      '<div class="card"><h3>題材別の設定</h3>' +
      '<div class="f"><span>題材別タグ <small>設計者・都市・様式など（英語）。スペース区切り</small></span><div class="row"><input type="text" class="grow" data-bind="tags" data-input="captionRefresh" value="' + esc(s.tags) + '" placeholder="#aldorossi #kitakyushu #postmodernarchitecture">' +
      '<button class="btn small" data-action="tagsSuggest">設計者・場所から候補を追加</button></div></div>' +
      '<label class="check"><input type="checkbox" data-bind="aiGenerated" data-input="captionRefresh"' + (s.aiGenerated ? ' checked' : '') + '> AI生成が完成形の作品（開示の一文を入れる）</label>' +
      '<p class="hint">色の行はマスター（' + m.id + '：' + esc(m.bg.name) + (m.moon ? ' × ' + esc(m.moon.name) : '') + '）から入ります。英語表記は「建物」、固定タグと開示文は「設定」で変えられます。</p></div>' +
      '</div>' +
      '<div class="igpost"><div class="ig-head"><span class="avatar">' + DS.moon(4, 30) + '</span><b>' + handle + '</b></div>' +
      '<div class="ig-img">' + DS.posterOf(s, '', m.id) + '</div><div class="ig-cap" id="ig-cap">' + igCaption(text) + '</div></div></div>'
    );
  }

  /* ---------- ⑥ データカード ---------- */

  function tabCard(s) {
    const mode = DS.state.ui.cardBg || 'master';
    const opt = (v, label) => '<option value="' + v + '"' + (mode === v ? ' selected' : '') + '>' + label + '</option>';
    return (
      '<div class="cardtab"><div class="card"><h3>カルーセル2枚目のデータカード</h3>' +
      [0, 1, 2].map((i) => '<label class="f"><span>ポイント ' + (i + 1) + '</span><input type="text" data-bind="points.' + i + '" data-input="cardRedraw" value="' + esc(s.points[i]) + '"></label>').join('') +
      '<label class="f"><span>カードの背景</span><select data-change="cardBg">' + opt('master', 'マスターの背景色') + opt('light', '生成り（明るい）') + opt('dark', '墨（暗い）') + '</select></label>' +
      '<p class="hint">建物名・設計者・竣工年・場所は「建物」の内容が入ります。サイズは 1080×1350（4:5）です。</p>' +
      '<div class="row"><button class="btn primary big" data-action="cardDownload">PNGをダウンロード</button><code>' + esc(L.cardFilename(s)) + '</code></div></div>' +
      '<div class="cardpreview"><canvas id="datacard"></canvas></div></div>'
    );
  }

  /* ---------- 画面本体 ---------- */

  const TAB_HTML = { info: tabInfo, colors: tabColors, prompt: tabPrompt, cands: tabCands, caption: tabCaption, card: tabCard };
  const WIDE_TABS = { cands: true, caption: true, card: true }; // 自前の絵がある工程では横の下絵を畳む

  /** 見出し（月相・題材名・次の一手）と工程表。入力中にも差し替えられるよう分けてある */
  function headInner(s, tab) {
    const a = L.alert(s);
    const next = L.nextAction(s);
    const st = Math.min(L.stage(s), 4);
    return (
      '<div class="work-head"><div class="work-title"><div class="eyebrow">' + DS.moon(st, 16) + (s.status === 'posted' ? '投稿済み' : L.PHASES[st] + '　' + L.STAGES[st]) + '　・　' +
      (s.slot ? L.fmtSlot(s.slot) : '投稿枠は未定') + (s.slot && s.status !== 'posted' ? '　<span class="slotline ' + a.level + '">' + esc(a.text) + '</span>' : '') + '</div>' +
      '<h1 id="work-title">' + nameOf(s) + '</h1></div>' +
      (next && next.tab !== tab ? '<button class="btn primary next" data-action="nextStep"><small>次の一手</small>' + next.label + ' →</button>' : '') + '</div>' +
      '<div class="stepper">' + TABS.map(([id, label], i) => {
        const done = stepDone(s, id);
        return '<button class="step' + (tab === id ? ' on' : '') + (done ? ' done' : '') + '" data-action="tab" data-tab="' + id + '"><i>' + (done ? '✓' : i + 1) + '</i><span>' + label + '</span></button>';
      }).join('') + '</div>'
    );
  }

  const currentTab = () => (TAB_HTML[DS.state.ui.tab] ? DS.state.ui.tab : 'info');

  function workHtml(s) {
    const tab = currentTab();
    return (
      '<div id="work-top">' + headInner(s, tab) + '</div>' +
      '<div class="bench' + (WIDE_TABS[tab] ? ' wide' : '') + '">' + (WIDE_TABS[tab] ? '' : '<aside class="stage" id="stage">' + stageInner(s) + '</aside>') +
      '<div class="tabbody">' + TAB_HTML[tab](s) + '</div></div>'
    );
  }

  DS.views.subject = function () {
    const s = DS.current();
    return (
      '<div class="studio"><aside class="shelf"><button class="btn primary block" data-action="subjectNew">＋ 新しい題材</button><div id="subject-list">' + subjectListHtml() + '</div></aside>' +
      '<section class="work">' + (s ? workHtml(s) : '<div class="blankwork">' + DS.moon(0, 96) + '<h1>次は、どの建物を描きますか</h1><p class="hint">左の棚から題材を選ぶか、新しく作ってください。</p><button class="btn primary big" data-action="subjectNew">＋ 新しい題材</button></div>') + '</section></div>'
    );
  };

  DS.afterRender.subject = function () {
    const s = DS.current();
    if (!s) return;
    const tab = DS.state.ui.tab;
    if (tab === 'colors' && s.refPhotos.length) runSampling(s);
    if (tab === 'card') DS.datacard.draw($('#datacard'), s, DS.state.ui.cardBg);
  };

  /* ---------- アクション ---------- */

  const A = DS.actions;

  A.tab = (el) => {
    DS.state.ui.tab = el.dataset.tab;
    DS.closeModal();
    changed();
    window.scrollTo(0, 0);
  };

  A.nextStep = () => {
    const next = L.nextAction(DS.current());
    if (!next) return;
    if (next.tab) DS.state.ui.tab = next.tab;
    if (next.view) DS.state.ui.view = next.view;
    changed();
    window.scrollTo(0, 0);
  };

  A.previewSet = (el) => {
    DS.state.ui.preview = { sid: DS.current().id, pid: el.dataset.pid };
    DS.save();
    if ($('#stage')) DS.softRefresh();
    else DS.render();
  };

  A.subjectNew = () => {
    const s = DS.newSubject({});
    DS.state.subjects.push(s);
    Object.assign(DS.state.ui, { subjectId: s.id, tab: 'info', view: 'subject' });
    changed();
    const input = $('[data-bind="name"]');
    if (input) input.focus();
  };

  A.subjectDelete = async () => {
    const s = DS.current();
    if (!s || !confirm('「' + (s.name || '（無題）') + '」を削除します。読み込んだ写真・候補画像も消えます。元に戻せません。よろしいですか？')) return;
    const ids = s.refPhotos.concat(Object.values(s.patterns).map((r) => r.imageId).filter(Boolean));
    for (const id of ids) await DS.images.remove(id);
    DS.state.subjects = DS.state.subjects.filter((x) => x.id !== s.id);
    DS.state.ui.subjectId = null;
    changed();
  };

  A.statusSet = (el) => {
    L.setStatus(DS.current(), el.value);
    changed();
  };

  A.slotNext = () => {
    DS.current().slot = L.nextFreeSlot();
    changed();
  };
  A.slotUnset = () => {
    DS.current().slot = '';
    changed();
  };

  A.colorTouched = (el) => {
    el.classList.remove('unset');
    const code = el.parentElement.querySelector('.hexcode');
    if (code) code.textContent = el.value;
  };

  A.refRemove = async (el) => {
    const s = DS.current();
    s.refPhotos = s.refPhotos.filter((id) => id !== el.dataset.id);
    await DS.images.remove(el.dataset.id);
    changed();
  };

  DS.fileActions.refAdd = async (files) => {
    const s = DS.current();
    for (const f of files) s.refPhotos.push(await DS.images.put(f));
    changed();
  };

  A.slotPick = (el) => {
    const s = DS.current();
    const kind = el.dataset.kind;
    const i = +el.dataset.i;
    const hexOf = (name) => (C.find(name) || {}).hex || '';
    DS.pickColor({
      title: kind === 'bg' ? '背景色 ' + BG_IDS[i] + ' を選ぶ' : '月の色 ' + (i + 1) + ' を選ぶ',
      current: s[kind][i],
      showUsed: kind === 'bg',
      exceptId: s.id,
      favorites: kind === 'moon' ? DS.MOON_FAVORITES : null,
      // 乗せた色を当てはめた下絵
      preview: (name) =>
        DS.poster({
          bg: kind === 'bg' ? hexOf(name) : hexOf(s.bg[0]) || '#141a2c',
          moon: kind === 'moon' ? hexOf(name) : hexOf(s.moon[0]) || '#ffffff',
          main: s.buildingMain.hex,
          sub: s.buildingSub.hex,
        }),
      onPick(name) {
        s[kind][i] = name;
        s.captionEdited = null;
        if (kind === 'bg') DS.state.ui.preview = { sid: s.id, pid: BG_IDS[i] };
        changed();
      },
    });
  };
  A.slotClear = (el) => {
    const s = DS.current();
    s[el.dataset.kind][+el.dataset.i] = '';
    changed();
  };

  A.patToggle = (el) => {
    L.toggleDone(DS.current(), el.dataset.pid);
    changed();
  };
  A.patMaster = (el) => {
    const s = DS.current();
    L.setMaster(s, el.dataset.pid);
    if (s.masterId) DS.state.ui.preview = { sid: s.id, pid: s.masterId };
    changed();
    if (s.masterId === el.dataset.pid) DS.celebrate(s);
  };

  A.sampSelect = (el) => {
    DS.state.ui.sampIndex = +el.dataset.i;
    changed();
  };
  A.sampSet = (el) => {
    const s = DS.current();
    s[el.dataset.which] = { hex: el.dataset.hex, name: el.dataset.name || '' };
    changed();
    DS.toast((el.dataset.which === 'buildingMain' ? '主色' : '副色') + 'に設定しました');
  };
  A.sampApply = () => {
    const s = DS.current();
    if (!lastSuggestion) return;
    const has = s.bg.some(Boolean) || s.moon.some(Boolean);
    if (has && !confirm('いま選んでいる背景色・月の色を、叩き台の内容で置き換えます。よろしいですか？')) return;
    s.bg = [0, 1, 2].map((i) => (lastSuggestion.bg[i] ? lastSuggestion.bg[i].c.name : ''));
    s.moon = [0, 1].map((i) => (lastSuggestion.moon[i] ? lastSuggestion.moon[i].c.name : ''));
    changed();
    window.scrollTo(0, 0);
    DS.toast('組み合わせ表に入れました');
  };

  A.descFill = () => {
    const s = DS.current();
    s.description = L.autoDescription(s);
    changed();
  };
  A.promptRefresh = () => {
    const out = $('#prompt-out');
    if (!out) return;
    out.innerHTML = promptOut(DS.current());
    DS.hydrate(out);
  };
  A.batchOnlyTodo = (el) => {
    DS.state.ui.batchOnlyTodo = el.checked;
    DS.save();
    A.promptRefresh();
  };

  DS.fileActions.candImage = async (files, el) => {
    await setPatternImage(DS.current(), el.dataset.pid, files[0]);
    changed();
  };

  DS.fileActions.candBulk = async (files) => {
    const s = DS.current();
    const ids = complete(s).map((p) => p.id);
    const rest = [];
    let placed = 0;
    for (const f of files) {
      // candidate_ で始まる名前は大文字小文字を問わず、それ以外は大文字のIDだけ拾う
      const m = /^candidate[_\-\s]*(A2|B2|C2|A|B|C)(?=[_\-\s.]|$)/i.exec(f.name) || /(?:^|[_\-\s(])(A2|B2|C2|A|B|C)(?=[_\-\s.)]|$)/.exec(f.name);
      const pid = m ? m[1].toUpperCase() : null;
      if (pid && ids.includes(pid)) {
        await setPatternImage(s, pid, f);
        placed++;
      } else rest.push(f);
    }
    for (const f of rest) {
      const free = complete(s).find((p) => !p.imageId);
      if (!free) break;
      await setPatternImage(s, free.id, f);
      placed++;
    }
    changed();
    DS.toast(placed + '枚を読み込みました' + (placed < files.length ? '（' + (files.length - placed) + '枚は入れる枠がありませんでした）' : ''));
  };

  A.candRemove = async (el) => {
    const s = DS.current();
    const r = L.patternRec(s, el.dataset.pid);
    await DS.images.remove(r.imageId);
    r.imageId = null;
    changed();
  };

  A.candSave = async (el) => {
    const s = DS.current();
    const p = L.patternsOf(s).find((x) => x.id === el.dataset.pid);
    const rec = p && p.imageId ? await DS.images.get(p.imageId) : null;
    if (!rec) return;
    let name = el.dataset.master ? L.masterFilename(s) : L.candidateFilename(s, p);
    const ext = { 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/png': '.png' }[rec.type];
    if (ext && ext !== '.png') name = name.replace(/\.png$/, ext); // 中身と拡張子を合わせる
    DS.download(rec.blob, name);
  };

  A.tagsSuggest = () => {
    const s = DS.current();
    const add = L.suggestTags(s);
    if (!add.length) return DS.toast('「建物」に設計者・場所の英語表記を入れると候補を作れます', 'warn');
    s.tags = L.normalizeTags(s.tags + ' ' + add.join(' ')).join(' ');
    changed();
  };
  function captionSync(text) {
    $('#cap-count').innerHTML = captionCount(text);
    const ig = $('#ig-cap');
    if (ig) ig.innerHTML = igCaption(text);
  }
  A.captionRefresh = () => {
    const s = DS.current();
    const ta = $('#caption');
    if (!ta) return;
    if (s.captionEdited == null) ta.value = L.caption(s);
    captionSync(ta.value);
  };
  A.captionEdit = (el) => {
    DS.current().captionEdited = el.value;
    DS.save();
    captionSync(el.value);
    $('#cap-note').textContent = '手で編集した内容を保持しています。入力値の変更を反映するには「自動生成に戻す」を押してください。';
  };
  A.captionReset = () => {
    DS.current().captionEdited = null;
    changed();
  };

  A.cardRedraw = () => {
    const cv = $('#datacard');
    if (cv) DS.datacard.draw(cv, DS.current(), DS.state.ui.cardBg);
  };
  A.cardBg = (el) => {
    DS.state.ui.cardBg = el.value;
    DS.save();
    A.cardRedraw();
  };
  A.cardDownload = () => {
    const s = DS.current();
    const cv = document.createElement('canvas');
    DS.datacard.draw(cv, s, DS.state.ui.cardBg);
    cv.toBlob((blob) => DS.download(blob, L.cardFilename(s)), 'image/png');
    s.cardSaved = true;
    DS.save();
  };
})();
