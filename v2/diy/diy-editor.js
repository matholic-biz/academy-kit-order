/* 우리학원 브랜드북 — 앞부분(3~12p) 직접 꾸미기 편집기 (2026-11-05, 11-06 개편: 3p·12p 고정 / 4~11p 템플릿 10종 / 작성 도우미 / 자동 저장)
 *
 * 맞춤형 앞부분 10p(3~12p)를 원장님이 고른 페이지로 바꿉니다. 단위는 세 가지:
 *   3p  = 낱장(오른쪽, 표2와 마주 봄)
 *   4~11p = 펼침면 0~4개
 *   마지막 = 낱장(왼쪽)
 * 쪽수가 늘 짝수라 13p부터의 뒷부분 좌우가 바뀌지 않습니다.
 *
 * 책(book) = { info, first, spreads:[], last }
 *   info: 학원 기본 정보 { academy, director, cover(표지 문구), logoUrl, profileUrl, address, phone, visit — 예전 12p 오시는 길용, 지금은 화면에 안 보임 } — 편집기 맨 앞 [학원 기본 정보]에서 입력
 *   한 칸(slot) = { kind:'single'|'spread', side:'R'|'L'(낱장만), layout, theme, saved, cache, guide }
 *     saved: 편집한 상태(JSON 문자열). 없으면 layout의 예시 내용으로 그립니다.
 *     cache: { 템플릿: saved } — 템플릿을 바꿨다 돌아와도 쓰던 글·사진을 되살림. guide: { 템플릿: { t(고른 항목), kw(고른 키워드), own(직접 쓴 글) } }
 *
 * 쓰는 법 (index.html):
 *   DiyEditor.setBook(book)                            // 학원명·로고가 꾸미기 페이지 학원명 자리에 자동으로 들어감
 *   DiyEditor.openBook(book, { start, startMode:'B', cover:'01', cv, labelsFor, backPages, onChange, onSave, onClose })
 *     book.last = 12p 쉬어 가는 페이지(layout:'prologue', 매쓰홀릭 고정 그림 diy/fixed/p012_prologue.jpg)
 *     backPages(): 13p부터 들어갈 매쓰홀릭 페이지 [{ mh:true, sample, title, imgs:[{ no, src }] }] — 아래 줄·미리보기용(편집 불가)
 *     onSave(): 바뀐 내용을 저장할 때마다 부름(index.html이 IndexedDB에 저장)
 *   await DiyEditor.renderPages(slot, { ppi, bleed })  // 쪽마다 이미지(dataURL) 배열
 *   DiyEditor.greetingText(slot)                       // 인사말 펼침면이면 그 글, 아니면 ''
 *   DiyEditor.closingText(book)                        // 표2 맺음말 원문(인사말 펼침면 → 없으면 3p 학원 소개)
 * AI 문구 도우미는 쓰지 않음(2026-11-05 회의) — 템플릿마다 [작성 도우미](질문 → 키워드 하나 → 연결된 추천 문구 하나 → [○○에 적용])로 대신합니다.
 *
 * 테마 배경은 디자이너 시안이 오기 전까지 섹션 색으로 그린 임시안, 구성(layout)은 임시 콘텐츠입니다.
 * Fabric.js 5.3.0 필요.
 */
(function(){
'use strict';
const $ = id => document.getElementById(id);

// ===================== 판형 (단위: mm) =====================
const BLEED = 3, PAGE_W = 182, PAGE_H = 257, SAFE = 10, H = PAGE_H + BLEED * 2;
const PRINT_PPI = 300;
const PX_PER_MM = ppi => ppi / 25.4;
const PT = 72 / 25.4;                       // 글자 크기 표시용: mm → pt
const FONT = 'DxPretendard', PEN = 'DxPen';

// 캔버스 원점은 도련 끝. 펼침면은 370×263, 낱장은 접히는 쪽 도련이 없어 185×263.
// pages[].x = 그 쪽 재단선 왼쪽 끝, fold = 접히는 곳.
function geom(kind, side){
  if(kind === 'spread') return { W:PAGE_W * 2 + BLEED * 2, H, pages:[{ x:BLEED, side:'L' }, { x:BLEED + PAGE_W, side:'R' }], fold:BLEED + PAGE_W };
  if(side === 'R') return { W:PAGE_W + BLEED, H, pages:[{ x:0, side:'R' }], fold:0 };
  return { W:PAGE_W + BLEED, H, pages:[{ x:BLEED, side:'L' }], fold:PAGE_W + BLEED };
}

const C = {
  ink:'#10282B', body:'#45585B', teal:'#028090', mint:'#02C39A',
  grayGreen:'rgb(156,178,167)', yellow:'rgb(255,244,174)', peach:'rgb(246,216,200)',
  paleMint:'#EAF7F4', white:'#FFFFFF',
};
const TEXT_COLORS = [C.ink, C.body, C.teal, '#FFFFFF'];

fabric.Object.prototype.objectCaching = false;   // 확대·고해상도 내보내기에서 글자가 흐려지지 않게
fabric.Object.prototype.set({ cornerColor:C.teal, cornerStrokeColor:'#fff', borderColor:C.teal, transparentCorners:false, cornerSize:9 });

// ===================== 배경 테마 (임시: 섹션 색) =====================
const THEMES = {
  clean: { name:'화이트', dot:`linear-gradient(${C.grayGreen} 0 30%, #fff 30%)`,
    draw: g => [rect(0, 0, g.W, g.H, C.white), rect(0, 0, g.W, 14, C.grayGreen)] },
  green: { name:'그레이그린', dot:C.grayGreen,
    draw: g => [rect(0, 0, g.W, g.H, C.white), g.pages.length > 1 ? rect(0, 0, g.fold, g.H, C.grayGreen) : rect(0, 0, g.W, 92, C.grayGreen)] },
  yellow: { name:'옐로', dot:C.yellow,
    draw: g => [rect(0, 0, g.W, g.H, 'rgb(255,250,222)'), rect(0, g.H - 12, g.W, 12, C.teal)] },
  peach: { name:'피치', dot:C.peach,
    draw: g => [rect(0, 0, g.W, g.H, C.white), g.pages.length > 1 ? rect(g.fold, 0, g.W - g.fold, g.H, C.peach) : rect(0, g.H - 90, g.W, 90, C.peach)] },
};
function rect(x, y, w, h, fill){ return new fabric.Rect({ left:x, top:y, width:w, height:h, fill, strokeWidth:0 }); }
function themeGroup(g, id){ return new fabric.Group((THEMES[id] || THEMES.clean).draw(g), { left:0, top:0 }); }

// ===================== InDesign 테마 (2026-11-06: 테마_export.jsx → 테마_웹변환.py → diy/theme/T1) =====================
// 템플릿 모음(_내지_1105.indd)에서 뽑은 theme.json이 있으면 그 칸 위치·서식과 배경 그림(색 변형별)으로 그립니다.
// 없거나 그 템플릿이 theme.json에 없으면 아래 LAYOUTS(임시 구성)·THEMES(임시 색)를 씁니다.
const THEME_DIR = 'diy/theme/T1/';
let THEME = null, themeReady = null;
const OLD_THEME = { clean:'v1', green:'v1', yellow:'v2', peach:'v4' };   // 예전에 저장한 색 → 변형
function loadTheme(){
  if(!themeReady) themeReady = fetch(THEME_DIR + 'theme.json', { cache:'no-cache' }).then(r => r.ok ? r.json() : null).then(t => {
    if(!t || !t.variants) return null;
    THEME = t;
    Object.keys(THEMES).forEach(k => delete THEMES[k]);
    t.variants.forEach(v => { const c = v.colors && v.colors['강조']; THEMES[v.id] = { name:v.name, dot:c && c.rgb ? `rgb(${c.rgb.join(',')})` : '#ccc' }; });
    // 점 색 = 배경 그림 왼쪽 끝 띠에서 실제 색을 읽음(띠 색조를 InDesign에서 바꿔도 그대로 따라감)
    return Promise.all(t.variants.map(v => sampleBand(THEME_DIR + 'bg/' + v.id + '/greeting.jpg').then(rgb => { if(rgb) THEMES[v.id].dot = `rgb(${rgb.join(',')})`; }))).then(() => t);
  }).catch(() => null);
  return themeReady;
}
function sampleBand(url){
  return new Promise(res => { const im = new Image(); im.onload = () => { try{
    const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d');
    x.drawImage(im, im.width * 0.01, im.height / 2, 1, 1, 0, 0, 1, 1); res([...x.getImageData(0, 0, 1, 1).data].slice(0, 3));
  }catch(e){ res(null); } }; im.onerror = () => res(null); im.src = url; });
}
const THEME_VER = () => THEME ? `${THEME.theme}:${THEME.version}` : '';
const themeSpread = id => THEME && THEME.spreads.find(x => x.id === id && !x.fixed);
const themeId = id => !THEME ? id : THEMES[id] ? id : (OLD_THEME[id] || THEME.variants[0].id);
// 저장해 둔 편집이 지금 테마로 만든 것인지(아니면 글만 옮겨 새 칸에 넣음)
const savedOk = json => { if(!THEME) return true; try{ return JSON.parse(json).tv === THEME_VER(); }catch(e){ return false; } };

const FONT_MAP = { 'Wanted Sans':'DxWanted', 'Pretendard':FONT };
const W_MAP = { Thin:100, ExtraLight:200, Light:300, Regular:400, Medium:500, SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
const alignOf = a => /CENTER/.test(a || '') ? 'center' : /RIGHT/.test(a || '') ? 'right' : 'left';
const rgbOf = (c, def) => c && c.rgb ? `rgb(${c.rgb.join(',')})` : def;
const TAG_PAD = 3, TAG_GAP = 1.2;   // 해시태그 알약: 글 양옆 여백·알약 사이 (mm)
// 낱장 오른쪽(3p)은 InDesign 그림에 접히는 쪽 도련이 있어 캔버스(접히는 쪽 도련 없음)보다 3mm 넓음 → 왼쪽으로 3mm
const themeDx = (ts, g) => ts.kind === 'single' && g.pages[0].side === 'R' ? -BLEED : 0;
function themeObjs(ts, g){
  const dx = themeDx(ts, g), out = [];
  const logo = ts.items.find(it => it.key === 'logo');
  ts.items.forEach(it => {
    const m = it.mm, x = m.x + dx;
    if(it.key === 'logo') return;   // 로고는 학원명 칸 자리에(fillAuto)
    if(it.type === 'frame'){ if(/^사진_/.test(it.name)) out.push(frame(x, m.y, m.w, m.h, it.key || it.name, it.label || '사진')); return; }
    const p = (it.paragraphs || [])[0] || {};
    const tag = /^글_태그\s*(\d+)/.exec(it.name);
    const key = it.key || (tag ? 'tag' + tag[1] : it.name.replace(/^글_/, ''));
    const sizePt = p.sizePt || 10, lead = typeof p.leadingPt === 'number' ? p.leadingPt : sizePt * 1.2;
    const o = new fabric.Textbox(String(it.text || '').replace(/\r/g, '\n'), { left:x, top:m.y, width:m.w, fontSize:sizePt / PT, lineHeight:lead / sizePt / 1.13,
      fontFamily:FONT_MAP[p.font] || FONT, fontWeight:W_MAP[p.fontStyle] || 400, charSpacing:p.tracking || 0, fill:rgbOf(p.color, C.ink), textAlign:alignOf(p.align),
      role:'text', key, label:tag ? `해시태그 ${tag[1]}` : (it.label || key) });
    if(p.ruleBelow) o.set('underline', true);              // 밑줄 라벨(글_주제): 단락 경계선(아래) → 글 길이만큼 밑줄
    if(tag && it.stroke) o.set({ pill:{ stroke:rgbOf(it.stroke, C.teal), weight:(it.stroke.weightPt || 0.3) / PT, r:it.cornerMm || m.h / 2, h:m.h }, rowX:x });
    if(it.verticalAlign === 'CENTER_ALIGN') o.set('top', m.y + (m.h - o.height) / 2);
    if(key === 'academy') o.set({ boxL:x, boxT:m.y, boxW:m.w, boxH:m.h, logoBox:!!logo });
    out.push(o);
  });
  reflowTags(out);
  return out;
}
// 해시태그 알약: 글 길이에 맞춰 폭을 정하고 왼쪽부터 나란히. 빈 태그는 숨김
function reflowTags(objs){
  const tags = objs.filter(o => /^tag\d+$/.test(o.key || '') && o.pill).sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric:true }));
  if(!tags.length) return;
  let x = tags[0].rowX != null ? tags[0].rowX : tags[0].left;
  tags.forEach(o => {
    const t = String(o.text || '').trim();
    o.set('visible', !!t);
    if(!t) return;
    const probe = new fabric.Text(t, { fontSize:o.fontSize, fontFamily:o.fontFamily, fontWeight:o.fontWeight, charSpacing:o.charSpacing });
    o.set({ width:probe.width + TAG_PAD * 2, left:x });
    o.initDimensions(); o.setCoords();
    x += o.width + TAG_GAP;
  });
}
// 알약 테두리: 글상자 배경 자리에 둥근 사각형(높이는 InDesign 칸 높이)
(function(){
  const base = fabric.Textbox.prototype._renderBackground;
  fabric.Textbox.prototype._renderBackground = function(ctx){
    const p = this.pill;
    if(p && String(this.text || '').trim()){
      const w = this.width, h = p.h, r = Math.min(p.r, h / 2), x = -w / 2 + p.weight / 2, y = -h / 2, ww = w - p.weight;
      ctx.save(); ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + ww - r, y); ctx.arcTo(x + ww, y, x + ww, y + r, r); ctx.lineTo(x + ww, y + h - r); ctx.arcTo(x + ww, y + h, x + ww - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
      ctx.lineWidth = p.weight; ctx.strokeStyle = p.stroke; ctx.stroke(); ctx.restore();
    }
    return base.call(this, ctx);
  };
})();
// 템플릿 칸 만들기: theme.json에 있으면 그것, 없으면 임시 구성
function buildObjs(id, g){ const ts = themeSpread(id); return ts ? themeObjs(ts, g) : LAYOUTS[id].build(g); }
// 예전 테마로 저장한 편집이면: 새 칸을 만들고 같은 칸 이름(key)의 글만 옮김
function carryText(json, objs){
  try{ (JSON.parse(json).canvas.objects || []).forEach(x => { if(!x.key || typeof x.text !== 'string') return; const o = objs.find(y => y.key === x.key && y.type === 'textbox'); if(o && x.key !== 'academy') o.set('text', x.text); }); }catch(e){}
  reflowTags(objs);
  return objs;
}
// 배경: 변형 색의 배경 그림 + 실제 책 쪽 번호(theme.json footer가 있을 때). 그림이 없으면 임시 THEMES
const bgCache = {};
const loadEl = url => bgCache[url] || (bgCache[url] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }));
async function backgroundFor(layout, g, theme, pageNos){
  const ts = themeSpread(layout);
  if(!ts) return THEMES[theme] && THEMES[theme].draw ? themeGroup(g, theme) : null;
  const el = await loadEl(`${THEME_DIR}bg/${themeId(theme)}/${layout}.jpg`);
  if(!el) return null;
  const k = ts.sizeMm[0] / el.naturalWidth;
  const objs = [new fabric.Image(el, { left:themeDx(ts, g), top:0, scaleX:k, scaleY:k })];
  const ft = THEME.footer || {};
  (pageNos || []).forEach((no, i) => {
    const pg = ts.pages[i], gp = g.pages[i]; if(!pg || !gp || !no) return;
    const spec = ft[pg.master] && ft[pg.master][pg.side]; if(!spec) return;
    const f = spec.format || {}, sizePt = f.sizePt || 7;
    objs.push(new fabric.Textbox(String(no), { left:gp.x + spec.mm.x, top:BLEED + spec.mm.y, width:spec.mm.w, fontSize:sizePt / PT, lineHeight:1,
      fontFamily:FONT_MAP[f.font] || FONT, fontWeight:W_MAP[f.fontStyle] || 400, fill:rgbOf(f.color, '#000'), textAlign:alignOf(f.align) }));
  });
  return objs.length > 1 ? new fabric.Group(objs, { left:objs[0].left, top:0 }) : objs[0];
}

// ===================== 구성 (2026-11-06: 3p·12p 고정, 4~11p는 두 쪽 템플릿 10종) =====================
// build(g): g의 쪽 위치 기준으로 글·사진 칸을 만듭니다. L = 첫 쪽 안전 영역 왼쪽, R = 둘째 쪽(펼침면) 안전 영역 왼쪽.
// key·label이 있는 칸은 [내용 입력]의 왼쪽 입력칸에 나옵니다. fixed:true = 위치·레이아웃 고정(내용만 입력).
const COL = PAGE_W - SAFE * 2;
const at = g => ({ L:g.pages[0].x + SAFE, R:(g.pages[1] || g.pages[0]).x + SAFE });
const eyebrow = (s, x, y = 24, o = {}) => text(s, x, y, COL, 3.6, Object.assign({ fontWeight:700, fill:C.teal }, o));
const TT_DAYS = ['월', '화', '수', '목', '금', '토'], TT_ROWS = 6;
// 상담 절차: 원장님이 실제 진행 순서대로 고른 절차 = 책의 STEP. 선택지마다 미리 써 둔 제목·설명(직접 작성도 가능)
const FLOW_OPTS = [
  { id:'reserve', label:'상담 예약', t:'상담 예약', d:'전화나 문자로 편하신 날짜와 시간을 정해 상담을 예약해 주세요.' },
  { id:'talk', label:'학습 고민 상담', t:'학습 고민 상담', d:'아이가 수학에서 어떤 점을 어려워하는지, 학부모님이 걱정하시는 부분을 먼저 듣습니다.' },
  { id:'test', label:'레벨 테스트', t:'레벨 테스트', d:'학년에 맞는 문제를 풀어보며 이해한 개념과 어려워하는 부분을 확인합니다.' },
  { id:'note', label:'교재·노트 확인', t:'교재·노트 확인', d:'평소 풀던 교재와 노트를 함께 보며 풀이 습관과 막히는 부분을 살펴봅니다.' },
  { id:'result', label:'결과 상담', t:'결과 상담', d:'테스트와 상담에서 확인한 내용을 학부모님과 함께 보며 지금 아이의 학습 상태를 설명해 드립니다.' },
  { id:'plan', label:'학습 계획 안내', t:'학습 계획 안내', d:'무엇부터 어떻게 공부할지, 아이에게 맞춘 학습 계획을 안내합니다.' },
  { id:'class', label:'반 배정', t:'반 배정', d:'학습 수준과 목표를 바탕으로 아이에게 맞는 반과 수업 일정을 정합니다.' },
  { id:'first', label:'첫 수업', t:'첫 수업', d:'첫 수업 뒤에는 아이가 수업에 어떻게 적응하고 있는지 학부모님께 알려드립니다.' },
];
const FLOW_DEFAULT = [];   // 처음엔 단계 없이 시작 — 원장님이 고른 순서대로 STEP이 생김
const FLOW_MAX = 6;
// 오른쪽 페이지 STEP 상자: 단계 수에 맞춰 높이·간격·글자 크기를 자동으로 나눔
function flowStepObjs(g, list){
  const R = (g.pages[1] || g.pages[0]).x + SAFE, n = list.length, top = 24, area = 214, gap = n > 4 ? 5 : 7;
  const h = (area - gap * (n - 1)) / n, compact = h < 44;
  return list.map((st, i) => { const y = top + i * (h + gap);
    return [
      new fabric.Rect({ left:R, top:y, width:COL, height:h, rx:4, ry:4, fill:C.paleMint, strokeWidth:0, row:i + 1 }),
      text(`STEP ${i + 1}`, R + 8, y + (compact ? 4 : 8), 40, compact ? 3.2 : 3.6, { fontWeight:700, fill:C.teal, row:i + 1 }),
      text(st.t, R + 8, y + (compact ? 9 : 15), COL - 16, compact ? 4.6 : 5, { fontWeight:700, key:`step${i + 1}`, label:`STEP ${i + 1} 제목`, grp:'opt:' + st.id, row:i + 1 }),
      text(st.d, R + 8, y + (compact ? 16 : 24), COL - 16, compact ? 3.3 : 3.5, { fill:C.body, lineHeight:1.55, key:`step${i + 1}d`, label:`STEP ${i + 1} 설명`, row:i + 1 }),
    ]; }).flat();
}
// 학원 시간표 데이터: classes(반 → 요일·시간 묶음 여러 개) / guides(반 안내: 이름·대상·수업 키워드·소개 글)
const TT_WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const TT_KW = [['개념 학습', '교과서 개념을 차근차근 익히고, 왜 그렇게 되는지 이해하며 공부합니다.'],
  ['내신 대비', '학교 진도와 시험 범위에 맞춰 내신 시험을 준비합니다.'],
  ['심화 학습', '기본 개념을 바탕으로 한 단계 더 깊이 생각하는 문제에 도전합니다.'],
  ['부족한 부분 보충', '수업에서 어려웠던 부분을 다시 짚어 보며 빈틈을 채웁니다.']];
const TT_MAX_CLASS = 8, TT_MAX_GUIDE = 4;
const TT_EMPTY = () => ({ classes:[{ name:'', slots:[{ days:[], from:'', to:'' }] }], guides:[{ name:'', target:'', kws:[], text:'' }] });
const ttTime = sl => sl.from && sl.to ? `${sl.from}\n~${sl.to}` : (sl.from || sl.to || '');
function ttObjs(g, M, top0 = 72){
  const L = g.pages[0].x + SAFE, R = (g.pages[1] || g.pages[0]).x + SAFE, out = [];
  const T = (str, x, y, w, size, o) => text(str, x, y, w, size, Object.assign({ grp:'tt' }, o));
  out.push(new fabric.Rect({ left:0, top:0, width:1, height:1, visible:false, selectable:false, evented:false, role:'ttdata', grp:'tt', label:JSON.stringify(M) }));
  // 왼쪽: 표 (반 = 행, 요일 = 열, 칸 = 수업 시간)
  const rows = M.classes.filter(c => c.name.trim() || c.slots.some(sl => sl.days.length && (sl.from || sl.to)));
  let days = TT_WEEK.filter(d => rows.some(c => c.slots.some(sl => sl.days.includes(d) && (sl.from || sl.to))));
  if(!days.length) days = TT_WEEK.slice(0, 5);
  if(rows.length){
    const c0 = 34, cw = (COL - c0) / days.length, y0 = top0, hh = 11;
    out.push(new fabric.Rect({ left:L, top:y0, width:COL, height:hh - 1, rx:2, ry:2, fill:C.ink, strokeWidth:0, grp:'tt' }));
    [['반', L, c0], ...days.map((d, j) => [d, L + c0 + j * cw, cw])].forEach(([t, x, w]) => out.push(T(t, x, y0 + 3.2, w, 3.4, { fontWeight:700, fill:'#fff', textAlign:'center' })));
    const cells = rows.map(c => days.map(d => c.slots.filter(sl => sl.days.includes(d)).map(ttTime).filter(Boolean).join('\n')));
    const lines = cells.map(r => Math.max(1, ...r.map(v => v ? v.split('\n').length : 1)));
    let fs = 3.1, unit = 4.1, pad = 5, total = lines.reduce((a, n) => a + n * unit + pad, 0);
    if(y0 + hh + total > 238){ const k = (238 - y0 - hh) / total; fs *= Math.max(0.7, k); unit *= Math.max(0.7, k); pad *= Math.max(0.6, k); }
    let y = y0 + hh;
    rows.forEach((c, i) => {
      const rh = lines[i] * unit + pad;
      out.push(new fabric.Rect({ left:L, top:y, width:c0 - 1, height:rh - 1, rx:2, ry:2, fill:'#EEF2F1', strokeWidth:0, grp:'tt', row:i + 1 }));
      const nm = T(c.name, L + 1, 0, c0 - 3, Math.min(3.4, fs + 0.3), { fontWeight:700, textAlign:'center', row:i + 1 }); nm.set('top', y + (rh - 1 - nm.height) / 2); out.push(nm);
      days.forEach((d, j) => { const v = cells[i][j];
        out.push(new fabric.Rect({ left:L + c0 + j * cw, top:y, width:cw - 1, height:rh - 1, rx:2, ry:2, fill:v ? C.paleMint : '#F6F8F8', strokeWidth:0, grp:'tt', row:i + 1 }));
        if(v){ const t = T(v, L + c0 + j * cw, 0, cw - 1, fs, { fontWeight:600, fill:C.teal, textAlign:'center', lineHeight:1.15, row:i + 1 }); t.set('top', y + (rh - 1 - t.height) / 2); out.push(t); } });
      y += rh;
    });
  }
  // 오른쪽: 반 안내 (개수에 맞춰 상자 높이 자동)
  out.push(T('반 안내', R, 33, COL, 9, { fontWeight:700 }));
  const gs = M.guides.filter(x => x.name.trim() || x.text.trim()), n = gs.length, gap = 6, top = 54;
  const h = n ? Math.min(62, (238 - top - gap * (n - 1)) / n) : 0;
  gs.forEach((x, i) => { const y = top + i * (h + gap);
    out.push(new fabric.Rect({ left:R, top:y, width:COL, height:h, rx:4, ry:4, fill:C.paleMint, strokeWidth:0, grp:'tt', card:'g' + (i + 1) }),
      T(x.name, R + 8, y + 7, COL - 16, 5, { fontWeight:700, card:'g' + (i + 1) }));
    if(x.target.trim()) out.push(T(`대상 · ${x.target}`, R + 8, y + 16, COL - 16, 3.4, { fontWeight:600, fill:C.teal, card:'g' + (i + 1) }));
    out.push(T(x.text, R + 8, y + (x.target.trim() ? 24 : 16), COL - 16, 3.4, { fill:C.body, lineHeight:1.6, card:'g' + (i + 1) }));
  });
  return out;
}
// 선생님 소개 데이터: mode(one/with/staff) + people[{ name, role, grades[], bio }] — 사진은 tp1, tp2 … 칸에 그대로 둠
const TC_GRADES = ['초등', '중1', '중2', '중3', '고1', '고2', '고3'];
const TC_MAX = 6;
const TC_EMPTY = () => ({ mode:null, people:[] });
const tcPerson = (role = '') => ({ name:'', role, grades:[], bio:'' });
// 오른쪽 페이지: 1명이면 크게, 2명이면 위아래, 3명 이상이면 두 줄 격자. 사진 칸(tpN)은 frame으로 만들고 올린 사진은 tcDraw가 옮겨 끼움.
function tcBoxes(g, n){
  const R = (g.pages[1] || g.pages[0]).x + SAFE, top = 24, area = 214, out = [];
  if(n === 1) return [{ photo:{ x:R, y:top, w:COL, h:130 }, tx:R, ty:top + 138, tw:COL, big:true }];
  if(n === 2){ const h = (area - 10) / 2;
    for(let i = 0; i < 2; i++){ const y = top + i * (h + 10); out.push({ photo:{ x:R, y, w:72, h:Math.min(92, h) }, tx:R + 80, ty:y + 4, tw:COL - 80 }); } return out; }
  const rows = Math.ceil(n / 2), gap = 8, ch = (area - gap * (rows - 1)) / rows, ph = Math.max(34, Math.min(70, ch - 34));
  for(let i = 0; i < n; i++){ const x = R + (i % 2) * 84, y = top + Math.floor(i / 2) * (ch + gap); out.push({ photo:{ x, y, w:78, h:ph }, tx:x, ty:y + ph + 4, tw:78 }); }
  return out;
}
function tcObjs(g, M){
  const out = [new fabric.Rect({ left:0, top:0, width:1, height:1, visible:false, selectable:false, evented:false, role:'tcdata', grp:'tc', label:JSON.stringify(M) })];
  const B = tcBoxes(g, M.people.length);
  M.people.forEach((p, i) => { const b = B[i], n = i + 1, small = !b.big && M.people.length > 2;
    out.push(Object.assign(frame(b.photo.x, b.photo.y, b.photo.w, b.photo.h, `tp${n}`, `선생님 ${n} 사진`), { card:n, grp:'tc' }));
    let y = b.ty;
    const add = (str, size, o) => { if(!String(str).trim()) return; const t = text(str, b.tx, y, b.tw, size, Object.assign({ grp:'tc', card:n }, o)); out.push(t); y += t.height + 1.5; };
    add(p.name, b.big ? 6 : small ? 4.2 : 5, { fontWeight:700 });
    add([p.role, p.grades.join('·')].filter(Boolean).join(' · '), b.big ? 3.8 : 3.3, { fontWeight:600, fill:C.teal });
    add(p.bio, b.big ? 3.6 : 3.3, { fill:C.body, lineHeight:1.55 });
  });
  return out;
}
// 학년별 커리큘럼: courses[{ grades[], label(예전 자료), dir, t, d }] + note{ type, title, text }
const CU_DIRS = [['basic', '기초 다지기'], ['school', '학교 진도 학습'], ['adv', '응용·심화'], ['exam', '내신 대비'], ['next', '다음 학년 준비']];
const CU_TEXT = {   // 학년 단계 × 수업 방향 → 미리 써 둔 수업 제목·설명
  e1:{ basic:['수와 연산의 기초를 탄탄하게', '수를 세고 더하고 빼는 원리를 구체물과 그림으로 익힙니다. 계산이 익숙해질 때까지 차근차근 연습합니다.'],
    school:['교과서 진도에 맞춰 차근차근', '학교에서 배우는 단원을 미리 살펴보고 복습하며, 배운 내용을 자기 말로 설명해 봅니다.'],
    adv:['생각하는 힘을 기르는 수학', '기본 문제를 익힌 뒤 규칙 찾기와 문장 문제로 생각하는 힘을 기릅니다.'],
    exam:['단원 평가 꼼꼼히 준비', '단원이 끝날 때마다 배운 내용을 정리하고, 틀린 문제를 다시 풀며 단원 평가를 준비합니다.'],
    next:['다음 학년을 미리 준비', '이번 학년의 핵심 개념을 정리하고, 다음 학년에서 이어 배울 내용을 미리 살펴봅니다.'] },
  e2:{ basic:['초등 수학의 기초를 탄탄하게', '분수·소수와 도형처럼 처음 만나는 개념을 그림과 예로 이해하고 기본 문제로 확인합니다.'],
    school:['학교 진도에 맞춘 개념 학습', '학교에서 배우는 단원을 미리 익히고 복습하며, 개념을 정확히 이해했는지 확인합니다.'],
    adv:['응용·심화로 넓히는 생각', '기본 개념을 바탕으로 여러 단계를 거쳐 푸는 문제에 도전하며 생각하는 힘을 키웁니다.'],
    exam:['단원 평가 대비', '단원별로 배운 내용을 정리하고, 자주 틀리는 유형을 다시 풀며 평가를 준비합니다.'],
    next:['다음 학년을 미리 준비', '이번 학년 개념을 마무리하고, 다음 학년에서 배울 내용과 이어지는 부분을 미리 살펴봅니다.'] },
  m:{ basic:['중학교 수학의 기초를 탄탄하게', '새롭게 배우는 개념을 이해하고 기본 문제로 확인합니다. 어려워하는 부분은 이전 개념부터 다시 짚어봅니다.'],
    school:['학교 진도에 맞춘 개념 학습', '학교 수업 진도에 맞춰 단원별 개념을 정리하고, 유형별 문제로 이해한 내용을 확인합니다.'],
    adv:['응용·심화로 실력 키우기', '기본 개념을 여러 단원과 연결해 생각하는 응용·심화 문제에 도전합니다.'],
    exam:['학교 시험 꼼꼼히 대비', '시험 범위의 개념을 다시 정리하고, 자주 틀리는 유형을 반복해 풀며 내신 시험을 준비합니다.'],
    next:['다음 학년을 미리 준비', '이번 학년 개념을 마무리하고, 다음 학년에서 이어지는 단원을 미리 살펴봅니다.'] },
  h:{ basic:['고등 수학의 기초를 탄탄하게', '중학 개념과 이어지는 부분부터 다시 짚고, 고등 수학의 기본 개념을 정확히 익힙니다.'],
    school:['학교 진도에 맞춘 개념 학습', '학교 수업 진도에 맞춰 개념을 정리하고, 유형별 문제로 적용하는 힘을 기릅니다.'],
    adv:['응용·심화로 실전 대비', '여러 개념을 연결해 푸는 문제에 도전하며 실전에서 꺼내 쓰는 힘을 기릅니다.'],
    exam:['내신 시험 꼼꼼히 대비', '시험 범위의 개념과 자주 틀리는 유형을 다시 정리하며 내신 시험을 준비합니다.'],
    next:['다음 학년을 미리 준비', '이번 학년 개념을 마무리하고, 다음 학년에서 배울 단원을 미리 살펴봅니다.'] },
  초6:{ next:['중학교 수학을 미리 준비', '초등 과정을 마무리하며 중학교에서 배울 문자와 식, 정수의 개념을 미리 만나 봅니다.'] },
  중3:{ next:['고등 수학으로 이어지는 준비', '중학 과정을 마무리하며 고등 수학으로 이어지는 단원을 미리 다집니다.'] },
  고3:{ next:['수능까지 이어지는 준비', '배운 개념을 단원별로 다시 정리하며 수능형 문제에 필요한 힘을 기릅니다.'] },
};
const cuStage = gr => /^초[12]$/.test(gr) ? 'e1' : gr[0] === '초' ? 'e2' : gr[0] === '중' ? 'm' : 'h';
const cuSuggest = (grades, dir) => { const g0 = grades[grades.length - 1] || grades[0] || '중1';   // 묶음이면 마지막 학년 기준(‘다음 학년 준비’가 자연스럽게)
  return (CU_TEXT[g0] && CU_TEXT[g0][dir]) || CU_TEXT[cuStage(grades[0] || g0)][dir]; };
