/* 保存まわり：状態は localStorage、画像は IndexedDB。外部への送信は一切しない。 */
(function () {
  'use strict';
  const DS = window.DS;
  const KEY = 'drawing-support/v1';

  DS.STATUS = [
    { id: 'todo', label: '未着手' },
    { id: 'generating', label: '生成中' },
    { id: 'master', label: 'マスター決定' },
    { id: 'scheduled', label: '予約済み' },
    { id: 'posted', label: '投稿済み' },
  ];

  // 指示書の共通プロンプト（初期値）。設定画面で編集できる。
  DS.DEFAULT_PROMPT = [
    '以下の条件で、建築のドローイングを1枚生成してください。',
    '【建物の説明文】',
    '添付した参考写真の建物を描くこと。建物全体だけを画面中央に孤立させて配置し、周囲の街並み・地面・車・人は描かない。',
    '事件は1つだけ：空に満月を1つ置く。月はベタ塗りの【月の色】の円で、クレーターや陰影は描かない。位置は画面の横幅を白銀比（1:√2）に分ける点に中心を置く。',
    '',
    '* ベタ塗りのみ。グラデーション、陰影、影、反射、質感や凹凸の表現、3D照明は一切入れない',
    '* フラットなベクターイラスト（Illustratorのベタ塗り）、シルクスクリーンのポスターのような仕上がり',
    '* 背景は和色「【背景色】」の単色',
    '* 地面、周囲の建物、人は描かない',
    '* 赤い要素は入れない（建物自体の色はそのまま）',
    '* 縦長 4:5',
    '* 人物、文字、ロゴ、サインは入れない',
  ].join('\n');

  DS.defaultSettings = function () {
    return {
      promptTemplate: DS.DEFAULT_PROMPT,
      includeHex: true,
      fixedTags: '#architecture #architectureillustration #archidrawing #buildingillustration #archilovers #modernarchitecture',
      jpTags: '#ドローイング #建築',
      disclosureJa: '制作：AI生成（ChatGPT）／ディレクション：杣',
      disclosureEn: 'Created with AI (ChatGPT), directed by Soma',
      handle: '@myo22myo22',
      usedNote: 'マルクトハルは実測ティール、キャプション表記は浅葱色。',
    };
  };

  DS.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  DS.ymd = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  DS.newSubject = function (props) {
    const seqs = ((DS.state && DS.state.subjects) || []).map((s) => s.seq);
    return Object.assign(
      {
        id: DS.uid(),
        seq: (seqs.length ? Math.max.apply(null, seqs) : 0) + 1,
        name: '',
        nameEn: '',
        architect: '',
        architectEn: '',
        year: '',
        location: '',
        locationEn: '',
        buildingMain: { name: '', hex: '' },
        buildingSub: { name: '', hex: '' },
        slot: '', // 投稿枠の日付 YYYY-MM-DD（時刻は 7:00 固定）
        status: 'todo',
        verified: false, // Instagramアプリの「予約済みコンテンツ」で目視確認したか
        verifiedAt: null,
        description: '', // プロンプトの【建物の説明文】。空なら自動文
        points: ['', '', ''],
        tags: '',
        aiGenerated: true,
        bg: ['', '', ''], // 背景色 3 候補（和色名）
        moon: ['', ''], // 月の色 2 候補（和色名）
        patterns: {}, // { A: { done, imageId }, ... }
        masterId: null,
        measuredHex: '', // 仕上がりの実測色（任意）。グリッド表示で優先
        refPhotos: [], // IndexedDB の画像ID
        captionEdited: null,
        note: '',
      },
      props || {}
    );
  };

  function seed() {
    const st = {
      version: 1,
      settings: DS.defaultSettings(),
      customColors: [],
      subjects: [],
      ui: { view: 'queue', subjectId: null, tab: 'info', gridAspect: '3 / 4', gridTentative: null, gridSel: null, batchOnlyTodo: false, cardBg: 'master', sampIndex: 0 },
    };
    let seq = 0;
    const add = (name, bg, extra) => {
      const s = DS.newSubject(
        Object.assign({ id: DS.uid() + seq, seq: ++seq, name, status: 'posted', bg: [bg, '', ''], masterId: 'A', patterns: { A: { done: true, imageId: null } } }, extra)
      );
      st.subjects.push(s);
      return s;
    };

    add('国立新美術館', '鴇色');
    add('アートプラザ', '藤色');
    add('せんだいメディアテーク', '浅葱色');
    add('キューブハウス', '群青色');
    add('MOT', '紺鼠');
    add('ツォルフェアアイン炭鉱', '利休鼠');
    add('スカリジェロ城', '芥子色');
    add('水戸芸術館タワー', '紫紺');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const moji = add('プレミアホテル門司港', '白群', {
      status: 'master',
      nameEn: 'Premier Hotel Mojiko',
      architect: 'アルド・ロッシ',
      architectEn: 'Aldo Rossi',
      year: '1998',
      location: '福岡県北九州市（門司港）',
      locationEn: 'Kitakyushu, Fukuoka, Japan',
      buildingMain: { name: '煉瓦色', hex: '#b55233' },
      buildingSub: { name: '練色', hex: '#ede4cd' },
      moon: ['白', ''],
      slot: DS.ymd(tomorrow),
      points: ['イタリアの建築家アルド・ロッシの設計', '関門海峡に面した門司港レトロ地区に建つ', '正面は鮫をイメージしたとされる造形'],
      tags: '#aldorossi #kitakyushu #mojiko #postmodernarchitecture',
      note: 'サンプルデータ。建物の色・ポイント・投稿枠は仮の値です。',
    });
    add('渋谷・道玄坂の自作設計', '墨色');

    st.ui.subjectId = moji.id;
    return st;
  }

  DS.load = function () {
    let st = null;
    try {
      st = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      st = null;
    }
    if (!st || !Array.isArray(st.subjects)) st = seed();
    st.settings = Object.assign(DS.defaultSettings(), st.settings || {});
    st.customColors = st.customColors || [];
    st.ui = Object.assign({ view: 'queue', subjectId: null, tab: 'info', gridAspect: '3 / 4', gridTentative: null, gridSel: null, batchOnlyTodo: false, cardBg: 'master', sampIndex: 0 }, st.ui || {});
    st.subjects = st.subjects.map((s) => Object.assign(DS.newSubject({ id: s.id, seq: s.seq }), s));
    DS.state = st;
  };

  let timer = null;
  DS.saveNow = function () {
    clearTimeout(timer);
    timer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(DS.state));
    } catch (e) {
      if (DS.toast) DS.toast('保存に失敗しました（ブラウザの保存領域を確認してください）', 'danger');
    }
  };
  DS.save = function () {
    clearTimeout(timer);
    timer = setTimeout(DS.saveNow, 250);
  };
  window.addEventListener('beforeunload', () => {
    if (timer) DS.saveNow();
  });

  DS.resetToSample = function () {
    DS.state = seed();
    DS.saveNow();
    return DS.images.clear();
  };

  DS.current = function () {
    const st = DS.state;
    return st.subjects.find((s) => s.id === st.ui.subjectId) || null;
  };

  /* ---------- 画像（IndexedDB） ---------- */
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const rq = indexedDB.open('drawing-support', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('images');
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error);
      });
    }
    return dbPromise;
  }
  function run(mode, fn) {
    return db().then(
      (d) =>
        new Promise((resolve, reject) => {
          const tx = d.transaction('images', mode);
          const rq = fn(tx.objectStore('images'));
          tx.oncomplete = () => resolve(rq ? rq.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  const urls = new Map();
  DS.images = {
    /** File/Blob を保存して ID を返す */
    put(file, id) {
      id = id || DS.uid();
      const rec = { blob: file, name: file.name || '', type: file.type || 'image/png' };
      return run('readwrite', (st) => st.put(rec, id)).then(() => id);
    },
    get(id) {
      return run('readonly', (st) => st.get(id));
    },
    /** 表示用の objectURL（キャッシュあり） */
    url(id) {
      if (urls.has(id)) return Promise.resolve(urls.get(id));
      return DS.images.get(id).then((rec) => {
        if (!rec) return '';
        const u = URL.createObjectURL(rec.blob);
        urls.set(id, u);
        return u;
      });
    },
    remove(id) {
      if (!id) return Promise.resolve();
      if (urls.has(id)) {
        URL.revokeObjectURL(urls.get(id));
        urls.delete(id);
      }
      return run('readwrite', (st) => st.delete(id));
    },
    keys() {
      return run('readonly', (st) => st.getAllKeys());
    },
    clear() {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
      return run('readwrite', (st) => st.clear());
    },
  };

  /* ---------- バックアップ ---------- */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  function dataUrlToBlob(dataUrl) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(dataUrl);
    if (!m) return new Blob([]);
    const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: m[1] || 'image/png' });
  }

  DS.exportAll = async function (withImages) {
    const out = { app: 'drawing-support', exportedAt: new Date().toISOString(), state: DS.state, images: {} };
    if (withImages) {
      for (const id of await DS.images.keys()) {
        const rec = await DS.images.get(id);
        if (rec) out.images[id] = { name: rec.name, type: rec.type, data: await blobToDataUrl(rec.blob) };
      }
    }
    return new Blob([JSON.stringify(out)], { type: 'application/json' });
  };

  DS.importAll = async function (file) {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'drawing-support' || !data.state || !Array.isArray(data.state.subjects)) {
      throw new Error('このアプリのバックアップファイルではありません');
    }
    await DS.images.clear();
    for (const id of Object.keys(data.images || {})) {
      const im = data.images[id];
      const blob = dataUrlToBlob(im.data);
      await run('readwrite', (st) => st.put({ blob, name: im.name || '', type: im.type || blob.type }, id));
    }
    localStorage.setItem(KEY, JSON.stringify(data.state));
    DS.load();
  };
})();
