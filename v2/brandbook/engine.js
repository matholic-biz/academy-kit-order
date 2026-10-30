// 우리학원 브랜드북 미리보기 엔진 v0.1
// brandbook_rules.json + pages_variable.json + masters_index.json + cover_variable.json
// + 페이지 이미지 + 서체로 미리보기 PDF를 만든다. 브라우저와 Node 양쪽에서 동작.
(function (root) {
  const MM = 72 / 25.4;
  const PAGE_W_MM = 182, PAGE_H_MM = 257;
  const PW = PAGE_W_MM * MM, PH = PAGE_H_MM * MM;

  // 3p 소개 문구 점선 (InDesign 내지 마스터 값, 2026-10-29). 바탕 이미지에서 빼고 엔진이 줄 수만큼 그린다.
  const INTRO_RULE = {
    x: 34, w: 120, ys: [122.265, 144.912, 167.559],   // mm, 3줄일 때 자리
    weightPt: 0.5, dashPt: 2, gapPt: 3,                // 파선 2pt + 간격 3pt, 끝모양 맞대기
    cmyk: [45, 20, 35, 10]                              // 색 견본 '섹션_그레이그린'
  };

  const FONT_FILES = {
    'Pretendard|Regular': 'Pretendard-Regular.ttf', 'Pretendard|Medium': 'Pretendard-Medium.ttf',
    'Pretendard|SemiBold': 'Pretendard-SemiBold.ttf', 'Pretendard|Bold': 'Pretendard-Bold.ttf',
    'Pretendard|ExtraBold': 'Pretendard-ExtraBold.ttf',
    'SUIT|Thin': 'SUIT-Thin.ttf', 'SUIT|ExtraLight': 'SUIT-ExtraLight.ttf',
    'SUIT|Light': 'SUIT-Light.ttf', 'SUIT|SemiBold': 'SUIT-SemiBold.ttf',
    '나눔손글씨 펜|Regular': 'NanumPenScript-Regular.ttf',
    'Wanted Sans|Regular': 'WantedSans-Regular.ttf', 'Wanted Sans|SemiBold': 'WantedSans-SemiBold.ttf'
  };

  const SUBSET = { 'Pretendard-Regular.ttf': false, 'Pretendard-Medium.ttf': false, 'Pretendard-SemiBold.ttf': false, 'Pretendard-Bold.ttf': false, 'Pretendard-ExtraBold.ttf': false, 'NanumPenScript-Regular.ttf': false, 'WantedSans-Regular.ttf': false, 'WantedSans-SemiBold.ttf': false };

  function alignOf(a) {
    a = String(a || '');
    if (a.indexOf('CENTER') === 0) return 'center';
    if (a.indexOf('RIGHT') === 0) return 'right';
    return 'left';
  }

  function splitSentences(text) {
    const out = [];
    String(text || '').split(/\n+/).forEach(par => {
      const s = par.trim(); if (!s) return;
      s.split(/(?<=[.!?])\s+/).forEach(x => { x = x.trim(); if (x) out.push(x); });
    });
    return out;
  }

  async function build(ctx) {
    const { PDFLib, fontkit, asset, rules, pv, mi, cv, input } = ctx;
    const { PDFDocument, cmyk, rgb, BlendMode, pushGraphicsState, popGraphicsState,
            moveTo, appendBezierCurve, closePath, clip, endPath, setCharacterSpacing } = PDFLib;
    const warnings = [];
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    // ---------- 서체 ----------
    const fontCache = {};
    async function font(family, style) {
      const key = family + '|' + style;
      const file = FONT_FILES[key];
      if (!file) throw new Error('서체 없음: ' + key);
      if (!fontCache[file]) fontCache[file] = await doc.embedFont(await asset('fonts/' + file), { subset: SUBSET[file] !== false });
      return fontCache[file];
    }

    // ---------- 이미지 ----------
    const imgCache = {};
    async function bgImage(path) {
      if (!imgCache[path]) imgCache[path] = await doc.embedJpg(await asset(path));
      return imgCache[path];
    }
    async function userImage(bytes) {
      if (!bytes) return null;
      const b = new Uint8Array(bytes);
      if (b[0] === 0x89 && b[1] === 0x50) return doc.embedPng(b);
      return doc.embedJpg(b);
    }

    function colorOf(p) {
      const v = p.colorValue || [0, 0, 0, 100];
      const t = (p.tint == null || p.tint < 0) ? 1 : p.tint / 100;
      return cmyk(v[0] / 100 * t, v[1] / 100 * t, v[2] / 100 * t, v[3] / 100 * t);
    }

    // ---------- 글자 배치 ----------
    function measure(f, size, tracking, s) {
      return f.widthOfTextAtSize(s, size) + size * tracking / 1000 * Math.max(0, s.length - 1);
    }
    // 둥근 따옴표(‘…’ “…”)로 묶인 구간은 한 줄 안에 두기
    function tokens(par) {
      const out = []; let buf = '', q = null;
      const open = { '‘': '’', '“': '”' };
      for (const ch of par) {
        if (q) { buf += ch; if (ch === q) q = null; continue; }
        if (open[ch]) { q = open[ch]; buf += ch; continue; }
        if (ch === ' ') { if (buf) out.push(buf); buf = ''; continue; }
        buf += ch;
      }
      if (buf) out.push(buf);
      return out;
    }
    // 가운데 정렬 문구는 줄 길이를 고르게(같은 줄 수 안에서 가장 좁은 폭을 찾음)
    function wrapBalanced(f, size, tracking, text, maxW) {
      const base = wrap(f, size, tracking, text, maxW);
      if (base.length < 2) return base;
      let lo = maxW * 0.4, hi = maxW;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (wrap(f, size, tracking, text, mid).length <= base.length) hi = mid; else lo = mid;
      }
      return wrap(f, size, tracking, text, hi);
    }
    function wrap(f, size, tracking, text, maxW) {
      const lines = [];
      String(text).split('\n').forEach(par => {
        const words = tokens(par);
        if (!words.length) { lines.push(''); return; }
        let cur = '';
        words.forEach(w => {
          const t = cur ? cur + ' ' + w : w;
          if (measure(f, size, tracking, t) <= maxW) { cur = t; return; }
          if (cur) lines.push(cur);
          if (measure(f, size, tracking, w) <= maxW) { cur = w; return; }
          let piece = '';                                  // 한 어절이 폭보다 길면 글자 단위로
          for (const ch of w) {
            if (measure(f, size, tracking, piece + ch) > maxW && piece) { lines.push(piece); piece = ch; }
            else piece += ch;
          }
          cur = piece;
        });
        lines.push(cur);
      });
      return lines;
    }

    // paras: [{text, spec}] spec = JSON 단락 정보. frame: {x,y,w,h} mm (페이지 왼쪽 위 기준)
    async function layoutParas(paras, frameW) {
      const out = [];
      for (const pa of paras) {
        const s = pa.spec;
        const f = await font(s.font, s.fontStyle);
        const wf = alignOf(s.align) === 'center' ? wrapBalanced : wrap;
        const lines = pa.text === '' ? [''] : wf(f, s.sizePt, s.tracking || 0, pa.text, frameW * MM);
        lines.forEach(l => out.push({ text: l, f, s }));
      }
      return out;
    }
    function blockHeight(lines) {
      if (!lines.length) return 0;
      let h = lines[0].f.heightAtSize(lines[0].s.sizePt, { descender: false });
      for (let i = 1; i < lines.length; i++) h += lines[i].s.leadingPt;
      const last = lines[lines.length - 1];
      h += last.f.heightAtSize(last.s.sizePt) - last.f.heightAtSize(last.s.sizePt, { descender: false });
      return h;
    }
    function drawLines(page, lines, frame, vAlign, label) {
      const top = frame.y * MM, fx = frame.x * MM, fw = frame.w * MM, fh = frame.h * MM;
      const total = blockHeight(lines);
      let start = top;
      if (vAlign === 'CENTER_ALIGN') start = top + (fh - total) / 2;
      if (vAlign === 'BOTTOM_ALIGN') start = top + fh - total;
      let baseline = start;
      lines.forEach((ln, i) => {
        baseline += i === 0 ? ln.f.heightAtSize(ln.s.sizePt, { descender: false }) : ln.s.leadingPt;
        if (!ln.text) return;
        if (baseline > top + fh + 2 && vAlign === 'TOP_ALIGN') {
          if (label) warnings.push(label + ': 프레임을 넘쳐서 일부가 잘립니다');
          label = null; return;
        }
        const cs = ln.s.sizePt * (ln.s.tracking || 0) / 1000;
        const w = measure(ln.f, ln.s.sizePt, ln.s.tracking || 0, ln.text);
        const al = alignOf(ln.s.align);
        const x = al === 'center' ? fx + (fw - w) / 2 : al === 'right' ? fx + fw - w : fx;
        page.pushOperators(setCharacterSpacing(cs));
        page.drawText(ln.text, { x, y: PH - baseline, size: ln.s.sizePt, font: ln.f, color: colorOf(ln.s) });
        page.pushOperators(setCharacterSpacing(0));
      });
    }

    // InDesign '파선 및 간격 조정'처럼 양 끝이 파선으로 끝나도록 간격을 고르게 맞춰 그림
    function drawDashedRule(page, r, yMm) {
      const len = r.w * MM;
      const count = Math.max(1, Math.round((len + r.gapPt) / (r.dashPt + r.gapPt)));
      const gap = count > 1 ? (len - count * r.dashPt) / (count - 1) : 0;
      const y = PH - yMm * MM;
      page.drawLine({
        start: { x: r.x * MM, y }, end: { x: r.x * MM + len, y },
        thickness: r.weightPt, dashArray: [r.dashPt, gap],
        color: cmyk(r.cmyk[0] / 100, r.cmyk[1] / 100, r.cmyk[2] / 100, r.cmyk[3] / 100)
      });
    }

    function fitImage(page, img, frame, mode) {
      const fx = frame.x * MM, fy = PH - (frame.y + frame.h) * MM, fw = frame.w * MM, fh = frame.h * MM;
      const r = img.width / img.height, fr = fw / fh;
      let w, h;
      if (mode === 'fill' ? r > fr : r < fr) { h = fh; w = fh * r; } else { w = fw; h = fw / r; }
      page.drawImage(img, { x: fx + (fw - w) / 2, y: fy + (fh - h) / 2, width: w, height: h,
                            blendMode: mode === 'fit' ? BlendMode.Multiply : BlendMode.Normal });
    }
    function clipOval(page, frame) {
      const x = frame.x * MM, y = PH - (frame.y + frame.h) * MM, w = frame.w * MM, h = frame.h * MM;
      const k = 0.5523, cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
      page.pushOperators(pushGraphicsState(), moveTo(cx + rx, cy),
        appendBezierCurve(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry),
        appendBezierCurve(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy),
        appendBezierCurve(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry),
        appendBezierCurve(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy),
        closePath(), clip(), endPath());
    }

    // ---------- 입력값 정리 ----------
    const name = (input.academy || '').trim() || '[학원명]';
    const director = (input.director || '').trim() || '[원장명]';
    const coverTop = (input.coverTop || '').trim(), coverStrong = (input.coverStrong || '').trim();
    const hasCover = !!(coverTop || coverStrong);
    const greet = String(input.greeting || '').replace(/\r/g, '').trim();
    const sentences = splitSentences(greet);
    const gLines = greet.split(/\n+/).map(x => x.trim()).filter(Boolean);
    let firstSentence = gLines[0] || '';
    if (firstSentence.length > 40) firstSentence = sentences[0] || firstSentence;
    if (!firstSentence) firstSentence = `안녕하세요, ${name} 원장 ${director}입니다.`;
    const bodyText = greet ? greet.slice(greet.indexOf(firstSentence) + firstSentence.length).trim().replace(/\n\s*\n+/g, '\n') : '';
    const logo = await userImage(input.logo);
    const profile = await userImage(input.profile);

    // ---------- 페이지 구성 ----------
    const byNo = {}; rules.pages.forEach(p => { byNo[p.page] = p; });
    const secByCode = {}; rules.sections.forEach(s => { secByCode[s.code] = s; });
    let seq, coverCode;
    if (input.mode === 'template') {
      const t = rules.templates[input.template];
      seq = t.sequence.map(e => ({ page: e.page, section: e.section }));
      coverCode = t.cover;
    } else {
      const chosen = new Set(), secs = new Set();
      rules.topics.filter(t => input.topics.indexOf(t.code) >= 0).forEach(t => {
        t.pages.forEach(p => chosen.add(p)); secs.add(t.section);
      });
      seq = rules.pages.filter(p => p.type === 'fixed' || chosen.has(p.page) ||
                                    (p.type === 'divider' && secs.has(p.section)))
                       .sort((a, b) => a.page - b.page).map(p => ({ page: p.page, section: p.section }));
      coverCode = input.cover;
    }
    const blank = seq.length % 2 === 1;
    const coverSet = rules.covers[coverCode];

    // ---------- 표지 ----------
    const coverW = cv.spreadSizeMm[0] * MM, spineMm = cv.spineMm;
    const coverPageIdx = cv.pages.findIndex(p => p.file === coverSet.outer.split('/').pop());
    const innerPageIdx = cv.pages.findIndex(p => p.file === coverSet.inner.split('/').pop());
    async function coverPanel(fileKey, side) {
      const page = doc.addPage([PW, PH]);
      const img = await bgImage('cover/' + fileKey.replace('.png', '.jpg'));
      page.drawImage(img, { x: side === 'right' ? -(PAGE_W_MM + spineMm) * MM : 0, y: 0, width: coverW, height: PH });
      return page;
    }
    const outerFile = coverSet.outer.split('/').pop(), innerFile = coverSet.inner.split('/').pop();
    const p1 = await coverPanel(outerFile, 'right');
    {
      const items = cv.pages[coverPageIdx].items;
      const want = hasCover ? '표지문구' : '학원명_BRANDBOOK';
      const it = items.find(i => i.name === want);
      const texts = hasCover ? [coverTop, coverStrong] : [name, 'BRANDBOOK'];
      const paras = it.paragraphs.map((s, i) => ({ text: texts[i] || '', spec: s })).filter(p => p.text);
      drawLines(p1, await layoutParas(paras, it.panelMm.w), it.panelMm, it.verticalAlign, '표1');
    }
    const p2 = await coverPanel(innerFile, 'left');
    {
      const items = cv.pages[innerPageIdx].items;
      const get = n => items.find(i => i.name === n);
      const prof = get('프로필사진');
      if (prof && profile) { clipOval(p2, prof.panelMm); fitImage(p2, profile, prof.panelMm, 'fill'); p2.pushOperators(popGraphicsState()); }
      const a = get('표2_학원명');
      drawLines(p2, await layoutParas([{ text: name, spec: a.paragraphs[0] }, { text: 'BRANDBOOK', spec: a.paragraphs[1] }], a.panelMm.w), a.panelMm, a.verticalAlign, '표2 학원명');
      const d = get('표2_원장명');
      drawLines(p2, await layoutParas([{ text: d.paragraphs[0].text.replace('[원장명]', director), spec: d.paragraphs[0] }], d.panelMm.w), d.panelMm, d.verticalAlign, '표2 원장명');
      const g = get('표2_인사말');
      // 단락 역할은 스타일 이름으로 찾음: 표2_인사말 = 맺음, 표2_슬로건 = (빈 줄 +) 슬로건
      const closeSpec = g.paragraphs.find(x => x.style === '표2_인사말') || g.paragraphs[0];
      const sloganSpecs = g.paragraphs.filter(x => x.style === '표2_슬로건');
      const sloganSpec = sloganSpecs[sloganSpecs.length - 1] || closeSpec;
      const gapSpec = sloganSpecs.find(x => !x.text) || null;
      const fC = await font(closeSpec.font, closeSpec.fontStyle);
      const W = g.panelMm.w * MM, ts = closeSpec.tracking || 0, MAXL = 3;
      const nLines = t => wrap(fC, closeSpec.sizePt, ts, t, W).length;
      let pick = [], used = 0;
      for (let i = sentences.length - 1; i >= 0; i--) {
        const n = nLines(sentences[i]);
        if (used + n > MAXL) break;
        pick.unshift(sentences[i]); used += n;
      }
      let closingText = pick.join(' ');
      if (!pick.length && sentences.length) {             // 마지막 문장 하나가 3줄을 넘으면 3줄까지만 + …
        const ls = wrap(fC, closeSpec.sizePt, ts, sentences[sentences.length - 1], W).slice(0, MAXL);
        let last = ls[MAXL - 1];
        while (last && measure(fC, closeSpec.sizePt, ts, last + '…') > W) last = last.slice(0, -1);
        ls[MAXL - 1] = (last || '') + '…';
        closingText = ls.join('\n');
      }
      const gp = [];
      if (closingText) gp.push({ text: closingText, spec: closeSpec });
      if (hasCover) {
        if (gapSpec) gp.push({ text: '', spec: gapSpec });
        gp.push({ text: [coverTop, coverStrong].filter(Boolean).join(' '), spec: sloganSpec });
      }
      drawLines(p2, await layoutParas(gp, g.panelMm.w), g.panelMm, g.verticalAlign, '표2 인사말');
    }

    // ---------- 내지 ----------
    const varByPage = {}; pv.variablePages.forEach(v => { varByPage[v.page] = v.items; });
    const masters = {}; mi.masters.forEach(m => { masters[m.master] = m; });
    const order = [];
    for (let i = 0; i < seq.length; i++) {
      const no = i + 3, side = no % 2 ? 'R' : 'L';
      const e = seq[i], meta = byNo[e.page];
      order.push({ no, side, src: e.page, section: e.section, title: meta.title });
      const page = doc.addPage([PW, PH]);
      const file = meta.files[side] || Object.values(meta.files)[0];
      if (!meta.files[side]) warnings.push(`${e.page}p는 ${side}쪽 이미지가 없어 다른 쪽 이미지를 사용`);
      page.drawImage(await bgImage(file.replace('.png', '.jpg')), { x: 0, y: 0, width: PW, height: PH });

      // 띠·푸터
      let masterName = null;
      if (e.section === 'INTRO') masterName = e.page >= 8 ? 'A-마스터_INTRO' : null;
      else masterName = secByCode[e.section].bodyMaster;
      if (masterName && masters[masterName]) {
        const mp = masters[masterName].pages.find(p => p.side === side);
        const rgbv = (secByCode[e.section].color || {}).rgb;
        for (const it of mp.items) {
          if (it.kind === 'Rectangle' && rgbv) {
            page.drawRectangle({ x: it.mm.x * MM, y: PH - (it.mm.y + it.mm.h) * MM, width: it.mm.w * MM, height: it.mm.h * MM,
                                 color: rgb(rgbv[0] / 255, rgbv[1] / 255, rgbv[2] / 255) });
          } else if (it.kind === 'TextFrame') {
            const paras = it.paragraphs.map(s => ({
              text: s.hasAutoPageNumber ? String(no) : s.text,
              spec: Object.assign({}, s, { colorValue: (s.color && s.color.value) || [0, 0, 0, 100], tint: s.color ? s.color.tint : -1 })
            }));
            drawLines(page, await layoutParas(paras, it.mm.w + 20), it.mm, 'TOP_ALIGN', null);
          }
        }
      }

      // 가변 요소
      const items = varByPage[String(e.page)];
      if (!items) continue;
      const get = n => items.find(i => i.name === n);
      if (e.page === 3) {
        const it1 = get('소개문구_1');
        const lines = await layoutParas([{ text: input.intro || '', spec: it1.paragraphs[0] }], it1.mm.w);
        // 앞뒤 빈 줄은 줄 수에 넣지 않음
        while (lines.length && !lines[0].text) lines.shift();
        while (lines.length && !lines[lines.length - 1].text) lines.pop();
        if (lines.length > 3) warnings.push(`3p 소개 문구: ${lines.length}줄 → 3줄까지만 들어갑니다`);
        // 쓴 줄 수(N)만큼만 글과 점선을 놓고, 3줄 칸의 가운데에 오도록 (3 - N) / 2줄만큼 아래로 내림
        const n = Math.min(lines.length, 3);
        const step = (INTRO_RULE.ys[2] - INTRO_RULE.ys[0]) / 2;
        const shift = (3 - n) / 2 * step;
        ['소개문구_1', '소개문구_2', '소개문구_3'].slice(0, n).forEach((name, k) => {
          const fr = get(name).mm;
          if (lines[k].text) drawLines(page, [lines[k]], { ...fr, y: fr.y + shift }, 'TOP_ALIGN', null);
          drawDashedRule(page, INTRO_RULE, INTRO_RULE.ys[k] + shift);
        });
        const lg = get('로고'), tx = get('학원명_텍스트');
        if (logo) fitImage(page, logo, lg.mm, 'fit');
        else drawLines(page, await layoutParas([{ text: name, spec: tx.paragraphs[0] }], tx.mm.w), tx.mm, tx.verticalAlign, '3p 학원명');
      }
      if (e.page === 4) {
        const it = get('인사말_첫문장');
        drawLines(page, await layoutParas([{ text: firstSentence, spec: it.paragraphs[0] }], it.mm.w), it.mm, it.verticalAlign, '4p 인사말 첫 문장');
      }
      if (e.page === 5) {
        const it = get('인사말_본문'), col = it.columns;
        const lines = await layoutParas([{ text: bodyText, spec: it.paragraphs[0] }], col.widthMm);
        while (lines.length && !lines[lines.length - 1].text) lines.pop();
        if (!lines.length) continue;                    // 인사말이 한 줄뿐이거나 비어 있으면 5p 본문 없음
        const leftN = Math.ceil(lines.length / 2);
        const perCol = Math.floor((it.mm.h * MM - lines[0].f.heightAtSize(9)) / it.paragraphs[0].leadingPt) + 1;
        if (leftN > perCol) warnings.push(`5p 인사말 본문: ${lines.length}줄 → 단마다 ${perCol}줄까지 들어갑니다`);
        drawLines(page, lines.slice(0, leftN), { x: it.mm.x, y: it.mm.y, w: col.widthMm, h: it.mm.h }, 'TOP_ALIGN', '5p 인사말(왼쪽 단)');
        drawLines(page, lines.slice(leftN), { x: it.mm.x + col.widthMm + col.gutterMm, y: it.mm.y, w: col.widthMm, h: it.mm.h }, 'TOP_ALIGN', '5p 인사말(오른쪽 단)');
      }
    }
    if (blank) { doc.addPage([PW, PH]); order.push({ no: seq.length + 3, side: (seq.length + 3) % 2 ? 'R' : 'L', src: null, section: null, title: '빈 페이지' }); }

    await coverPanel(innerFile, 'right');   // 표3
    await coverPanel(outerFile, 'left');    // 표4

    const innerPages = seq.length + (blank ? 1 : 0);
    const spineRow = (rules.spine.table || []).find(r => r.innerPages === innerPages);
    const bytes = await doc.save();
    return { bytes, order, innerPages, totalPages: innerPages + 4, blank, cover: coverCode,
             spineMm: spineRow ? spineRow.spineMm : null, warnings: Array.from(new Set(warnings)) };
  }

  root.BrandbookEngine = { build, splitSentences };
  if (typeof module !== 'undefined') module.exports = root.BrandbookEngine;
})(typeof window !== 'undefined' ? window : globalThis);