const CU_NOTES = [['level', '수준별 반 편성', '수준별 반 편성', '같은 학년이라도 진단 결과와 진도에 따라 알맞은 반에서 시작합니다.'],
  ['consult', '상담 후 반 안내', '상담 후 반 안내', '상담에서 아이의 학습 상태와 목표를 함께 살펴본 뒤 알맞은 반을 안내해 드립니다.'],
  ['custom', '직접 작성', '', '']];
const CU_EMPTY = () => ({ courses:[], note:{ type:null, title:'', text:'' } });
const cuLabel = c => c.label || c.grades.join('·');
function cuObjs(g, M){
  const L = g.pages[0].x + SAFE, R = (g.pages[1] || g.pages[0]).x + SAFE;
  const out = [new fabric.Rect({ left:0, top:0, width:1, height:1, visible:false, selectable:false, evented:false, role:'cudata', grp:'cu', label:JSON.stringify(M) })];
  const noteOn = !!(M.note.type && (M.note.title.trim() || M.note.text.trim())), noteH = noteOn ? 44 : 0;
  const cols = [{ x:L, top:74, bot:238 }, { x:R, top:40, bot:238 - (noteOn ? noteH + 8 : 0) }];
  const cs = M.courses.filter(c => cuLabel(c).trim() || c.t.trim() || c.d.trim());
  // 과정 상자: 글 높이를 재서 왼쪽부터 채우고, 넘치면 오른쪽 페이지로. 둘 다 넘치면 글자를 조금씩 줄임.
  for(let k = 1; k >= 0.66; k -= 0.06){
    const blocks = cs.map((c, i) => { const gl = text(cuLabel(c), 0, 0, 40, 5.2 * k, { fontWeight:700 }), tt = text(c.t, 0, 0, COL - 44, 4.8 * k, { fontWeight:700 }), dd = text(c.d, 0, 0, COL - 44, 3.4 * k, { lineHeight:1.6 });
      return { c, i, h:Math.max(gl.height, (c.t.trim() ? tt.height + 2 : 0) + (c.d.trim() ? dd.height : 0)) + 12 * k }; });
    // 두 페이지에 고르게: 왼쪽은 전체 높이 중 왼쪽 몫(공간 비율)만큼만 채우고 나머지는 오른쪽으로
    const cap0 = cols[0].bot - cols[0].top, cap1 = cols[1].bot - cols[1].top, total = blocks.reduce((a, b) => a + b.h + 6 * k, 0), share = total * cap0 / (cap0 + cap1);
    let col = 0, y = cols[0].top, used = 0, place = [], fit = true;
    blocks.forEach(b => { if(col === 0 && place.length && (y + b.h > cols[0].bot || used + b.h / 2 > share)){ col = 1; y = cols[1].top; }
      if(y + b.h > cols[col].bot && col === 0){ col = 1; y = cols[1].top; } used += b.h + 6 * k; if(y + b.h > cols[col].bot) fit = false; place.push([b, cols[col].x, y]); y += b.h + 6 * k; });
    if(!fit && k > 0.7) continue;
    place.forEach(([b, x, y]) => { const c = b.c, n = b.i + 1, o = { grp:'cu', row:n };
      out.push(new fabric.Rect({ left:x, top:y, width:COL, height:0.3, fill:C.ink, strokeWidth:0, grp:'cu', row:n }),
        text(cuLabel(c), x, y + 6 * k, 40, 5.2 * k, Object.assign({ fontWeight:700, fill:C.teal }, o)));
      let ty = y + 6 * k;
      if(c.t.trim()){ const t = text(c.t, x + 44, ty, COL - 44, 4.8 * k, Object.assign({ fontWeight:700 }, o)); out.push(t); ty += t.height + 2; }
      if(c.d.trim()) out.push(text(c.d, x + 44, ty, COL - 44, 3.4 * k, Object.assign({ fill:C.body, lineHeight:1.6 }, o)));
    });
    break;
  }
  if(noteOn){ const y = 238 - noteH;
    out.push(new fabric.Rect({ left:R, top:y, width:COL, height:noteH, rx:4, ry:4, fill:C.paleMint, strokeWidth:0, grp:'cu', card:'note' }));
    if(M.note.title.trim()) out.push(text(M.note.title, R + 8, y + 8, COL - 16, 4.4, { fontWeight:700, grp:'cu', card:'note' }));
    out.push(text(M.note.text, R + 8, y + (M.note.title.trim() ? 18 : 9), COL - 16, 3.4, { fill:C.body, lineHeight:1.6, grp:'cu', card:'note' }));
  }
  return out;
}
// 학생 관리: 관리 방향(왼쪽) + 실제 관리 활동(오른쪽 카드, 활동마다 미리 써 둔 소제목·설명)
const CARE_HEAD = [
  { id:'habit', label:'꾸준한 공부 습관', t:'매일의 공부가 습관이 되도록', d:'배운 내용을 꾸준히 복습하고 과제를 스스로 챙길 수 있도록 돕습니다. 작은 실천을 이어가며 자신의 공부 습관을 만들어갑니다.' },
  { id:'gap', label:'부족한 부분 보완', t:'빈틈을 찾아 하나씩 채워갑니다', d:'아이가 어려워하는 부분을 꼼꼼히 살피고, 필요한 개념부터 다시 짚어줍니다. 작은 빈틈이 쌓이지 않도록 꾸준히 확인합니다.' },
  { id:'self', label:'스스로 공부하는 힘', t:'혼자서도 공부할 수 있도록', d:'해야 할 공부를 스스로 정하고 점검하는 연습을 함께 합니다. 선생님은 아이가 다음 한 걸음을 찾을 때까지 곁에서 돕습니다.' },
  { id:'parent', label:'학부모와 소통', t:'아이의 공부를 학부모님과 함께', d:'아이의 학습 상황을 학부모님께 꾸준히 전해 드립니다. 집과 학원이 같은 방향으로 아이를 도울 수 있도록 함께 이야기합니다.' },
];
const CARE_ACTS = [
  { id:'hw', label:'숙제 확인', t:'숙제는 풀이 과정까지 확인해요', d:'과제를 했는지뿐 아니라 어떻게 풀었는지 함께 살펴봅니다. 어려워한 문제는 다시 짚어주고 다음 학습으로 이어갑니다.' },
  { id:'wrong', label:'오답 다시 풀기', t:'틀린 문제는 다시 풀어 확인해요', d:'틀린 문제를 해설 없이 다시 풀어보며 어디에서 막혔는지 확인합니다. 같은 실수가 반복되지 않도록 함께 짚어봅니다.' },
  { id:'plan', label:'학습 계획 점검', t:'학습 계획을 함께 점검해요', d:'정해 둔 계획대로 공부하고 있는지 주기적으로 살펴봅니다. 필요하면 아이에게 맞게 계획을 조정합니다.' },
  { id:'exam', label:'시험 전 복습', t:'시험 전에는 배운 내용을 다시 정리해요', d:'시험 범위의 개념과 자주 틀린 문제를 다시 살펴봅니다. 아이가 자신 있게 시험을 준비할 수 있도록 돕습니다.' },
  { id:'extra', label:'보충 지도', t:'부족한 부분은 따로 보충해요', d:'수업에서 어려워한 부분은 따로 시간을 내어 다시 설명합니다. 이해할 때까지 함께 문제를 풀어봅니다.' },
  { id:'report', label:'학부모에게 학습 상황 안내', t:'학습 상황을 학부모님께 알려드려요', d:'아이가 무엇을 배우고 어떤 부분을 어려워하는지 정리해 학부모님께 전해 드립니다.' },
  { id:'talk', label:'개별 상담', t:'아이와 일대일로 이야기해요', d:'공부하며 느끼는 어려움이나 고민을 아이와 따로 이야기합니다. 아이에게 맞는 공부 방법을 함께 찾아갑니다.' },
];
const CARE_MAX = 6;
const CARE_SAMPLE = [['숙제 확인', '숙제는 다음 수업 시작 전에 확인하고, 하지 못한 부분은 이유를 함께 살핍니다.'],
  ['오답 재점검', '틀린 문제는 다시 풀어 보며 이해했는지 확인하고, 반복되는 실수는 따로 짚어 줍니다.'],
  ['학부모 피드백', '아이의 학습 상황을 정리해 학부모님께 알려드리고, 필요하면 상담으로 이어갑니다.']].map(([t, d]) => ({ id:'sample', t, d }));
function careObjs(g, list){
  const R = (g.pages[1] || g.pages[0]).x + SAFE, n = list.length, top = 24, area = 214, gap = n > 4 ? 5 : 8;
  const h = n ? (area - gap * (n - 1)) / n : 0, compact = h < 50;
  return list.map((st, i) => { const y = top + i * (h + gap), o = { row:i + 1, grp:'care' };
    return [
      new fabric.Rect({ left:R, top:y, width:COL, height:h, rx:4, ry:4, fill:C.paleMint, strokeWidth:0, row:i + 1, grp:'care' }),
      text(`CHECK 0${i + 1}`, R + 8, y + (compact ? 4.5 : 7), 60, compact ? 3.2 : 3.6, Object.assign({ fontWeight:700, fill:C.teal }, o)),
      text(st.t, R + 8, y + (compact ? 10 : 15), COL - 16, compact ? 4.6 : 5.4, Object.assign({ fontWeight:700, key:`c${i + 1}`, label:`관리 활동 ${i + 1} 소제목`, grp:'opt:' + st.id }, { row:i + 1 })),
      text(st.d, R + 8, y + (compact ? 17 : 26), COL - 16, compact ? 3.3 : 3.5, Object.assign({ fill:C.body, lineHeight:1.6, key:`c${i + 1}d`, label:`관리 활동 ${i + 1} 설명` }, o)),
    ]; }).flat();
}
// 우리 학원 교재: 교재 선택 기준(왼쪽) + books[{ name, target, uses[], text }] (오른쪽, 사진은 bp1 … 칸에 그대로)
const BK_HEAD = [
  { id:'level', label:'학생 수준에 맞게', t:'아이에게 맞는 교재로, 필요한 공부부터', d:'학생마다 이해도와 학습 속도가 다르기에, 현재 수준과 목표에 맞는 교재를 선택합니다. 잘하는 부분은 발전시키고 어려운 부분은 충분히 연습하도록 돕습니다.' },
  { id:'gap', label:'부족한 부분을 집중적으로', t:'부족한 부분을 채우는 교재', d:'아이가 자주 틀리거나 어려워하는 단원을 찾아, 그 부분을 충분히 연습할 수 있는 교재와 자료를 고릅니다. 빈틈을 채운 뒤 다음 단계로 나아갑니다.' },
  { id:'step', label:'개념부터 심화까지 차근차근', t:'개념부터 심화까지, 단계에 맞춘 교재', d:'개념을 익히는 교재에서 시작해 유형 연습과 심화 문제로 차근차근 이어갑니다. 단계마다 알맞은 교재로 실력을 쌓아갑니다.' },
  { id:'exam', label:'학교 시험에 맞게', t:'학교 시험까지 이어지는 교재', d:'학교 진도와 시험 범위에 맞춰 교재를 고르고 활용합니다. 배운 개념을 시험에서 꺼내 쓸 수 있도록 충분히 연습합니다.' },
];
const BK_USES = [['concept', '개념 익히기', '새 단원의 개념을 처음 익힐 때 사용합니다. 설명과 예제를 함께 보며 배운 내용을 기본 문제로 확인합니다.'],
  ['type', '유형 연습', '개념을 익힌 뒤 여러 유형의 문제로 적용하는 연습을 할 때 사용합니다.'],
  ['adv', '심화 도전', '기본 문제에 익숙해진 학생이 한 단계 더 깊이 생각하는 문제에 도전할 때 사용합니다.'],
  ['wrong', '오답 복습', '틀린 문제를 다시 풀어보며 어디에서 막혔는지 확인하고, 같은 실수를 줄이는 데 활용합니다.'],
  ['exam', '내신 대비', '학교 시험 범위에 맞춰 개념을 정리하고 자주 나오는 유형을 연습할 때 사용합니다.'],
  ['custom', '학생별 맞춤 학습', '학생마다 필요한 단원과 문제를 골라 구성한 맞춤 교재입니다. 학습 상황에 맞춰 부족한 부분을 보완하고, 다음 단계로 나아갈 수 있도록 활용합니다.']];
