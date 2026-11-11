/* カルーセル2枚目用のデータカード（縦長 4:5 / 1080×1350）を canvas に描く */
(function () {
  'use strict';
  const DS = window.DS;
  const C = DS.color;
  const W = 1080;
  const H = 1350;
  const M = 96;
  const FONT = '"Yu Gothic", "YuGothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif';

  /** 英単語は途中で切らず、和文は1文字単位で折り返す */
  function wrap(ctx, text, maxWidth, maxLines) {
    const tokens = String(text || '').match(/[A-Za-z0-9#@&'’.,:;\-–()/]+\s*|\s+|[^\sA-Za-z0-9]/g) || [];
    const lines = [];
    let line = '';
    for (const tk of tokens) {
      if (ctx.measureText(line + tk).width > maxWidth && line) {
        lines.push(line.trimEnd());
        line = tk.trimStart();
      } else {
        line += tk;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    if (maxLines && lines.length > maxLines) {
      const cut = lines.slice(0, maxLines);
      let last = cut[maxLines - 1];
      while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
      cut[maxLines - 1] = last + '…';
      return cut;
    }
    return lines;
  }

  function rgba(hex, alpha) {
    const [r, g, b] = C.rgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function spaced(ctx, px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
  }

  DS.datacard = {
    W,
    H,
    draw(canvas, s, bgMode) {
      const m = DS.logic.masterOf(s);
      const masterBg = m && m.bg ? C.safe(s.measuredHex) || m.bg.hex : '';
      const bg = bgMode === 'dark' ? '#1d1d1f' : bgMode === 'light' || !masterBg ? '#f6f4ee' : masterBg;
      const ink = C.textOn(bg);
      const soft = rgba(ink, 0.62);
      const line = rgba(ink, 0.28);
      const moonHex = m && m.moon ? m.moon.hex : ink;

      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = 'alphabetic';

      // 月：横幅を白銀比（1:√2）に分ける点
      const mx = (W * Math.SQRT2) / (1 + Math.SQRT2);
      ctx.beginPath();
      ctx.arc(mx, 236, 92, 0, Math.PI * 2);
      ctx.fillStyle = moonHex;
      ctx.fill();
      if (C.deltaE(moonHex, bg) < 14) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = line;
        ctx.stroke();
      }

      ctx.fillStyle = soft;
      ctx.font = '600 26px ' + FONT;
      spaced(ctx, 6);
      ctx.fillText('ARCHITECTURE DATA', M, 132);
      spaced(ctx, 0);

      // 題材名
      let y = 470;
      ctx.fillStyle = ink;
      ctx.font = '700 74px ' + FONT;
      for (const l of wrap(ctx, s.name || '（題材名）', W - M * 2, 3)) {
        ctx.fillText(l, M, y);
        y += 94;
      }
      if (s.nameEn) {
        ctx.fillStyle = soft;
        ctx.font = '500 32px ' + FONT;
        y -= 26;
        for (const l of wrap(ctx, s.nameEn, W - M * 2, 2)) {
          ctx.fillText(l, M, y);
          y += 44;
        }
        y += 8;
      }

      y += 10;
      ctx.fillStyle = line;
      ctx.fillRect(M, y, W - M * 2, 2);
      y += 72;

      // 基本データ
      const rows = [
        ['設計', [s.architect, s.architectEn].filter(Boolean).join('  /  ')],
        ['竣工', s.year ? s.year + '年' : ''],
        ['所在地', s.location],
      ].filter((r) => r[1]);
      for (const [label, value] of rows) {
        ctx.fillStyle = soft;
        ctx.font = '600 30px ' + FONT;
        ctx.fillText(label, M, y);
        ctx.fillStyle = ink;
        ctx.font = '500 40px ' + FONT;
        for (const l of wrap(ctx, value, W - M - 250, 2)) {
          ctx.fillText(l, 250, y);
          y += 52;
        }
        y += 22;
      }

      // ポイント3つ
      const points = (s.points || []).map((p) => (p || '').trim()).filter(Boolean);
      if (points.length) {
        y += 6;
        ctx.fillStyle = line;
        ctx.fillRect(M, y, W - M * 2, 2);
        y += 70;
        points.forEach((p, i) => {
          ctx.fillStyle = soft;
          ctx.font = '700 30px ' + FONT;
          ctx.fillText('0' + (i + 1), M, y);
          ctx.fillStyle = ink;
          ctx.font = '500 38px ' + FONT;
          for (const l of wrap(ctx, p, W - M - 180, 3)) {
            ctx.fillText(l, 180, y);
            y += 52;
          }
          y += 24;
        });
      }

      // フッター：色名とアカウント
      const fy = H - 92;
      let fx = M;
      ctx.font = '500 28px ' + FONT;
      const chip = (hex, label, round) => {
        ctx.beginPath();
        if (round) ctx.arc(fx + 16, fy - 8, 16, 0, Math.PI * 2);
        else ctx.rect(fx, fy - 24, 32, 32);
        ctx.fillStyle = hex;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = line;
        ctx.stroke();
        ctx.fillStyle = soft;
        ctx.fillText(label, fx + 44, fy);
        fx += 44 + ctx.measureText(label).width + 36;
      };
      if (m && m.bg) chip(C.safe(s.measuredHex) || m.bg.hex, '背景 ' + m.bg.name, false);
      if (m && m.moon) chip(m.moon.hex, '月 ' + m.moon.name, true);
      const handle = DS.state.settings.handle || '';
      ctx.fillStyle = soft;
      ctx.textAlign = 'right';
      ctx.fillText(handle, W - M, fy);
      ctx.textAlign = 'left';
    },
  };
})();
