/* 参考写真から主要色を抽出し、背景3色 × 月2色の叩き台を提案する。処理はすべてブラウザ内。 */
(function () {
  'use strict';
  const DS = window.DS;
  const C = DS.color;
  const S = (DS.sampling = {});

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像を読み込めませんでした'));
      img.src = url;
    });
  }

  /** k-means（初期値は明るさ順の等間隔なので毎回同じ結果になる） */
  function kmeans(px, k) {
    if (!px.length) return [];
    const sorted = px.slice().sort((a, b) => a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11 - (b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11));
    let centers = [];
    for (let i = 0; i < k; i++) centers.push(sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice());
    let counts = [];
    for (let iter = 0; iter < 10; iter++) {
      const sums = centers.map(() => [0, 0, 0]);
      counts = centers.map(() => 0);
      for (const p of px) {
        let bi = 0;
        let bd = Infinity;
        for (let i = 0; i < centers.length; i++) {
          const c = centers[i];
          const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
          if (d < bd) {
            bd = d;
            bi = i;
          }
        }
        sums[bi][0] += p[0];
        sums[bi][1] += p[1];
        sums[bi][2] += p[2];
        counts[bi]++;
      }
      centers = centers.map((c, i) => (counts[i] ? sums[i].map((v) => v / counts[i]) : c));
    }
    let out = centers.map((c, i) => ({ hex: C.hex(c[0], c[1], c[2]), ratio: counts[i] / px.length })).filter((c) => c.ratio > 0.01);
    out.sort((a, b) => b.ratio - a.ratio);
    // よく似たクラスタは大きい方にまとめる
    const merged = [];
    for (const c of out) {
      const near = merged.find((m) => C.deltaE(m.hex, c.hex) < 9);
      if (near) near.ratio += c.ratio;
      else merged.push(c);
    }
    return merged;
  }

  /** 画像ID → { img, all, center, top } */
  S.analyze = async function (imageId) {
    const url = await DS.images.url(imageId);
    if (!url) throw new Error('画像が見つかりません');
    const img = await loadImage(url);
    const w = 96;
    const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const all = [];
    const center = [];
    const top = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) continue;
        const p = [data[i], data[i + 1], data[i + 2]];
        all.push(p);
        if (x > w * 0.25 && x < w * 0.75 && y > h * 0.3 && y < h * 0.8) center.push(p);
        if (y < h * 0.15) top.push(p);
      }
    }
    return { img, all: kmeans(all, 6), center: kmeans(center, 4), top: kmeans(top, 2) };
  };

  /** 解析結果から背景3 × 月2 の叩き台を作る */
  S.suggest = function (res, s) {
    const mainHex = C.safe(s.buildingMain.hex) || (res.center[0] && res.center[0].hex) || '#888888';
    const subHex = C.safe(s.buildingSub.hex) || (res.center[1] && res.center[1].hex) || '';
    const skyHex = (res.top[0] && res.top[0].hex) || '#a0d8ef';
    const mainLab = C.lab(mainHex);
    const subLab = subHex ? C.lab(subHex) : null;
    const used = DS.logic.usedColors(s.id);

    const pool = C.all()
      .filter((c) => !used.has(c.name) && !C.isReddish(c.hex))
      .map((c) => ({ c, lab: C.lab(c.hex) }))
      .filter((x) => x.lab.L < 93 && C.deltaE(x.lab, mainLab) >= 28 && (!subLab || C.deltaE(x.lab, subLab) >= 16));

    const picks = [];
    const take = (score, reason) => {
      let best = null;
      let bs = -Infinity;
      for (const x of pool) {
        if (picks.some((p) => p.c.name === x.c.name || C.deltaE(p.lab, x.lab) < 22)) continue;
        const v = score(x);
        if (v > bs) {
          bs = v;
          best = x;
        }
      }
      if (best) picks.push({ c: best.c, lab: best.lab, reason });
    };

    const mh = C.hue(mainLab);
    if (C.chroma(mainLab) >= 12) {
      take((x) => -C.hueDiff(C.hue(x.lab), mh + 180) - (C.chroma(x.lab) < 15 ? 60 : 0) - Math.abs(x.lab.L - 60) * 0.2, '建物の主色の補色寄り。建物がいちばん浮き立つ');
    } else {
      take((x) => C.chroma(x.lab) - Math.abs(x.lab.L - 60) * 0.4, '建物が無彩色寄りなので、彩度のある背景で対比をつける');
    }
    take((x) => -C.deltaE(x.lab, C.lab(skyHex)), '参考写真の上部（空）の色に近い。写真の空気感を残す');
    if (mainLab.L >= 50) take((x) => -x.lab.L + Math.min(C.chroma(x.lab), 30) * 0.3, '暗い背景で明度差をつける。月が映える');
    else take((x) => x.lab.L - Math.abs(C.chroma(x.lab) - 25) * 0.3, '明るい背景で明度差をつける');

    const moonPool = DS.MOON_FAVORITES.map((n) => C.find(n))
      .filter(Boolean)
      .map((c) => ({ c, lab: C.lab(c.hex) }))
      .map((x) => {
        const minBg = picks.length ? Math.min.apply(null, picks.map((p) => C.deltaE(p.lab, x.lab))) : 50;
        return Object.assign(x, { score: minBg - (C.deltaE(x.lab, mainLab) < 15 ? 20 : 0), minBg });
      })
      .sort((a, b) => b.score - a.score);
    const moons = [];
    for (const x of moonPool) {
      if (moons.length >= 2) break;
      if (moons.some((m) => C.deltaE(m.lab, x.lab) < 15)) continue;
      moons.push({ c: x.c, lab: x.lab, reason: 'どの背景候補とも色差が大きい（最小ΔE ' + Math.round(x.minBg) + '）' });
    }

    return { mainHex, subHex, skyHex, bg: picks, moon: moons };
  };
})();