const BK_MAX = 4;
const BK_EMPTY = () => ({ books:[{ name:'', target:'', uses:[], text:'' }] });
function bkObjs(g, M){
  const R = (g.pages[1] || g.pages[0]).x + SAFE, n = M.books.length, top = 24, area = 214, gap = 8;
  const out = [new fabric.Rect({ left:0, top:0, width:1, height:1, visible:false, selectable:false, evented:false, role:'bkdata', grp:'bk', label:JSON.stringify(M) })];
  const h = n ? Math.min(100, (area - gap * (n - 1)) / n) : 0, pw = n === 1 ? 70 : 50, ph = Math.min(h, n === 1 ? 92 : 64);
  M.books.forEach((b, i) => { const y = top + i * (h + gap), nn = i + 1, x = R + pw + 6, w = COL - pw - 6;
    out.push(Object.assign(frame(R, y, pw, ph, `bp${nn}`, `교재 ${nn} 사진`), { card:nn, grp:'bk' }));
    let ty = y + 3;
    const add = (str, size, o) => { if(!String(str).trim()) return; const t = text(str, x, ty, w, size, Object.assign({ grp:'bk', card:nn }, o)); out.push(t); ty += t.height + 2; };
    add(b.name, 5, { fontWeight:700 });
    add(b.target.trim() ? `대상 · ${b.target}` : '', 3.4, { fontWeight:600, fill:C.teal });
    add(b.text, 3.4, { fill:C.body, lineHeight:1.6 });
  });
  return out;
}
const LAYOUTS = {
  // ---------- 낱장 (고정) ----------
  intro: { kind:'single', name:'학원 소개', sub:'3쪽 · 제목·소개 글·사진 직접 편집', build: g => { const { L } = at(g); return [
    eyebrow('#ABOUT US', L),
    text('우리 학원은\n이렇게 다릅니다', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'제목' }),
    text('한 문제를 풀어도 왜 그런지 끝까지 묻게 합니다. 학생마다 다른 출발점에서 시작해 스스로 답을 찾는 힘을 기릅니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'학원 소개 문구' }),
    frame(L, 100, COL, 130, 'photo1', '학원 사진'),
    academyText(L),
  ]; } },
  contact: { kind:'single', fixed:true, name:'오시는 길', sub:'12쪽 · 기본 정보에서 자동', build: g => { const { L } = at(g); return [
    eyebrow('#VISIT US', L),
    text('오시는 길', L, 33, COL, 9, { fontWeight:700 }),
    frame(L, 52, COL, 110, 'photo1', '지도·건물 사진'),
    ...[['주소', 'addr', '주소를 [학원 기본 정보]에 넣어 주세요'], ['연락처', 'tel', '연락처를 [학원 기본 정보]에 넣어 주세요'], ['방문 안내', 'visit', '운영 시간·주차·교통 안내']].map(([lb, k, v], i) => [
      text(lb, L, 172 + i * 18, 30, 3.4, { fontWeight:700, fill:C.teal }),
      text(v, L + 32, 172 + i * 18, COL - 32, 3.6, { fill:C.ink, lineHeight:1.5, key:k, label:lb, auto:'info' }),
    ]).flat(),
    academyText(L),
  ]; } },

  // 12p 쉬어 가는 페이지: 디자이너가 만든 그림(재단 크기 182×257) 한 장. 원장님은 바꾸지 않고, 템플릿 목록에도 나오지 않습니다(2026-11-05).
  prologue: { kind:'single', fixed:true, image:'diy/fixed/p012_prologue.jpg?v=20261105h', name:'쉬어 가는 페이지', sub:'12쪽 · 고정', build: () => [] },

  // ---------- 펼침면 (4~11p 네 자리에서 고름) ----------
  greeting: { kind:'spread', name:'인사말', sub:'원장님 사진 + 인사말 (마지막 문장은 안쪽 표지에도)', greeting:true, build: g => { const { L, R } = at(g); return [
    eyebrow('#GREETING', L),
    text('아이들과 함께 자라는\n학원이 되고 싶습니다.', L, 33, COL, 8, { fontWeight:700, lineHeight:1.3, key:'gtitle', label:'인사말 제목' }),
    frame(L, 80, COL, 150, 'photo1', '원장님 사진'),
    text('저는 이 지역에서 아이들에게 수학을 가르치고 있습니다. 같은 문제를 풀어도 아이마다 걸리는 곳이 다르기에, 한 명 한 명의 속도에 맞춰 차근차근 이끌어 가려 합니다.\n\n이 책에 저희 학원이 아이들을 어떻게 가르치고 살피는지 담았습니다. 아이의 공부를 함께 고민하는 데 작은 도움이 되길 바랍니다.',
      R, 33, COL, 3.6, { fill:C.body, lineHeight:1.8, key:'gbody', label:'인사말 본문' }),
    text('원장 ○○○ 드림', R, 200, COL, 4, { fontWeight:600, textAlign:'right', key:'sign', label:'서명' }),
    academyText(L),
  ]; } },
  class: { kind:'spread', name:'수업 방식', sub:'대표 문구·소개 글·수업 사진 | 수업의 특징 3가지', build: g => { const { L, R } = at(g); return [
    eyebrow('#OUR CLASS', L),
    text('생각을 끝까지\n따라가는 수업', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'대표 문구' }),
    text('정답을 맞히는 것보다 왜 그런지 설명할 수 있는 힘을 기릅니다. 한 문제를 풀어도 끝까지 묻고, 스스로 답을 찾을 때까지 기다립니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 100, COL, 136, 'photo1', '수업 사진'),
    eyebrow('우리 수업의 특징', R),
    ...[0, 1, 2].map(i => [
      new fabric.Rect({ left:R, top:38 + i * 68, width:COL, height:0.3, fill:C.ink, strokeWidth:0 }),
      text(`0${i + 1}`, R, 44 + i * 68, 24, 10, { fontWeight:700, fill:C.grayGreen }),
      text(['오답 원인부터 정리', '비슷한 문제로 다시 도전', '풀이를 말로 설명하기'][i], R + 28, 46 + i * 68, COL - 28, 5.2, { fontWeight:700, key:`item${i + 1}`, label:`수업 특징 ${'①②③④'[i]} 소제목` }),
      text(['틀린 문제는 왜 틀렸는지 먼저 적어 보고, 같은 실수를 반복하지 않도록 함께 살핍니다.',
            '원인을 찾은 뒤에는 비슷한 유형의 문제를 다시 풀며 정말 이해했는지 확인합니다.',
            '선생님께 풀이를 직접 설명해 보며, 아는 것과 모르는 것을 스스로 구분하게 합니다.'][i],
        R + 28, 57 + i * 68, COL - 28, 3.6, { fill:C.body, lineHeight:1.65, key:`item${i + 1}d`, label:`수업 특징 ${'①②③④'[i]} 설명` }),
    ]).flat(),
    academyText(L),
  ]; } },
  space: { kind:'spread', name:'학원 공간', sub:'사진 4장 + 설명', build: g => { const { L, R } = at(g); return [
    eyebrow('#OUR SPACE', L),
    text('우리 학원의 모습', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    frame(L, 52, COL, 160, 'photo1', '사진 1'),
    text('', L, 217, COL, 3.5, { fill:C.body, key:'cap1', label:'사진 ① 설명' }),
    frame(R, 24, COL, 100, 'photo2', '사진 2'),
    text('', R, 127, COL, 3.5, { fill:C.body, key:'cap2', label:'사진 ② 설명' }),
    frame(R, 140, 78, 96, 'photo3', '사진 3'),
    frame(R + 84, 140, 78, 96, 'photo4', '사진 4'),
    text('', R, 239, 78, 3.5, { fill:C.body, key:'cap3', label:'사진 ③ 설명' }),
    text('', R + 84, 239, 78, 3.5, { fill:C.body, key:'cap4', label:'사진 ④ 설명' }),
    academyText(L),
  ]; } },
  // 상담 절차: 왼쪽 소개·사진(선택) / 오른쪽 STEP 상자(개수는 원장님이 정한 대로)
  flow: { kind:'spread', name:'상담 절차', sub:'절차 단계 + 사진 1장', build: g => { const { L } = at(g); return [
    eyebrow('#HOW TO START', L),
    text('우리 아이에게 맞는 수업,\n상담부터 시작해요', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'제목' }),
    text('아이의 학습 상황과 고민을 살펴보고, 앞으로의 수업 방향을 함께 이야기합니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 80, COL, 160, 'photo1', '상담 사진'),
    ...flowStepObjs(g, FLOW_DEFAULT.map(id => FLOW_OPTS.find(o => o.id === id))),
    academyText(L),
  ]; } },
  // 학원 시간표(2026-11-06): 제목·안내는 칸, 표와 반 안내는 원장님이 입력한 반·요일·시간(ttdata)에서 자동으로 그림
  timetable: { kind:'spread', name:'학원 시간표', sub:'반·요일·시간 표 + 반 안내', build: g => { const { L, R } = at(g); return [
    eyebrow('#TIMETABLE', L),
    text('우리 학원 수업 시간표', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('수업 일정은 학원으로 문의해 주세요.', L, 50, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'안내 문구' }),
    eyebrow('#CLASS GUIDE', R),
    ...ttObjs(g, TT_EMPTY()),
    academyText(L),
  ]; } },
  // 선생님 소개(2026-11-06): 왼쪽 제목·소개 글·대표 사진 / 오른쪽은 원장님이 정한 인원만큼 선생님 카드(tcdata에서 자동 배치)
  teacher: { kind:'spread', name:'선생님 소개', sub:'대표 사진 + 선생님별 소개', build: g => { const { L } = at(g); return [
    eyebrow('#OUR TEACHERS', L),
    text('함께하는 선생님', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('수업부터 상담까지, 아이를 가장 가까이에서 보는 선생님들입니다.', L, 52, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 72, COL, 168, 'photo1', '대표 사진'),
    ...tcObjs(g, TC_EMPTY()),
    academyText(L),
  ]; } },
  // 학년별 커리큘럼(2026-11-06): 제목·소개 글은 칸, 과정 목록과 반 편성 안내는 cudata에서 양쪽 페이지에 자동 배치
  curriculum: { kind:'spread', name:'학년별 커리큘럼', sub:'학년별 수업 방향과 과정 소개', build: g => { const { L, R } = at(g); return [
    eyebrow('#CURRICULUM', L),
    text('우리 학원의 학년별 수업', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('학년과 학습 수준에 맞춰 필요한 개념부터 차근차근 공부합니다.', L, 52, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    eyebrow('#ROADMAP', R),
    ...cuObjs(g, CU_EMPTY()),
    academyText(L),
  ]; } },
  // 학생 관리(2026-11-06): 왼쪽 대표 문구·소개 글·사진 / 오른쪽 관리 활동 카드(고른 개수에 맞춰 자동 배치, 처음엔 예시 3개)
  care: { kind:'spread', name:'학생 관리', sub:'관리 방향 + 관리 활동 카드', build: g => { const { L } = at(g); return [
    eyebrow('#STUDENT CARE', L),
    text('수업이 끝난 뒤에도\n끝까지 확인합니다', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'대표 문구' }),
    text('수업 시간에 이해한 것이 정말 내 것이 되었는지, 숙제와 오답으로 다시 확인합니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 100, COL, 136, 'photo1', '관리 장면 사진'),
    ...careObjs(g, CARE_SAMPLE),
    academyText(L),
  ]; } },
  // 우리 학원 교재(2026-11-06): 왼쪽 교재 선택 기준·대표 사진 / 오른쪽 교재 카드(원장님이 넣은 개수만큼 자동 배치, bkdata)
  books: { kind:'spread', name:'우리 학원 교재', sub:'교재 선택 기준 + 교재별 소개', build: g => { const { L } = at(g); return [
    eyebrow('#TEXTBOOK', L),
    text('우리 학원 교재', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('학년과 수준에 맞춰 고른 교재와 학습 자료로 수업합니다.', L, 50, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 72, COL, 164, 'photo1', '대표 사진'),
    ...bkObjs(g, BK_EMPTY()),
    academyText(L),
  ]; } },
  blank: { kind:'spread', name:'백지 자유편집', sub:'빈 두 쪽에 글·사진을 자유롭게', free:true, build: g => [academyText(at(g).L)] },
};
const SPREAD_LAYOUTS = ['greeting', 'class', 'space', 'flow', 'timetable', 'teacher', 'curriculum', 'care', 'books', 'blank'];

// ===================== 작성 도우미 (2026-11-06 2차: 질문 하나 → 답 하나 → 펼침면 전체 원고 한 세트) =====================
// 원장님이 답을 고르면, 그 답에 맞춰 미리 써 둔 완성 원고 한 세트를 펼침면의 모든 글 칸에 한 번에 넣습니다.
// AI·무작위·서로 무관한 예문 조합은 쓰지 않습니다. 같은 답 → 항상 같은 세트.
// FILLS[템플릿] = { q, opts:[{ id, label, fields:{ 칸 key: 글 } }], facts:[원장님만 아는 칸 key], shots:{ 사진 key: 촬영 예시 } }
//   facts 칸(교재명·선생님 성함·시간표 등)은 원고를 넣을 때 건드리지 않고, 처음 고를 때 샘플 글이면 비워 둡니다.
// 문구는 매쓰홀릭 콘텐츠(2026-11-06). 고칠 때는 여기 글만 바꾸면 됩니다.
const GREET_HEAD = '안녕하세요, [학원명] 원장 [원장명]입니다.';
// [학원명]·[원장명]은 기본 정보에서 가져오고, 비어 있으면 대괄호 없이 자연스러운 인사로 바꿉니다.
function fillNames(t, info){
  const a = (info && info.academy || '').trim(), d = (info && info.director || '').trim();
  const head = a && d ? `안녕하세요, ${a} 원장 ${d}입니다.` : a ? `안녕하세요, ${a} 원장입니다.` : d ? `안녕하세요, 원장 ${d}입니다.` : '안녕하세요.';
  return t.split(GREET_HEAD).join(head).replace(/\[학원명\]/g, a || '저희 학원').replace(/\[원장명\]/g, d || '');
}
const signOf = info => { const d = (info && info.director || '').trim(); return d ? `원장 ${d} 드림` : '원장 드림'; };
const TT_KEYS = (() => { const k = []; for(let i = 0; i < 6; i++){ k.push(`row_${i}`); for(let j = 0; j < 6; j++) k.push(`cell_${i}_${j}`); } return k; })();
const GRADES = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const GRADE_TEXT = {
  초1:['수와 친해지기', '물건을 세고 모으며 수의 크기를 익힙니다. 덧셈과 뺄셈이 어떤 상황에서 쓰이는지 그림과 말로 표현해 봅니다.'],
  초2:['곱셈의 원리 이해', '같은 수를 여러 번 더하는 상황에서 곱셈을 이해하고, 구구단을 외우기 전에 원리부터 살펴봅니다.'],
  초3:['분수와 나눗셈 시작', '똑같이 나누는 상황에서 나눗셈과 분수를 처음 만납니다. 그림으로 나타내며 크기를 비교합니다.'],
  초4:['큰 수와 도형 감각', '큰 수의 자릿값을 정리하고, 각과 도형의 성질을 직접 그리고 재 보며 익힙니다.'],
  초5:['약수·배수와 분수 계산', '약수와 배수를 이용해 분수를 통분하고, 분수의 덧셈과 뺄셈을 원리와 함께 익힙니다.'],
  초6:['비와 비율, 중학 준비', '비와 비율로 생활 속 문제를 풀어 보고, 중학교에서 이어질 문자와 식을 미리 만나 봅니다.'],
  중1:['문자와 식에 익숙해지기', '수를 문자로 나타내는 방법을 익히고, 일차방정식으로 문제 상황을 식으로 세우는 연습을 합니다.'],
  중2:['식의 계산과 함수', '연립방정식과 일차함수를 배우며, 식과 그래프가 같은 관계를 어떻게 나타내는지 연결해 봅니다.'],
  중3:['고등 수학으로 가는 다리', '제곱근과 이차방정식, 이차함수를 익히며 고등 수학으로 이어지는 개념을 단단히 다집니다.'],
  고1:['고등 수학의 기본기', '다항식과 방정식·부등식, 도형의 방정식을 정리하며 고등 수학 전체의 기본 도구를 익힙니다.'],
  고2:['개념을 연결하는 힘', '선택 과목의 핵심 개념을 익히고, 여러 단원의 개념을 연결해 풀이 계획을 세우는 연습을 합니다.'],
  고3:['실전에서 꺼내 쓰는 힘', '배운 개념을 시험 형식의 문제에 적용하며, 시간 안에 풀이 방향을 정하는 연습을 합니다.'],
};
// 고른 학년이 어느 학교급인지(초·중·고)에 따라 제목·소개 글
const CURRI_HEAD = {
  e:['초등 학년별 수업 과정', '초등 시기에는 수와 연산, 도형을 직접 다뤄 보며 수학과 친해지는 데 집중합니다. 학년마다 꼭 익혀야 할 내용을 정해 두고 차근차근 쌓아 갑니다.'],
  m:['중학교 학년별 수업 과정', '중학교 수학은 문자와 식, 함수로 생각의 폭이 넓어지는 시기입니다. 학년마다 핵심 개념을 정리하고 학교 시험까지 이어지도록 준비합니다.'],
  h:['고등학교 학년별 수업 과정', '고등 수학은 여러 단원의 개념을 연결해 생각해야 합니다. 학년마다 기본기를 다지고, 배운 개념을 실전 문제에서 꺼내 쓰는 힘을 기릅니다.'],
  em:['초등부터 중학교까지의 과정', '초등에서 익힌 수와 연산이 중학교의 문자와 식으로 자연스럽게 이어지도록 과정을 짰습니다. 학년마다 다음 단계의 바탕이 되는 내용을 놓치지 않게 살핍니다.'],
  mh:['중학교부터 고등까지의 과정', '중학교에서 다진 개념이 고등 수학의 기본기가 되도록 과정을 이어 두었습니다. 학년마다 목표를 정하고, 다음 학년에서 쓰일 개념을 미리 연결합니다.'],
  eh:['학년별 수업 과정', '학년마다 꼭 익혀야 할 내용을 정해 두고 수업합니다. 같은 학원 안에서도 학년의 특성에 맞춰 서로 다른 목표로 공부합니다.'],
  emh:['초등부터 고등까지 수업 과정', '초등의 수와 연산에서 고등의 함수와 실전 문제까지, 학년마다 다음 단계를 준비하도록 과정을 이어 두었습니다.'],
};
const CURRI_MAX = 4;   // 두 쪽에 들어가는 과정 수
// 수업 방식 오른쪽 책장: 수업 시간에 실제로 하는 활동(최대 3개) → 수업 특징 ①②③의 소제목·설명
const CLASS_ACTS = [
  { id:'qa', label:'일대일 질문 시간', t:'선생님과 하나씩 짚어보는 질문 시간', d:'막힌 문제를 선생님과 함께 펼쳐 놓고 어디까지 풀었는지 이야기합니다. 학생이 어려워한 부분부터 짚어준 뒤, 다음 단계는 스스로 풀어보게 합니다.' },
  { id:'retry', label:'비슷한 문제 다시 풀기', t:'숫자를 바꾼 문제로 다시 확인하기', d:'설명을 들은 문제와 숫자나 조건만 바꾼 문제를 이어서 풀어봅니다. 방금 이해한 방법을 혼자서도 쓸 수 있는지 그 자리에서 확인합니다.' },
  { id:'say', label:'풀이 말로 설명하기', t:'내 풀이를 말로 설명하는 시간', d:'문제를 푼 뒤 왜 그렇게 풀었는지 선생님에게 말로 설명합니다. 설명하다 막히는 곳을 함께 찾아 다시 정리합니다.' },
  { id:'compare', label:'여러 풀이 비교하기', t:'다른 풀이와 나란히 비교하기', d:'같은 문제를 푼 서로 다른 방법을 나란히 놓고 살펴봅니다. 어떤 방법이 더 빠르고 정확한지 이야기하며 생각의 폭을 넓힙니다.' },
];
const CLASS_ACT_MAX = 3;
const FILLS = {
  intro: { q:'우리 학원의 어떤 점을 가장 알리고 싶으세요?', opts:[
    { id:'concept', label:'탄탄한 개념 학습', fields:{ title:'개념을 자기 말로\n설명할 수 있을 때까지', lead:'공식을 외우는 데서 멈추지 않고, 왜 그렇게 되는지 함께 따져 봅니다. 배운 개념을 자기 말로 설명할 수 있어야 처음 보는 문제에서도 꺼내 쓸 수 있기 때문입니다.' } },
    { id:'fit', label:'학생별 맞춤 지도', fields:{ title:'아이마다 다른 출발점에서\n함께 시작합니다', lead:'같은 단원을 배우는 아이들도 막히는 곳은 저마다 다릅니다. 학생이 어디까지 이해했는지 먼저 살피고, 지금 필요한 설명과 문제를 골라 수업합니다.' } },
    { id:'wrong', label:'꼼꼼한 오답 관리', fields:{ title:'틀린 문제를\n그냥 넘기지 않습니다', lead:'틀린 문제에는 아이가 어디에서 생각이 달라졌는지가 담겨 있습니다. 처음 풀이를 함께 짚어 보고, 다음에는 혼자 풀 수 있는지 다시 확인합니다.' } },
    { id:'self', label:'스스로 공부하는 힘', fields:{ title:'혼자서도 공부할 수 있는\n힘을 기릅니다', lead:'문제를 만났을 때 무엇부터 해 볼지 스스로 생각하도록 질문합니다. 선생님은 답을 먼저 알려 주기보다, 아이가 다음 한 걸음을 찾을 때까지 곁에서 기다립니다.' } }],
    shots:{ photo1:'학원 입구나 교실 전체가 밝게 보이는 사진' },
    // 3쪽 소개 문구만 바꾸고 싶을 때(키워드 1개 ↔ 문장 1개, 기존 작성 도우미 문구)
    sentences:[['개념을 탄탄하게', '공식을 외운 뒤에도 “왜 이렇게 풀까?”를 묻습니다. 배운 개념을 자기 말로 설명할 수 있어야 다음 문제에서도 꺼내 쓸 수 있기 때문입니다.'],
      ['스스로 공부하는 힘', '문제를 만났을 때 무엇부터 해볼지 스스로 생각하는 힘을 기릅니다. 선생님은 아이가 시도한 풀이를 살펴보고, 다음 한 걸음을 찾도록 질문합니다.'],
      ['한 명 한 명 맞춤', '같은 단원을 배우는 아이들도 막히는 곳은 다릅니다. 학생이 어디까지 이해했는지 먼저 살피고, 지금 필요한 설명과 문제를 고릅니다.'],
      ['오답 끝까지', '틀린 문제에는 아이가 어디에서 어려움을 느꼈는지가 담겨 있습니다. 처음 풀이를 함께 짚어보고, 다음에는 혼자 풀 수 있는지 확인합니다.'],
      ['학부모와 소통', '학부모님이 아이의 수업 모습을 떠올릴 수 있도록, 요즘 배우는 내용과 혼자 해낸 일, 아직 도움이 필요한 부분을 구체적으로 전합니다.']] },
  greeting: { q:'학부모님께 어떤 약속을 전하고 싶으세요?', names:true, opts:[
    { id:'pace', label:'아이의 속도를 존중해요', fields:{ gtitle:'아이의 속도에 맞추면\n수학은 따라옵니다.', gbody:`${GREET_HEAD}\n\n아이마다 이해가 깊어지는 순간은 조금씩 다릅니다. 어떤 아이는 설명을 듣자마자 고개를 끄덕이고, 어떤 아이는 몇 번을 다시 풀어 본 뒤에야 “아, 그래서 이렇구나” 하고 말합니다.\n\n저는 그 차이를 서두르지 않으려 합니다. 우리 아이가 지금 어디에 서 있는지 먼저 살피고, 다음 한 걸음을 스스로 내디딜 수 있도록 곁에서 돕겠습니다.` } },
    { id:'ask', label:'편하게 질문할 수 있어요', fields:{ gtitle:'“여기부터 모르겠어요”라고\n말할 수 있는 교실', gbody:`${GREET_HEAD}\n\n저는 아이가 “여기부터 모르겠어요”라고 말하는 순간을 가장 소중하게 생각합니다. 모르는 것을 정확히 말할 수 있다면, 이미 절반은 이해한 것이기 때문입니다.\n\n질문이 부끄럽지 않은 교실, 틀린 풀이도 함께 들여다볼 수 있는 교실을 만들겠습니다. 이해한 만큼은 자신 있게 말하고, 모르는 것은 편하게 묻는 아이로 자라도록 돕겠습니다.` } },
    { id:'grow', label:'작은 성장도 함께 나눠요', fields:{ gtitle:'어제보다 한 문제 더,\n그 성장을 함께 나눕니다.', gbody:`${GREET_HEAD}\n\n수학 실력은 하루아침에 달라지지 않습니다. 대신 어제는 도움이 필요했던 문제를 오늘은 혼자 풀어내는 작은 순간들이 쌓여 갑니다.\n\n저는 그런 순간을 놓치지 않고 아이에게, 그리고 학부모님께 전하려 합니다. 아이가 해낸 일과 아직 도움이 필요한 부분을 솔직하게 나누며, 함께 다음 목표를 세우겠습니다.` } }],
    shots:{ photo1:'원장님 사진 (선택) · 상반신, 밝은 배경' } },
  class: { q:'우리 학원 수업은 어디에 가장 중점을 두나요?', opts:[
    { id:'concept', label:'개념 이해', fields:{ title:'왜 그런지 알고\n푸는 수업', lead:'새 개념을 배울 때는 공식보다 그 공식이 나온 이유를 먼저 살핍니다. 간단한 예에서 규칙을 찾고, 그 규칙을 식으로 옮겨 보며 개념을 자기 것으로 만듭니다.',
      item1:'예에서 규칙 찾기', item1d:'숫자를 바꿔 가며 간단한 예를 직접 계산해 보고, 그 안에서 공통된 규칙을 찾아냅니다.',
      item2:'규칙을 식으로 옮기기', item2d:'찾아낸 규칙이 교과서의 식과 어떻게 이어지는지 연결해 보며, 공식이 왜 그런 모양인지 이해합니다.',
      item3:'개념을 자기 말로 설명하기', item3d:'수업 끝에는 오늘 배운 개념을 선생님께 직접 설명해 봅니다. 설명이 막히는 부분은 다시 함께 짚습니다.' } },
    { id:'pace', label:'학생별 진도', fields:{ title:'지금 이 아이에게\n필요한 만큼', lead:'같은 교실에 있어도 아이마다 익숙한 단원과 어려운 단원이 다릅니다. 학생이 혼자 풀 수 있는 것과 도움이 필요한 것을 나눠 보고, 그에 맞춰 연습할 내용과 속도를 정합니다.',
      item1:'혼자 풀 수 있는 것부터 확인', item1d:'새 단원에 들어가기 전, 이전 개념을 얼마나 알고 있는지 몇 문제로 먼저 확인합니다.',
      item2:'학생마다 다른 연습 문제', item2d:'확인한 결과에 따라 더 연습할 유형과 넘어가도 되는 유형을 나눠, 학생마다 다른 문제를 풉니다.',
      item3:'다음 단계로 가는 기준', item3d:'정해 둔 문제를 혼자 해결할 수 있을 때 다음 단계로 넘어갑니다. 서두르지도, 멈춰 있지도 않게 진도를 살핍니다.' } },
    { id:'wrong', label:'오답 복습', fields:{ title:'틀린 문제 한 번 더,\n이번에는 스스로', lead:'틀린 문제를 다시 펼쳐 어디에서 막혔는지 함께 짚어봅니다. 그런 다음 풀이를 덮고 처음부터 풀어보며, 혼자서도 풀 수 있는지 확인합니다.',
      item1:'처음 풀이에서 단서 찾기', item1d:'학생이 쓴 식을 보며 조건을 놓쳤는지, 개념을 다르게 이해했는지, 계산에서 실수했는지 짚어봅니다.',
      item2:'해설을 덮고 다시 풀기', item2d:'설명을 들은 뒤에는 첫 줄부터 다시 써봅니다. 처음에 막혔던 부분을 이번에는 어떻게 해결했는지 자기 말로 이야기합니다.',
      item3:'다른 문제에서도 확인하기', item3d:'숫자나 조건이 달라진 문제를 풀어봅니다. 방금 익힌 방법을 어디에 써야 할지 혼자 알아볼 수 있는지 확인합니다.' } },
    { id:'explain', label:'풀이 설명', fields:{ title:'답보다 풀이를\n말할 수 있도록', lead:'정답을 맞혔는지보다 어떤 생각으로 그 답에 이르렀는지를 봅니다. 아이가 자기 풀이를 말로 설명하며 스스로 생각을 정리하도록 돕습니다.',
      item1:'고른 방법의 이유 말하기', item1d:'답을 구한 뒤에는 문제의 어떤 조건을 보고 그 방법을 골랐는지 이야기해 봅니다.',
      item2:'막힌 줄에서 함께 멈추기', item2d:'설명하다 말이 막히는 곳이 바로 이해가 흔들리는 곳입니다. 그 줄에서 멈춰 선생님과 함께 다시 따져 봅니다.',
      item3:'다른 풀이와 비교하기', item3d:'같은 문제를 다르게 푼 풀이와 나란히 놓고, 어떤 방법이 언제 더 편리한지 비교해 봅니다.' } }],
    shots:{ photo1:'큰 사진 · 수업 중인 교실이나 학생이 문제를 푸는 모습' } },
  // 학원 공간: 질문 없이 제목 + 사진 4장·설명(선택)만 직접 입력(2026-11-06)
  space: { q:'', opts:[], note:'학생 얼굴이 나오는 사진은 보호자 동의를 받은 사진만 넣어 주세요.' },
  flow: { q:'처음 온 학생과 어떤 방식으로 상담하나요?', opts:[
    { id:'test', label:'진단평가 중심', fields:{ title:'진단으로 시작하는\n첫 상담', lead:'학생이 직접 푼 문제를 바탕으로 지금의 실력을 함께 확인합니다. 결과를 보며 학생에게 맞는 수업을 찾습니다.',
      step1:'상담 예약', step1d:'학생의 학년과 궁금한 점을 알려 주시면 방문하실 시간을 안내해 드립니다.',
      step2:'진단평가', step2d:'학년에 맞는 문제를 풀며 익숙한 개념과 보완할 부분을 확인합니다.',
      step3:'결과 상담', step3d:'학생이 쓴 풀이를 함께 보며 강점과 보완할 점을 설명해 드립니다.',
      step4:'수업 안내', step4d:'상담 내용을 바탕으로 맞는 반과 교재, 첫 수업 준비를 안내해 드립니다.' } },
    { id:'note', label:'교재·노트 중심', fields:{ title:'평소 공부한 흔적에서\n시작하는 상담', lead:'학생이 쓰던 교재와 풀이 노트에는 공부 습관이 고스란히 담겨 있습니다. 평소의 흔적을 함께 보며 상담을 시작합니다.',
      step1:'상담 예약', step1d:'방문하실 때 최근에 풀던 교재나 노트를 함께 가져와 주세요.',
      step2:'교재·노트 살펴보기', step2d:'풀이 노트를 보며 자주 막히는 유형과 풀이 습관을 짚어 봅니다.',
      step3:'학습 고민 상담', step3d:'학생과 학부모님이 느끼는 어려움을 듣고, 노트에서 본 모습과 함께 이야기합니다.',
      step4:'수업 안내', step4d:'필요한 연습과 맞는 반을 정리해 첫 수업 준비를 안내해 드립니다.' } },
    { id:'talk', label:'학습 고민 면담 중심', fields:{ title:'고민을 먼저 듣는\n첫 상담', lead:'점수보다 먼저 학생이 수학을 어떻게 느끼는지 듣습니다. 고민을 충분히 나눈 뒤 함께 방향을 정합니다.',
      step1:'상담 예약', step1d:'편하신 시간을 알려 주시면 학생과 함께 오실 수 있는 시간을 잡아 드립니다.',
      step2:'학생 면담', step2d:'학생과 먼저 이야기하며 어려운 단원과 공부할 때의 고민을 들어 봅니다.',
      step3:'학부모 상담', step3d:'학부모님이 보시는 아이의 모습과 바라시는 점을 함께 나눕니다.',
      step4:'수업 안내', step4d:'면담 내용을 바탕으로 수업 방향과 맞는 반을 안내해 드립니다.' } }],
    shots:{ photo1:'상담실이나 상담하는 책상 위' } },
  timetable: { q:'', opts:[] },   // 질문 없이 제목 → 시간표 → 반 안내를 직접 입력(renderTimetableForm)
  teacher: { q:'어떤 선생님들을 소개할까요?', opts:[
    { id:'one', label:'원장님 한 분', fields:{ title:'아이를 직접 가르치는 원장입니다', lead:'상담부터 수업, 학부모님과의 소통까지 원장이 직접 맡습니다. 아이의 공부를 처음부터 끝까지 한 사람이 살핍니다.' } },
    { id:'with', label:'원장님과 선생님들', fields:{ title:'함께 가르치는 선생님들', lead:'원장과 선생님들이 같은 원칙으로 수업합니다. 아이에 대한 이야기를 서로 나누며 한 명 한 명을 함께 살핍니다.' } },
    { id:'staff', label:'담당 선생님들', fields:{ title:'우리 아이를 맡는 담당 선생님', lead:'학년과 반마다 담당 선생님이 정해져 있습니다. 수업부터 숙제 확인까지 담당 선생님이 아이를 가장 가까이에서 봅니다.' } }] },
  curriculum: { q:'어느 학년의 수업을 소개할까요?', multi:true, opts:[] },
  care: { q:'', opts:[] },   // 질문·활동은 CARE_HEAD / CARE_ACTS (renderCareForm)
  books: { q:'', opts:[] },   // 기준·교재는 BK_HEAD / BK_USES (renderBooksForm)
};
// 학년별 커리큘럼: 고른 학년(최대 4개)으로 원고 세트를 만듭니다.
function curriFields(grades, levelNote){
  const lv = ['e', 'm', 'h'].filter(x => grades.some(gr => ({ 초:'e', 중:'m', 고:'h' })[gr[0]] === x)).join('') || 'm';
  const head = CURRI_HEAD[lv];
  const f = { title:head[0], lead:head[1] };
  grades.slice(0, CURRI_MAX).forEach((gr, i) => { f[`g${i + 1}`] = gr; f[`goal${i + 1}`] = GRADE_TEXT[gr][0]; f[`desc${i + 1}`] = GRADE_TEXT[gr][1]; });
  if(levelNote){ f.ntitle = '수준별 반 편성'; f.note = '같은 학년이라도 진단 결과와 진도에 따라 알맞은 반에서 시작합니다. 반 배정은 상담 때 함께 정합니다.'; }
  return f;
}

function text(str, x, y, w, sizeMm, opt = {}){
  return new fabric.Textbox(str, Object.assign({ left:x, top:y, width:w, fontSize:sizeMm, fontFamily:FONT,
    fontWeight:400, fill:C.ink, lineHeight:1.4, charSpacing:-20, role:'text' }, opt));
}
// 학원명 자리: STEP 2의 학원명(로고가 있으면 로고)이 자동으로 들어갑니다.
function academyText(x, str = '학원명', y = 244){
  return text(str, x, y, COL, 3.2, { fontWeight:600, fill:C.teal, key:'academy', label:'학원명' });
}
// 사진 칸: 점선 사각형 + 안내 글. 사진을 넣으면 같은 자리·크기의 사진으로 바뀝니다.
function frame(x, y, w, h, key, label){
  const r = new fabric.Rect({ left:0, top:0, width:w, height:h, fill:'rgba(2,128,144,0.06)', stroke:C.teal, strokeWidth:0.4, strokeDashArray:[2, 1.5] });
  const t = new fabric.Text('사진을 넣어주세요', { fontSize:Math.min(4, w / 10), fontFamily:FONT, fill:C.teal, originX:'center', originY:'center', left:w / 2, top:h / 2 });
  return new fabric.Group([r, t], { left:x, top:y, role:'frame', key, label, lockScalingFlip:true });
}

// ===================== 학원명·로고 자동 반영 =====================
let book = null;
const getAuto = () => book ? { academy:book.info.academy, logoUrl:book.info.logoUrl } : { academy:'', logoUrl:null };
const byKey = (k, cv) => cv.getObjects().find(o => o.key === k);
const INFO_KEYS = { addr:'address', tel:'phone', visit:'visit' };
// 로고는 3p(학원 소개)에만 — 나머지 페이지 학원명 자리는 글자 그대로 (2026-11-05 QA)
async function fillAuto(cv, s = slot){
  if(book) cv.getObjects().filter(o => o.auto === 'info' && INFO_KEYS[o.key]).forEach(o => { const v = (book.info[INFO_KEYS[o.key]] || '').trim(); if(v) o.set('text', v); });
  const { academy } = getAuto(), logoUrl = book && s === book.first ? book.info.logoUrl : null;
  if(book){   // 템플릿 글의 [원장명]·[학원명] (예: 원장 [원장명] 드림)
    const d = (book.info.director || '').trim(), a = (academy || '').trim();
    cv.getObjects().filter(o => o.type === 'textbox' && o.key !== 'academy').forEach(o => { const t = String(o.text || ''); let n = t; if(d) n = n.replace(/\[원장명\]/g, d); if(a) n = n.replace(/\[학원명\]/g, a); if(n !== t) o.set('text', n); });
  }
  const o = byKey('academy', cv); if(!o) return;
  const idx = cv.getObjects().indexOf(o);
  if(logoUrl){
    const img = await new Promise(res => fabric.Image.fromURL(logoUrl, res));
    if(o.boxH){   // InDesign 로고 칸(3p): 칸 안에 비율 그대로, 가운데
      const sc = Math.min(o.boxH / img.height, o.boxW / img.width);
      img.set({ left:o.boxL + (o.boxW - img.width * sc) / 2, top:o.boxT + (o.boxH - img.height * sc) / 2, scaleX:sc, scaleY:sc, role:'logo', key:'academy', label:'학원 로고',
        boxL:o.boxL, boxT:o.boxT, boxW:o.boxW, boxH:o.boxH, lockSkewingX:true, lockSkewingY:true });
    }else{
    const s = Math.min(9 / img.height, 60 / img.width);
    img.set({ left:o.left, top:o.role === 'logo' ? o.top : o.top - 4, scaleX:s, scaleY:s, role:'logo', key:'academy', label:'학원 로고', lockSkewingX:true, lockSkewingY:true });
    }
    img.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false });
    cv.remove(o); cv.insertAt(img, idx);
  }else if(o.role === 'logo'){
    const ts = themeSpread(s && s.layout), t = ts && themeObjs(ts, geom(s.kind, s.side)).find(x => x.key === 'academy');
    if(t) t.set('text', academy || '학원명');
    cv.remove(o); cv.insertAt(t || academyText(o.left, academy || '학원명', o.top + 4), idx);
  }else{
    o.set('text', academy || '학원명');
  }
}

const SAVE_PROPS = ['role', 'key', 'label', 'auto', 'cellbg', 'row', 'grp', 'card', 'pill', 'rowX', 'boxL', 'boxT', 'boxW', 'boxH', 'logoBox'];
const loadFonts = () => Promise.all([`400 10px ${FONT}`, `600 10px ${FONT}`, `700 10px ${FONT}`, `400 10px ${PEN}`, '400 10px DxWanted', '600 10px DxWanted', '700 10px DxWanted'].map(f => document.fonts.load(f)));
const loadJSON = (cv, json) => new Promise(res => cv.loadFromJSON(json, res));
// 그림으로 된 고정 페이지(12p 쉬어 가는 페이지)인지
const isImagePage = s => !!(s && LAYOUTS[s.layout] && LAYOUTS[s.layout].image);
// 고정 페이지 그림을 재단선에 맞춰 놓음(도련은 흰색 — 인쇄본은 본사가 InDesign 원본으로 만듦)
async function fixedImage(s, g){
  const img = await new Promise(res => fabric.Image.fromURL(LAYOUTS[s.layout].image, res));
  img.set({ left:g.pages[0].x, top:BLEED, scaleX:PAGE_W / img.width, scaleY:PAGE_H / img.height, selectable:false, evented:false });
  return img;
}

// ===================== 내보내기 (팝업을 열지 않고 칸 하나를 그림) =====================
// bleed가 true면 도련 포함(인쇄용, 접히는 쪽은 도련 없음), false면 재단 크기(미리보기용).
async function renderPages(slot, { ppi = 150, bleed = false, type = 'jpeg', quality = 0.9, pageNo = null } = {}){
  await loadTheme();
  await loadFonts();
  const g = geom(slot.kind, slot.side), k = PX_PER_MM(ppi);
  const sc = new fabric.StaticCanvas(null, { width:g.W * k, height:g.H * k, backgroundColor:'#fff', renderOnAddRemove:false, enableRetinaScaling:false });
  sc.setZoom(k);
  let theme = slot.theme;
  if(isImagePage(slot)){ sc.add(await fixedImage(slot, g)); theme = null; }
  else if(slot.saved && savedOk(slot.saved)){ const s = JSON.parse(slot.saved); theme = s.theme; await loadJSON(sc, s.canvas); }
  else (slot.saved ? carryText(slot.saved, buildObjs(slot.layout, g)) : buildObjs(slot.layout, g)).forEach(o => sc.add(o));
  await fillAuto(sc, slot);
  if(pageNo == null && opts && opts.labelsFor && book) pageNo = parseInt(opts.labelsFor(slot)[0], 10) || null;
  if(theme){ const bg = await backgroundFor(slot.layout, g, theme, pageNo ? g.pages.map((_, i) => pageNo + i) : null); if(bg) sc.backgroundImage = bg; }
  sc.renderAll();
  const out = g.pages.map(p => {
    const x0 = p.x - (bleed && p.side === 'L' ? BLEED : 0);
    const x1 = p.x + PAGE_W + (bleed && p.side === 'R' ? BLEED : 0);
    const y0 = bleed ? 0 : BLEED, y1 = bleed ? H : H - BLEED;
    return sc.toDataURL({ format:type, quality, left:x0 * k, top:y0 * k, width:(x1 - x0) * k, height:(y1 - y0) * k });
  });
  sc.dispose();
  return out;
}

// 칸(key)들의 글을 한 줄씩 이어 줍니다. 편집하지 않았으면 예시 글. 제목 칸의 줄바꿈은 한 칸 띄움으로.
function slotText(slot, keys){
  if(!slot || !LAYOUTS[slot.layout]) return '';
  let objs;
  if(slot.saved && savedOk(slot.saved)) objs = JSON.parse(slot.saved).canvas.objects || [];
  else objs = slot.saved ? carryText(slot.saved, buildObjs(slot.layout, geom(slot.kind, slot.side))) : buildObjs(slot.layout, geom(slot.kind, slot.side));
  const get = k => { const o = objs.find(x => x.key === k); return o && o.text ? o.text.trim() : ''; };
  return keys.map((k, i) => i ? get(k) : get(k).replace(/\n/g, ' ')).filter(Boolean).join('\n');
}
// 인사말 펼침면이면 제목 + 본문(표2 맺음말을 여기서 가져감).
function greetingText(slot){
  return LAYOUTS[slot.layout] && LAYOUTS[slot.layout].greeting ? slotText(slot, ['gtitle', 'gbody']) : '';
}
// 표2 맺음말 원문: 4~11p 중 인사말 펼침면 → 없으면 3p 학원 소개(제목 + 소개 문구). 늘 채워지게(2026-11-06).
function closingText(book){
  if(!book) return '';
  return book.spreads.map(greetingText).find(Boolean) || slotText(book.first, ['title', 'lead']);
}

// ===================== 학원 기본 정보 (표1 앞표지·표2 안쪽 표지 미리보기) =====================
// 엔진과 같은 좌표(cover_variable.json)·서체로 대략 그립니다. 정확한 줄바꿈·배치는 STEP 2 미리보기(엔진)에서.
const SUIT_W = { Thin:100, ExtraLight:200, Light:300, SemiBold:600 };
const PRET_W = { Regular:400, Medium:500, SemiBold:600, Bold:700 };
const cmyk = v => { const [c, m, y, k] = (v || [0, 0, 0, 100]).map(x => x / 100); return `rgb(${[c, m, y].map(x => Math.round(255 * (1 - x) * (1 - k))).join(',')})`; };
function coverLines(t){
  const lines = String(t || '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines.length >= 2 ? [lines[0], lines.slice(1).join(' ')] : ['', lines[0] || ''];
}
// 문단(spec)마다 한 줄씩 위에서 아래로. 칸 폭을 넘으면 Textbox가 줄을 바꿉니다.
function paraText(str, spec, x, y, w){
  const suit = spec.font === 'SUIT';
  return new fabric.Textbox(str, { left:x, top:y, width:w, fontSize:spec.sizePt / PT, lineHeight:spec.leadingPt / spec.sizePt / 1.13,
    fontFamily:suit ? 'DxSuit' : FONT, fontWeight:(suit ? SUIT_W : PRET_W)[spec.fontStyle] || 400, charSpacing:spec.tracking || 0,
    textAlign:/CENTER/.test(spec.align) ? 'center' : 'left', fill:cmyk(spec.colorValue), selectable:false, evented:false });
}
function stack(cv, items, x0, y0, w){
  let y = y0;
  items.forEach(([str, spec]) => { if(!str) return; const t = paraText(str, spec, x0, y, w); cv.add(t); y += t.height; });
}
const imgP = (url, opt) => new Promise(res => fabric.Image.fromURL(url, img => res(img), opt));
// 표지: 표1(앞표지)·표2(안쪽 표지)를 낱장으로 하나씩, 재단 크기만 (2026-11-05 QA — 뒤표지 빼고, 흰 테두리 없이)
const INFO_N = 2;   // 아래 줄 맨 앞 두 칸 = 표1, 표2
const INFO_GEOM = { W:PAGE_W, H:PAGE_H, pages:[], fold:0, info:true };
async function drawInfo(cv, info, coverCode, cvJson, base, which = 'p1'){
  cv.clear(); cv.backgroundColor = '#fff';
  const set = cvJson.set[coverCode] || cvJson.set['01'];
  const pg = f => cvJson.pages.find(p => p.file.replace(/\.png$/, '') === f);
  const pxPerMm = cvJson.spreadSizePx[0] / cvJson.spreadSizeMm[0];
  const cut = cvJson.cutPx, X = 0, Y1 = 0;
  const lock = { selectable:false, evented:false };
  // 표1 = 바깥 표지의 오른쪽 반, 표2 = 안쪽 표지의 왼쪽 반
  const im0 = await imgP(`${base}cover/${set[which === 'p1' ? 0 : 1]}.jpg?v=1`), c = which === 'p1' ? cut.right : cut.left, k = 1 / pxPerMm;
  im0.set(Object.assign({ cropX:c[0], width:c[1] - c[0], left:X, top:Y1, scaleX:k, scaleY:k }, lock));
  cv.add(im0);
  const p1 = pg(set[0]), p2 = pg(set[1]);
  const get = (p, n) => p.items.find(i => i.name === n);
  // 표1: 표지 문구가 있으면 그것, 없으면 학원명 + BRANDBOOK
  const [top, strong] = coverLines(info.cover);
  const has = !!(top || strong);
  const it = which === 'p1' && get(p1, has ? '표지문구' : '학원명_BRANDBOOK');
  if(it) stack(cv, has ? [[top, it.paragraphs[0]], [strong, it.paragraphs[1]]] : [[info.academy || '학원명', it.paragraphs[0]], ['BRANDBOOK', it.paragraphs[1]]],
    X + it.panelMm.x, Y1 + it.panelMm.y, it.panelMm.w);
  if(which !== 'p2'){ cv.requestRenderAll(); return; }
  // 표2: 프로필 사진(원형) · 학원명 BRANDBOOK · 원장명 · 맺음말
  const prof = get(p2, '프로필사진');
  if(prof){
    const r = prof.panelMm.w / 2, cx = X + prof.panelMm.x + r, cy = Y1 + prof.panelMm.y + r;
    if(info.profileUrl){
      const im = await imgP(info.profileUrl);
      const s = Math.max(prof.panelMm.w / im.width, prof.panelMm.h / im.height);
      im.set(Object.assign({ originX:'center', originY:'center', left:cx, top:cy, scaleX:s, scaleY:s,
        clipPath:new fabric.Circle({ radius:r / s, originX:'center', originY:'center' }) }, lock));
      cv.add(im);
    }else cv.add(new fabric.Circle(Object.assign({ left:cx - r, top:cy - r, radius:r, fill:'rgba(255,255,255,0.25)', stroke:'rgba(255,255,255,0.7)', strokeWidth:0.3, strokeDashArray:[1, 1] }, lock)));
  }
  const a = get(p2, '표2_학원명'), d = get(p2, '표2_원장명'), gr = get(p2, '표2_인사말');
  if(a) stack(cv, [[info.academy || '학원명', a.paragraphs[0]], ['BRANDBOOK', a.paragraphs[1]]], X + a.panelMm.x, Y1 + a.panelMm.y, a.panelMm.w);
  if(d) stack(cv, [[d.paragraphs[0].text.replace('[원장명]', info.director || '원장명'), d.paragraphs[0]]], X + d.panelMm.x, Y1 + d.panelMm.y, d.panelMm.w);
  const close = closingText(book).split(/(?<=[.!?。])\s+/).filter(Boolean).slice(-2).join(' ');
  if(gr && close) stack(cv, [[close, gr.paragraphs[0]]], X + gr.panelMm.x, Y1 + gr.panelMm.y, gr.panelMm.w);
  cv.requestRenderAll();
}

// ===================== 편집 팝업 (책 한 권: 기본 정보 + 앞부분 전체 + 뒷부분 미리보기) =====================
// 2026-11-06 개편
//  · 고정: 표지·학원 기본 정보 / 3p 학원 소개(내용만 입력) / 12p 쉬어 가는 페이지(매쓰홀릭 그림, 입력 없음) — 상세 편집 없음
//  · 맞춤: 4~11p 펼침면 네 자리 — 템플릿 10종 중 선택, 템플릿을 바꿨다 돌아와도 쓰던 글·사진 복원(slot.cache)
//  · 13p 이후: 매쓰홀릭 프로그램 영역 미리보기(opts.backPages) — 편집 불가
//  · [1. 내용 입력] 왼쪽 = 템플릿·작성 도우미·본문 칸, 가운데 = 실제 펼침면 / [2. 상세 편집] = 같은 펼침면을 끌어 옮기기·크기 조절
//  · 회색 안내(고정·매쓰홀릭)는 화면에만 그리는 DOM이라 PDF(renderPages)에는 나오지 않습니다.
let mounted = false, canvas, g, slot = null, cur = 0, opts = {};
let state = { theme:'clean', layout:null };
let mode = 'A', zoom = 2, userZoom = 1, showGuides = true;
let history = [], future = [], muted = false, dirty = false, addSide = 0;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const FIX_MSG = '미리보기입니다. 이 페이지의 레이아웃은 고정되어 있어요.';
const MH_MSG = '이 자리는 [주제별 구성]에서 고른 주제에 따라 바뀌어요.';
const pagesOf = () => [{ info:'p1' }, { info:'p2' }, book.first, ...book.spreads, book.last, ...((opts.backPages && opts.backPages()) || [])];
const isInfo = () => cur < INFO_N;
const isMh = (i = cur) => !!(pagesOf()[i] || {}).mh;
// 고정(편집 불가): 표지·기본 정보 미리보기 / 12p 쉬어 가는 페이지 / 13p~ 매쓰홀릭. 3p 학원 소개는 원장님이 쓰고 고치는 페이지(2026-11-06 정정).
const isFixed = (i = cur) => { const s = pagesOf()[i]; return !s || s.info || s === book.last || !!s.mh; };
const isIntro = () => !!slot && slot === book.first;
const isFree = () => !!(slot && LAYOUTS[state.layout] && LAYOUTS[state.layout].free);

function mount(){
  if(mounted) return;
  mounted = true;
  const wrap = document.createElement('div');
  wrap.className = 'dx-modal'; wrap.id = 'dxModal';
  wrap.innerHTML = `
  <div class="dx-editor" id="dxEditor" data-mode="A">
    <div class="dx-head">
      <div class="dx-title" id="dxTitle"></div>
      <div class="dx-tabs" id="dxTabs"><button data-m="A" class="on">1. 내용 입력</button><button data-m="B">2. 상세 편집</button></div>
      <button class="dx-btn primary" id="dxDone">완료</button>
    </div>
    <div class="dx-need" id="dxNeed" hidden></div>
    <div class="dx-tools" id="dxTools"></div>
    <div class="dx-body">
      <aside class="dx-pane left">
        <div class="dx-onlyA">
          <div id="dxLayoutBox"><h3>템플릿 <small style="font-weight:500;">누르면 오른쪽 펼침면이 바로 바뀌어요</small></h3><div class="dx-tpls" id="dxLayouts"></div><div class="dx-chips" id="dxColors"></div></div>
          <div id="dxGuide"></div>
          <h3 id="dxFormTitle">내용 입력</h3><div id="dxForm"></div>
        </div>
        <div class="dx-cue" id="dxCue" hidden><button type="button">아래에 이어서 입력할 내용이 있어요 <b>↓</b></button></div>
        <div class="dx-onlyB"><h3>넣기</h3>
          <div class="dx-seg" id="dxAddSide"><button data-side="0" class="on">왼쪽 쪽에</button><button data-side="1">오른쪽 쪽에</button></div>
          <div class="dx-add"><button class="dx-btn small" id="dxAddTitle">제목 글</button><button class="dx-btn small" id="dxAddBody">본문 글</button>
            <button class="dx-btn small" id="dxAddFrame">사진 칸</button><label class="dx-btn small">사진 올리기<input type="file" id="dxPhoto" accept="image/png,image/jpeg" hidden></label></div>
          <p class="dx-note">사진 칸을 고른 뒤 [사진 올리기]를 누르면 칸에 맞춰 들어가요. 아무것도 고르지 않으면 위에서 고른 쪽에 들어가요.</p>
          <h3>레이어 <small style="font-weight:500;">(위에 있을수록 앞)</small></h3><div class="dx-layers" id="dxLayers"></div></div>
      </aside>
      <div class="dx-stage" id="dxStage"><div class="dx-stage-inner">
        <div class="dx-stagebar" id="dxStageBar"></div>
        <div class="dx-labels" id="dxLabels"></div>
        <div class="dx-canvas-wrap" id="dxCanvasWrap"><canvas id="dxCanvas"></canvas><div class="dx-static" id="dxStatic" hidden></div><div class="dx-infoview" id="dxInfoView" hidden></div><div class="dx-lock" id="dxLock" hidden><span></span></div></div>
        <p class="dx-note" id="dxStageNote" style="text-align:center;"></p></div></div>
      <aside class="dx-pane right dx-onlyB" id="dxProps"></aside>
    </div>
    <div class="dx-strip" id="dxStrip"></div>
    <div class="dx-foot"><span id="dxMsg"></span>
      <span class="dx-legend"><i style="border-top:1px solid #E5484D;"></i>재단선<i style="border-top:1px dashed #02C39A;"></i>안전 영역(글·사진은 안쪽에)</span></div>
  </div>`;
  document.body.appendChild(wrap);
  canvas = new fabric.Canvas('dxCanvas', { preserveObjectStacking:true, backgroundColor:'#fff' });
  bind();
  // 왼쪽 창 아래에 더 입력할 내용이 있으면 하단에 ‘아래로’ 안내를 띄움(누르면 내려감, 끝까지 내리면 사라짐)
  const pane = $('dxCue').closest('.dx-pane');
  let cueRaf = 0;
  const cue = () => { cancelAnimationFrame(cueRaf); cueRaf = requestAnimationFrame(() => {
    $('dxCue').hidden = !(mode === 'A' && pane.scrollHeight - pane.scrollTop - pane.clientHeight > 48); }); };
  pane.addEventListener('scroll', cue, { passive:true });
  window.addEventListener('resize', cue);
  new MutationObserver(cue).observe(pane, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden', 'open'] });
  $('dxCue').addEventListener('click', () => pane.scrollBy({ top:pane.clientHeight * 0.7, behavior:'smooth' }));
}
const isOpen = () => mounted && $('dxModal').classList.contains('show');
function setMsg(m, warn){ const el = $('dxMsg'); el.textContent = m; el.className = warn ? 'warn' : ''; }
const labelsAt = i => { const s = pagesOf()[i]; if(i < INFO_N) return [i === 0 ? '표1' : '표2']; if(s && s.mh) return s.imgs.map(x => `${x.no}p`); return opts.labelsFor ? opts.labelsFor(s) : []; };
const nameAt = i => { const s = pagesOf()[i]; if(i < INFO_N) return i === 0 ? '앞표지' : '안쪽 표지'; if(s.mh) return s.title || '주제별 구성'; return (LAYOUTS[s.layout] || {}).name; };
// 구간 표시: [성격, 이름] — 모달·편집기·아래 줄 어디서나 같은 글
function sectionAt(i){
  const s = pagesOf()[i];
  if(i < INFO_N) return ['고정', i === 0 ? '표1 앞표지' : '표2 안쪽 표지'];
  if(s === book.first) return ['고정', `${labelsAt(i)[0].replace('p', '')}쪽 학원 소개`];
  if(s === book.last) return ['고정', `${labelsAt(i)[0].replace('p', '')}쪽 ${(LAYOUTS[s.layout] || {}).name || ''}`];
  if(s.mh) return ['주제별', `${s.imgs.map(x => x.no).join('~')}쪽${s.sample ? ' 예시' : ''}`];
  const l = labelsAt(i); return ['맞춤', `${l[0].replace('p', '')}~${l[l.length - 1].replace('p', '')}쪽 ${nameAt(i)}`];
}
const secHtml = i => { const [k, t] = sectionAt(i); return `<span class="dx-sec ${k === '맞춤' ? 'cus' : k === '고정' ? 'fix' : k === '학원 소개' ? 'intro' : 'mh'}">${k}</span> ${esc(t)}`; };

function fitCanvas(){
  const stage = $('dxStage');
  if(isMh()){ $('dxStatic').style.height = Math.max(240, stage.clientHeight - 110) + 'px'; return; }
  const fit = Math.min((stage.clientWidth - 48) / g.W, (stage.clientHeight - 120) / g.H);
  zoom = Math.max(0.4, fit) * userZoom;
  canvas.setDimensions({ width:g.W * zoom, height:g.H * zoom });
  canvas.setZoom(zoom);
  canvas.requestRenderAll();
}
let bgTok = 0;
const pageNosAt = i => labelsAt(i).map(l => parseInt(l, 10)).filter(n => n > 0);
function applyTheme(id){
  state.theme = themeId(id);
  const tok = ++bgTok, layout = state.layout, cg = g;
  backgroundFor(layout, cg, state.theme, pageNosAt(cur)).then(bg => { if(tok === bgTok) canvas.setBackgroundImage(bg, canvas.renderAll.bind(canvas)); });
  renderLayoutChips();
}
async function buildLayout(id, themeId){
  state.layout = id;
  silent(() => { canvas.clear(); canvas.backgroundColor = '#fff'; buildObjs(id, g).forEach(o => canvas.add(o)); });
  await fillAuto(canvas);
  applyTheme(themeId || state.theme);
}
// 템플릿 바꾸기: 지금 쓰던 내용은 slot.cache[이전 템플릿]에 두고, 바꿀 템플릿에 예전에 쓰던 게 있으면 그대로 되살립니다.
async function switchLayout(id){
  if(!slot || id === state.layout) return;
  slot.cache = slot.cache || {};
  slot.cache[state.layout] = snapshot();
  if(slot.cache[id] && savedOk(slot.cache[id])){ await restore(slot.cache[id]); await fillAuto(canvas); }
  else await buildLayout(id, state.theme);
  slot.layout = id; slot.theme = state.theme;
  slot.saved = slot.cache[id] || null;
  history = [snapshot()]; future = []; dirty = false;
  pending = null; editOpen = false; flowPending = null;
  if(isFree()){ refreshUI(); renderStrip(); scheduleSave(); setMode('B'); return setMsg('빈 펼침면이에요. 왼쪽에서 글과 사진을 넣어 보세요. 넣은 것만 인쇄돼요.'); }
  setMsg(`${LAYOUTS[id].name} 템플릿으로 바꿨어요. ${slot.saved ? '전에 쓰던 글과 사진을 되살렸어요.' : '아래 질문부터 차례로 골라 주세요.'}`);
  refreshUI(); renderStrip(); renderStageBar(); scheduleSave();
  { const f = $('dxForm').firstElementChild; if(f) reveal(f); }   // 템플릿을 고르면 그 템플릿의 첫 질문이 보이도록 내려 줌
}
function setInteractive(){
  const edit = mode === 'B' && !isFixed();
  canvas.selection = edit;
  canvas.getObjects().forEach(o => o.set({ selectable:edit, evented:edit || !!o.key, hoverCursor:edit ? 'move' : (o.key ? 'pointer' : 'default') }));
}

// 되돌리기
function snapshot(){ const j = canvas.toJSON(SAVE_PROPS); delete j.backgroundImage; return JSON.stringify({ theme:state.theme, layout:state.layout, canvas:j, tv:THEME_VER() }); }
function silent(fn){ muted = true; try{ fn(); } finally{ muted = false; } }
function pushHistory(){ if(muted || isFixedNoCanvas()) return; history.push(snapshot()); if(history.length > 60) history.shift(); future = []; dirty = true; refreshUI(); scheduleSave(); }
const isFixedNoCanvas = () => isInfo() || isMh() || isImagePage(slot);
async function restore(json){
  const s = JSON.parse(json);
  muted = true;
  await loadJSON(canvas, s.canvas);
  state.theme = s.theme; state.layout = s.layout;
  canvas.getObjects().filter(o => o.role === 'photo' || o.role === 'logo').forEach(o => o.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false }));
  applyTheme(s.theme);
  muted = false; canvas.requestRenderAll(); refreshUI();
}
// 되돌리기·다시하기는 바로 저장(곧바로 창을 닫아도 되돌린 상태가 남도록)
const saveNow = () => { dirty = true; clearTimeout(saveTimer); commit(); opts.onSave && opts.onSave(); renderStrip(); };
function undo(){ if(history.length < 2) return; future.push(history.pop()); restore(history[history.length - 1]).then(saveNow); }
function redo(){ if(!future.length) return; const s = future.pop(); history.push(s); restore(s).then(saveNow); }
function refreshUI(){ setInteractive(); renderTop(); renderForm(); renderLayers(); renderProps(); }

// 자동 저장: 바뀐 내용을 책(slot.saved)에 넣고 opts.onSave로 알려 index.html이 브라우저(IndexedDB)에 저장합니다.
let saveTimer = null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => { const was = slot && !!slot.saved; commit(); opts.onSave && opts.onSave(); if(slot && !was && slot.saved) renderStrip(); else updateDoneBtn(); }, 600); }

function renderTop(){
  const noEdit = isFixedNoCanvas();
  $('dxTools').innerHTML = (noEdit ? '' : `<button class="dx-tb" data-a="undo" ${history.length < 2 ? 'disabled' : ''}>되돌리기</button>
    <button class="dx-tb" data-a="redo" ${future.length ? '' : 'disabled'}>다시하기</button><span class="dx-sep"></span>
    <button class="dx-tb ${showGuides ? 'on' : ''}" data-a="guides">재단선·안전 영역</button><span class="dx-sep"></span>`) +
    (isMh() || isInfo() ? '' : `<button class="dx-tb" data-a="zoom-">−</button><span class="dx-zoom">${Math.round(userZoom * 100)}%</span><button class="dx-tb" data-a="zoom+">+</button>
    <button class="dx-tb" data-a="zoomfit">화면 맞춤</button>`) + `<span class="dx-sep"></span><span class="dx-where">${secHtml(cur)}</span>`;
}
// 미리보기 위 버튼: [이 펼침면 상세 편집] / 백지면 [이 펼침면 자유 편집하기] / 상세 편집 중이면 [내용 입력으로]
function renderStageBar(){
  const el = $('dxStageBar');
  if(isFixed()){ el.innerHTML = `<span class="dx-where">${secHtml(cur)}</span>`; return; }
  el.innerHTML = `<span class="dx-where">${secHtml(cur)}</span>` + (mode === 'A'
    ? `<button class="dx-btn small ${isFree() ? 'primary' : ''}" data-a="toB">${isFree() ? '빈 펼침면에 글·사진 넣기' : isIntro() ? '이 페이지 상세 편집' : '이 펼침면 상세 편집'}</button>`
    : `<button class="dx-btn small" data-a="toA">← 내용 입력으로</button>`);
}
function renderLock(){
  // 입력하는 페이지(표1·표2·3p)는 안내 막 없이 — 쓰는 대로 바뀌는 모습이 가려져서 (2026-11-05 QA). 12p·매쓰홀릭만
  const el = $('dxLock'), on = isFixed() && !isInfo() && slot !== book.first;
  el.hidden = !on;
  if(on){ el.className = 'dx-lock' + (isMh() ? ' mh' : ''); el.querySelector('span').textContent = isMh() ? MH_MSG : FIX_MSG; }
}

// 템플릿 고르기 (4~11p 펼침면만) + 색
function renderLayoutChips(){
  const box = $('dxLayoutBox');
  if(!slot || isFixed() || isIntro()){ box.hidden = true; return; }
  box.hidden = false;
  $('dxLayouts').innerHTML = SPREAD_LAYOUTS.map(id => { const l = LAYOUTS[id];
    return `<button type="button" class="dx-tpl ${id === state.layout ? 'on' : ''} ${l.free ? 'free' : ''}" data-l="${id}" title="${esc(l.sub)}"><b>${l.name}</b><span>${esc(l.sub)}</span>${slot.cache && slot.cache[id] && id !== state.layout ? '<i>작성함</i>' : ''}</button>`; }).join('');
  $('dxColors').innerHTML = '배경 ' + Object.entries(THEMES).map(([id, t]) => `<button class="dx-dot ${id === state.theme ? 'on' : ''}" title="${t.name}" data-all="${id}" style="background:${t.dot}"></button>`).join('');
}

// ---------- 작성 도우미 ----------
// 도우미 상태(펼침면·템플릿마다): t = 고른 항목 번호(0부터), kw = 고른 키워드(하나), own = 직접 쓴 한 줄
// 원고 상태(펼침면·템플릿마다 따로 저장): slot.fill[템플릿] = { opt, fields(넣은 원고), grades, levelNote, count, kw }
const fillOf = () => slot && FILLS[state.layout];
const fState = () => { slot.fill = slot.fill || {}; return slot.fill[state.layout] = slot.fill[state.layout] || {}; };
let pending = null, editOpen = false, flashKeys = [];
const defCache = {};
function defaultText(k){
  const ck = state.layout + '|' + k;
  if(!(ck in defCache)){ const o = buildObjs(state.layout, g).find(x => x.key === k); defCache[ck] = o && o.type === 'textbox' ? String(o.text || '') : ''; }
  return defCache[ck];
}
const fieldText = k => { const o = byKey(k, canvas); return o && o.type === 'textbox' ? String(o.text || '') : ''; };
// 고른 답 → 넣을 원고 한 세트
function fieldsFor(choice){
  const F = fillOf();
  if(state.layout === 'curriculum') return curriFields(choice.grades || [], !!choice.levelNote);
  const o = F.opts.find(x => x.id === choice.id); if(!o) return {};
  const f = Object.assign({}, o.fields);
  if(state.layout === 'class') Object.keys(f).forEach(k => { if(k !== 'title' && k !== 'lead') delete f[k]; });   // 첫 답은 왼쪽 책장(대표 문구·소개 글)만
  if(F.names){ Object.keys(f).forEach(k => { f[k] = fillNames(f[k], book.info); }); f.sign = signOf(book.info); }
  return f;
}
// 원장님이 직접 고친 칸: 지금 글이 마지막으로 넣은 원고(처음이면 템플릿 샘플)와 다른 칸
function editedKeys(next){
  const st = fState(), prev = st.fields || null;
  const keys = [...new Set([...Object.keys(next), ...Object.keys(prev || {})])];
  return keys.filter(k => { const o = byKey(k, canvas); if(!o || o.type !== 'textbox' || o.visible === false || (k === 'sign' && state.layout === 'greeting')) return false;   // 서명은 원장명에서 자동
    const base = prev && k in prev ? prev[k] : defaultText(k); return fieldText(k) !== base; });
}
// 선생님 소개: 고른 구성에 맞춰 프로필 자리 수와 배치를 바꿈(한 분이면 크게 한 사람 중심)
const cardOf = (o, n) => o.card === n || new RegExp(`^(tp|t)${n}(d|m)?$`).test(o.key || '');
function arrangeTeachers(count, one){
  const tpl = buildObjs('teacher', g), R = at(g).R;
  for(let n = 1; n <= 4; n++) canvas.getObjects().filter(o => cardOf(o, n)).forEach(o => {
    o.set('visible', n <= count);
    const t = tpl.find(x => x.key === o.key); if(!t) return;
    const big = one && n === 1;
    if(o.key === `tp${n}`){
      const box = big ? { x:R, y:24, w:100, h:118 } : { x:t.left, y:t.top, w:t.width, h:t.height };
      if(o.role === 'photo'){ const sc = box.w / o.width; o.set({ left:box.x, top:box.y, scaleX:sc, scaleY:sc }); }
      else o.set({ left:box.x, top:box.y, scaleX:box.w / o.width, scaleY:box.h / o.height });
    }else if(big){
      const pos = { [`t${n}`]:[150, 6], [`t${n}d`]:[160, 3.6], [`t${n}m`]:[172, 3.8] }[o.key];
      if(pos) o.set({ left:R, top:pos[0], width:COL, fontSize:pos[1] });
    }else o.set({ left:t.left, top:t.top, width:t.width, fontSize:t.fontSize });
    o.setCoords && o.setCoords();
  });
}
// 학년별 커리큘럼: 고른 과정 수만큼만 보이고, 수준별 반 편성 안내는 골랐을 때만
function arrangeCurri(n, levelNote){
  canvas.getObjects().forEach(o => {
    const m = /^(g|goal|desc)(\d)$/.exec(o.key || ''); const r = o.row || (m ? +m[2] : 0);
    if(r) o.set('visible', r <= n);
    if(o.grp === 'level' || o.key === 'ntitle' || (o.key === 'note' && state.layout === 'curriculum')) o.set('visible', !!levelNote);
  });
}
// 답을 고르면 원고 한 세트를 펼침면의 모든 글 칸에 바로 넣고 저장. 직접 고친 글이 있을 때만 먼저 물어봄.
function applyChoice(choice, force){
  const F = fillOf(); if(!F) return;
  const next = fieldsFor(choice);
  // 팝업 없이 바로 바꿈(직접 고친 글이 있어도) — 되돌리려면 [되돌리기]
  const hadEdits = editedKeys(next).length > 0;
  pending = null;
  // 이번 개편 전에 저장된 펼침면(slot.v2 표시 없음)은 샘플과 같은 값이라도 원장님이 남겨 둔 것일 수 있어 비우지 않습니다.
  const legacy = !!slot.saved && !slot.v2;
  slot.v2 = true;
  const st = fState(), first = !st.fields && !legacy;
  // 처음 고를 때: 원장님만 아는 칸(교재명·성함·시간표…)에 남은 샘플 글은 비움 — 확인되지 않은 사실을 인쇄하지 않도록
  if(first && F.facts) F.facts.forEach(k => { const o = byKey(k, canvas); if(o && o.type === 'textbox' && fieldText(k) === defaultText(k)){ o.set('text', ''); syncCellBg(o); } });
  if(state.layout === 'curriculum' && st.fields) Object.keys(st.fields).forEach(k => { if(!(k in next)){ const o = byKey(k, canvas); if(o && o.type === 'textbox' && /^(g|goal|desc)\d$/.test(k)) o.set('text', ''); } });
  flashKeys = Object.keys(next).filter(k => fieldText(k) !== next[k]);
  Object.entries(next).forEach(([k, v]) => { const o = ensureField(k); if(o && o.type === 'textbox'){ o.set('text', v); syncCellBg(o); fitOneLine(o); } });
  if(state.layout === 'teacher'){
    const opt = F.opts.find(x => x.id === choice.id), cnt = choice.id === 'one' ? 1 : Math.max(2, st.count || opt.count);
    if(choice.id !== 'staff'){ const d = (book.info.director || '').trim(), o = byKey('t1', canvas); if(d && o && !fieldText('t1').trim()) o.set('text', `${d} 원장`); }
    arrangeTeachers(cnt, choice.id === 'one'); st.count = cnt;
  }
  if(state.layout === 'curriculum') arrangeCurri(Math.min((choice.grades || []).length, CURRI_MAX), choice.levelNote);
  Object.assign(st, { opt:choice.id || null, fields:next }, state.layout === 'curriculum' ? { grades:choice.grades, levelNote:!!choice.levelNote } : {});
  canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
  const label = state.layout === 'curriculum' ? (choice.grades || []).join('·') : (F.opts.find(x => x.id === choice.id) || {}).label;
  if(hadEdits) return setMsg(`‘${label}’ 문구로 바꿨어요. ${'바꾸기 전 문구로 돌아가려면 위의 [되돌리기]를 눌러 주세요.'}`);
  setMsg(state.layout === 'greeting' ? `‘${label}’ 인사말을 넣었어요. 왼쪽 제목·본문 칸에서 바로 고치면 책에도 함께 바뀌어요.`
    : state.layout === 'class' ? `‘${label}’ 대표 문구와 소개 글을 넣었어요. 고른 수업 활동은 그대로예요. 왼쪽 칸에서 바로 고치면 책에도 함께 바뀌어요.`
    : `‘${label}’ 원고를 ${isIntro() ? '3쪽' : '펼침면'} 전체에 넣었어요. 문장을 고치려면 오른쪽 책의 글을 누르거나 [문구 수정]을 여세요.`);
}
// 템플릿의 제목 자리가 한 줄짜리면(줄바꿈 없는 샘플), 넣은 제목이 넘칠 때 글자 크기를 줄여 한 줄에 맞춥니다(아래 글과 겹치지 않게).
function fitOneLine(o){
  if(!o || o.key !== 'title' || /\n/.test(defaultText('title'))) return;
  const tpl = buildObjs(state.layout, g).find(x => x.key === 'title'); if(!tpl) return;
  o.set('fontSize', tpl.fontSize); o.initDimensions();
  while(o._textLines && o._textLines.length > 1 && o.fontSize > 6){ o.set('fontSize', o.fontSize - 0.25); o.initDimensions(); }
}
// 키를 가진 칸이 지금 펼침면에 없으면(예전 저장본) 템플릿 원래 위치에 만들어 넣습니다.
function ensureField(k){
  let o = byKey(k, canvas); if(o) return o;
  const tpl = buildObjs(state.layout, g).find(x => x.key === k);
  if(!tpl) return null;
  if(k === 'ttcorner'){ const old = canvas.getObjects().find(x => x.type === 'textbox' && !x.key && x.text === '반' && Math.abs(x.left - tpl.left) < 1 && Math.abs(x.top - tpl.top) < 1); if(old) canvas.remove(old); }
  canvas.add(tpl); setInteractive(); return tpl;
}
function renderGuide(){
  const box = $('dxGuide');
  if(mode !== 'A' || !slot || isMh() || isInfo() || isImagePage(slot)){ box.innerHTML = ''; return; }
  if(['class', 'greeting', 'space', 'flow', 'timetable', 'teacher', 'curriculum', 'care', 'books', 'intro'].includes(state.layout)){ box.innerHTML = ''; return; }   // 질문·입력칸을 한 카드로 renderClassForm / renderGreetingForm에서   // 수업 방식은 질문·입력칸을 한 흐름으로 renderClassForm에서
  if(isFree()){ box.innerHTML = `<div class="dx-guide"><div class="dx-gq" style="margin-bottom:10px;">빈 두 쪽을 원하는 대로 채워요</div><button class="dx-btn primary" data-a="toB" style="width:100%;">빈 펼침면에 글·사진 넣기</button><p class="dx-note" style="margin:8px 0 0;">책에는 원장님이 넣은 글과 사진만 인쇄돼요.</p></div>`; return; }
  const F = fillOf(); if(!F){ box.innerHTML = ''; return; }
  const st = fState(), cur0 = state.layout === 'curriculum' ? (st.grades && st.grades.length) : st.opt;
  let h = `<div class="dx-guide"><div class="dx-gq">${esc(F.q)}</div>`;
  // 인사말: 질문 바로 아래에 안내(고른 답 이름이 들어감)
  if(state.layout === 'greeting'){ const lb = (F.opts.find(o => o.id === st.opt) || {}).label;
    h += `<p class="dx-note dx-greet-note">${lb ? `‘<b>${esc(lb)}</b>’에 어울리는 인사말 제목과 본문이 채워졌어요. 아래 칸에서 바로 고치면 돼요.` : '하나를 고르면 어울리는 인사말 제목과 본문이 바로 채워져요.'}</p>`; }
  if(state.layout === 'curriculum'){
    const sel = pending ? pending.grades : (st.grades || []);
    h += `<p class="dx-note" style="margin:-2px 0 8px;">실제로 운영하는 학년을 모두 골라 주세요. 두 쪽에 과정 ${CURRI_MAX}개까지 들어가요.</p>`;
    h += ['초', '중', '고'].map(lv => `<div class="dx-grades">${GRADES.filter(x => x[0] === lv).map(gr => `<button type="button" class="dx-chip ${sel.includes(gr) ? 'on' : ''}" data-grade="${gr}">${gr}</button>`).join('')}</div>`).join('');
    h += `<label class="dx-check"><input type="checkbox" id="dxLevel" ${(pending ? pending.levelNote : st.levelNote) ? 'checked' : ''}> 수준별 반 편성 안내도 넣기</label>`;
    h += `<div id="dxCurriMsg" class="dx-note" style="margin:6px 0 0;"></div>`;
  }else{
    h += `<div class="dx-opts" role="radiogroup">${F.opts.map(o => `<button type="button" role="radio" aria-checked="${st.opt === o.id}" class="dx-opt ${st.opt === o.id ? 'on' : ''} ${pending && pending.id === o.id ? 'pending' : ''}" data-opt="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
  }
  if(pending) h += `<div class="dx-confirm"><b>직접 수정한 문구를 새 예시로 바꿀까요?</b><p>바꾸면 이 ${isIntro() ? '페이지' : '펼침면'}의 글이 새 예시로 바뀌어요. 사진과 직접 넣은 정보(이름·교재명·시간표 등)는 그대로 남아요.</p><div class="dx-own-acts"><button type="button" class="dx-btn small primary" data-confirm="yes">새 예시로 바꾸기</button><button type="button" class="dx-btn small" data-confirm="no">취소</button></div></div>`;
  if(state.layout === 'teacher' && st.opt && st.opt !== 'one') h += `<div class="dx-count">소개할 인원 <b>${st.count || 2}명</b><button type="button" class="dx-btn small" data-tcount="-1" ${(st.count || 2) <= 2 ? 'disabled' : ''}>−</button><button type="button" class="dx-btn small" data-tcount="1" ${(st.count || 2) >= 4 ? 'disabled' : ''}>＋</button><small>실제 인원만큼만 넣어 주세요</small></div>`;
  if(state.layout === 'greeting'){}
  else if(cur0 && !pending) h += `<div class="dx-done">✓ 고른 답에 맞춰 ${isIntro() ? '3쪽' : '펼침면'}의 글을 모두 채웠어요. <button type="button" class="dx-link" data-editopen>문구 수정</button></div>`;
  else if(!pending && state.layout !== 'greeting') h += `<p class="dx-note" style="margin:8px 0 0;">답을 고르면 ${isIntro() ? '제목과 소개 글' : '이 펼침면의 모든 글'}이 한 번에 채워져요.</p>`;
  if(isIntro() && F.sentences){
    const s1 = F.sentences.find(x => x[0] === st.kw);
    h += `<details class="dx-own" ${st.kw ? 'open' : ''}><summary>소개 문구만 바꾸기 (키워드 추천 문구)</summary><div class="dx-gtags" style="margin-top:8px;">${F.sentences.map(([k]) => `<button type="button" class="dx-chip ${k === st.kw ? 'on' : ''}" data-sent="${esc(k)}">${esc(k)}</button>`).join('')}</div>
      ${s1 ? `<div class="dx-sug"><div class="dx-sug-h"><span class="dx-sug-badge">추천 문구 · 3쪽 소개 문구</span></div><div class="dx-sug-body"><div>${esc(s1[1])}</div></div><button type="button" class="dx-btn small primary" data-sent-apply style="width:100%;">3쪽 소개 문구에 적용</button></div>` : ''}</details>`;
  }
  box.innerHTML = h + '</div>';
}
function syncCellBg(o){
  if(o && /^tag\d+$/.test(o.key || '')) reflowTags(canvas.getObjects());
  if(!o || !/^cell_/.test(o.key || '')) return;
  const bg = canvas.getObjects().find(x => x.cellbg === o.key);
  if(bg) bg.set('fill', String(o.text || '').trim() ? C.paleMint : '#F6F8F8');
}

// 왼쪽 본문 칸 (실제 책에 들어가는 글)
const LONG = k => /^(title|lead|gtitle|gbody|note|rtitle)$|d$|^desc/.test(k);
function fieldHtml(o, fact){
  const k = o.key;
  if(o.role === 'frame' || o.role === 'photo'){
    const ok = o.role === 'photo';
    return `<div class="dx-fld" data-k="${k}"><label>${o.label}</label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '비어 있음'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${k}"></label></div></div>`;
  }
  if(k === 'academy' && slot === book.first){   // 3p: 학원명 자리에 로고(안 올리면 학원명)
    const u = book.info.logoUrl;
    return `<div class="dx-fld"><label>로고 <small>올리지 않으면 학원명이 들어가요 · PNG 권장</small></label><div class="dx-photo">
      ${u ? `<img class="dx-thumb" alt="" src="${u}">` : '<span class="st">아직 없어요</span>'}
      <span class="dx-photo-act">${u ? '<button type="button" class="dx-link" data-clear="logoUrl">지우기</button>' : ''}<label class="dx-btn small" style="margin:0;">${u ? '바꾸기' : '올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-info-file="logoUrl"></label></span></div></div>`;
  }
  if(k === 'academy') return `<div class="dx-fld" data-k="${k}"><label>학원명 <small>[앞표지]에서 넣은 이름이 들어가요</small></label></div>`;
  if(o.auto === 'info') return `<div class="dx-fld" data-k="${k}"><label>${o.label} <small>[학원 기본 정보]에서 자동으로 들어가요</small></label><div class="dx-auto">${esc(o.text || '')}</div></div>`;
  const rows = k === 'gbody' ? 8 : /title/.test(k) ? 2 : 3;
  return `<div class="dx-fld" data-k="${k}"><label>${o.label}</label>` + (fact ? '' : '') +
    (LONG(k) ? `<textarea data-k="${k}" rows="${rows}">${esc(o.text || '')}</textarea>` : `<input type="text" data-k="${k}" value="${esc(o.text || '')}">`) + '</div>';
}
function renderForm(){
  const box = $('dxForm');
  renderGuide();
  if(mode !== 'A') return;
  if(isInfo()) return renderInfoForm();
  if(isImagePage(slot)){
    $('dxFormTitle').textContent = LAYOUTS[slot.layout].name;
    box.innerHTML = '<div class="dx-lockcard"><b>미리 준비된 고정 페이지예요</b><p>다음 쪽부터 주제별 구성이 시작돼요. 따로 꾸미지 않아도 돼요.</p></div>';
    return;
  }
  if(isMh()){
    $('dxFormTitle').textContent = '주제별 구성';
    box.innerHTML = `<div class="dx-lockcard"><b>고르신 주제가 들어가는 자리예요</b><p>13쪽부터는 [주제별 구성]에서 고른 수업·관리 항목이 이어져요. ${pagesOf()[cur].sample ? '아직 주제를 고르기 전이라 예시 페이지를 보여드리고 있어요.' : '지금 보이는 페이지가 실제로 들어가요.'} 이 자리는 따로 꾸미지 않아도 돼요.</p></div>`;
    return;
  }
  $('dxFormTitle').textContent = '';
  const objs = canvas.getObjects().filter(o => o.key && o.visible !== false && o.key !== 'academy');
  if(!objs.length){ box.innerHTML = ''; return; }
  if(state.layout === 'greeting') return renderGreetingForm(box, objs);
  if(state.layout === 'class') return renderClassForm(box, objs);
  if(state.layout === 'space') return renderSpaceForm(box, objs);
  if(state.layout === 'flow') return renderFlowForm(box, objs);
  if(state.layout === 'timetable') return renderTimetableForm(box);
  if(state.layout === 'teacher') return renderTeacherForm(box, objs);
  if(state.layout === 'curriculum') return renderCurriForm(box);
  if(state.layout === 'care') return renderCareForm(box, objs);
  if(state.layout === 'books') return renderBooksForm(box, objs);
  if(state.layout === 'intro') return renderIntroForm(box, objs);
  const F = fillOf() || {}, st = fState(), optShots = ((F.opts || []).find(o => o.id === st.opt) || {}).shots || {};
  const facts = new Set(F.facts || []);
  const photos = objs.filter(o => o.role === 'frame' || o.role === 'photo');
  const factObjs = objs.filter(o => facts.has(o.key) && o.type === 'textbox' && !/^(row|cell)_/.test(o.key));
  const textObjs = objs.filter(o => o.type === 'textbox' && !facts.has(o.key) && o.auto !== 'info');
  const shot = k => optShots[k] || (F.shots || {})[k] || (/^tp\d$/.test(k) && (F.shots || {}).tp1) || '';
  let h = '';
  // ① 원장님만 넣을 수 있는 것: 사진·이름·교재명·시간표 (인쇄되는 건 원장님이 넣은 내용뿐, 촬영 예시는 화면에만)
  const need = [];
  photos.forEach(o => { const ok = o.role === 'photo';
    need.push(`<div class="dx-fld" data-k="${o.key}"><label>${esc(o.label)}${ok ? '' : ' <small>비어 있음</small>'}</label>${!ok && shot(o.key) ? `<p class="dx-hint">촬영 예시: ${esc(shot(o.key))}</p>` : ''}<div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '사진을 올려 주세요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${o.key}"></label></div></div>`); });
  if(state.layout === 'timetable'){
    const v = k => esc(fieldText(k));
    need.push(`<div class="dx-fld"><label>시간표 <small>반 이름·요일·시간은 직접 입력해 주세요. 답을 바꿔도 그대로 남아요</small></label><div class="dx-ttgrid"><table>
      <tr><th>${v('ttcorner') || '반'}</th>${TT_DAYS.map((d, j) => `<th><input type="text" data-k="day_${j}" value="${v(`day_${j}`)}"></th>`).join('')}</tr>
      ${Array.from({ length:TT_ROWS }, (_, i) => `<tr><th><input type="text" data-k="row_${i}" value="${v(`row_${i}`)}" placeholder="${v('ttcorner') || '반'} 이름"></th>${TT_DAYS.map((d, j) => `<td><input type="text" data-k="cell_${i}_${j}" value="${v(`cell_${i}_${j}`)}"></td>`).join('')}</tr>`).join('')}
    </table></div></div>`);
  }
  factObjs.forEach(o => need.push(fieldHtml(o, true)));
  if(need.length) h += `<div class="dx-need-box"><div class="dx-glabel">원장님이 직접 넣어 주세요 <small>사진·이름·교재명·시간처럼 원장님만 아는 내용은 비워 두었어요</small></div>${F.note ? `<p class="dx-hint">${esc(F.note)}</p>` : ''}${need.join('')}</div>`;
  // ② 문구 수정 (기본 접힘)
  if(textObjs.length) h += `<details class="dx-edit" id="dxEdit" ${editOpen ? 'open' : ''}><summary>문구 수정 <small>오른쪽 책의 문장을 눌러도 열려요</small></summary>${textObjs.map(o => fieldHtml(o)).join('')}</details>`;
  box.innerHTML = h;
}
// 인사말: 질문·답 바로 아래에 제목·본문 입력칸을 항상 펼쳐 두고(답을 누르면 두 칸과 책에 함께 들어감), 서명은 기본 정보의 원장명, 사진(선택)은 맨 아래.
function renderGreetingForm(box, objs){
  const sign = byKey('sign', canvas), want = signOf(book.info);
  // 서명은 원장님이 직접 바꾸지 않았다면(‘원장 … 드림’ 꼴) 기본 정보의 원장명을 따라갑니다.
  if(sign && sign.text !== want && /^원장 .* 드림$|^원장 드림$/.test(sign.text || '')){ sign.set('text', want); canvas.requestRenderAll(); dirty = true; scheduleSave(); }
  const F = fillOf(), st = fState(), v = k => esc(fieldText(k));
  const photo = objs.find(o => o.role === 'frame' || o.role === 'photo');
  // 질문 카드: 라벨 → 질문 → 안내 → 약속 3개 → 제목·본문 입력칸 (선택하면 두 칸과 책에 바로 들어감)
  let h = `<div class="dx-greet"><section class="dx-guide dx-step"><div class="dx-step-h">인사말 · 제목과 본문</div>
    <div class="dx-gq">${esc(F.q)}</div>
    <p class="dx-note dx-greet-note">${st.opt ? '고른 약속에 맞춰 제목과 본문을 채웠어요. 아래에서 원장님 말투로 바꿔보세요.' : '약속을 하나 고르면 왼쪽 페이지의 제목과 오른쪽 페이지의 인사말 본문이 함께 채워져요.'}</p>
    <div class="dx-opts" role="radiogroup">${F.opts.map(o => `<button type="button" role="radio" aria-checked="${st.opt === o.id}" class="dx-opt ${st.opt === o.id ? 'on' : ''} ${pending && pending.id === o.id ? 'pending' : ''}" data-opt="${o.id}">${esc(o.label)}</button>`).join('')}</div>
    ${pending ? `<div class="dx-confirm"><b>직접 수정한 문구를 새 예시로 바꿀까요?</b><p>바꾸면 인사말 제목과 본문이 새 예시로 바뀌어요. 서명과 사진은 그대로예요.</p><div class="dx-own-acts"><button type="button" class="dx-btn small primary" data-confirm="yes">새 예시로 바꾸기</button><button type="button" class="dx-btn small" data-confirm="no">취소</button></div></div>` : ''}
    <div class="dx-fld dx-later" data-k="gtitle"><label>인사말 제목 <small>· 왼쪽 페이지</small></label><textarea data-k="gtitle" data-autosize rows="2" placeholder="약속을 고르면 채워져요">${v('gtitle')}</textarea></div>
    <div class="dx-fld dx-later" data-k="gbody"><label>인사말 본문 <small>· 오른쪽 페이지</small></label><textarea data-k="gbody" data-autosize rows="6" placeholder="약속을 고르면 채워져요">${v('gbody')}</textarea></div>
    </section>
    <div class="dx-fld dx-later" data-k="sign"><label>서명 <small>[학원 기본 정보]의 원장명에서 가져와요</small></label><div class="dx-auto">${esc(sign ? sign.text : want)}</div></div>`;
  if(photo){ const ok = photo.role === 'photo';
    h += `<div class="dx-fld dx-greet-photo dx-later" data-k="${photo.key}"><label>원장님 사진 <small>선택</small></label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${photo.key}"></label></div></div>`; }
  box.innerHTML = h + '</div>';
  gate(box, !!st.opt);
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  // 답을 바꿔 새로 채워진 칸만 테두리를 잠깐 민트색으로
  const fl = flashKeys.filter(k => k === 'gtitle' || k === 'gbody'); flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`textarea[data-k="${k}"]`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); } });
  if(fl.length){ const t = box.querySelector('textarea[data-k="gbody"]'); if(t) reveal(t); }
}
// 고르면 생기는 흐름: dx-later 표시가 붙은 칸은 첫 선택 전에는 숨김(예전에 쓰던 펼침면은 그대로 보여줌)
const legacySlot = () => !!(slot && slot.saved && !slot.v2);
function gate(box, on){ if(on || legacySlot()) return; box.querySelectorAll('.dx-later').forEach(e => { e.hidden = true; }); }
// 새로 생긴 칸이 왼쪽 창 밖에 있으면 그 칸이 보이도록 부드럽게 내려 줌
function reveal(el){
  const pane = el && el.closest('.dx-pane'); if(!pane) return;
  requestAnimationFrame(() => { const pr = pane.getBoundingClientRect(), r = el.getBoundingClientRect();
    if(r.top >= pr.top + 8 && r.bottom <= pr.bottom - 40) return;
    pane.scrollTo({ top:Math.max(0, pane.scrollTop + (r.top - pr.top) - 70), behavior:'smooth' }); });
}
function autosize(t){ t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
// 학원 공간: 안내 → 제목 → 사진 1~4(사진 올리기 + 설명 선택) → [상세 편집]으로 사진 추가·배치 변경
const SPACE_POS = { photo1:'왼쪽 페이지 큰 사진', photo2:'오른쪽 페이지 위', photo3:'오른쪽 아래 왼쪽', photo4:'오른쪽 아래 오른쪽' };
function renderSpaceForm(box, objs){
  const F = fillOf(), v = k => esc(fieldText(k));
  // 상단 가이드: 무엇을 올리면 되는지 + 주의(보호자 동의)를 한 상자에
  let h = `<div class="dx-cls"><div class="dx-howto">
      <div class="dx-howto-h"><span class="dx-howto-ic" aria-hidden="true">📷</span>우리 학원의 모습을 담아보세요</div>
      <ul><li>학원 내부, 수업 장면, 공부하는 아이들의 모습 등 학부모님께 보여주고 싶은 사진을 자유롭게 올려 주세요.</li>
        <li>사진 개수와 배치는 <b>상세 편집</b>에서 바꿀 수 있어요.</li></ul>
      ${F && F.note ? `<p class="dx-howto-warn"><b>주의</b> ${esc(F.note)}</p>` : ''}
    </div>
    <section class="dx-guide dx-step">
    <div class="dx-fld" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="1" placeholder="우리 학원의 모습">${v('title')}</textarea></div>`;
  [1, 2, 3, 4].forEach(n => {
    const pk = `photo${n}`, ph = objs.find(o => o.key === pk), ok = ph && ph.role === 'photo', cap = objs.find(o => o.key === `cap${n}`);
    h += `<div class="dx-shot"><div class="dx-shot-h"><span>사진 ${n}</span><small>${SPACE_POS[pk]}</small></div>
      ${ph ? `<div class="dx-fld" data-k="${pk}"><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '아직 없어요'}</span>
        <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${pk}"></label></div></div>` : ''}
      ${cap ? `<div class="dx-fld" data-k="cap${n}"><textarea data-k="cap${n}" data-autosize rows="1" placeholder="사진에 대한 짧은 설명을 적어 주세요. (선택)">${v(`cap${n}`)}</textarea></div>` : ''}</div>`;
  });
  h += `</section><div class="dx-more"><span>사진을 더 넣거나 배치를 바꾸고 싶으세요?</span><button type="button" class="dx-btn small primary" data-a="toB">상세 편집</button></div>`;
  box.innerHTML = h + '</div>';
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
}
// 3쪽 학원 소개: 질문 → 답(제목·소개 글 추천) → 칸에서 바로 수정 + 소개 문장만 바꾸기 + 사진. 팝업 없이 직접 고친 칸은 그대로.
function introAction(d){
  const F = FILLS.intro, tObj = byKey('title', canvas), lObj = byKey('lead', canvas); if(!tObj) return;
  flashKeys = [];
  if(d.ina === 'head'){
    const H = F.opts.find(o => o.id === d.id), prev = F.opts.find(o => o.id === String(tObj.grp || '').replace('head:', '')), kept = [];
    [[tObj, 'title'], [lObj, 'lead']].forEach(([o, k]) => { if(!o) return; const cur = String(o.text || '');
      const edited = !(cur === defaultText(k) || (prev && cur === prev.fields[k]) || !cur.trim() || (k === 'lead' && F.sentences.some(x => x[1] === cur)));
      if(edited) kept.push(k); if(cur !== H.fields[k]){ o.set('text', H.fields[k]); flashKeys.push(k); } });
    tObj.set('grp', 'head:' + H.id);
    setMsg(`‘${H.label}’에 맞춰 제목과 소개 글을 채웠어요. ${kept.length ? '바꾸기 전 문구로 돌아가려면 위의 [되돌리기]를 눌러 주세요.' : '아래에서 바로 고칠 수 있어요.'}`);
  }
  if(d.ina === 'sent'){ const S = F.sentences.find(x => x[0] === d.kw); if(S && lObj){ lObj.set('text', S[1]); flashKeys = ['lead']; setMsg('소개 글을 바꿨어요. 아래에서 바로 고칠 수 있어요.'); } }
  canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
}
function renderIntroForm(box, objs){
  const F = FILLS.intro, tObj = byKey('title', canvas), head = String((tObj && tObj.grp) || '').replace('head:', ''), v = k => esc(fieldText(k));
  const photo = objs.find(o => o.key === 'photo1'), ok = photo && photo.role === 'photo', lead = fieldText('lead');
  let h = `<div class="dx-cls"><section class="dx-guide dx-step"><div class="dx-step-h">3쪽 · 학원 소개</div>
    <div class="dx-gq">${esc(F.q)}</div>
    <p class="dx-note dx-greet-note">${head ? '고른 답에 맞춰 제목과 소개 글을 채웠어요. 아래에서 원장님 말투로 바꿔보세요.' : '하나를 고르면 제목과 소개 글이 채워져요. 고르지 않고 아래 칸을 바로 고쳐도 돼요.'}</p>
    <div class="dx-opts grid2" role="radiogroup">${F.opts.map(o => `<button type="button" role="radio" aria-checked="${head === o.id}" class="dx-opt ${head === o.id ? 'on' : ''}" data-ina="head" data-id="${o.id}">${esc(o.label)}</button>`).join('')}</div>
    <div class="dx-fld" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="2">${v('title')}</textarea></div>
    <div class="dx-fld" data-k="lead"><label>소개 글</label><textarea data-k="lead" data-autosize rows="3">${v('lead')}</textarea></div>
    <div class="dx-fld"><label>소개 글만 다른 문장으로 <small>누르면 소개 글이 바로 바뀌어요</small></label><div class="dx-gtags">${F.sentences.map(([k, t]) => `<button type="button" class="dx-chip ${lead === t ? 'on' : ''}" data-ina="sent" data-kw="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
    ${photo ? `<div class="dx-fld" data-k="photo1"><label>학원 사진 <small>선택 · 학원 입구나 교실 전체가 밝게 보이는 사진</small></label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="photo1"></label></div></div>` : ''}</section></div>`;
  box.innerHTML = h;
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`textarea[data-k="${k}"]`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); } });
  const first = fl.map(k => box.querySelector(`textarea[data-k="${k}"]`)).find(Boolean); if(first) reveal(first);
}
// 우리 학원 교재: ① 교재 선택 기준(제목·소개 글) + 대표 사진 → ② 교재 카드(이름·사진·대상·활용·소개)
function bkModel(){
  const d = canvas.getObjects().find(o => o.role === 'bkdata');
  if(d){ try{ return JSON.parse(d.label); }catch(e){} }
  if(!byKey('b1', canvas)) return BK_EMPTY();
  const M = { books:[] };   // 예전 교재 칸(b1 …)을 교재 카드로 옮겨 읽음
  for(let n = 1; n <= 3; n++){ const nm = fieldText(`b${n}`), tx = fieldText(`b${n}d`); if(!nm.trim() && !tx.trim()) continue;
    if(/\((교재명|자료명)\)/.test(nm) && /^개념을 처음|^개념을 익힌 뒤|^아이마다 부족한/.test(tx)) continue;
    M.books.push({ name:nm, target:fieldText(`b${n}m`).replace(/^대상 · 용도$/, ''), uses:[], text:tx }); }
  if(!M.books.length) return BK_EMPTY();
  return M;
}
function bkDraw(M, record){
  const R = at(g).R, photos = {};
  canvas.getObjects().forEach(o => { if(/^bp\d+$/.test(o.key || '') && o.role === 'photo') photos[o.key] = o; });
  silent(() => {
    canvas.getObjects().filter(o => o.role === 'bkdata' || o.grp === 'bk' || o.left >= R - 1 || /^(bp|b)\d+[dm]?$/.test(o.key || '')).forEach(o => canvas.remove(o));
    const ins = canvas.getObjects().findIndex(o => o.key === 'academy');
    bkObjs(g, M).forEach((o, i) => {
      const ph = o.role === 'frame' && photos[o.key];
      if(ph){ const el = ph.getElement(), nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height, bw = o.width * (o.scaleX || 1), bh = o.height * (o.scaleY || 1);
        const sc = Math.max(bw / nw, bh / nh), cw = bw / sc, ch = bh / sc;
        ph.set({ left:o.left, top:o.top, cropX:(nw - cw) / 2, cropY:(nh - ch) / 2, width:cw, height:ch, scaleX:sc, scaleY:sc, card:o.card, grp:'bk' }); o = ph; }
      ins >= 0 ? canvas.insertAt(o, ins + i) : canvas.add(o);
    });
  });
  setInteractive(); canvas.requestRenderAll(); dirty = true;
  if(record){ pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip(); } else scheduleSave();
}
function bkAction(d){
  if(d.bka === 'head'){
    const H = BK_HEAD.find(x => x.id === d.id), tObj = byKey('title', canvas), lObj = byKey('lead', canvas); if(!H || !tObj) return;
    const prev = BK_HEAD.find(x => x.id === String(tObj.grp || '').replace('head:', '')), kept = []; flashKeys = [];
    [[tObj, 't', 'title'], [lObj, 'd', 'lead']].forEach(([o, f, k]) => { if(!o) return; const cur = String(o.text || '');
      if(!(cur === defaultText(k) || (prev && cur === prev[f]) || !cur.trim())) kept.push(k); if(cur !== H[f]){ o.set('text', H[f]); fitOneLine(o); flashKeys.push(k); } });
    tObj.set('grp', 'head:' + H.id);
    canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
    return setMsg(`‘${H.label}’에 맞춰 제목과 소개 글을 채웠어요. ${kept.length ? '바꾸기 전 문구로 돌아가려면 위의 [되돌리기]를 눌러 주세요.' : '아래에서 바로 고칠 수 있어요.'}`);
  }
  const M = bkModel(), i = +d.bi; flashKeys = [];
  if(d.bka === 'add'){ if(M.books.length >= BK_MAX) return setMsg(`교재는 ${BK_MAX}권까지 소개할 수 있어요.`, true); M.books.push({ name:'', target:'', uses:[], text:'' }); flashKeys = [`bk-c${M.books.length - 1}`]; setMsg('교재 카드를 하나 더 만들었어요. 오른쪽 배치도 맞춰졌어요.'); }
  if(d.bka === 'del'){ M.books.splice(i, 1); if(!M.books.length) M.books = BK_EMPTY().books; setMsg('그 교재를 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.'); }
  if(d.bka === 'use'){
    // 활용을 고르면 그 추천 문장을 교재 소개에 넣고, 빼면 그 문장만 지움(원장님이 고친 다른 문장은 그대로)
    const b = M.books[i], U = BK_USES.find(x => x[0] === d.use), on = b.uses.includes(d.use);
    if(on){ b.uses = b.uses.filter(x => x !== d.use); b.text = b.text.replace(U[2], '').replace(/\s{2,}/g, ' ').trim(); }
    else { b.uses.push(d.use); b.uses.sort((x, y) => BK_USES.findIndex(u => u[0] === x) - BK_USES.findIndex(u => u[0] === y)); if(!b.text.includes(U[2])) b.text = (b.text.trim() ? b.text.trim() + ' ' : '') + U[2]; }
    flashKeys = [`bk-t${i}`];
  }
  bkDraw(M, true);
}
function bkInput(t){
  const M = bkModel(), b = M.books[+t.dataset.bi]; if(!b) return;
  b[t.dataset.bkf] = t.value; if('autosize' in t.dataset) autosize(t);
  bkDraw(M, false);
}
function renderBooksForm(box, objs){
  const M = bkModel(), tObj = byKey('title', canvas), head = String((tObj && tObj.grp) || '').replace('head:', ''), v = k => esc(fieldText(k));
  const photo = objs.find(o => o.key === 'photo1'), ok = photo && photo.role === 'photo';
  let h = `<div class="dx-cls"><section class="dx-guide dx-step"><div class="dx-step-h">① 우리 학원 교재 소개 · 왼쪽 페이지</div>
    <p class="dx-note dx-space-intro" style="margin:0 0 8px;">우리 학원에서 사용하는 교재를 소개해 주세요.<br>학생에게 맞춰 고른 교재나 직접 만든 맞춤 교재가 있다면, 어떤 점이 좋은지 알려주세요.</p>
    <div class="dx-gq">교재를 사용할 때 어떤 점을 중요하게 생각하시나요?</div>
    <p class="dx-note dx-greet-note">하나를 고르면 아래 제목과 소개 글이 채워져요. 바로 고칠 수 있어요.</p>
    <div class="dx-opts grid2" role="radiogroup">${BK_HEAD.map(o => `<button type="button" role="radio" aria-checked="${head === o.id}" class="dx-opt ${head === o.id ? 'on' : ''}" data-bka="head" data-id="${o.id}">${esc(o.label)}</button>`).join('')}</div>
    <div class="dx-fld dx-later" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="1">${v('title')}</textarea></div>
    <div class="dx-fld dx-later" data-k="lead"><label>소개 글</label><textarea data-k="lead" data-autosize rows="2">${v('lead')}</textarea></div>
    ${photo ? `<div class="dx-fld dx-later" data-k="photo1"><label>대표 사진 <small>선택</small></label><p class="dx-note" style="margin:0 0 4px;">사용하는 교재들을 함께 찍거나, 실제로 공부한 교재 속 모습을 보여주세요.</p><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="photo1"></label></div></div>` : ''}</section>
    <section class="dx-guide dx-step dx-later"><div class="dx-step-h">② 교재별 소개 · 오른쪽 페이지</div>
    <div class="dx-gq">학부모님께 보여주고 싶은 교재를 넣어 주세요.</div>
    <p class="dx-note dx-greet-note">시중 교재, 직접 만든 맞춤 교재, 학습지 모두 소개할 수 있어요.</p>`;
  M.books.forEach((b, i) => { const pk = `bp${i + 1}`, ph = objs.find(o => o.key === pk), pok = ph && ph.role === 'photo';
    h += `<div class="dx-ttc" data-flash="bk-c${i}"><div class="dx-fstep-h"><span><em>교재 ${i + 1}</em></span><span class="dx-fstep-act"><button type="button" class="dx-tb" data-bka="del" data-bi="${i}" title="이 교재 빼기">✕</button></span></div>
      <div class="dx-fld"><label>교재 이름</label><input type="text" data-bkf="name" data-bi="${i}" value="${esc(b.name)}" placeholder="교재 이름을 적어 주세요"></div>
      ${ph ? `<div class="dx-fld" data-k="${pk}"><label>교재 사진 <small>선택</small></label><div class="dx-photo"><span class="st ${pok ? 'ok' : ''}">${pok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
        <label class="dx-btn small" style="margin:0;">${pok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${pk}"></label></div></div>` : ''}
      <div class="dx-fld"><label>사용 대상 <small>선택</small></label><input type="text" data-bkf="target" data-bi="${i}" value="${esc(b.target)}" placeholder="예: 중1 기본반"></div>
      <div class="dx-fld"><label>이 교재는 어떻게 활용하나요?</label><div class="dx-gtags">${BK_USES.map(([id, lb]) => `<button type="button" class="dx-chip ${b.uses.includes(id) ? 'on' : ''}" aria-pressed="${b.uses.includes(id)}" data-bka="use" data-bi="${i}" data-use="${id}">${lb}</button>`).join('')}</div></div>
      <div class="dx-fld"><label>교재 소개</label><p class="dx-note" style="margin:0 0 4px;">고른 활용에 맞는 추천 문장이 들어가요. 우리 학원 방식에 맞게 고쳐 주세요.</p><textarea data-bkf="text" data-bi="${i}" data-flash="bk-t${i}" data-autosize rows="2" placeholder="이 교재를 어떻게 쓰는지 적어 주세요">${esc(b.text)}</textarea></div></div>`; });
  h += `<button type="button" class="dx-btn dx-addblock" data-bka="add" ${M.books.length >= BK_MAX ? 'disabled' : ''}>＋ 교재 추가</button></section></div>`;
  box.innerHTML = h;
  gate(box, !!(head || M.books.some(b => b.name.trim() || b.text.trim())));
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-flash="${k}"]`) || box.querySelector(`textarea[data-k="${k}"]`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); reveal(t); } });
}
// 학생 관리: ① 관리 방향(대표 문구·소개 글) → ② 관리 활동(카드 수 자동) → ③ 관리 장면 사진(선택)
// 상태는 책의 칸(c1, c1d … 와 grp 'opt:활동')에서 다시 읽으므로 되돌리기와 항상 맞음
function careList(){
  const out = [];
  for(let n = 1; ; n++){ const t = byKey(`c${n}`, canvas); if(!t) break; if(t.visible === false) continue;
    out.push({ id:(t.grp || '').startsWith('opt:') ? t.grp.slice(4) : 'old', t:String(t.text || ''), d:fieldText(`c${n}d`) }); }
  return out;
}
function careDraw(list, flash){
  const R = at(g).R;
  silent(() => {
    canvas.getObjects().filter(o => o.left >= R - 1 || /^c\d+d?$/.test(o.key || '')).forEach(o => canvas.remove(o));
    const ins = canvas.getObjects().findIndex(o => o.key === 'academy');
    careObjs(g, list.length ? list : CARE_SAMPLE).forEach((o, i) => ins >= 0 ? canvas.insertAt(o, ins + i) : canvas.add(o));
  });
  setInteractive(); flashKeys = flash || [];
  canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
}
function careAction(d){
  if(d.caa === 'head'){
    const H = CARE_HEAD.find(x => x.id === d.id), tObj = byKey('title', canvas), lObj = byKey('lead', canvas); if(!H || !tObj) return;
    const prev = CARE_HEAD.find(x => x.id === String(tObj.grp || '').replace('head:', '')), kept = [];
    flashKeys = [];
    [[tObj, 't', 'title'], [lObj, 'd', 'lead']].forEach(([o, f, k]) => { if(!o) return; const cur = String(o.text || '');
      if(!(cur === defaultText(k) || (prev && cur === prev[f]) || !cur.trim())) kept.push(k); if(cur !== H[f]){ o.set('text', H[f]); fitOneLine(o); flashKeys.push(k); } });
    tObj.set('grp', 'head:' + H.id);
    canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
    return setMsg(`‘${H.label}’에 맞춰 대표 문구와 소개 글을 채웠어요. 고른 관리 활동은 그대로예요.${kept.length ? ' 바꾸기 전 문구로 돌아가려면 위의 [되돌리기]를 눌러 주세요.' : ''}`);
  }
  let list = careList().filter(x => x.id !== 'sample');
  if(d.caa === 'act'){
    const at0 = list.findIndex(x => x.id === d.id);
    if(at0 >= 0){ list.splice(at0, 1); careDraw(list); return setMsg(list.length ? '그 활동을 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.' : '고른 활동이 없어서 예시 카드 3개를 다시 보여드려요.'); }
    if(list.length >= CARE_MAX) return setMsg(`관리 활동은 ${CARE_MAX}개까지 넣을 수 있어요. 다른 활동을 하나 뺀 뒤 골라 주세요.`, true);
    const A = CARE_ACTS.find(x => x.id === d.id); list.push({ id:A.id, t:A.t, d:A.d });
    careDraw(list, [`c${list.length}`, `c${list.length}d`]);
    return setMsg(`‘${A.label}’을 관리 활동 ${list.length}번째 카드로 넣었어요. 아래에서 바로 고칠 수 있어요.`);
  }
  if(d.caa === 'custom'){
    if(list.length >= CARE_MAX) return setMsg(`관리 활동은 ${CARE_MAX}개까지 넣을 수 있어요.`, true);
    list.push({ id:'custom', t:'', d:'' }); careDraw(list, [`c${list.length}`]);
    const el = document.querySelector(`#dxForm input[data-k="c${list.length}"]`); if(el) setTimeout(() => el.focus(), 50);
    return setMsg('빈 카드를 만들었어요. 소제목과 설명을 직접 써 주세요.');
  }
  if(d.caa === 'del'){ list.splice(+d.n - 1, 1); careDraw(list); return setMsg('그 카드를 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.'); }
}
function renderCareForm(box, objs){
  const all = careList(), list = all.filter(x => x.id !== 'sample'), tObj = byKey('title', canvas), head = String((tObj && tObj.grp) || '').replace('head:', ''), v = k => esc(fieldText(k));
  const photo = objs.find(o => o.key === 'photo1'), ok = photo && photo.role === 'photo';
  let h = `<div class="dx-cls"><section class="dx-guide dx-step"><div class="dx-step-h">① 학생 관리 소개 · 왼쪽 페이지</div>
    <div class="dx-gq">우리 학원은 학생 관리에서 어떤 점을 중요하게 생각하나요?</div>
    <p class="dx-note dx-greet-note">하나를 고르면 대표 문구와 소개 글이 채워져요. 아래에서 바로 고칠 수 있어요.</p>
    <div class="dx-opts grid2" role="radiogroup">${CARE_HEAD.map(o => `<button type="button" role="radio" aria-checked="${head === o.id}" class="dx-opt ${head === o.id ? 'on' : ''}" data-caa="head" data-id="${o.id}">${esc(o.label)}</button>`).join('')}</div>
    <div class="dx-fld dx-later" data-k="title"><label>대표 문구</label><textarea data-k="title" data-autosize rows="2">${v('title')}</textarea></div>
    <div class="dx-fld dx-later" data-k="lead"><label>소개 글</label><textarea data-k="lead" data-autosize rows="2">${v('lead')}</textarea></div></section>
    <section class="dx-guide dx-step dx-later"><div class="dx-step-h">② 관리 활동 · 오른쪽 페이지</div>
    <div class="dx-gq">우리 학원에서 실제로 하고 있는 관리를 골라 주세요.</div>
    <p class="dx-note dx-greet-note">고른 활동마다 소제목과 설명이 채워져요. 다시 누르면 빠져요. 최대 ${CARE_MAX}개예요.</p>
    <div class="dx-opts grid2">${CARE_ACTS.map(a => { const n = list.findIndex(x => x.id === a.id);
      return `<button type="button" class="dx-opt dx-act ${n >= 0 ? 'on' : ''}" aria-pressed="${n >= 0}" data-caa="act" data-id="${a.id}">${n >= 0 ? `<i class="dx-act-n">${n + 1}</i>` : ''}${esc(a.label)}</button>`; }).join('')}
      <button type="button" class="dx-opt dx-fcustom" data-caa="custom">＋ 직접 작성</button></div>`;
  if(!list.length) h += `<p class="dx-note dx-fempty">지금 오른쪽에는 예시 카드 3개가 보여요. 활동을 고르면 고른 활동으로 바뀌고, 개수에 맞춰 카드가 다시 놓여요.</p>`;
  all.forEach((x, i) => { if(x.id === 'sample') return; const n = i + 1, A = CARE_ACTS.find(a => a.id === x.id);
    h += `<div class="dx-fstep"><div class="dx-fstep-h"><span><em>CHECK 0${n}</em> ${A ? esc(A.label) : x.id === 'custom' ? '직접 작성' : ''}</span>
      <span class="dx-fstep-act"><button type="button" class="dx-tb" data-caa="del" data-n="${n}" title="빼기">✕</button></span></div>
      <div class="dx-fld" data-k="c${n}"><label>소제목</label><input type="text" data-k="c${n}" value="${v(`c${n}`)}" placeholder="예: 숙제는 풀이 과정까지 확인해요"></div>
      <div class="dx-fld" data-k="c${n}d"><label>설명</label><textarea data-k="c${n}d" data-autosize rows="2" placeholder="이 관리를 어떻게 하는지 적어 주세요">${v(`c${n}d`)}</textarea></div></div>`; });
  h += `</section>`;
  if(photo) h += `<section class="dx-guide dx-step dx-later"><div class="dx-step-h">③ 관리 장면 사진 · 선택</div>
    <p class="dx-note dx-greet-note">숙제나 노트를 확인하는 모습, 학생과 이야기하는 모습 등 우리 학원의 관리 장면을 담아 주세요.</p>
    <div class="dx-fld" data-k="photo1"><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="photo1"></label></div></div></section>`;
  box.innerHTML = h + '</div>';
  gate(box, !!(head || list.length));
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-k="${k}"]:is(input,textarea)`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); } });
  const first = fl.map(k => box.querySelector(`[data-k="${k}"]:is(input,textarea)`)).find(Boolean); if(first) reveal(first);
}
// 학년별 커리큘럼: ① 제목·소개 글 → ② 학년 고르기 → 학년별 카드(수업 방향 → 수업 제목·설명) → ③ 반 편성 안내(선택)
function cuModel(){
  const d = canvas.getObjects().find(o => o.role === 'cudata');
  if(d){ try{ return JSON.parse(d.label); }catch(e){} }
  const M = CU_EMPTY();
  // 예전 자료(과정 ①~④ 칸)를 과정 목록으로 옮겨 읽음
  for(let i = 1; i <= 4; i++){ const gObj = byKey(`g${i}`, canvas); if(!gObj || gObj.visible === false) continue;
    const lab = fieldText(`g${i}`), gs = GRADES.filter(x => lab.split(/[·,\s]+/).includes(x));
    M.courses.push({ grades:gs, label:gs.length && gs.join('·') === lab ? '' : lab, dir:null, t:fieldText(`goal${i}`), d:fieldText(`desc${i}`) }); }
  const nt = byKey('note', canvas); if(nt && nt.visible !== false && fieldText('note').trim()) M.note = { type:'custom', title:fieldText('ntitle'), text:fieldText('note') };
  return M;
}
function cuDraw(M, record){
  silent(() => {
    canvas.getObjects().filter(o => !['title', 'lead', 'academy'].includes(o.key) && !(o.type === 'textbox' && /^#/.test(o.text || '') && !o.key)).forEach(o => canvas.remove(o));
    const ins = canvas.getObjects().findIndex(o => o.key === 'academy');
    cuObjs(g, M).forEach((o, i) => ins >= 0 ? canvas.insertAt(o, ins + i) : canvas.add(o));
  });
  setInteractive(); canvas.requestRenderAll(); dirty = true;
  if(record){ pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip(); } else scheduleSave();
}
const cuSort = M => M.courses.sort((a, b) => GRADES.indexOf(a.grades[0]) - GRADES.indexOf(b.grades[0]));
function cuAction(d){
  const M = cuModel(), a = d.cua, i = +d.ci; flashKeys = [];
  if(a === 'grade'){
    const gr = d.grade, at0 = M.courses.findIndex(c => c.grades.includes(gr));
    if(at0 >= 0){ const c = M.courses[at0]; c.grades = c.grades.filter(x => x !== gr); if(!c.grades.length && !c.label) M.courses.splice(at0, 1);
      setMsg(`${gr}을 뺐어요. 다른 과정의 문구는 그대로예요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.`); }
    else { if(M.courses.length >= 12) return; M.courses.push({ grades:[gr], label:'', dir:null, t:'', d:'' }); cuSort(M);
      flashKeys = [`cu-c${M.courses.findIndex(c => c.grades.includes(gr))}`]; setMsg(`${gr} 카드를 만들었어요. 이 학년에서 중점을 두는 공부를 골라 주세요.`); }
  }
  if(a === 'dir'){
    const c = M.courses[i], prev = c.dir && cuSuggest(c.grades, c.dir), next = cuSuggest(c.grades, d.dir);
    const edited = (c.t.trim() && !(prev && c.t === prev[0])) || (c.d.trim() && !(prev && c.d === prev[1]));
    flashKeys = [c.t !== next[0] && `cu-t${i}`, c.d !== next[1] && `cu-d${i}`].filter(Boolean);
    c.dir = d.dir; c.t = next[0]; c.d = next[1];
    setMsg(`${cuLabel(c)} 수업 제목과 설명을 채웠어요. ${edited ? '바꾸기 전 문구로 돌아가려면 위의 [되돌리기]를 눌러 주세요.' : '아래 칸에서 바로 고칠 수 있어요.'}`);
  }
  if(a === 'merge'){ const c = M.courses[i], n = M.courses[i + 1]; if(!n) return;
    c.grades = GRADES.filter(x => c.grades.includes(x) || n.grades.includes(x)); c.label = c.label && n.label ? `${c.label}·${n.label}` : '';
    if(!c.t.trim()) c.t = n.t; if(!c.d.trim()) c.d = n.d; M.courses.splice(i + 1, 1); flashKeys = [`cu-c${i}`];
    setMsg(`${cuLabel(c)}을 한 과정으로 묶었어요. 위 과정의 문구를 그대로 썼어요.`); }
  if(a === 'split'){ const c = M.courses[i]; if(c.grades.length < 2) return;
    const rest = c.grades.slice(1).map(gr => { const s0 = c.dir && cuSuggest([gr], c.dir); return { grades:[gr], label:'', dir:c.dir, t:s0 ? s0[0] : '', d:s0 ? s0[1] : '' }; });
    c.grades = [c.grades[0]]; c.label = ''; M.courses.splice(i + 1, 0, ...rest); setMsg('학년별로 나눴어요. 첫 학년은 쓰던 문구를 그대로 썼어요.'); }
  if(a === 'del'){ M.courses.splice(i, 1); setMsg('그 과정을 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.'); }
  if(a === 'note'){
    if(M.note.type === d.note){ M.note = { type:null, title:'', text:'' }; setMsg('반 편성 안내를 뺐어요.'); }
    else { const N = CU_NOTES.find(x => x[0] === d.note), prev = CU_NOTES.find(x => x[0] === M.note.type);
      M.note = { type:N[0], title:N[2] || (N[0] === 'custom' ? '' : M.note.title), text:N[3] }; flashKeys = ['cu-nt', 'cu-nx'];
      setMsg(N[0] === 'custom' ? '안내 제목과 문구를 직접 써 주세요.' : '반 편성 안내를 넣었어요. 아래 칸에서 바로 고칠 수 있어요.'); }
  }
  cuDraw(M, true);
}
function cuInput(t){
  const M = cuModel(), f = t.dataset.cuf, i = +t.dataset.ci;
  if(f === 't' || f === 'd' || f === 'label') M.courses[i][f] = t.value;
  if(f === 'ntitle') M.note.title = t.value; if(f === 'ntext') M.note.text = t.value;
  if('autosize' in t.dataset) autosize(t);
  cuDraw(M, false);
}
function renderCurriForm(box){
  const M = cuModel(), v = k => esc(fieldText(k)), picked = new Set(M.courses.flatMap(c => c.grades));
  let h = `<div class="dx-cls">
    <section class="dx-guide dx-step"><div class="dx-step-h">① 커리큘럼 소개 · 제목과 소개 글</div>
      <div class="dx-fld" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="1">${v('title')}</textarea></div>
      <div class="dx-fld" data-k="lead"><label>소개 글</label><textarea data-k="lead" data-autosize rows="2">${v('lead')}</textarea></div></section>
    <section class="dx-guide dx-step"><div class="dx-step-h">② 학년별 수업 · 양쪽 페이지</div>
      <div class="dx-gq">어느 학년의 수업을 소개할까요?</div>
      <p class="dx-note dx-greet-note">여러 학년을 고를 수 있어요. 고른 학년마다 아래에 입력 카드가 생겨요.</p>
      ${['초', '중', '고'].map(lv => `<div class="dx-grades">${GRADES.filter(x => x[0] === lv).map(gr => `<button type="button" class="dx-chip ${picked.has(gr) ? 'on' : ''}" aria-pressed="${picked.has(gr)}" data-cua="grade" data-grade="${gr}">${gr}</button>`).join('')}</div>`).join('')}`;
  if(!M.courses.length) h += `<p class="dx-note dx-fempty">아직 고른 학년이 없어요. 위에서 소개할 학년을 눌러 주세요.</p>`;
  M.courses.forEach((c, i) => {
    h += `<div class="dx-ttc" data-flash="cu-c${i}"><div class="dx-fstep-h"><span><em>${esc(cuLabel(c) || '과정')}</em></span><span class="dx-fstep-act"><button type="button" class="dx-tb" data-cua="del" data-ci="${i}" title="이 과정 빼기">✕</button></span></div>
      ${c.label ? `<div class="dx-fld"><label>학년 표기</label><input type="text" data-cuf="label" data-ci="${i}" value="${esc(c.label)}"></div>` : ''}
      <div class="dx-gq" style="margin-top:6px;">이 학년에서는 어떤 공부에 중점을 두나요?</div>
      <div class="dx-gtags">${CU_DIRS.map(([id, lb]) => `<button type="button" class="dx-chip ${c.dir === id ? 'on' : ''}" aria-pressed="${c.dir === id}" data-cua="dir" data-ci="${i}" data-dir="${id}">${lb}</button>`).join('')}</div>
      <div class="dx-fld"><label>수업 제목</label><input type="text" data-cuf="t" data-ci="${i}" data-flash="cu-t${i}" value="${esc(c.t)}" placeholder="고르지 않고 직접 써도 돼요"></div>
      <div class="dx-fld"><label>수업 설명</label><textarea data-cuf="d" data-ci="${i}" data-flash="cu-d${i}" data-autosize rows="2" placeholder="이 과정에서 무엇을 공부하는지 적어 주세요">${esc(c.d)}</textarea></div>
      <div class="dx-cu-acts">${i < M.courses.length - 1 ? `<button type="button" class="dx-link" data-cua="merge" data-ci="${i}">아래 과정(${esc(cuLabel(M.courses[i + 1]))})과 한 과정으로 묶기</button>` : ''}${c.grades.length > 1 ? `<button type="button" class="dx-link" data-cua="split" data-ci="${i}">학년별로 나누기</button>` : ''}</div></div>`;
  });
  const nt = M.note;
  h += `</section><section class="dx-guide dx-step dx-later"><div class="dx-step-h">③ 추가 안내 · 선택</div>
      <div class="dx-gq">반 편성에 대해 덧붙일 말이 있나요?</div>
      <p class="dx-note dx-greet-note">고르면 오른쪽 페이지 아래에 안내가 들어가요. 필요 없으면 넘어가도 돼요. 다시 누르면 빠져요.</p>
      <div class="dx-gtags">${CU_NOTES.map(([id, lb]) => `<button type="button" class="dx-chip ${nt.type === id ? 'on' : ''}" aria-pressed="${nt.type === id}" data-cua="note" data-note="${id}">${lb}</button>`).join('')}</div>
      ${nt.type ? `<div class="dx-fld"><label>안내 제목</label><input type="text" data-cuf="ntitle" data-flash="cu-nt" value="${esc(nt.title)}" placeholder="예: 반 편성 안내"></div>
        <div class="dx-fld"><label>안내 문구</label><textarea data-cuf="ntext" data-flash="cu-nx" data-autosize rows="2" placeholder="반 편성에 대해 알리고 싶은 내용을 적어 주세요">${esc(nt.text)}</textarea></div>` : ''}</section></div>`;
  box.innerHTML = h;
  gate(box, !!(M.courses.length || M.note.type));
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-flash="${k}"]`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); reveal(t); } });
}
// 선생님 소개: ① 소개 구성(누구를·몇 명) → ② 소개 문구·대표 사진(왼쪽) → ③ 선생님별 소개(오른쪽, 인원만큼)
function tcModel(){
  const d = canvas.getObjects().find(o => o.role === 'tcdata');
  if(d){ try{ return JSON.parse(d.label); }catch(e){} }
  if(!byKey('t1', canvas)) return TC_EMPTY();
  // 예전 카드(성함·담당·약력 칸)를 사람별 입력으로 옮겨 읽음
  const M = { mode:((slot.fill || {}).teacher || {}).opt || 'staff', people:[] };
  for(let n = 1; n <= 4; n++){ const t = byKey(`t${n}`, canvas); if(!t || t.visible === false) continue;
    const nm = String(t.text || ''); if(/○○○/.test(nm) && !fieldText(`t${n}m`)) continue;
    M.people.push({ name:nm.replace(/○○○ ?/, ''), role:'', grades:[], bio:[fieldText(`t${n}d`), fieldText(`t${n}m`)].filter(x => x.trim() && !/^담당 학년 · 한 줄 소개$/.test(x)).join(' ') }); }
  return M;
}
function tcDraw(M, record){
  const R = at(g).R, photos = {};
  canvas.getObjects().forEach(o => { if(/^tp\d+$/.test(o.key || '') && o.role === 'photo') photos[o.key] = o; });
  silent(() => {
    canvas.getObjects().filter(o => o.role === 'tcdata' || o.grp === 'tc' || o.left >= R - 1 || /^(tp|t)\d+[dm]?$/.test(o.key || '')).forEach(o => canvas.remove(o));
    const ins = canvas.getObjects().findIndex(o => o.key === 'academy');
    tcObjs(g, M).forEach((o, i) => {
      const ph = o.role === 'frame' && photos[o.key];
      if(ph){ // 올려 둔 사진을 새 칸 크기에 맞춰 가운데를 잘라 다시 끼움
        const el = ph.getElement(), nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height, bw = o.width * (o.scaleX || 1), bh = o.height * (o.scaleY || 1);
        const sc = Math.max(bw / nw, bh / nh), cw = bw / sc, ch = bh / sc;
        ph.set({ left:o.left, top:o.top, cropX:(nw - cw) / 2, cropY:(nh - ch) / 2, width:cw, height:ch, scaleX:sc, scaleY:sc, card:o.card, grp:'tc' });
        o = ph;
      }
      ins >= 0 ? canvas.insertAt(o, ins + i) : canvas.add(o);
    });
  });
  setInteractive(); canvas.requestRenderAll(); dirty = true;
  if(record){ pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip(); } else scheduleSave();
}
function tcFillHead(prevMode, mode){
  // 소개 구성을 고르면 제목·소개 글을 추천 문구로. 원장님이 직접 고친 글이면 그대로 둠(되돌리기 가능)
  const F = FILLS.teacher, prev = F.opts.find(o => o.id === prevMode), next = F.opts.find(o => o.id === mode); let kept = false;
  ['title', 'lead'].forEach(k => { const o = byKey(k, canvas); if(!o) return;
    const cur = String(o.text || ''); if(!(cur === defaultText(k) || (prev && cur === prev.fields[k]) || !cur.trim())) kept = true;
    if(cur !== next.fields[k]){ o.set('text', next.fields[k]); fitOneLine(o); flashKeys.push(k); } });
  return kept;
}
function tcAction(d){
  const M = tcModel(), a = d.tca, i = +d.pi, dir = (book.info.director || '').trim();
  flashKeys = [];
  if(a === 'mode'){
    const prev = M.mode, mode = d.mode; if(prev === mode) return;
    M.mode = mode;
    if(mode === 'one'){ M.people = [M.people[0] || tcPerson()]; }
    if(mode === 'with' && M.people.length < 2) while(M.people.length < 2) M.people.push(tcPerson('선생님'));
    if(mode === 'staff' && !M.people.length) M.people.push(tcPerson('선생님'));
    if(mode !== 'staff'){ const p0 = M.people[0]; if(!p0.name.trim() && dir) p0.name = dir; if(!p0.role.trim() || p0.role === '선생님') p0.role = '원장'; }
    else M.people.forEach(p => { if(p.role === '원장' && p.name === dir){ p.role = '선생님'; } });
    const kept = tcFillHead(prev, mode);
    M.people.forEach((_, k) => flashKeys.push(`tc-p${k}`));
    setMsg('소개 제목과 문구를 준비했어요. 아래에서 선생님 정보와 사진을 채워 주세요.' + (kept ? ' 바꾸기 전 문구로 돌아가려면 위의 [되돌리기]를 눌러 주세요.' : ''));
  }
  if(a === 'count'){
    const min = M.mode === 'with' ? 2 : 1, n = Math.max(min, Math.min(TC_MAX, M.people.length + +d.step));
    if(n === M.people.length) return setMsg(n === TC_MAX ? `선생님은 ${TC_MAX}명까지 소개할 수 있어요.` : `${M.mode === 'with' ? '원장님 포함 2명' : '1명'}부터 소개할 수 있어요.`, true);
    while(M.people.length < n){ M.people.push(tcPerson('선생님')); flashKeys.push(`tc-p${M.people.length - 1}`); }
    M.people.length = n;
    setMsg(`${n}명으로 바꿨어요. 입력칸과 오른쪽 소개 영역이 ${n}명에 맞춰졌어요.`);
  }
  if(a === 'grade'){ const p = M.people[i], k = p.grades.indexOf(d.grade); k >= 0 ? p.grades.splice(k, 1) : p.grades.push(d.grade); p.grades.sort((x, y) => TC_GRADES.indexOf(x) - TC_GRADES.indexOf(y)); }
  tcDraw(M, true);
}
function tcInput(t){
  const M = tcModel(), p = M.people[+t.dataset.pi]; if(!p) return;
  p[t.dataset.tcf] = t.value;
  if('autosize' in t.dataset) autosize(t);
  tcDraw(M, false);
}
function renderTeacherForm(box, objs){
  const M = tcModel(), F = FILLS.teacher, v = k => esc(fieldText(k)), n = M.people.length;
  let h = `<div class="dx-cls"><section class="dx-guide dx-step"><div class="dx-step-h">① 소개 구성</div>
    <div class="dx-gq">${esc(F.q)}</div>
    <p class="dx-note dx-greet-note">${M.mode ? '소개 제목과 문구를 준비했어요. 아래에서 선생님 정보와 사진을 채워 주세요.' : '누구를 소개할지 고르면 인원을 정하고, 그만큼 입력칸이 만들어져요.'}</p>
    <div class="dx-opts" role="radiogroup">${F.opts.map(o => `<button type="button" role="radio" aria-checked="${M.mode === o.id}" class="dx-opt ${M.mode === o.id ? 'on' : ''}" data-tca="mode" data-mode="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
  if(M.mode === 'one') h += `<p class="dx-note" style="margin:8px 0 0;">1명으로 소개해요. 이름은 [학원 기본 정보]의 원장명을 가져왔어요.</p>`;
  if(M.mode && M.mode !== 'one') h += `<div class="dx-count dx-tccount"><span>소개할 인원${M.mode === 'with' ? ' <small>(원장님 포함)</small>' : ''}</span>
      <button type="button" class="dx-tb" data-tca="count" data-step="-1" ${n <= (M.mode === 'with' ? 2 : 1) ? 'disabled' : ''} aria-label="한 명 줄이기">−</button><b>${n}명</b><button type="button" class="dx-tb" data-tca="count" data-step="1" ${n >= TC_MAX ? 'disabled' : ''} aria-label="한 명 늘리기">＋</button></div>
    <p class="dx-note" style="margin:4px 0 0;">선택한 인원만큼 입력칸과 오른쪽 소개 영역이 만들어져요.</p>`;
  h += `</section>`;
  if(M.mode){
    const photo = objs.find(o => o.key === 'photo1'), ok = photo && photo.role === 'photo';
    h += `<section class="dx-guide dx-step"><div class="dx-step-h">② 소개 문구 · 왼쪽 페이지</div>
      <div class="dx-fld" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="1">${v('title')}</textarea></div>
      <div class="dx-fld" data-k="lead"><label>소개 글</label><textarea data-k="lead" data-autosize rows="2">${v('lead')}</textarea></div>
      ${photo ? `<div class="dx-fld" data-k="photo1"><label>대표 사진 <small>선택 · 단체 사진이나 교실 모습</small></label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
        <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="photo1"></label></div></div>` : ''}</section>
    <section class="dx-guide dx-step"><div class="dx-step-h">③ 선생님별 소개 · 오른쪽 페이지</div>`;
    M.people.forEach((p, i) => { const pk = `tp${i + 1}`, ph = objs.find(o => o.key === pk), pok = ph && ph.role === 'photo';
      h += `<div class="dx-ttc" data-flash="tc-p${i}"><div class="dx-fstep-h"><span><em>${M.mode !== 'staff' && i === 0 ? '원장님' : `선생님 ${M.mode !== 'staff' ? i : i + 1}`}</em></span></div>
        <div class="dx-fld"><label>이름</label><input type="text" data-tcf="name" data-pi="${i}" value="${esc(p.name)}" placeholder="예: 김홀릭"></div>
        <div class="dx-fld"><label>직책</label><input type="text" data-tcf="role" data-pi="${i}" value="${esc(p.role)}" placeholder="예: 원장, 중등부 선생님"></div>
        <div class="dx-fld"><label>담당 학년 <small>여러 개 고를 수 있어요</small></label><div class="dx-gtags">${TC_GRADES.map(gr => `<button type="button" class="dx-chip ${p.grades.includes(gr) ? 'on' : ''}" aria-pressed="${p.grades.includes(gr)}" data-tca="grade" data-pi="${i}" data-grade="${gr}">${gr}</button>`).join('')}</div></div>
        ${ph ? `<div class="dx-fld" data-k="${pk}"><label>사진 <small>선택</small></label><div class="dx-photo"><span class="st ${pok ? 'ok' : ''}">${pok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
          <label class="dx-btn small" style="margin:0;">${pok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${pk}"></label></div></div>` : ''}
        <div class="dx-fld"><label>소개·약력 <small>선택</small></label><textarea data-tcf="bio" data-pi="${i}" data-autosize rows="2" placeholder="예: 수학교육과 졸업 · 중등 지도 10년">${esc(p.bio)}</textarea></div></div>`; });
    h += `</section>`;
  }
  box.innerHTML = h + '</div>';
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-flash="${k}"]`) || box.querySelector(`textarea[data-k="${k}"]`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); } });
  const first = fl.map(k => box.querySelector(`textarea[data-k="${k}"]`) || box.querySelector(`[data-flash="${k}"]`)).find(Boolean); if(first) reveal(first);
}
// 학원 시간표: ① 제목·안내(왼쪽) → ② 반·요일·시간(왼쪽 표) → ③ 반 안내(오른쪽)
function ttModel(){
  const d = canvas.getObjects().find(o => o.role === 'ttdata');
  if(d){ try{ return JSON.parse(d.label); }catch(e){} }
  if(!byKey('row_0', canvas)) return TT_EMPTY();
  // 예전 표(칸에 직접 쓴 시간)를 반·요일·시간으로 옮겨 읽음
  const M = { classes:[], guides:[] };
  for(let i = 0; i < 6; i++){ const nm = fieldText(`row_${i}`); const by = {};
    ['월', '화', '수', '목', '금', '토'].forEach((dd, j) => { const v = fieldText(`cell_${i}_${j}`).trim(); if(v) (by[v] = by[v] || []).push(dd); });
    const slots = Object.entries(by).map(([v, ds]) => ({ days:ds, from:v, to:'' }));
    if(nm.trim() || slots.length) M.classes.push({ name:nm, slots:slots.length ? slots : [{ days:[], from:'', to:'' }] }); }
  for(let n = 1; n <= 3; n++){ const nm = fieldText(`k${n}`); if(!nm.trim() && !fieldText(`k${n}d`).trim()) continue;
    M.guides.push({ name:nm, target:fieldText(`k${n}m`).replace(/^대상\s*·\s*/, ''), kws:[], text:fieldText(`k${n}d`) }); }
  if(!M.classes.length) M.classes = TT_EMPTY().classes; if(!M.guides.length) M.guides = TT_EMPTY().guides;
  return M;
}
function ttDraw(M, record){
  silent(() => {
    canvas.getObjects().filter(o => !['title', 'lead', 'academy'].includes(o.key) && !(o.type === 'textbox' && /^#/.test(o.text || '') && !o.key)).forEach(o => canvas.remove(o));
    const ins = canvas.getObjects().findIndex(o => o.key === 'academy');
    // 안내 문구를 지우면 표를 제목 바로 아래로 올림
    const ld = byKey('lead', canvas), y0 = ld && String(ld.text || '').trim() ? Math.max(72, ld.top + ld.calcTextHeight() + 10) : 54;
    ttObjs(g, M, y0).forEach((o, i) => ins >= 0 ? canvas.insertAt(o, ins + i) : canvas.add(o));
  });
  setInteractive(); canvas.requestRenderAll(); dirty = true;
  if(record){ pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip(); } else scheduleSave();
}
function ttInput(t){
  const M = ttModel(), d = t.dataset, f = d.ttf;
  if(f === 'cname') M.classes[+d.ci].name = t.value;
  if(f === 'from' || f === 'to') M.classes[+d.ci].slots[+d.si][f] = t.value;
  if(f === 'gname' || f === 'gtarget' || f === 'gtext') M.guides[+d.gi][{ gname:'name', gtarget:'target', gtext:'text' }[f]] = t.value;
  if('autosize' in d) autosize(t);
  ttDraw(M, false);
}
function ttAction(d){
  const M = ttModel(), a = d.tta, ci = +d.ci, si = +d.si, gi = +d.gi;
  if(a === 'day'){ const sl = M.classes[ci].slots[si], k = sl.days.indexOf(d.day); k >= 0 ? sl.days.splice(k, 1) : sl.days.push(d.day); sl.days.sort((x, y) => TT_WEEK.indexOf(x) - TT_WEEK.indexOf(y)); }
  if(a === 'addslot') M.classes[ci].slots.push({ days:[], from:'', to:'' });
  if(a === 'delslot') M.classes[ci].slots.splice(si, 1);
  if(a === 'addclass'){ if(M.classes.length >= TT_MAX_CLASS) return setMsg(`시간표에는 반을 ${TT_MAX_CLASS}개까지 넣을 수 있어요.`, true); M.classes.push({ name:'', slots:[{ days:[], from:'', to:'' }] }); flashKeys = [`tt-c${M.classes.length - 1}`]; }
  if(a === 'delclass'){ M.classes.splice(ci, 1); if(!M.classes.length) M.classes = TT_EMPTY().classes; setMsg('반을 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.'); }
  if(a === 'addguide'){ if(M.guides.length >= TT_MAX_GUIDE) return setMsg(`반 안내는 ${TT_MAX_GUIDE}개까지 넣을 수 있어요.`, true); M.guides.push({ name:'', target:'', kws:[], text:'' }); flashKeys = [`tt-g${M.guides.length - 1}`]; }
  if(a === 'delguide'){ M.guides.splice(gi, 1); if(!M.guides.length) M.guides = TT_EMPTY().guides; setMsg('반 안내를 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.'); }
  if(a === 'pick'){ M.guides[gi].name = d.name; }
  if(a === 'kw'){
    // 키워드를 고르면 그 추천 문장을 소개 글에 넣고, 빼면 그 문장만 지움(원장님이 고친 다른 문장은 그대로)
    const G = M.guides[gi], K = TT_KW.find(x => x[0] === d.kw), on = G.kws.includes(d.kw);
    if(on){ G.kws = G.kws.filter(x => x !== d.kw); G.text = G.text.replace(K[1], '').replace(/\s{2,}/g, ' ').trim(); }
    else { G.kws.push(d.kw); G.kws.sort((x, y) => TT_KW.findIndex(k => k[0] === x) - TT_KW.findIndex(k => k[0] === y)); if(!G.text.includes(K[1])) G.text = (G.text.trim() ? G.text.trim() + ' ' : '') + K[1]; }
    flashKeys = [`tt-gt${gi}`];
  }
  ttDraw(M, true);
}
function renderTimetableForm(box){
  const M = ttModel(), v = k => esc(fieldText(k)), names = [...new Set(M.classes.map(c => c.name.trim()).filter(Boolean))];
  let h = `<div class="dx-cls">
    <section class="dx-guide dx-step"><div class="dx-step-h">① 제목 · 왼쪽 페이지</div>
      <div class="dx-gq">시간표를 소개하는 제목을 적어 주세요.</div>
      <div class="dx-fld" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="1">${v('title')}</textarea></div>
      <div class="dx-fld" data-k="lead"><label>안내 문구 <small>고치거나 지워도 돼요</small></label><textarea data-k="lead" data-autosize rows="1" placeholder="비워 두면 책에 나오지 않아요">${v('lead')}</textarea></div></section>
    <section class="dx-guide dx-step"><div class="dx-step-h">② 시간표 · 왼쪽 페이지</div>
      <div class="dx-gq">어떤 반이 언제 수업하나요?</div>
      <p class="dx-note dx-greet-note">반 이름과 요일·시간을 입력하면 옆의 시간표에 바로 들어가요.</p>`;
  M.classes.forEach((c, ci) => {
    h += `<div class="dx-ttc" data-flash="tt-c${ci}"><div class="dx-fstep-h"><span><em>반 ${ci + 1}</em></span><span class="dx-fstep-act"><button type="button" class="dx-tb" data-tta="delclass" data-ci="${ci}" title="이 반 빼기">✕</button></span></div>
      <div class="dx-fld"><label>반 이름</label><input type="text" data-ttf="cname" data-ci="${ci}" value="${esc(c.name)}" placeholder="예: 중1 기본반"></div>`;
    c.slots.forEach((sl, si) => {
      h += `<div class="dx-ttslot"><div class="dx-ttslot-h"><label>수업 요일${c.slots.length > 1 ? ` <small>${si + 1}</small>` : ''}</label>${c.slots.length > 1 ? `<button type="button" class="dx-link" data-tta="delslot" data-ci="${ci}" data-si="${si}">이 요일·시간 빼기</button>` : ''}</div>
        <div class="dx-days">${TT_WEEK.map(d => `<button type="button" class="dx-day ${sl.days.includes(d) ? 'on' : ''}" aria-pressed="${sl.days.includes(d)}" data-tta="day" data-ci="${ci}" data-si="${si}" data-day="${d}">${d}</button>`).join('')}</div>
        <label class="dx-ttlab">수업 시간</label><div class="dx-times"><input type="time" data-ttf="from" data-ci="${ci}" data-si="${si}" value="${esc(sl.from)}" aria-label="시작 시간"><span>~</span><input type="time" data-ttf="to" data-ci="${ci}" data-si="${si}" value="${esc(sl.to)}" aria-label="종료 시간"></div></div>`;
    });
    h += `<button type="button" class="dx-btn small dx-addline" data-tta="addslot" data-ci="${ci}">＋ 다른 요일·시간 추가</button><p class="dx-note" style="margin:4px 0 0;">같은 반이 토요일에는 다른 시간에 수업할 때 써요.</p></div>`;
  });
  h += `<button type="button" class="dx-btn dx-addblock" data-tta="addclass">＋ 반 추가</button></section>
    <section class="dx-guide dx-step dx-later"><div class="dx-step-h">③ 반 안내 · 오른쪽 페이지</div>
      <div class="dx-gq">학부모님께 소개하고 싶은 반을 알려주세요.</div>
      <p class="dx-note dx-greet-note">시간표에 넣은 반을 선택하거나, ‘중등반’처럼 묶어서 소개할 수 있어요.</p>`;
  M.guides.forEach((x, gi) => {
    h += `<div class="dx-ttc" data-flash="tt-g${gi}"><div class="dx-fstep-h"><span><em>반 안내 ${gi + 1}</em></span><span class="dx-fstep-act"><button type="button" class="dx-tb" data-tta="delguide" data-gi="${gi}" title="이 안내 빼기">✕</button></span></div>
      ${names.length ? `<div class="dx-ttpick"><small>시간표의 반</small>${names.map(nm => `<button type="button" class="dx-chip ${x.name === nm ? 'on' : ''}" data-tta="pick" data-gi="${gi}" data-name="${esc(nm)}">${esc(nm)}</button>`).join('')}</div>` : ''}
      <div class="dx-fld"><label>반 이름</label><input type="text" data-ttf="gname" data-gi="${gi}" value="${esc(x.name)}" placeholder="예: 중등반"></div>
      <div class="dx-fld"><label>대상</label><input type="text" data-ttf="gtarget" data-gi="${gi}" value="${esc(x.target)}" placeholder="예: 중1~중3"></div>
      <div class="dx-fld"><label>어떤 수업을 하나요?</label><div class="dx-gtags">${TT_KW.map(([k]) => `<button type="button" class="dx-chip ${x.kws.includes(k) ? 'on' : ''}" aria-pressed="${x.kws.includes(k)}" data-tta="kw" data-gi="${gi}" data-kw="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
      <div class="dx-fld"><label>소개 글</label><p class="dx-note" style="margin:0 0 4px;">키워드를 고르면 추천 문장이 들어가요. 바로 고쳐도 돼요.</p><textarea data-ttf="gtext" data-gi="${gi}" data-autosize rows="2" data-flash="tt-gt${gi}" placeholder="이 반에서 어떤 수업을 하는지 적어 주세요">${esc(x.text)}</textarea></div></div>`;
  });
  h += `<button type="button" class="dx-btn dx-addblock" data-tta="addguide">＋ 반 안내 추가</button></section></div>`;
  box.innerHTML = h;
  gate(box, !!(names.length || M.guides.some(x => x.name.trim() || x.text.trim())));
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-flash="${k}"]`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); reveal(t); } });
}
// 상담 절차: 상담 소개(왼쪽) 제목·소개 글 → 상담 절차(오른쪽) 1~3단계 [질문 → 방식 고르기 → 단계 제목·설명] → 상담 사진(선택)
let flowPending = null;
// 지금 책에 있는 STEP 목록(원장님이 고친 글 그대로). 되돌리기를 해도 책 내용에서 다시 읽으므로 항상 일치.
function flowList(){
  const out = [];
  for(let n = 1; ; n++){ const t = byKey(`step${n}`, canvas); if(!t) break; if(t.visible === false) continue;
    const id = (t.grp || '').startsWith('opt:') ? t.grp.slice(4) : 'custom';
    out.push({ id, t:String(t.text || ''), d:fieldText(`step${n}d`) }); }
  return out;
}
// 목록이 바뀌면 오른쪽 페이지 STEP 상자를 다시 배치(개수에 맞춰 높이·간격 자동)
function setFlow(list, flash){
  const R = at(g).R;
  silent(() => {
    canvas.getObjects().filter(o => o.left >= R - 1 || /^step\d+d?$/.test(o.key || '')).forEach(o => canvas.remove(o));
    const ins = canvas.getObjects().findIndex(o => o.key === 'academy');
    flowStepObjs(g, list).forEach((o, i) => ins >= 0 ? canvas.insertAt(o, ins + i) : canvas.add(o));   // 상자 → STEP → 제목 → 설명 순서(글이 상자 위)
  });
  setInteractive();
  flashKeys = flash || [];
  canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
}
function flowAction(d){
  const list = flowList();
  if(d.fadd){
    const at0 = list.findIndex(x => x.id === d.fadd);
    if(at0 >= 0){ list.splice(at0, 1); setFlow(list); return setMsg('그 절차를 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.'); }
    if(list.length >= FLOW_MAX) return setMsg(`절차는 ${FLOW_MAX}단계까지 넣을 수 있어요. 다른 단계를 하나 뺀 뒤 골라 주세요.`, true);
    const O = FLOW_OPTS.find(o => o.id === d.fadd); list.push({ id:O.id, t:O.t, d:O.d });
    setFlow(list, [`step${list.length}`, `step${list.length}d`]);
    return setMsg(`‘${O.label}’을 STEP ${list.length}로 넣었어요. 아래에서 바로 고칠 수 있어요.`);
  }
  if('fcustom' in d){
    if(list.length >= FLOW_MAX) return setMsg(`절차는 ${FLOW_MAX}단계까지 넣을 수 있어요.`, true);
    list.push({ id:'custom', t:'', d:'' }); setFlow(list, [`step${list.length}`]);
    const el = document.querySelector(`#dxForm input[data-k="step${list.length}"]`); if(el) setTimeout(() => el.focus(), 50);
    return setMsg(`STEP ${list.length}을 비워 두었어요. 제목과 설명을 직접 써 주세요.`);
  }
  const n = +(d.fup || d.fdown || d.fdel); if(!n) return;
  if(d.fdel){ list.splice(n - 1, 1); setFlow(list); return setMsg(`STEP ${n}을 뺐어요. 잘못 뺐다면 위의 [되돌리기]를 눌러 주세요.`); }
  const m = d.fup ? n - 1 : n + 1; if(m < 1 || m > list.length) return;
  [list[n - 1], list[m - 1]] = [list[m - 1], list[n - 1]];
  setFlow(list, [`step${m}`, `step${m}d`]); setMsg(`순서를 바꿨어요. 고친 문구는 그대로 따라가요.`);
}
function renderFlowForm(box, objs){
  const list = flowList(), v = k => esc(fieldText(k));
  const photo = objs.find(o => o.role === 'frame' || o.role === 'photo');
  let h = `<div class="dx-cls"><div class="dx-howto">
      <div class="dx-howto-h"><span class="dx-howto-ic" aria-hidden="true">💬</span>우리 학원의 상담 절차를 알려주세요</div>
      <ul><li>실제로 진행하는 절차를 <b>순서대로</b> 골라 주세요. 고른 순서가 그대로 상담 절차가 돼요.</li>
        <li>고르면 제목과 설명이 채워지고, 아래에서 바로 고칠 수 있어요.</li>
        <li>순서 바꾸기·빼기도 여기서 해요. 잘못 바꿨다면 위의 [되돌리기]를 눌러 주세요.</li></ul></div>
    <section class="dx-guide dx-step"><div class="dx-step-h">상담 소개 · 왼쪽 페이지</div>
    <div class="dx-fld" data-k="title"><label>제목</label><textarea data-k="title" data-autosize rows="2">${v('title')}</textarea></div>
    <div class="dx-fld" data-k="lead"><label>소개 글</label><textarea data-k="lead" data-autosize rows="2">${v('lead')}</textarea></div>`;
  if(photo){ const ok = photo.role === 'photo';
    h += `<div class="dx-fld" data-k="${photo.key}"><label>상담 사진 <small>선택</small></label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${photo.key}"></label></div></div>`; }
  h += `</section><section class="dx-guide dx-step"><div class="dx-step-h">상담 절차 · 오른쪽 페이지</div>
    <div class="dx-gq">우리 학원에서 실제로 진행하는 절차를 순서대로 골라 주세요.</div>
    <p class="dx-note dx-greet-note">누른 순서대로 STEP이 만들어져요. 다시 누르면 빠져요. 최대 ${FLOW_MAX}단계예요.</p>
    <div class="dx-opts grid2 dx-fopts">${FLOW_OPTS.map(o => { const n = list.findIndex(x => x.id === o.id);
      return `<button type="button" class="dx-opt dx-act ${n >= 0 ? 'on' : ''}" aria-pressed="${n >= 0}" data-fadd="${o.id}">${n >= 0 ? `<i class="dx-act-n">${n + 1}</i>` : ''}${esc(o.label)}</button>`; }).join('')}
      <button type="button" class="dx-opt dx-fcustom" data-fcustom>＋ 직접 작성</button></div>`;
  if(!list.length) h += `<p class="dx-note dx-fempty">아직 고른 절차가 없어요. 위에서 실제로 진행하는 순서대로 눌러 주세요. 누를 때마다 오른쪽 페이지에 STEP이 하나씩 생겨요.</p>`;
  list.forEach((st, i) => { const n = i + 1, O = FLOW_OPTS.find(o => o.id === st.id);
    h += `<div class="dx-fstep"><div class="dx-fstep-h"><span><em>STEP ${n}</em> ${O ? esc(O.label) : '직접 작성'}</span>
      <span class="dx-fstep-act"><button type="button" class="dx-tb" data-fup="${n}" ${n === 1 ? 'disabled' : ''} title="위로">↑</button><button type="button" class="dx-tb" data-fdown="${n}" ${n === list.length ? 'disabled' : ''} title="아래로">↓</button><button type="button" class="dx-tb" data-fdel="${n}" title="빼기">✕</button></span></div>
      <div class="dx-fld" data-k="step${n}"><label>단계 제목</label><input type="text" data-k="step${n}" value="${v(`step${n}`)}" placeholder="예: 상담 예약"></div>
      <div class="dx-fld" data-k="step${n}d"><label>설명</label><textarea data-k="step${n}d" data-autosize rows="2" placeholder="이 단계에서 무엇을 하는지 적어 주세요">${v(`step${n}d`)}</textarea></div></div>`; });
  box.innerHTML = h + '</section></div>';
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-k="${k}"]:is(input,textarea)`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); } });
  const first = fl.map(k => box.querySelector(`[data-k="${k}"]:is(input,textarea)`)).find(Boolean); if(first) reveal(first);
}
// 수업 방식: ① 수업 소개(왼쪽 책장) 질문 → 대표 문구·소개 글 → ② 수업 활동(오른쪽 책장, 최대 3개) → 활동별 소제목·설명 → 수업 사진(선택)
function classRows(n){
  // 오른쪽 책장의 특징 줄(선·번호·소제목·설명)을 고른 활동 수만큼만 보여줌. 아직 안 골랐으면 템플릿 그대로 셋 다.
  const R = at(g).R;
  canvas.getObjects().forEach(o => { if(o.left < R - 1 || o.top < 36) return;
    const r = Math.floor((o.top - 36) / 68) + 1; if(r >= 1 && r <= 3) o.set('visible', !n || r <= n); });
}
function applyActs(acts){
  const st = fState(), before = {};
  for(let i = 1; i <= 3; i++){ before[`item${i}`] = fieldText(`item${i}`); before[`item${i}d`] = fieldText(`item${i}d`); }
  st.acts = acts;
  for(let i = 1; i <= 3; i++){
    const a = acts[i - 1], o = byKey(`item${i}`, canvas), od = byKey(`item${i}d`, canvas);
    if(o) o.set('text', a ? a.t : (acts.length ? '' : defaultText(`item${i}`)));
    if(od) od.set('text', a ? a.d : (acts.length ? '' : defaultText(`item${i}d`)));
  }
  classRows(acts.length);
  flashKeys = Object.keys(before).filter(k => fieldText(k) !== before[k] && fieldText(k));
  canvas.requestRenderAll(); pushHistory(); commit(); opts.onSave && opts.onSave(); renderStrip();
}
function toggleAct(id){
  const st = fState(), acts = (st.acts || []).slice(), at0 = acts.findIndex(a => a.id === id);
  if(at0 >= 0){ acts.splice(at0, 1); applyActs(acts); return setMsg('고른 활동을 뺐어요. 남은 활동이 수업 특징 ①부터 차례로 들어가요.'); }
  if(acts.length >= CLASS_ACT_MAX){ const m = $('dxActMsg'); if(m){ m.textContent = `최대 ${CLASS_ACT_MAX}개까지 고를 수 있어요. 다른 활동을 하나 뺀 뒤 골라 주세요.`; m.className = 'dx-note warn'; } return; }
  const A = CLASS_ACTS.find(a => a.id === id); acts.push({ id, t:A.t, d:A.d });
  applyActs(acts);
  setMsg(`‘${A.label}’을 수업 특징 ${'①②③'[acts.length - 1]}에 넣었어요. 아래 칸에서 바로 고치면 책에도 함께 바뀌어요.`);
}
function renderClassForm(box, objs){
  const F = fillOf(), st = fState(), acts = st.acts || [];
  const v = k => esc(fieldText(k));
  const lb = (F.opts.find(o => o.id === st.opt) || {}).label;
  let h = `<div class="dx-cls"><div class="dx-cls-h">우리 학원의 수업 방식을 소개해 주세요</div>
    <section class="dx-guide dx-step"><div class="dx-step-h">① 수업 소개 · 왼쪽 페이지</div>
    <div class="dx-gq">학부모님께 우리 학원 수업의 어떤 점을 가장 먼저 소개하고 싶으세요?</div>
    <p class="dx-note dx-greet-note">${lb ? `‘<b>${esc(lb)}</b>’에 어울리는 대표 문구와 소개 글이 채워졌어요. 아래 칸에서 바로 고치면 돼요.` : '하나를 고르면 대표 문구와 소개 글이 채워져요.'}</p>
    <div class="dx-opts grid2" role="radiogroup">${F.opts.map(o => `<button type="button" role="radio" aria-checked="${st.opt === o.id}" class="dx-opt ${st.opt === o.id ? 'on' : ''} ${pending && pending.id === o.id ? 'pending' : ''}" data-opt="${o.id}">${esc(o.label)}</button>`).join('')}</div>
    ${pending ? `<div class="dx-confirm"><b>직접 수정한 문구를 새 예시로 바꿀까요?</b><p>대표 문구와 소개 글만 새 예시로 바뀌어요. 고른 수업 활동과 사진은 그대로예요.</p><div class="dx-own-acts"><button type="button" class="dx-btn small primary" data-confirm="yes">새 예시로 바꾸기</button><button type="button" class="dx-btn small" data-confirm="no">취소</button></div></div>` : ''}
    <div class="dx-fld dx-later" data-k="title"><label>대표 문구</label><textarea data-k="title" data-autosize rows="2" placeholder="답을 고르면 채워져요">${v('title')}</textarea></div>
    <div class="dx-fld dx-later" data-k="lead"><label>소개 글 <small>눌러서 바로 고칠 수 있어요</small></label><textarea data-k="lead" data-autosize rows="3" placeholder="답을 고르면 채워져요">${v('lead')}</textarea></div>
    </section>
    <section class="dx-guide dx-step dx-later"><div class="dx-step-h">② 수업 특징 · 오른쪽 페이지</div>
    <div class="dx-gq">우리 학원 수업 시간에 실제로 하는 활동을 골라 주세요.</div>
    <p class="dx-note dx-greet-note">최대 ${CLASS_ACT_MAX}개까지 고를 수 있어요. 고른 활동마다 소제목과 설명이 채워져요.</p>
    <div class="dx-opts grid2">${CLASS_ACTS.map(a => { const n = acts.findIndex(x => x.id === a.id);
      return `<button type="button" class="dx-opt dx-act ${n >= 0 ? 'on' : ''}" aria-pressed="${n >= 0}" data-act="${a.id}">${n >= 0 ? `<i class="dx-act-n">${'①②③'[n]}</i>` : ''}${esc(a.label)}</button>`; }).join('')}</div>
    <div id="dxActMsg" class="dx-note" style="margin:6px 0 0;"></div>`;
  acts.forEach((a, i) => { const A = CLASS_ACTS.find(x => x.id === a.id) || {};
    h += `<div class="dx-actf"><div class="dx-actf-h">수업 특징 ${'①②③'[i]} · ${esc(A.label || '')}</div>
      <div class="dx-fld" data-k="item${i + 1}"><label>소제목</label><input type="text" data-k="item${i + 1}" value="${v(`item${i + 1}`)}"></div>
      <div class="dx-fld" data-k="item${i + 1}d"><label>설명</label><textarea data-k="item${i + 1}d" data-autosize rows="3">${v(`item${i + 1}d`)}</textarea></div></div>`; });
  if(!acts.length) h += `<p class="dx-note" style="margin:8px 0 0;">활동을 고르기 전에는 오른쪽 책에 예시 특징 3개가 보여요.</p>`;
  h += `</section>`;
  const photo = objs.find(o => o.role === 'frame' || o.role === 'photo');
  if(photo){ const ok = photo.role === 'photo';
    h += `<div class="dx-fld dx-greet-photo dx-later" data-k="${photo.key}"><label>수업 사진 <small>선택 · 수업 중인 교실이나 학생이 문제를 푸는 모습</small></label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '넣지 않아도 돼요'}</span>
      <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${photo.key}"></label></div></div>`; }
  box.innerHTML = h + '</div>';
  gate(box, !!(st.opt || acts.length));
  box.querySelectorAll('textarea[data-autosize]').forEach(autosize);
  const fl = flashKeys; flashKeys = [];
  fl.forEach(k => { const t = box.querySelector(`[data-k="${k}"]:is(input,textarea)`); if(t){ t.classList.add('dx-changed'); setTimeout(() => t.classList.remove('dx-changed'), 1400); } });
  const first = fl.map(k => box.querySelector(`[data-k="${k}"]:is(input,textarea)`)).find(Boolean); if(first) reveal(first);
}
function renderInfoForm(){
  const i = book.info;
  $('dxFormTitle').textContent = cur === 0 ? '앞표지' : '안쪽 표지';
  const file = (k, label, hint) => `<div class="dx-fld"><label>${label} <small>${hint}</small></label><div class="dx-photo">
    ${i[k] ? `<img class="dx-thumb ${k === 'profileUrl' ? 'round' : ''}" alt="" src="${i[k]}">` : '<span class="st">아직 없어요</span>'}
    <span class="dx-photo-act">${i[k] ? `<button type="button" class="dx-link" data-clear="${k}">지우기</button>` : ''}<label class="dx-btn small" style="margin:0;">${i[k] ? '바꾸기' : '올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-info-file="${k}"></label></span></div></div>`;
  if(cur === 1){
    $('dxForm').innerHTML = `
    <div class="dx-fld"><label>원장명</label><input type="text" data-info="director" value="${esc(i.director)}" placeholder="예: 김홀릭"></div>
    ${file('profileUrl', '원장님 프로필 사진', '얼굴이 가운데 오는 사진')}
    <p class="dx-note">아래 맺음말은 인사말의 마지막 문장이 들어가요. 인사말 템플릿을 고르지 않으면 3p 학원 소개 글로 채워요.</p>`;
    return;
  }
  $('dxForm').innerHTML = `
    <div class="dx-fld"><label>학원명</label><input type="text" data-info="academy" value="${esc(i.academy)}" placeholder="예: 홀릭수학학원"></div>
    <div class="dx-fld"><label>표지 문구 <small>앞표지</small></label>
      <p class="dx-hint">비워두면 '학원명 + BRANDBOOK'이 들어가요. 직접 쓰실 땐 두 줄로 써 주세요(첫 줄 얇은 글씨, 둘째 줄 굵은 글씨).</p>
      <textarea data-info="cover" rows="2" placeholder="예: 생각하는 힘을 키우는&#10;홀릭수학학원">${esc(i.cover)}</textarea></div>
    <p class="dx-note">표지는 STEP 1에서 고른 디자인이에요. [완료]를 누른 뒤 STEP 1에서 다시 바꿀 수 있고, 쓰신 내용은 그대로 남아요.</p>`;
}
// 사진·로고를 올리거나 지운 뒤: 표지면 표지를 다시 그리고, 3p(로고)면 페이지에 넣고 편집함으로 기록
async function afterInfoFile(){
  if(isInfo()){ renderInfoForm(); redrawInfo(); }
  else{ await fillAuto(canvas); canvas.requestRenderAll(); dirty = true; pushHistory(); renderStrip(); }
  opts.onChange && opts.onChange(); scheduleSave();
}
const readUrl = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
let infoTimer = null;
function redrawInfo(){ clearTimeout(infoTimer); infoTimer = setTimeout(() => drawInfo(canvas, book.info, opts.cover, opts.cv, opts.base || 'brandbook/', cur === 0 ? 'p1' : 'p2'), 150); }

