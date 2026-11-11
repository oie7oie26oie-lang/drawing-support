/* 和色リストと色計算のユーティリティ
 * HEX は一般的に流通している代表値（出典により差がある）。
 * 値を直したいときは「和色」画面で同じ色名を登録すると上書きできる。 */
(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  // [色名, ローマ字表記, 英語の説明, HEX, グループ]
  const RAW = [
    ['鴇色', 'Toki-iro', 'crested ibis pink', '#f4b3c2', '桃・赤み'],
    ['薄桜', 'Usuzakura', 'pale cherry pink', '#fdeff2', '桃・赤み'],
    ['桜色', 'Sakura-iro', 'cherry blossom pink', '#fef4f4', '桃・赤み'],
    ['撫子色', 'Nadeshiko-iro', 'dianthus pink', '#eebbcb', '桃・赤み'],
    ['珊瑚色', 'Sango-iro', 'coral pink', '#f5b1aa', '桃・赤み'],
    ['灰桜', 'Haizakura', 'greyish cherry pink', '#e8d3d1', '桃・赤み'],
    ['牡丹色', 'Botan-iro', 'peony magenta', '#e7609e', '桃・赤み'],
    ['小豆色', 'Azuki-iro', 'adzuki bean brown', '#96514d', '桃・赤み'],

    ['杏色', 'Anzu-iro', 'apricot', '#f7b977', '黄・橙'],
    ['卵色', 'Tamago-iro', 'egg yolk yellow', '#fcd575', '黄・橙'],
    ['淡黄', 'Tanko', 'pale yellow', '#f8e58c', '黄・橙'],
    ['刈安色', 'Kariyasu-iro', 'pale greenish yellow', '#f5e56b', '黄・橙'],
    ['山吹色', 'Yamabuki-iro', 'golden yellow', '#f8b500', '黄・橙'],
    ['鬱金色', 'Ukon-iro', 'turmeric yellow', '#fabf14', '黄・橙'],
    ['黄金', 'Kogane', 'gold', '#e6b422', '黄・橙'],
    ['芥子色', 'Karashi-iro', 'mustard', '#d0af4c', '黄・橙'],
    ['黄土色', 'Odo-iro', 'yellow ochre', '#c39143', '黄・橙'],
    ['金茶', 'Kincha', 'golden brown', '#f39800', '黄・橙'],
    ['琥珀色', 'Kohaku-iro', 'amber', '#bf783a', '黄・橙'],

    ['白緑', 'Byakuroku', 'pale malachite green', '#d6e9ca', '緑'],
    ['若草色', 'Wakakusa-iro', 'fresh grass green', '#c3d825', '緑'],
    ['萌黄', 'Moegi', 'spring bud green', '#aacf53', '緑'],
    ['抹茶色', 'Matcha-iro', 'matcha green', '#c5c56a', '緑'],
    ['山葵色', 'Wasabi-iro', 'wasabi green', '#a8bf93', '緑'],
    ['鶯色', 'Uguisu-iro', 'bush warbler olive', '#928c36', '緑'],
    ['松葉色', 'Matsuba-iro', 'pine needle green', '#839b5c', '緑'],
    ['若竹色', 'Wakatake-iro', 'young bamboo green', '#68be8d', '緑'],
    ['青竹色', 'Aotake-iro', 'green bamboo', '#7ebea5', '緑'],
    ['青磁色', 'Seiji-iro', 'celadon', '#7ebeab', '緑'],
    ['常磐色', 'Tokiwa-iro', 'evergreen', '#007b43', '緑'],
    ['千歳緑', 'Chitose-midori', 'deep pine green', '#316745', '緑'],
    ['深緑', 'Fukamidori', 'deep green', '#00552e', '緑'],
    ['鉄色', 'Tetsu-iro', 'iron green', '#005243', '緑'],
    ['利休鼠', 'Rikyu-nezumi', 'greenish grey', '#888e7e', '緑'],

    ['甕覗', 'Kamenozoki', 'palest indigo', '#a2d7dd', '青'],
    ['水色', 'Mizu-iro', 'water blue', '#bce2e8', '青'],
    ['白群', 'Byakugun', 'pale azurite blue', '#83ccd2', '青'],
    ['空色', 'Sora-iro', 'sky blue', '#a0d8ef', '青'],
    ['勿忘草色', 'Wasurenagusa-iro', 'forget-me-not blue', '#89c3eb', '青'],
    ['新橋色', 'Shinbashi-iro', 'bright turquoise blue', '#59b9c6', '青'],
    ['浅葱色', 'Asagi-iro', 'light indigo teal', '#00a3af', '青'],
    ['錆浅葱', 'Sabi-asagi', 'dusty teal', '#5c9291', '青'],
    ['納戸色', 'Nando-iro', 'deep greyish teal', '#008899', '青'],
    ['露草色', 'Tsuyukusa-iro', 'dayflower blue', '#38a1db', '青'],
    ['縹色', 'Hanada-iro', 'mid indigo blue', '#2792c3', '青'],
    ['藍色', 'Ai-iro', 'indigo', '#165e83', '青'],
    ['群青色', 'Gunjo-iro', 'ultramarine', '#4c6cb3', '青'],
    ['瑠璃色', 'Ruri-iro', 'lapis lazuli blue', '#1e50a2', '青'],
    ['紺色', 'Kon-iro', 'navy', '#223a70', '青'],
    ['鉄紺', 'Tetsukon', 'iron navy', '#17184b', '青'],
    ['紺鼠', 'Kon-nezu', 'navy grey', '#44617b', '青'],
    ['藍鼠', 'Ai-nezu', 'indigo grey', '#6c848d', '青'],

    ['淡藤色', 'Awafuji-iro', 'pale wisteria', '#bbc8e6', '紫'],
    ['藤色', 'Fuji-iro', 'wisteria', '#bbbcde', '紫'],
    ['藤紫', 'Fuji-murasaki', 'wisteria purple', '#a59aca', '紫'],
    ['菫色', 'Sumire-iro', 'violet', '#7058a3', '紫'],
    ['桔梗色', 'Kikyo-iro', 'bellflower purple', '#5654a2', '紫'],
    ['江戸紫', 'Edo-murasaki', 'Edo purple', '#745399', '紫'],
    ['古代紫', 'Kodai-murasaki', 'antique purple', '#895b8a', '紫'],
    ['茄子紺', 'Nasukon', 'aubergine', '#824880', '紫'],
    ['紫紺', 'Shikon', 'deep purple navy', '#460e44', '紫'],

    ['白', 'Shiro', 'white', '#ffffff', '白・灰・黒'],
    ['月白', 'Geppaku', 'moon white', '#eaf4fc', '白・灰・黒'],
    ['生成り色', 'Kinari-iro', 'ecru', '#fbfaf5', '白・灰・黒'],
    ['象牙色', 'Zoge-iro', 'ivory', '#f8f4e6', '白・灰・黒'],
    ['鳥の子色', 'Torinoko-iro', 'eggshell', '#fff1cf', '白・灰・黒'],
    ['練色', 'Neri-iro', 'raw silk beige', '#ede4cd', '白・灰・黒'],
    ['灰白色', 'Kaihaku-shoku', 'greyish white', '#e9e4d4', '白・灰・黒'],
    ['砂色', 'Suna-iro', 'sand', '#dcd3b2', '白・灰・黒'],
    ['銀鼠', 'Gin-nezu', 'silver grey', '#afafb0', '白・灰・黒'],
    ['茶鼠', 'Cha-nezu', 'brownish grey', '#a99e93', '白・灰・黒'],
    ['鼠色', 'Nezumi-iro', 'mouse grey', '#949495', '白・灰・黒'],
    ['鈍色', 'Nibi-iro', 'dull grey', '#727171', '白・灰・黒'],
    ['墨色', 'Sumi-iro', 'ink black', '#595857', '白・灰・黒'],
    ['消炭色', 'Keshizumi-iro', 'charcoal', '#524e4d', '白・灰・黒'],
    ['藍墨茶', 'Aisumicha', 'bluish charcoal', '#474a4d', '白・灰・黒'],
    ['黒', 'Kuro', 'black', '#2b2b2b', '白・灰・黒'],
    ['漆黒', 'Shikkoku', 'lacquer black', '#0d0015', '白・灰・黒'],

    ['煉瓦色', 'Renga-iro', 'brick', '#b55233', '茶'],
    ['檜皮色', 'Hiwada-iro', 'cypress bark brown', '#965036', '茶'],
    ['栗色', 'Kuri-iro', 'chestnut', '#762f07', '茶'],
    ['焦茶', 'Kogecha', 'dark brown', '#6f4b3e', '茶'],
  ];

  DS.WAIRO = RAW.map(([name, en, gloss, hex, group]) => ({ name, en, gloss, hex, group }));
  DS.MOON_FAVORITES = ['白', '月白', '鳥の子色', '淡黄', '黄金', '山吹色', '銀鼠', '墨色', '紺色'];

  const C = (DS.color = {});

  /** '#abc' / '#aabbcc' / 'aabbcc' → '#aabbcc'。不正なら ''。 */
  C.safe = function (hex) {
    if (typeof hex !== 'string') return '';
    let h = hex.trim().toLowerCase().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/.test(h) ? '#' + h : '';
  };

  C.rgb = function (hex) {
    const h = C.safe(hex);
    if (!h) return null;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };

  C.hex = function (r, g, b) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  };

  /** sRGB → CIE Lab (D65) */
  C.lab = function (hex) {
    const rgb = C.rgb(hex) || [128, 128, 128];
    const [r, g, b] = rgb.map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
  };

  /** 色差（CIE76）。おおよそ 10 未満はかなり近い、20 未満は近い。 */
  C.deltaE = function (a, b) {
    const p = typeof a === 'string' ? C.lab(a) : a;
    const q = typeof b === 'string' ? C.lab(b) : b;
    return Math.sqrt((p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);
  };

  C.chroma = (lab) => Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  C.hue = (lab) => ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  C.hueDiff = (h1, h2) => {
    const d = Math.abs((((h1 - h2) % 360) + 360) % 360);
    return d > 180 ? 360 - d : d;
  };

  /** その色の上に載せる文字色 */
  C.textOn = function (hex) {
    return C.lab(hex).L > 58 ? '#1d1d1f' : '#ffffff';
  };

  /** 「赤い要素は入れない」ルール用：鮮やかな赤かどうか */
  C.isReddish = function (hex) {
    const lab = C.lab(hex);
    const h = C.hue(lab);
    return C.chroma(lab) > 45 && (h < 48 || h > 350);
  };

  /** ファイル名用のローマ字（英小文字のみ） */
  C.romaji = function (color) {
    if (!color) return 'unset';
    const s = (color.en || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return s || 'color';
  };

  /** 組み込み＋ユーザー追加（同名はユーザー側が優先） */
  C.all = function () {
    const custom = (DS.state && DS.state.customColors) || [];
    const names = new Set(custom.map((c) => c.name));
    return DS.WAIRO.filter((c) => !names.has(c.name)).concat(custom);
  };

  C.find = function (name) {
    if (!name) return null;
    const custom = (DS.state && DS.state.customColors) || [];
    return custom.find((c) => c.name === name) || DS.WAIRO.find((c) => c.name === name) || null;
  };

  /** 任意のHEXに最も近い和色 */
  C.nearest = function (hex, list) {
    const lab = C.lab(hex);
    let best = null;
    let bd = Infinity;
    for (const c of list || C.all()) {
      const d = C.deltaE(lab, C.lab(c.hex));
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return { color: best, d: bd };
  };
})();
