/* 画面に依存しないロジック：組み合わせ表・プロンプト・キャプション・ファイル名・投稿枠 */
(function () {
  'use strict';
  const DS = window.DS;
  const C = DS.color;
  const L = (DS.logic = {});

  const BG_IDS = ['A', 'B', 'C'];
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  L.STAGES = ['下書き', '生成済み', 'マスター決定', '予約済み', 'アプリで確認済み'];

  L.statusLabel = (id) => (DS.STATUS.find((x) => x.id === id) || {}).label || id;

  /* ---------- 組み合わせ表 ---------- */

  /** 背景3 × 月2 = A / A2 / B / B2 / C / C2 */
  L.patternsOf = function (s) {
    const out = [];
    BG_IDS.forEach((b, i) => {
      [0, 1].forEach((j) => {
        const id = b + (j ? '2' : '');
        const rec = (s.patterns && s.patterns[id]) || {};
        const isMaster = s.masterId === id;
        out.push({
          id,
          bgIdx: i,
          moonIdx: j,
          bg: C.find(s.bg[i]),
          moon: C.find(s.moon[j]),
          imageId: rec.imageId || null,
          isMaster,
          state: isMaster ? 'master' : rec.done || rec.imageId ? 'done' : 'none',
        });
      });
    });
    return out;
  };

  L.masterOf = function (s) {
    if (!s.masterId) return null;
    return L.patternsOf(s).find((p) => p.id === s.masterId) || null;
  };

  function rec(s, pid) {
    if (!s.patterns[pid]) s.patterns[pid] = { done: false, imageId: null };
    return s.patterns[pid];
  }
  L.patternRec = rec;

  L.setStatus = function (s, status) {
    s.status = status;
    if (status !== 'scheduled' && status !== 'posted') {
      s.verified = false;
      s.verifiedAt = null;
    }
  };

  L.toggleDone = function (s, pid) {
    const r = rec(s, pid);
    r.done = !(r.done || r.imageId);
    if (!r.done && r.imageId) r.done = true; // 画像がある間は「済」のまま
    if (r.done && s.status === 'todo') L.setStatus(s, 'generating');
  };

  L.setMaster = function (s, pid) {
    if (s.masterId === pid) {
      s.masterId = null;
      if (s.status === 'master') L.setStatus(s, 'generating');
    } else {
      s.masterId = pid;
      rec(s, pid).done = true;
      if (s.status === 'todo' || s.status === 'generating') L.setStatus(s, 'master');
    }
    s.captionEdited = null;
  };

  /* ---------- 使用済みの背景色 ---------- */

  /** マスターが決まった題材の背景色（投稿順）。 */
  L.usedList = function () {
    return L.sortedForGrid(DS.state.subjects.filter((s) => s.masterId))
      .map((s) => {
        const m = L.masterOf(s);
        return m && m.bg ? { name: m.bg.name, hex: m.bg.hex, measuredHex: C.safe(s.measuredHex), subject: s, status: s.status } : null;
      })
      .filter(Boolean);
  };

  /** 色名 → その色を使った題材名の配列（exceptId の題材は除く） */
  L.usedColors = function (exceptId) {
    const map = new Map();
    L.usedList().forEach((u) => {
      if (u.subject.id === exceptId) return;
      if (!map.has(u.name)) map.set(u.name, []);
      map.get(u.name).push(u.subject.name || '（無題）');
    });
    return map;
  };

  /* ---------- プロンプト ---------- */

  L.colorLabel = function (c) {
    if (!c) return '（未設定）';
    return DS.state.settings.includeHex ? c.name + '（' + c.hex + '）' : c.name;
  };

  L.autoDescription = function (s) {
    const facts = [];
    if (s.architect) facts.push('設計：' + s.architect);
    if (s.year) facts.push(s.year + '年竣工');
    if (s.location) facts.push(s.location);
    let t = '題材は「' + (s.name || '（建物名）') + '」' + (facts.length ? '（' + facts.join('、') + '）' : '') + '。';
    const main = s.buildingMain.name || C.safe(s.buildingMain.hex);
    const sub = s.buildingSub.name || C.safe(s.buildingSub.hex);
    const withHex = (o, label) => (o.name && C.safe(o.hex) ? label + '（' + C.safe(o.hex) + '）' : label);
    if (main && sub) t += '建物自体の色は、主色が' + withHex(s.buildingMain, main) + '、副色が' + withHex(s.buildingSub, sub) + '。';
    else if (main) t += '建物自体の色は' + withHex(s.buildingMain, main) + 'が主体。';
    return t;
  };

  L.describe = (s) => (s.description && s.description.trim() ? s.description.trim() : L.autoDescription(s));

  function fill(template, desc, moon, bg) {
    return template.split('【建物の説明文】').join(desc).split('【月の色】').join(moon).split('【背景色】').join(bg);
  }

  /** パターン1つ分の個別プロンプト */
  L.prompt = function (s, p) {
    return fill(DS.state.settings.promptTemplate, L.describe(s), L.colorLabel(p.moon), L.colorLabel(p.bg));
  };

  /** 複数パターンを一括で頼む統合プロンプト */
  L.batchPrompt = function (s, ps) {
    const lines = ps.map((p) => '- ' + p.id + '：背景色＝' + L.colorLabel(p.bg) + '／月の色＝' + L.colorLabel(p.moon));
    return [
      '同じ建物のドローイングを、下の「パターン一覧」の' + ps.length + '通りで、パターンごとに別々の画像として1枚ずつ生成してください。',
      'パターン間で変えるのは「背景色」と「月の色」の2点だけです。建物の描き方・構図・月の位置と大きさは全パターンで同じにしてください。',
      '1枚の画像の中に複数のパターンを並べないでください。それぞれの画像に、どのパターンID（' + ps.map((p) => p.id).join(' / ') + '）かを添えてください。',
      '',
      '■ パターン一覧',
      lines.join('\n'),
      '',
      '■ 共通条件（各パターンの1枚ごとに適用）',
      fill(DS.state.settings.promptTemplate, L.describe(s), '（パターン一覧で指定した月の色）', '（パターン一覧で指定した背景色）'),
    ].join('\n');
  };

  /* ---------- ファイル名 ---------- */

  const safeName = (t) => (t || 'untitled').trim().replace(/[\\/:*?"<>|\s]+/g, '_');
  L.candidateFilename = (s, p) => 'candidate_' + p.id + '_' + C.romaji(p.bg) + '_' + C.romaji(p.moon) + '.png';
  L.masterFilename = (s) => 'master_' + safeName(s.name) + '.png';
  L.cardFilename = (s) => 'datacard_' + safeName(s.name) + '.png';

  /* ---------- キャプション ---------- */

  L.normalizeTags = function (str) {
    const seen = new Set();
    return (str || '')
      .split(/[\s,、]+/)
      .map((t) => t.replace(/^#+/, '').trim())
      .filter(Boolean)
      .map((t) => '#' + t)
      .filter((t) => (seen.has(t.toLowerCase()) ? false : seen.add(t.toLowerCase())));
  };

  /** 設計者・場所の英語表記から題材別タグの候補を作る */
  L.suggestTags = function (s) {
    const out = [];
    const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (s.architectEn) out.push(slug(s.architectEn));
    (s.locationEn || '').split(/[,/]/).forEach((part) => out.push(slug(part)));
    return out.filter((t) => t.length > 1).map((t) => '#' + t);
  };

  function colorLineEn(label, c) {
    if (!c) return null;
    return label + ': ' + (c.en ? c.en + ' (' + c.name + ')' : c.name) + (c.gloss ? ' — ' + c.gloss : '');
  }
  function colorLineJa(label, c) {
    if (!c) return null;
    return label + '：' + c.name + (c.en ? '（' + c.en + '）' : '');
  }

  /** マスターの色名を使ったキャプション。英語が先、日本語が後。 */
  L.caption = function (s) {
    const m = L.masterOf(s);
    const set = DS.state.settings;
    const bg = m && m.bg;
    const moon = m && m.moon;
    const en = [];
    en.push(s.nameEn || s.name);
    const by = [s.architectEn || s.architect, s.year].filter(Boolean).join(', ');
    if (by) en.push(by);
    if (s.locationEn || s.location) en.push(s.locationEn || s.location);
    const enColors = [colorLineEn('Background', bg), colorLineEn('Moon', moon)].filter(Boolean);
    if (enColors.length) en.push('', enColors.join('\n'));
    if (s.aiGenerated && set.disclosureEn) en.push('', set.disclosureEn);

    const ja = [];
    ja.push(s.name);
    const byJa = [s.architect, s.year ? s.year + '年' : ''].filter(Boolean).join('／');
    if (byJa) ja.push(byJa);
    if (s.location) ja.push(s.location);
    const jaColors = [colorLineJa('背景', bg), colorLineJa('月', moon)].filter(Boolean);
    if (jaColors.length) ja.push('', jaColors.join('\n'));
    if (s.aiGenerated && set.disclosureJa) ja.push('', set.disclosureJa);

    const tags = L.normalizeTags([set.fixedTags, s.tags, set.jpTags].join(' '));
    return [en.join('\n'), ja.join('\n'), tags.join(' ')].filter((b) => b.trim()).join('\n\n');
  };

  /* ---------- 投稿枠（毎朝 7:00） ---------- */

  L.slotDate = (s) => (s.slot ? new Date(s.slot + 'T07:00:00') : null);

  L.fmtSlot = function (ymd) {
    const d = new Date(ymd + 'T07:00:00');
    if (isNaN(d)) return ymd;
    return d.getMonth() + 1 + '/' + d.getDate() + '(' + WEEK[d.getDay()] + ') 7:00';
  };

  L.fmtDateTime = function (iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getMonth() + 1 + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  /** これから来る 7:00 枠の日付（YYYY-MM-DD）を n 個 */
  L.upcomingSlots = function (n) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(DS.ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  };

  L.subjectsAt = (ymd) => DS.state.subjects.filter((s) => s.slot === ymd);

  L.nextFreeSlot = function () {
    const taken = new Set(DS.state.subjects.map((s) => s.slot).filter(Boolean));
    return L.upcomingSlots(400).find((d) => !taken.has(d));
  };

  /** 進捗段階：0 下書き / 1 生成済み / 2 マスター決定 / 3 予約済み / 4 アプリで確認済み / 5 投稿済み */
  L.stage = function (s) {
    if (s.status === 'posted') return 5;
    if (s.status === 'scheduled') return s.verified ? 4 : 3;
    if (s.masterId || s.status === 'master') return 2;
    if (L.patternsOf(s).some((p) => p.state !== 'none')) return 1;
    return 0;
  };

  /** 投稿枠の警告。level: ok / warn / danger */
  L.alert = function (s) {
    const t = L.slotDate(s);
    if (s.status === 'posted') return { level: 'ok', text: '投稿済み' };
    if (!t) return { level: 'none', text: '投稿枠が未設定' };
    const now = new Date();
    const hours = (t - now) / 36e5;
    if (hours < 0) return { level: 'danger', text: '枠の時刻を過ぎています。Instagramで投稿されたか確認し、投稿済みにしてください' };
    if (s.status === 'scheduled') {
      if (!s.verified) return { level: 'danger', text: '予約済みですが、アプリの「予約済みコンテンツ」で未確認です' };
      const dayBefore = new Date(t);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(0, 0, 0, 0);
      if (now >= dayBefore && new Date(s.verifiedAt) < dayBefore) {
        return { level: 'warn', text: '投稿の前日になりました。予約が消えていないか再確認を（最終確認 ' + L.fmtDateTime(s.verifiedAt) + '）' };
      }
      return { level: 'ok', text: 'アプリで確認済み（' + L.fmtDateTime(s.verifiedAt) + '）' };
    }
    return { level: hours < 24 ? 'danger' : 'warn', text: 'まだ予約されていません（現在：' + L.STAGES[L.stage(s)] + '）' };
  };

  /* ---------- グリッド ---------- */

  /** 古い順。投稿枠の日付があるものは日付順、ないもの（過去分）は登録順で先頭側。 */
  L.sortedForGrid = function (list) {
    return list.slice().sort((a, b) => {
      const ka = a.slot || '';
      const kb = b.slot || '';
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.seq - b.seq;
    });
  };

  /** グリッドに並べる項目（新しい順）。仮置きも含む。 */
  L.gridItems = function () {
    const t = DS.state.ui.gridTentative;
    const out = [];
    L.sortedForGrid(DS.state.subjects).forEach((s) => {
      let pid = s.masterId;
      let tentative = false;
      if (t && t.sid === s.id && (!s.masterId || t.pid !== s.masterId)) {
        pid = t.pid;
        tentative = true;
      }
      if (!pid) return;
      const p = L.patternsOf(s).find((x) => x.id === pid);
      if (!p || !p.bg) return;
      out.push({
        s,
        p,
        tentative,
        bgHex: (!tentative && C.safe(s.measuredHex)) || p.bg.hex,
        moonHex: p.moon ? p.moon.hex : '',
      });
    });
    return out.reverse();
  };

  /** 色被り：連続する投稿（横に並びやすい）と、3つ違い（常に縦に隣接） */
  L.gridClashes = function (items, threshold) {
    const out = [];
    items.forEach((a, i) => {
      [1, 3].forEach((step) => {
        const b = items[i + step];
        if (!b) return;
        const d = C.deltaE(a.bgHex, b.bgHex);
        if (d < threshold) out.push({ a, b, d, kind: step === 1 ? '連続する投稿（横に並びやすい）' : '3つ違い（常に縦に隣接）' });
      });
    });
    return out.sort((x, y) => x.d - y.d);
  };

  /* ---------- 月の満ち欠け・次の一手 ---------- */

  // 進捗段階に対応する月相（下書き＝新月 … アプリで確認済み＝満月）
  L.PHASES = ['新月', '三日月', '上弦', '十三夜', '満月'];

  /** いま見せるべきパターン：マスター → 色が揃った最初のパターン → 背景だけ決まったパターン */
  L.featured = function (s) {
    const ps = L.patternsOf(s);
    return ps.find((p) => p.isMaster && p.bg) || ps.find((p) => p.bg && p.moon) || ps.find((p) => p.bg) || null;
  };

  /** 次の 7:00 までの残り時間 */
  L.countdown = function () {
    const t = new Date(L.upcomingSlots(1)[0] + 'T07:00:00');
    const m = Math.max(0, Math.round((t - new Date()) / 60000));
    const h = Math.floor(m / 60);
    return (h ? h + '時間' : '') + (m % 60) + '分';
  };

  /** その題材で次にやること */
  L.nextAction = function (s) {
    const st = L.stage(s);
    const ready = L.patternsOf(s).some((p) => p.bg && p.moon);
    if (st === 0) {
      if (!s.name) return { label: '建物の情報を入れる', tab: 'info' };
      return ready ? { label: 'プロンプトをコピーして生成する', tab: 'prompt' } : { label: '背景色と月の色を決める', tab: 'colors' };
    }
    if (st === 1) return { label: '候補を比べてマスターを決める', tab: 'cands' };
    if (st === 2) return s.slot ? { label: 'キャプションを作って予約する', tab: 'caption' } : { label: '投稿枠を決める', tab: 'info' };
    if (st === 3) return { label: '「予約済みコンテンツ」を確認する', view: 'queue' };
    if (st === 4) return { label: '満月。あとは朝7:00を待つだけ', view: 'queue' };
    return null;
  };
})();