// 상세 편집
function kindOf(o){ return o.type === 'textbox' ? '글' : o.role === 'frame' ? '칸' : o.role === 'photo' ? '사진' : o.role === 'logo' ? '로고' : '도형'; }
function layerName(o){
  if(o.label) return o.label;
  if(o.type === 'textbox') return o.text.split('\n')[0].slice(0, 16) || '(빈 글)';
  return kindOf(o);
}
const sel = () => canvas.getActiveObject();
function renderLayers(){
  if(mode !== 'B' || muted) return;
  const objs = canvas.getObjects(), a = sel();
  $('dxLayers').innerHTML = objs.map((o, i) => [o, i]).reverse().filter(([o]) => !['ttdata', 'tcdata', 'cudata', 'bkdata'].includes(o.role)).map(([o, i]) =>
    `<div class="dx-layer ${o === a ? 'on' : ''}" data-i="${i}"><span class="kind">${kindOf(o)}</span><span class="nm">${esc(layerName(o))}</span>
      <button class="dx-tb" data-li="up" title="앞으로">▲</button><button class="dx-tb" data-li="down" title="뒤로">▼</button></div>`).join('') || '<div class="dx-layer"><span class="nm" style="color:var(--muted)">아직 아무것도 없어요</span></div>';
}
function mmInfo(o){
  const p = g.pages.length > 1 && o.left >= g.fold - 1 ? 1 : 0;
  const x = o.left - g.pages[p].x, y = o.top - BLEED;
  return `${labelsAt(cur)[p] || ''} · 재단선 기준<br>위치 X ${x.toFixed(1)} · Y ${y.toFixed(1)} mm<br>크기 ${o.getScaledWidth().toFixed(1)} × ${o.getScaledHeight().toFixed(1)} mm`;
}
function renderProps(){
  if(mode !== 'B') return;
  const el = $('dxProps'), o = sel();
  if(!o || o.type === 'activeSelection'){ el.innerHTML = '<h3>선택한 것</h3><p class="dx-note">페이지에서 글이나 사진을 누르거나 왼쪽 레이어에서 고르면, 여기서 크기·색·순서를 바꿀 수 있어요.</p><h3>사용법</h3><p class="dx-note">끌어서 옮기고, 모서리를 끌어 크기를 바꿔요. 글은 두 번 눌러 고치고, 지우기는 Delete 키, 되돌리기는 ⌘Z예요.</p>'; return; }
  let h = `<h3>${esc(layerName(o))}</h3><div class="dx-mm">${mmInfo(o)}</div>`;
  if(o.type === 'textbox'){
    const pt = Math.round(o.fontSize * PT);
    h += `<h3>글자</h3><div class="dx-prop"><button class="dx-tb" data-a="fs-">가−</button><span style="min-width:44px;text-align:center;">${pt}pt</span><button class="dx-tb" data-a="fs+">가+</button>
      <button class="dx-tb ${o.fontWeight >= 600 ? 'on' : ''}" data-a="bold"><b>굵게</b></button>
      <button class="dx-tb ${o.fontFamily === PEN ? 'on' : ''}" data-a="pen">손글씨</button></div>
      <div class="dx-prop">${TEXT_COLORS.map(c => `<button class="dx-swatch ${o.fill === c ? 'on' : ''}" data-a="color" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="dx-prop">${['left', 'center', 'right'].map((a, i) => `<button class="dx-tb ${o.textAlign === a ? 'on' : ''}" data-a="align" data-v="${a}">${['왼쪽', '가운데', '오른쪽'][i]}</button>`).join('')}</div>`;
  }
  if(o.role === 'frame') h += `<h3>사진</h3><div class="dx-prop"><label class="dx-tb">이 칸에 사진 넣기<input type="file" accept="image/png,image/jpeg" hidden data-a="fill"></label></div>`;
  if(o.role === 'photo') h += `<h3>사진</h3><div class="dx-prop"><button class="dx-tb" data-a="crop" data-v="-1">← 보이는 부분</button><button class="dx-tb" data-a="crop" data-v="1">보이는 부분 →</button>
    <label class="dx-tb">사진 바꾸기<input type="file" accept="image/png,image/jpeg" hidden data-a="fill"></label></div>`;
  h += `<h3>배치</h3><div class="dx-prop"><button class="dx-tb" data-a="front">앞으로</button><button class="dx-tb" data-a="back">뒤로</button>
    <button class="dx-tb" data-a="dup">복제</button><button class="dx-tb" data-a="del">삭제</button></div>`;
  el.innerHTML = h;
}

function setMode(m){
  if(isFixed()) m = 'A';
  mode = m;
  $('dxEditor').dataset.mode = m;
  $('dxEditor').dataset.info = isInfo() ? '1' : '';
  $('dxEditor').dataset.fixed = isFixed() ? '1' : '';
  document.querySelectorAll('#dxTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  canvas.discardActiveObject();
  setMsg(isInfo() ? (cur === 0 ? '학원명을 넣으면 앞표지에 바로 반영돼요.' : '원장명을 넣으면 안쪽 표지에 바로 반영돼요.')
    : isMh() ? MH_MSG
    : isImagePage(slot) ? '미리 준비된 고정 페이지예요. 다음 쪽부터 주제별 구성이 시작돼요.'
    : m === 'A' && state.layout === 'flow' ? '실제로 진행하는 절차를 순서대로 고르면 오른쪽 페이지에 STEP이 하나씩 생겨요.'
    : m === 'A' && state.layout === 'books' ? '교재 선택 기준을 고르고, 교재마다 이름·사진·활용을 넣어 주세요. 칸에서 바로 고치면 책에도 함께 바뀌어요.'
    : m === 'A' && state.layout === 'care' ? '관리 방향을 고르고, 실제로 하는 관리 활동을 골라 주세요. 칸에서 바로 고치면 책에도 함께 바뀌어요.'
    : m === 'A' && state.layout === 'curriculum' ? '소개할 학년과 수업 방향을 고르면 추천 문구가 채워져요. 칸에서 바로 고치면 책에도 함께 바뀌어요.'
    : m === 'A' && state.layout === 'teacher' ? '누구를 소개할지 고르고 인원을 정하면, 그만큼 입력칸과 오른쪽 소개 영역이 만들어져요.'
    : m === 'A' && state.layout === 'timetable' ? '제목 → 시간표 → 반 안내 순서로 채우면 오른쪽 책에 바로 반영돼요.'
    : m === 'A' && state.layout === 'space' ? '사진을 올리고 제목·설명을 쓰면 오른쪽 책에 바로 반영돼요.'
    : m === 'A' && ['class', 'greeting'].includes(state.layout) ? '왼쪽에서 답을 고르면 글이 채워져요. 칸에서 바로 고치면 책에도 함께 바뀌어요.'
    : m === 'A' ? (isFree() ? '빈 펼침면이에요. [빈 펼침면에 글·사진 넣기]를 눌러 주세요. 넣은 것만 인쇄돼요.' : `질문에 답을 하나 고르면 ${isIntro() ? '제목과 소개 글' : '펼침면의 글'}이 한 번에 채워져요. 페이지의 글을 누르면 [문구 수정]이 열려요.`)
    : '끌어서 옮기고, 모서리를 끌어 크기를 바꿔요. 글은 두 번 눌러 고쳐요. [← 내용 입력으로]를 눌러도 고친 내용은 그대로예요.');
  refreshUI();
  renderStageBar();
  fitCanvas();
}

// 채울 곳: 12p(매쓰홀릭 고정)·13p~(매쓰홀릭) 빼고 모두 — 표1 학원명, 표2 원장명, 3p, 4~11p 펼침면 (2026-11-05 QA: 사실상 다 써야 해서 '필수' 구분 없음)
const requiredList = () => pagesOf().map((s, i) => (i < INFO_N || (!s.mh && s !== book.last)) ? i : -1).filter(i => i >= 0);
const isRequired = i => requiredList().includes(i);
const isDone = i => i === 0 ? !!book.info.academy.trim() : i === 1 ? !!book.info.director.trim() : !!pagesOf()[i].saved;
function missingRequired(){ return requiredList().find(i => !isDone(i)); }
function updateDoneBtn(){
  const left = requiredList().filter(i => !isDone(i)).length;
  $('dxDone').textContent = left ? `완료 (${left}개 남음)` : '완료';
  $('dxDone').classList.toggle('pending', !!left);
  $('dxDone').classList.toggle('ready', !left);
  if(!$('dxNeed').hidden) renderNeed();
}
// [완료]를 눌렀는데 꼭 쓸 것이 남았으면, 무엇이 남았는지와 바로 가는 버튼을 화면 위에 크게 보여줍니다.
const needName = i => i === 0 ? '표1 앞표지 · 학원명' : i === 1 ? '표2 안쪽 표지 · 원장명' : `${sectionAt(i)[1]}`;
const needWhy = i => i === 0 ? '앞표지와 페이지 곳곳에 들어가요.' : i === 1 ? '안쪽 표지에 들어가요.'
  : pagesOf()[i] === book.first ? '질문에 답을 하나 고르면 제목과 소개 글이 채워져요. 직접 고쳐 써도 완료돼요.'
  : pagesOf()[i].layout === 'greeting' ? '질문에 답을 하나 고르면 인사말이 채워져요. 마지막 문장은 안쪽 표지에도 들어가요.'
  : '질문에 답을 하나 고르면 이 템플릿의 글이 채워져요. 직접 고쳐 써도 완료돼요.';
function renderNeed(){
  const miss = requiredList().filter(i => !isDone(i)), el = $('dxNeed');
  if(!miss.length){ el.hidden = true; return; }
  el.innerHTML = `<div><b>아직 완료할 수 없어요. 채워야 할 곳이 ${miss.length}개 남았어요.</b>
    <ul>${miss.map(i => `<li><span>${esc(needName(i))}</span><small>${esc(needWhy(i))}</small><button type="button" class="dx-btn small primary" data-need="${i}">${i === cur ? '지금 이 페이지예요' : '채우러 가기'}</button></li>`).join('')}</ul></div>
    <button type="button" class="dx-need-x" data-need-close aria-label="닫기">✕</button>`;
  el.hidden = false;
}

// 아래 줄: 표지·기본 정보 → 3p → 4~11p 펼침면 → 12p → 13p~ 매쓰홀릭. 지금 펼침면은 테두리로 강조, 고친 내용도 썸네일에 반영.
const stripCache = new WeakMap();
async function stripThumb(s){
  if(s.mh) return s.imgs.map(x => x.src);
  const { academy, logoUrl } = getAuto();
  const inf = book.info;
  const key = `${s.layout}|${s.theme}|${s.saved || ''}|${academy}|${s === book.first && logoUrl ? logoUrl.length : 0}|${inf.address}|${inf.phone}|${inf.visit}`;
  const c = stripCache.get(s);
  if(c && c.key === key) return c.p;
  const p = renderPages(s, { ppi:22, quality:0.75 });
  stripCache.set(s, { key, p });
  return p;
}
// 표1·표2 썸네일: 입력한 학원명·표지 문구·원장명이 들어간 모습
const infoThumbCache = {};
// 에디터 밖(STEP 1)에서 쓰는 표지 그림: 고른 표지 세트(cover_variable.json set — 엔진·조립과 같은 짝)로 표1/표2를 그림
async function coverImage(info, { cover, cv, base = 'brandbook/', which = 'p2', ppi = 40 } = {}){
  await loadFonts();
  await Promise.all(['100 10px DxSuit', '200 10px DxSuit', '300 10px DxSuit', '600 10px DxSuit'].map(f => document.fonts.load(f)));
  const k = PX_PER_MM(ppi), sc = new fabric.StaticCanvas(null, { width:INFO_GEOM.W * k, height:INFO_GEOM.H * k, renderOnAddRemove:false, enableRetinaScaling:false });
  sc.setZoom(k);
  await drawInfo(sc, info || {}, cover, cv, base, which);
  sc.renderAll();
  const u = sc.toDataURL({ format:'jpeg', quality:0.85 });
  sc.dispose();
  return u;
}
async function infoThumb(i){
  const f = book.info, key = [opts.cover, f.academy, f.director, f.cover, f.profileUrl ? f.profileUrl.length : 0].join('|');
  if(infoThumbCache[i] && infoThumbCache[i].key === key) return infoThumbCache[i].p;
  const p = (async () => {
    const k = PX_PER_MM(22), sc = new fabric.StaticCanvas(null, { width:INFO_GEOM.W * k, height:INFO_GEOM.H * k, renderOnAddRemove:false, enableRetinaScaling:false });
    sc.setZoom(k);
    await drawInfo(sc, f, opts.cover, opts.cv, opts.base || 'brandbook/', i === 0 ? 'p1' : 'p2');
    sc.renderAll();
    const u = sc.toDataURL({ format:'jpeg', quality:0.75 });
    sc.dispose();
    return u;
  })();
  infoThumbCache[i] = { key, p };
  return p;
}
function renderStrip(){
  const pages = pagesOf();
  const items = pages.map((s, i) => {
    const [k] = sectionAt(i), fix = isFixed(i);
    return `${s.mh && i > 0 && !pages[i - 1].mh ? '<span class="dx-st-sep" title="여기부터 주제별 구성"></span>' : ''}<div class="dx-st ${i === cur ? 'on' : ''} ${s.info ? 'single' : s.mh ? 'mh spread' : s.kind}" data-go="${i}">
      <div class="dx-st-img" data-thumb="${i}">${fix ? '<em class="dx-st-lock"></em>' : ''}</div>
      ${isRequired(i) && isDone(i) ? '<span class="dx-st-done" title="채움">✓</span>' : ''}
      <div class="dx-st-cap">${secHtml(i)}</div></div>`;
  });
  updateDoneBtn();
  $('dxStrip').innerHTML = `<div class="dx-strip-head"><b>전체 구성 미리보기</b><span><span class="dx-sec fix">고정</span> 위치·레이아웃 고정 <span class="dx-sec cus">맞춤</span> 4~11쪽 템플릿·상세 편집 <span class="dx-sec mh">주제별</span> STEP 1에서 고른 주제</span></div>
    <div class="dx-strip-row">${items.join('')}</div>`;
  $('dxStrip').querySelectorAll('[data-thumb]').forEach(async el => {
    const i = +el.dataset.thumb;
    const urls = i < INFO_N ? [await infoThumb(i)] : await stripThumb(pages[i]);
    if(el.isConnected) el.insertAdjacentHTML('afterbegin', urls.map(u => `<img alt="" src="${u}" loading="lazy">`).join(''));
  });
  const on = $('dxStrip').querySelector('.dx-st.on'); if(on) on.scrollIntoView({ block:'nearest', inline:'nearest' });
}
// 지금 페이지를 책에 저장 (편집했을 때만)
function commit(){
  if(!slot || isFixedNoCanvas()) return;
  if(history.length > 1 || dirty || slot.saved){ slot.saved = snapshot(); }
  slot.layout = state.layout; slot.theme = state.theme;
  if(slot.saved){ slot.cache = slot.cache || {}; slot.cache[state.layout] = slot.saved; }
}
// 배경은 책 전체 한 가지(2026-11-06 사용자): 3p~11p 모든 칸·저장본·템플릿별 사본에 같은 색
function setBookTheme(id){
  applyTheme(id);
  const t = state.theme, re = j => { try{ const o = JSON.parse(j); o.theme = t; return JSON.stringify(o); }catch(e){ return j; } };
  [book.first, ...book.spreads].forEach(s => {
    if(!s) return; s.theme = t;
    if(s.saved && s !== slot) s.saved = re(s.saved);
    if(s.cache) Object.keys(s.cache).forEach(k => { s.cache[k] = re(s.cache[k]); });
  });
}
async function goTo(i){
  commit();
  { const pane = mounted && $('dxCue') && $('dxCue').closest('.dx-pane'); if(pane) pane.scrollTop = 0; }   // 다른 페이지로 가면 왼쪽 창은 맨 위부터
  if(i !== cur && opts.onSave) opts.onSave();
  cur = i;
  const s = pagesOf()[i];
  slot = (s.info || s.mh) ? null : s;
  if(slot && !slot.saved) slot.v2 = true;
  const mh = !!s.mh;
  g = s.info ? INFO_GEOM : mh ? geom('spread') : geom(s.kind, s.side);
  $('dxTitle').innerHTML = `우리 학원 소개하기<small>${secHtml(i)}</small>`;
  $('dxLabels').innerHTML = s.info ? '' : labelsAt(i).map(l => `<span>${l}</span>`).join('');
  $('dxTabs').style.visibility = isFixed(i) ? 'hidden' : '';
  $('dxStageNote').textContent = s.info ? '표지 글자는 대략적인 모습이에요.' : '';
  $('dxStatic').hidden = !mh;
  canvas.wrapperEl.style.display = mh ? 'none' : '';   // 표1·표2도 캔버스에 그림(시안의 DOM 표지 화면은 쓰지 않음)
  pending = null; editOpen = false;
  userZoom = 1;
  history = []; future = []; dirty = false;
  if(mh){
    $('dxStatic').innerHTML = s.imgs.map(x => `<img alt="${x.no}p" src="${x.src}">`).join('');
  }else{
    canvas.setBackgroundImage(null); canvas.setDimensions({ width:g.W * zoom, height:g.H * zoom }); canvas.setZoom(zoom);
    if(s.info){ await drawInfo(canvas, book.info, opts.cover, opts.cv, opts.base || 'brandbook/', s.info); }
    else if(isImagePage(slot)){ canvas.clear(); canvas.backgroundColor = '#fff'; state.layout = slot.layout; canvas.add(await fixedImage(slot, g)); canvas.requestRenderAll(); }
    else if(slot.saved && savedOk(slot.saved)){ await restore(slot.saved); await fillAuto(canvas); history = [snapshot()]; }
    else if(slot.saved){ const old = slot.saved; await buildLayout(slot.layout, slot.theme); silent(() => carryText(old, canvas.getObjects())); canvas.requestRenderAll(); history = [snapshot()]; }
    else { await buildLayout(slot.layout, slot.theme); history = [snapshot()]; }
  }
  renderLock();
  setMode(opts.startMode && i === opts.start ? opts.startMode : 'A');
  opts.startMode = null;
  renderLayoutChips();
  renderStrip();
}

// 사진: 사진 칸(또는 넣어 둔 사진)이 골라져 있으면 그 크기에 맞춰 가운데를 잘라 넣고, 없으면 고른 쪽에 가로 80mm로 넣습니다.
function placePhoto(file, target){
  const reader = new FileReader();
  reader.onload = () => fabric.Image.fromURL(reader.result, img => {
    const iw = img.width, ih = img.height;
    const fits = target && (target.role === 'frame' || target.role === 'photo');
    const side = g.pages[Math.min(addSide, g.pages.length - 1)];
    const box = fits ? { x:target.left, y:target.top, w:target.getScaledWidth(), h:target.getScaledHeight() }
                     : { x:side.x + SAFE + 20, y:60, w:80, h:80 * ih / iw };
    const s = Math.max(box.w / iw, box.h / ih);
    const cw = box.w / s, ch = box.h / s;
    img.set({ left:box.x, top:box.y, cropX:(iw - cw) / 2, cropY:(ih - ch) / 2, width:cw, height:ch, scaleX:s, scaleY:s, role:'photo',
      key:fits ? target.key : undefined, label:fits ? target.label : undefined, lockSkewingX:true, lockSkewingY:true });
    img.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false });
    if(fits){ canvas.insertAt(img, canvas.getObjects().indexOf(target)); canvas.remove(target); }
    else canvas.add(img);
    setInteractive();
    if(mode === 'B') canvas.setActiveObject(img);
    const ppi = Math.round(25.4 / s);
    setMsg(ppi < 200 ? `이 사진은 인쇄하면 조금 흐릴 수 있어요(약 ${ppi}ppi). 더 큰 사진이 있으면 바꿔 주세요.` : `사진이 들어갔어요(약 ${ppi}ppi, 인쇄에 알맞아요).`, ppi < 200);
    pushHistory();
  });
  reader.readAsDataURL(file);
}
function shiftCrop(o, dir){
  const el = o.getElement(), nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height;
  const step = Math.max(nw, nh) * 0.05 * dir;
  if(nw - o.width > 1) o.set('cropX', Math.min(nw - o.width, Math.max(0, o.cropX + step)));
  else o.set('cropY', Math.min(nh - o.height, Math.max(0, o.cropY + step)));
}
function addObj(o){ canvas.add(o); setInteractive(); if(mode === 'B') canvas.setActiveObject(o); pushHistory(); }
const sideX = () => g.pages[Math.min(addSide, g.pages.length - 1)].x + SAFE;

function bind(){
  window.addEventListener('resize', () => { if(isOpen()) fitCanvas(); });
  // 아래 줄 썸네일이 늦게 채워져 무대 높이가 바뀌어도 다시 맞춤(처음 열 때 표지 아래가 잘렸음)
  if(window.ResizeObserver) new ResizeObserver(() => { if(isOpen() && g) fitCanvas(); }).observe($('dxStage'));
  // 내용 입력: 페이지의 글·사진을 누르면 왼쪽 해당 칸으로 이동
  canvas.on('mouse:down', ({ target }) => {
    if(isInfo()) return;
    if(mode !== 'A' || !target || !target.key) return;
    // 글을 누르면 접혀 있던 [문구 수정]을 열고 그 칸으로
    const ed = $('dxEdit');
    if(ed && !ed.open && ed.querySelector(`[data-k="${target.key}"]`)){ editOpen = true; ed.open = true; }
    const inp = document.querySelector(`#dxForm input[type=text][data-k="${target.key}"], #dxForm textarea[data-k="${target.key}"]`) || document.querySelector(`#dxForm .dx-fld[data-k="${target.key}"]`);
    if(!inp) return;
    const f = inp.closest('.dx-fld') || inp;
    inp.scrollIntoView({ block:'center', behavior:'smooth' });
    // 캔버스를 누르면 브라우저가 마우스를 뗄 때 포커스를 거둬 가므로, 그 뒤에 입력칸으로 커서를 옮깁니다.
    if(/INPUT|TEXTAREA/.test(inp.tagName)) setTimeout(() => inp.focus({ preventScroll:true }), 0);
    f.classList.add('flash'); setTimeout(() => f.classList.remove('flash'), 900);
  });
  canvas.on('after:render', ({ ctx }) => {
    if(!showGuides || !ctx || !g || isInfo() || isMh() || isImagePage(slot)) return;
    const m = v => v * zoom, dpr = canvas.getRetinaScaling();
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1; ctx.strokeStyle = '#E5484D';
    g.pages.forEach(p => ctx.strokeRect(m(p.x) + 0.5, m(BLEED) + 0.5, m(PAGE_W) - 1, m(PAGE_H) - 1));
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.mint;
    g.pages.forEach(p => ctx.strokeRect(m(p.x + SAFE), m(BLEED + SAFE), m(PAGE_W - SAFE * 2), m(PAGE_H - SAFE * 2)));
    ctx.restore();
  });
  // 상담 절차에 단계가 아직 없으면 오른쪽 페이지에 화면 전용 안내(인쇄·PDF에는 안 나옴)
  canvas.on('after:render', ({ ctx }) => {
    if(!ctx || !g || mode !== 'A' || isInfo() || isMh() || !slot || state.layout !== 'flow' || byKey('step1', canvas)) return;
    const p1 = g.pages[1]; if(!p1) return;
    const m = v => v * zoom, dpr = canvas.getRetinaScaling();
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = m(p1.x + SAFE), y = m(BLEED + 24), w = m(COL), h = m(214);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = '#9FBFB8'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#5E7F79'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.max(11, m(4.2))}px ${FONT}, sans-serif`;
    ctx.fillText('왼쪽에서 절차를 고르면', x + w / 2, y + h / 2 - m(3));
    ctx.fillText('여기에 STEP이 순서대로 생겨요', x + w / 2, y + h / 2 + m(4));
    ctx.restore();
  });
  canvas.on('after:render', ({ ctx }) => {
    if(ctx && g && mode === 'A' && !isInfo() && !isMh() && slot && state.layout === 'teacher' && !canvas.getObjects().some(o => o.grp === 'tc' && o.card) && g.pages[1]){
      const m = v => v * zoom, dpr = canvas.getRetinaScaling(), x = m(g.pages[1].x + SAFE), y = m(BLEED + 24), w = m(COL), hh = m(214);
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.setLineDash([6, 5]); ctx.strokeStyle = '#9FBFB8'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, hh);
      ctx.fillStyle = '#5E7F79'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.max(11, m(4))}px ${FONT}, sans-serif`;
      ctx.fillText('소개 구성과 인원을 정하면', x + w / 2, y + hh / 2 - m(3)); ctx.fillText('여기에 선생님 소개가 생겨요', x + w / 2, y + hh / 2 + m(4)); ctx.restore(); return; }
    if(ctx && g && mode === 'A' && !isInfo() && !isMh() && slot && state.layout === 'curriculum' && !canvas.getObjects().some(o => o.grp === 'cu' && o.row)){
      const m = v => v * zoom, dpr = canvas.getRetinaScaling(); ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      [[g.pages[0], 72, 164], [g.pages[1], 38, 198]].forEach(([pg, y0, hh]) => { if(!pg) return; const x = m(pg.x + SAFE), y = m(BLEED + y0), w = m(COL), H2 = m(hh);
        ctx.setLineDash([6, 5]); ctx.strokeStyle = '#9FBFB8'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, H2); });
      const pg = g.pages[0], x = m(pg.x + SAFE), y = m(BLEED + 72), w = m(COL), H2 = m(164);
      ctx.fillStyle = '#5E7F79'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.max(11, m(4))}px ${FONT}, sans-serif`;
      ctx.fillText('학년을 고르면', x + w / 2, y + H2 / 2 - m(3)); ctx.fillText('여기부터 과정이 채워져요', x + w / 2, y + H2 / 2 + m(4)); ctx.restore(); return; }
    if(!ctx || !g || mode !== 'A' || isInfo() || isMh() || !slot || state.layout !== 'timetable') return;
    const objs = canvas.getObjects(), noRows = !objs.some(o => o.grp === 'tt' && o.row), noGuide = !objs.some(o => o.grp === 'tt' && o.card);
    if(!noRows && !noGuide) return;
    const m = v => v * zoom, dpr = canvas.getRetinaScaling();
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const box = (px, y0, hh, l1, l2) => { const x = m(px + SAFE), y = m(BLEED + y0), w = m(COL), h = m(hh);
      ctx.setLineDash([6, 5]); ctx.strokeStyle = '#9FBFB8'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#5E7F79'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.max(11, m(4))}px ${FONT}, sans-serif`;
      ctx.fillText(l1, x + w / 2, y + h / 2 - m(3)); ctx.fillText(l2, x + w / 2, y + h / 2 + m(4)); };
    if(noRows) box(g.pages[0].x, 70, 160, '반 이름과 요일·시간을 넣으면', '여기에 시간표가 만들어져요');
    if(noGuide && g.pages[1]) box(g.pages[1].x, 52, 180, '반 안내를 쓰면', '여기에 들어가요');
    ctx.restore();
  });
  canvas.on('object:modified', pushHistory);
  canvas.on('text:editing:exited', pushHistory);
  canvas.on('text:changed', ({ target }) => syncCellBg(target));
  ['object:added', 'object:removed'].forEach(ev => canvas.on(ev, () => { if(!muted) renderLayers(); }));
  ['selection:created', 'selection:updated', 'selection:cleared'].forEach(e => canvas.on(e, () => { renderProps(); renderLayers(); }));
  canvas.on('object:moving', renderProps); canvas.on('object:scaling', renderProps);

  $('dxLayouts').onclick = e => { const b = e.target.closest('[data-l]'); if(b) switchLayout(b.dataset.l); };
  $('dxColors').onclick = e => { const b = e.target.closest('[data-all]'); if(b){ setBookTheme(b.dataset.all); pushHistory(); saveNow(); } };
  // 원고 고르기: 답 하나 → 펼침면 전체 원고
  const guideClick = e => {
    const ac = e.target.closest('[data-act]'); if(ac && slot) return toggleAct(ac.dataset.act);
    const ib = e.target.closest('[data-ina]'); if(ib && slot && state.layout === 'intro'){ introAction(ib.dataset); return; }
    const bb = e.target.closest('[data-bka]'); if(bb && slot && state.layout === 'books'){ bkAction(bb.dataset); return; }
    const kb = e.target.closest('[data-caa]'); if(kb && slot && state.layout === 'care'){ careAction(kb.dataset); return; }
    const ub = e.target.closest('[data-cua]'); if(ub && slot && state.layout === 'curriculum'){ cuAction(ub.dataset); return; }
    const cb = e.target.closest('[data-tca]'); if(cb && slot && state.layout === 'teacher'){ if(!cb.disabled) tcAction(cb.dataset); return; }
    const tb = e.target.closest('[data-tta]'); if(tb && slot && state.layout === 'timetable'){ ttAction(tb.dataset); return; }
    const fb = e.target.closest('[data-fadd],[data-fcustom],[data-fup],[data-fdown],[data-fdel]'); if(fb && slot && state.layout === 'flow'){ if(!fb.disabled) flowAction(fb.dataset); return; }
    const b = e.target.closest('[data-opt],[data-grade],[data-confirm],[data-tcount],[data-editopen],[data-sent],[data-sent-apply]');
    if(!b || !slot) return;
    const st = fState(), d = b.dataset;
    if(d.opt) return applyChoice({ id:d.opt });
    if(d.grade){
      const curG = (pending ? pending.grades : st.grades) || [];
      let gs = curG.includes(d.grade) ? curG.filter(x => x !== d.grade) : [...curG, d.grade];
      if(gs.length > CURRI_MAX){ const m = $('dxCurriMsg'); if(m){ m.className = 'dx-note warn'; m.textContent = `두 쪽에는 과정 ${CURRI_MAX}개까지 들어가요. 학년을 더 넣으려면 [문구 수정]에서 학년 칸을 ‘초1·초2’처럼 직접 묶어 주세요.`; } return; }
      gs = GRADES.filter(x => gs.includes(x));
      const lv = $('dxLevel') ? $('dxLevel').checked : !!st.levelNote;
      return applyChoice({ grades:gs, levelNote:lv });
    }
    if(d.confirm){ if(d.confirm === 'yes' && pending) applyChoice(pending, true); else { pending = null; renderForm(); setMsg('직접 고친 문구를 그대로 두었어요.'); } return; }
    if(d.tcount){ st.count = Math.min(4, Math.max(2, (st.count || 2) + +d.tcount)); arrangeTeachers(st.count, false); canvas.requestRenderAll(); pushHistory(); return; }
    if('editopen' in d){ editOpen = true; renderForm(); const ed = $('dxEdit'); if(ed){ ed.open = true; ed.scrollIntoView({ block:'start', behavior:'smooth' }); } return; }
    if(d.sent){ st.kw = st.kw === d.sent ? null : d.sent; renderGuide(); scheduleSave(); return; }
    if('sentApply' in d){ const s1 = (fillOf().sentences || []).find(x => x[0] === st.kw); const o = byKey('lead', canvas);
      if(s1 && o){ o.set('text', s1[1]); canvas.requestRenderAll(); pushHistory(); setMsg('3쪽 소개 문구를 바꿨어요. [문구 수정]에서 더 고칠 수 있어요.'); } }
  };
  $('dxGuide').addEventListener('click', guideClick);
  $('dxForm').addEventListener('click', e => { if(['class', 'greeting', 'space', 'flow', 'timetable', 'teacher', 'curriculum', 'care', 'books', 'intro'].includes(state.layout)) guideClick(e); });

  $('dxGuide').addEventListener('change', e => {
    if(e.target.id !== 'dxLevel' || !slot) return;
    const st = fState(), gs = (pending ? pending.grades : st.grades) || [];
    if(!gs.length){ st.levelNote = e.target.checked; return; }
    applyChoice({ grades:gs, levelNote:e.target.checked });
  });
  $('dxForm').addEventListener('toggle', e => { if(e.target.id === 'dxEdit') editOpen = e.target.open; }, true);
  $('dxForm').addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.info){ book.info[t.dataset.info] = t.value.trim() ? t.value : ''; redrawInfo(); opts.onChange && opts.onChange(); if(t.dataset.info !== 'cover') renderStrip(); scheduleSave(); return; }
    const k = t.dataset.k; if(!k || t.type === 'file') return;
    if('autosize' in t.dataset) autosize(t);
    if(state.layout === 'class' && slot){ const m = /^item(\d)(d?)$/.exec(k), acts = fState().acts; if(m && acts && acts[m[1] - 1]) acts[m[1] - 1][m[2] ? 'd' : 't'] = t.value; }
    const o = byKey(k, canvas); if(o && o.type === 'textbox'){ o.set('text', t.value); syncCellBg(o); fitOneLine(o); canvas.requestRenderAll(); dirty = true; scheduleSave();
      if(state.layout === 'timetable' && k === 'lead') ttDraw(ttModel(), false); }
  });
  // 시간표 입력: 글자를 칠 때는 책만 다시 그리고(입력칸 유지), 칸을 벗어날 때 되돌리기 기록
  $('dxForm').addEventListener('input', e => { const t = e.target; if(state.layout === 'teacher' && slot && t.dataset.tcf) return tcInput(t); if(state.layout === 'curriculum' && slot && t.dataset.cuf) return cuInput(t); if(state.layout === 'books' && slot && t.dataset.bkf) return bkInput(t); if(state.layout !== 'timetable' || !slot || !t.dataset.ttf) return; ttInput(t); });
  $('dxForm').addEventListener('change', e => { if(slot && ((state.layout === 'timetable' && e.target.dataset.ttf) || (state.layout === 'teacher' && e.target.dataset.tcf) || (state.layout === 'curriculum' && e.target.dataset.cuf) || (state.layout === 'books' && e.target.dataset.bkf))){
      history.push(snapshot()); future = []; renderTop(); renderStrip(); scheduleSave();
      if($('dxForm').querySelector('.dx-later[hidden]')) setTimeout(renderForm, 0);   // 입력으로 다음 구역이 열릴 수 있으면 다시 그림
    } });
  $('dxForm').addEventListener('change', async e => {
    const t = e.target;
    if(t.dataset.infoFile){ if(t.files[0]){ book.info[t.dataset.infoFile] = await readUrl(t.files[0]); await afterInfoFile(); } return; }
    const k = t.dataset.k; if(!k || t.dataset.info) return;
    if(t.type === 'file'){ if(t.files[0]) placePhoto(t.files[0], byKey(k, canvas)); }
    else{ history.push(snapshot()); future = []; dirty = true; renderTop(); renderStrip(); scheduleSave(); }   // 입력 중에는 칸을 다시 그리지 않도록 기록만
  });
  const go3 = e => { if(e.target.closest('[data-go3]') && cur !== INFO_N) goTo(INFO_N); };
  $('dxInfoView').addEventListener('click', go3);
  $('dxInfoView').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') go3(e); });
  $('dxForm').addEventListener('click', e => {
    if(e.target.closest('[data-go3]')) return go3(e);
    const clr = e.target.closest('[data-clear]');
    if(clr){ book.info[clr.dataset.clear] = null; afterInfoFile(); }
  });
  $('dxNeed').addEventListener('click', e => {
    if(e.target.closest('[data-need-close]')){ $('dxNeed').hidden = true; return; }
    const b = e.target.closest('[data-need]'); if(b && +b.dataset.need !== cur) goTo(+b.dataset.need);
  });
  $('dxStrip').addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if(go && +go.dataset.go !== cur) goTo(+go.dataset.go);
  });
  $('dxLayers').onclick = e => {
    const row = e.target.closest('.dx-layer'); if(!row || row.dataset.i == null) return;
    const o = canvas.getObjects()[+row.dataset.i];
    const b = e.target.closest('[data-li]');
    if(b){ b.dataset.li === 'up' ? canvas.bringForward(o) : canvas.sendBackwards(o); pushHistory(); }
    canvas.setActiveObject(o); canvas.requestRenderAll(); refreshUI();
  };
  $('dxAddSide').onclick = e => { const b = e.target.closest('[data-side]'); if(!b) return; addSide = +b.dataset.side; canvas.discardActiveObject(); canvas.requestRenderAll(); $('dxAddSide').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('dxEditor').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if(!b || b.tagName === 'INPUT') return;
    const a = b.dataset.a, o = sel();
    if(a === 'toB') return setMode('B');
    if(a === 'toA') return setMode('A');
    if(a === 'undo') return undo();
    if(a === 'redo') return redo();
    if(a === 'guides'){ showGuides = !showGuides; canvas.requestRenderAll(); return renderTop(); }
    if(a === 'zoom+' || a === 'zoom-' || a === 'zoomfit'){
      userZoom = a === 'zoomfit' ? 1 : Math.min(3, Math.max(0.5, userZoom + (a === 'zoom+' ? 0.25 : -0.25)));
      fitCanvas(); return renderTop();
    }
    if(!o || !b.closest('#dxProps')) return;
    if(a === 'fs-' || a === 'fs+') o.set('fontSize', Math.max(6 / PT, o.fontSize + (a === 'fs+' ? 1 : -1) / PT));
    if(a === 'bold') o.set('fontWeight', o.fontWeight >= 600 ? 400 : 700);
    if(a === 'pen') o.set('fontFamily', o.fontFamily === PEN ? FONT : PEN);
    if(a === 'color') o.set('fill', b.dataset.c);
    if(a === 'align') o.set('textAlign', b.dataset.v);
    if(a === 'crop') shiftCrop(o, +b.dataset.v);
    if(a === 'front') canvas.bringForward(o);
    if(a === 'back') canvas.sendBackwards(o);
    if(a === 'del'){ canvas.remove(o); canvas.discardActiveObject(); }
    if(a === 'dup'){ o.clone(c => { c.set({ left:o.left + 6, top:o.top + 6, role:o.role, key:undefined, label:undefined }); canvas.add(c); canvas.setActiveObject(c); pushHistory(); }, SAVE_PROPS); return; }
    canvas.requestRenderAll(); pushHistory();
  });
  $('dxProps').addEventListener('change', e => { if(e.target.dataset.a === 'fill' && e.target.files[0]) placePhoto(e.target.files[0], sel()); });
  document.addEventListener('keydown', e => {
    if(!isOpen() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const o = sel();
    if(o && o.isEditing) return;
    if(mode === 'B' && (e.key === 'Delete' || e.key === 'Backspace') && o){ canvas.remove(o); canvas.discardActiveObject(); pushHistory(); e.preventDefault(); }
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z'){ e.shiftKey ? redo() : undo(); e.preventDefault(); }
  });
  $('dxTabs').onclick = e => { const b = e.target.closest('[data-m]'); if(b) setMode(b.dataset.m); };
  $('dxPhoto').addEventListener('change', e => { if(e.target.files[0]) placePhoto(e.target.files[0], sel()); e.target.value = ''; });
  $('dxAddTitle').onclick = () => addObj(text('제목을 입력하세요', sideX(), 40, 140, 7, { fontWeight:700 }));
  $('dxAddBody').onclick = () => addObj(text('내용을 입력하세요. 두 번 누르면 글을 고칠 수 있어요.', sideX(), 70, 140, 3.6, { fill:C.body, lineHeight:1.6 }));
  $('dxAddFrame').onclick = () => addObj(frame(sideX() + 10, 100, 100, 70));
  $('dxDone').onclick = async () => {
    canvas.discardActiveObject();
    commit();
    const miss = missingRequired();
    if(miss != null){
      if(miss !== cur) await goTo(miss);
      renderNeed();
      return setMsg(`${needName(miss)} — ${needWhy(miss)}`, true);
    }
    opts.onSave && opts.onSave();
    $('dxNeed').hidden = true;
    $('dxModal').classList.remove('show');
    opts.onClose && opts.onClose({ complete:true });
  };
}

async function openBook(b, o = {}){
  book = b; opts = o;
  mount();
  $('dxModal').classList.add('show');
  await loadTheme();
  await loadFonts();
  await Promise.all(['100 10px DxSuit', '200 10px DxSuit', '300 10px DxSuit', '600 10px DxSuit'].map(f => document.fonts.load(f)));
  slot = null; cur = 0;
  await goTo(o.start || 0);
}
// 닫기 없이 저장만 (index.html이 페이지를 떠나기 전에 부름)
function flush(){ if(isOpen()) commit(); }

window.DiyEditor = {
  BLEED, PAGE_W, PAGE_H, PRINT_PPI, LAYOUTS, SPREAD_LAYOUTS, THEMES, FILLS, geom,
  setBook(b){ book = b; },
  loadTheme,
  openBook, renderPages, greetingText, closingText, coverImage, flush,
  requiredDone: () => book ? missingRequired() == null : false,
};
loadTheme();
})();
