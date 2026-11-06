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
    return t;
  }).catch(() => null);
  return themeReady;
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
const LAYOUTS = {
  // ---------- 낱장 (고정) ----------
  intro: { kind:'single', fixed:true, name:'학원 소개', sub:'3쪽 · 레이아웃 고정', build: g => { const { L } = at(g); return [
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
  prologue: { kind:'single', fixed:true, image:'diy/fixed/p012_prologue.jpg?v=20261105h', name:'쉬어 가는 페이지', sub:'12쪽 · 매쓰홀릭 고정', build: () => [] },

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
    text('아이들이 머무는 공간', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    frame(L, 52, COL, 160, 'photo1', '사진 1'),
    text('강의실 · 아이들이 수업을 듣는 공간', L, 217, COL, 3.5, { fill:C.body, key:'cap1', label:'사진 ① 설명' }),
    frame(R, 24, COL, 100, 'photo2', '사진 2'),
    text('자습실 · 수업 전후에 공부하는 공간', R, 127, COL, 3.5, { fill:C.body, key:'cap2', label:'사진 ② 설명' }),
    frame(R, 140, 78, 96, 'photo3', '사진 3'),
    frame(R + 84, 140, 78, 96, 'photo4', '사진 4'),
    text('상담실', R, 239, 78, 3.5, { fill:C.body, key:'cap3', label:'사진 ③ 설명' }),
    text('학원 입구', R + 84, 239, 78, 3.5, { fill:C.body, key:'cap4', label:'사진 ④ 설명' }),
    academyText(L),
  ]; } },
  flow: { kind:'spread', name:'상담 절차', sub:'4단계 + 사진 1장', build: g => { const { L, R } = at(g); return [
    eyebrow('#HOW TO START', L),
    text('처음 오시는 길,\n이렇게 함께해요', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'제목' }),
    text('상담부터 첫 수업까지, 학생에게 맞는 반을 함께 찾습니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 80, COL, 160, 'photo1', '사진'),
    ...[0, 1, 2, 3].map(i => [
      new fabric.Rect({ left:R, top:24 + i * 57, width:COL, height:50, rx:4, ry:4, fill:C.paleMint, strokeWidth:0 }),
      text(`STEP ${i + 1}`, R + 8, 31 + i * 57, 40, 3.6, { fontWeight:700, fill:C.teal }),
      text(['상담 예약', '레벨테스트', '결과 상담과 반 배정', '첫 수업'][i], R + 8, 38 + i * 57, COL - 16, 5, { fontWeight:700, key:`step${i + 1}`, label:`상담 단계 ${'①②③④'[i]} 제목` }),
      text(['전화나 문자로 편하신 시간을 예약해 주세요.', '학년별 진단지로 지금 위치를 확인해요.', '부모님과 함께 결과를 보고 반을 정해요.', '첫 수업 뒤 적응 상황을 알려드려요.'][i],
        R + 8, 46 + i * 57, COL - 16, 3.5, { fill:C.body, key:`step${i + 1}d`, label:`상담 단계 ${'①②③④'[i]} 설명` }),
    ]).flat(),
    academyText(L),
  ]; } },
  timetable: { kind:'spread', name:'학원 시간표', sub:'요일·시간·반 이름 표 + 반 안내', build: g => { const { L, R } = at(g);
    const c0 = 30, cw = (COL - c0) / TT_DAYS.length, y0 = 76, rh = 15, out = [];
    out.push(eyebrow('#TIMETABLE', L),
      text('반별 수업 시간표', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
      text('학년·반별 수업 요일과 시간입니다. 시간표는 학기마다 바뀔 수 있어요.', L, 50, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }));
    out.push(new fabric.Rect({ left:L, top:y0, width:COL, height:rh - 1, rx:2, ry:2, fill:C.ink, strokeWidth:0 }));
    out.push(text('반', L, y0 + 4.6, c0, 3.4, { fontWeight:700, fill:'#fff', textAlign:'center' }));
    TT_DAYS.forEach((d, j) => out.push(text(d, L + c0 + j * cw, y0 + 4.6, cw, 3.4, { fontWeight:700, fill:'#fff', textAlign:'center', key:`day_${j}`, label:`${d}요일 머리` })));
    const rows = ['중1', '중2', '중3', '고1', '', ''], cells = [['16:00', '', '16:00', '', '16:00', ''], ['', '16:00', '', '16:00', '', '10:00'], ['18:00', '', '18:00', '', '18:00', ''], ['', '18:00', '', '18:00', '', '13:00']];
    for(let i = 0; i < TT_ROWS; i++){
      const y = y0 + rh * (i + 1);
      out.push(new fabric.Rect({ left:L, top:y, width:c0 - 1, height:rh - 1, rx:2, ry:2, fill:'#EEF2F1', strokeWidth:0 }));
      out.push(text(rows[i], L, y + 4.8, c0 - 1, 3.4, { fontWeight:700, textAlign:'center', key:`row_${i}`, label:`${i + 1}번째 반 이름` }));
      TT_DAYS.forEach((d, j) => {
        const v = (cells[i] || [])[j] || '';
        out.push(new fabric.Rect({ left:L + c0 + j * cw, top:y, width:cw - 1, height:rh - 1, rx:2, ry:2, fill:v ? C.paleMint : '#F6F8F8', strokeWidth:0, cellbg:`cell_${i}_${j}` }));
        out.push(text(v, L + c0 + j * cw, y + 4.8, cw - 1, 3.2, { fontWeight:600, fill:C.teal, textAlign:'center', key:`cell_${i}_${j}`, label:`${i + 1}번째 반 · ${d}` }));
      });
    }
    out.push(text('시험 기간에는 학교별 시험 일정에 맞춰 시간표가 바뀝니다.', L, y0 + rh * (TT_ROWS + 1) + 8, COL, 3.4, { fill:C.body, lineHeight:1.6, key:'note', label:'시간표 안내' }));
    out.push(eyebrow('#CLASS GUIDE', R), text('반 안내', R, 33, COL, 9, { fontWeight:700, key:'rtitle', label:'오른쪽 제목' }));
    [0, 1, 2].forEach(i => {
      const y = 54 + i * 60;
      out.push(new fabric.Rect({ left:R, top:y, width:COL, height:52, rx:4, ry:4, fill:C.paleMint, strokeWidth:0 }),
        text(['중등반', '고등반', '주말 보충'][i], R + 8, y + 7, COL - 16, 5, { fontWeight:700, key:`k${i + 1}`, label:`반 ${i + 1} 이름` }),
        text(['대상 · 중1~중3', '대상 · 고1', '대상 · 보충이 필요한 학생'][i], R + 8, y + 16, COL - 16, 3.4, { fontWeight:600, fill:C.teal, key:`k${i + 1}m`, label:`반 ${i + 1} 대상` }),
        text(['교과 개념을 익히고 학교 시험을 준비합니다.', '내신과 모의고사를 함께 준비합니다.', '평일 수업에서 부족했던 부분을 보충합니다.'][i], R + 8, y + 24, COL - 16, 3.4, { fill:C.body, lineHeight:1.6, key:`k${i + 1}d`, label:`반 ${i + 1} 설명` }));
    });
    out.push(academyText(L));
    return out; } },
  teacher: { kind:'spread', name:'선생님 소개', sub:'단체 사진 + 선생님 4명', build: g => { const { L, R } = at(g); return [
    eyebrow('#OUR TEACHERS', L),
    text('함께하는 선생님', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('수업부터 상담까지, 아이를 가장 가까이에서 보는 선생님들입니다.', L, 52, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 72, COL, 168, 'photo1', '단체 사진'),
    ...[0, 1, 2, 3].map(i => {
      const x = R + (i % 2) * 84, y = 24 + Math.floor(i / 2) * 112;
      return [
        frame(x, y, 78, 70, `tp${i + 1}`, `선생님 ${i + 1} 사진`),
        text(['○○○ 선생님', '○○○ 선생님', '○○○ 선생님', '○○○ 선생님'][i], x, y + 74, 78, 4.2, { fontWeight:700, key:`t${i + 1}`, label:`선생님 ${'①②③④'[i]} 성함` }),
        text(['담당 학년 · 한 줄 소개', '담당 학년 · 한 줄 소개', '담당 학년 · 한 줄 소개', '담당 학년 · 한 줄 소개'][i], x, y + 81, 78, 3.4, { fill:C.body, lineHeight:1.5, key:`t${i + 1}d`, label:`선생님 ${'①②③④'[i]} 담당·약력` }),
        text('', x, y + 90, 78, 3.2, { fill:C.teal, lineHeight:1.5, key:`t${i + 1}m`, label:`선생님 ${'①②③④'[i]} 지도 한마디` }),
      ];
    }).flat(),
    academyText(L),
  ]; } },
  curriculum: { kind:'spread', name:'학년별 커리큘럼', sub:'학년·수준별 과정과 학습 목표', build: g => { const { L, R } = at(g);
    const rows = [['초등', '수학과 친해지는 습관', '연산과 기본 개념을 정확히 익히고, 문장으로 된 문제를 읽고 식으로 바꾸는 연습을 합니다.'],
      ['중1·중2', '개념을 빈틈없이', '교과 개념을 단원마다 정리하고, 유형 문제로 적용하는 힘을 기릅니다.'],
      ['중3', '고등 수학 준비', '중학 과정을 마무리하며 고등 수학으로 이어지는 단원을 미리 다집니다.'],
      ['고등', '내신과 수능을 함께', '학교 내신을 준비하면서 수능형 문제에 필요한 사고력을 함께 기릅니다.']];
    const row = (x, y, i) => [
      new fabric.Rect({ left:x, top:y, width:COL, height:0.3, fill:C.ink, strokeWidth:0 }),
      text(rows[i][0], x, y + 6, 40, 5.4, { fontWeight:700, fill:C.teal, key:`g${i + 1}`, label:`학습 과정 ${'①②③④'[i]} 학년·수준` }),
      text(rows[i][1], x + 44, y + 6, COL - 44, 5, { fontWeight:700, key:`goal${i + 1}`, label:`학습 과정 ${'①②③④'[i]} 제목` }),
      text(rows[i][2], x + 44, y + 16, COL - 44, 3.5, { fill:C.body, lineHeight:1.65, key:`desc${i + 1}`, label:`학습 과정 ${'①②③④'[i]} 학습 목표` }),
    ];
    return [
      eyebrow('#CURRICULUM', L),
      text('학년별 커리큘럼', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
      text('학년과 수준에 맞춰 과정을 나누고, 단계마다 꼭 이뤄야 할 목표를 정해 둡니다.', L, 50, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
      ...row(L, 82, 0), ...row(L, 152, 1),
      eyebrow('#ROADMAP', R), ...row(R, 40, 2), ...row(R, 110, 3),
      new fabric.Rect({ left:R, top:186, width:COL, height:50, rx:4, ry:4, fill:C.paleMint, strokeWidth:0 }),
      text('수준별 반 편성', R + 8, 194, COL - 16, 4.4, { fontWeight:700, key:'ntitle', label:'안내 제목' }),
      text('같은 학년이라도 진단 결과에 따라 맞는 반에서 시작합니다.', R + 8, 204, COL - 16, 3.5, { fill:C.body, lineHeight:1.6, key:'note', label:'안내 내용' }),
      academyText(L),
    ]; } },
  care: { kind:'spread', name:'학생 관리', sub:'숙제 확인 · 오답 재점검 · 학부모 피드백', build: g => { const { L, R } = at(g); return [
    eyebrow('#STUDENT CARE', L),
    text('수업이 끝난 뒤에도\n끝까지 확인합니다', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'대표 문구' }),
    text('수업 시간에 이해한 것이 정말 내 것이 되었는지, 숙제와 오답으로 다시 확인합니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 100, COL, 136, 'photo1', '관리 장면 사진'),
    ...[0, 1, 2].map(i => [
      new fabric.Rect({ left:R, top:24 + i * 72, width:COL, height:64, rx:4, ry:4, fill:C.paleMint, strokeWidth:0 }),
      text(`CHECK 0${i + 1}`, R + 8, 31 + i * 72, 60, 3.6, { fontWeight:700, fill:C.teal }),
      text(['숙제 확인', '오답 재점검', '학부모 피드백'][i], R + 8, 39 + i * 72, COL - 16, 5.4, { fontWeight:700, key:`c${i + 1}`, label:`학생 관리 ${'①②③④'[i]} 소제목` }),
      text(['숙제는 다음 수업 시작 전에 확인하고, 하지 못한 부분은 이유를 함께 살핍니다.',
            '틀린 문제는 다시 풀어 보며 이해했는지 확인하고, 반복되는 실수는 따로 짚어 줍니다.',
            '아이의 학습 상황을 정리해 학부모님께 알려드리고, 필요하면 상담으로 이어갑니다.'][i],
        R + 8, 50 + i * 72, COL - 16, 3.5, { fill:C.body, lineHeight:1.6, key:`c${i + 1}d`, label:`학생 관리 ${'①②③④'[i]} 설명` }),
    ]).flat(),
    academyText(L),
  ]; } },
  books: { kind:'spread', name:'우리 학원 교재', sub:'교재 사진 + 교재 3권 소개', build: g => { const { L, R } = at(g); return [
    eyebrow('#TEXTBOOK', L),
    text('우리 학원 교재', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('학년과 수준에 맞춰 고른 교재와 학습 자료로 수업합니다.', L, 50, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 72, COL, 164, 'photo1', '교재 사진'),
    ...[0, 1, 2].map(i => [
      frame(R, 24 + i * 72, 50, 64, `bp${i + 1}`, `교재 ${i + 1} 사진`),
      text(['개념서 (교재명)', '유형서 (교재명)', '학습지 (자료명)'][i], R + 56, 28 + i * 72, COL - 56, 5, { fontWeight:700, key:`b${i + 1}`, label:`교재 ${'①②③④'[i]} 이름` }),
      text(['대상 · 용도', '대상 · 용도', '대상 · 용도'][i], R + 56, 37 + i * 72, COL - 56, 3.4, { fontWeight:600, fill:C.teal, key:`b${i + 1}m`, label:`교재 ${'①②③④'[i]} 대상·용도` }),
      text(['개념을 처음 익힐 때 씁니다.', '개념을 익힌 뒤 유형별 문제로 적용할 때 씁니다.', '아이마다 부족한 부분을 보충할 때 씁니다.'][i], R + 56, 45 + i * 72, COL - 56, 3.5, { fill:C.body, lineHeight:1.6, key:`b${i + 1}d`, label:`교재 ${'①②③④'[i]} 활용 설명` }),
    ]).flat(),
    academyText(L),
  ]; } },
  blank: { kind:'spread', name:'백지 자유편집', sub:'빈 두 쪽에 글·사진을 자유롭게', free:true, build: g => [academyText(at(g).L)] },
};
const SPREAD_LAYOUTS = ['greeting', 'class', 'space', 'flow', 'timetable', 'teacher', 'curriculum', 'care', 'books', 'blank'];

// ===================== 작성 도우미 (2026-11-06 개편: 키워드 1개 ↔ 추천 문구 1개) =====================
// 질문 → 키워드 하나 선택 → 그 키워드에 연결된 추천 문구 하나 → [○○에 적용]. AI·문장 조합·무작위 추천은 쓰지 않습니다.
// 키워드를 누르면 추천 영역만 바뀌고, 본문은 [적용]을 눌렀을 때만 바뀝니다.
// 입력칸이 여러 개인 템플릿(targets)은 먼저 편집할 항목을 고르고, 그 항목의 칸(keys)에만 넣습니다.
//   put(키워드, 문구, n) → { 캔버스 key: 넣을 글 }   (n = 고른 항목 번호, 1부터)
// 문구는 매쓰홀릭 콘텐츠(김영주님, 2026-11-06)를 그대로 씁니다. 바꿀 때는 rows만 고치면 됩니다.
const multi = (label, count, keys) => Array.from({ length:count }, (_, i) => ({ name:`${label} ${'①②③④'[i]}`, keys:keys(i + 1) }));
const GREET_HEAD = '안녕하세요, [학원명] 원장 [원장명]입니다.';
// [학원명]·[원장명]은 기본 정보에서 가져오고, 비어 있으면 대괄호 없이 자연스러운 인사로 바꿉니다.
function fillNames(t, info){
  const a = (info && info.academy || '').trim(), d = (info && info.director || '').trim();
  const head = a && d ? `안녕하세요, ${a} 원장 ${d}입니다.` : a ? `안녕하세요, ${a} 원장입니다.` : d ? `안녕하세요, 원장 ${d}입니다.` : '안녕하세요.';
  return t.split(GREET_HEAD).join(head).replace(/\[학원명\]/g, a || '저희 학원').replace(/\[원장명\]/g, d || '');
}
const GUIDES = {
  intro: { q:'처음 방문한 학부모님이 우리 학원을 어떤 곳으로 기억하면 좋을까요?',
    targets:[{ name:'3쪽 학원 소개', keys:['lead'] }], put:(k, t) => ({ lead:t }),
    rows:[['개념을 탄탄하게', '공식을 외운 뒤에도 “왜 이렇게 풀까?”를 묻습니다. 배운 개념을 자기 말로 설명할 수 있어야 다음 문제에서도 꺼내 쓸 수 있기 때문입니다.'],
      ['스스로 공부하는 힘', '문제를 만났을 때 무엇부터 해볼지 스스로 생각하는 힘을 기릅니다. 선생님은 아이가 시도한 풀이를 살펴보고, 다음 한 걸음을 찾도록 질문합니다.'],
      ['한 명 한 명 맞춤', '같은 단원을 배우는 아이들도 막히는 곳은 다릅니다. 학생이 어디까지 이해했는지 먼저 살피고, 지금 필요한 설명과 문제를 고릅니다.'],
      ['오답 끝까지', '틀린 문제에는 아이가 어디에서 어려움을 느꼈는지가 담겨 있습니다. 처음 풀이를 함께 짚어보고, 다음에는 혼자 풀 수 있는지 확인합니다.'],
      ['학부모와 소통', '학부모님이 아이의 수업 모습을 떠올릴 수 있도록, 요즘 배우는 내용과 혼자 해낸 일, 아직 도움이 필요한 부분을 구체적으로 전합니다.']] },
  greeting: { q:'처음 상담하러 온 학부모님께 원장님이 꼭 전하고 싶은 약속은 무엇인가요?', names:true,
    targets:[{ name:'인사말', keys:['gbody'] }], put:(k, t) => ({ gbody:t }),
    rows:[['아이의 속도 존중', `${GREET_HEAD} 아이마다 이해가 깊어지는 순간은 조금씩 다릅니다. 우리 아이가 지금 서 있는 곳에서 다음 한 걸음을 내디딜 수 있도록 곁에서 살피겠습니다.`],
      ['편하게 질문하는 교실', `${GREET_HEAD} 저는 아이가 “여기부터 모르겠어요”라고 말하는 순간을 소중하게 생각합니다. 모르는 것을 편안하게 묻고, 이해한 만큼 자신 있게 말할 수 있는 교실을 만들겠습니다.`],
      ['수학 자신감 회복', `${GREET_HEAD} 수학이 어렵다는 아이에게는 스스로 한 문제를 풀어낸 경험이 좋은 출발점이 됩니다. 어제는 도움이 필요했지만 오늘은 혼자 해낸 일을 함께 발견하겠습니다.`],
      ['학부모와 함께', `${GREET_HEAD} 교실에서 보이는 아이의 모습과 집에서 느끼시는 고민을 함께 들여다보고 싶습니다. 아이에게 어떤 도움이 필요한지 학부모님과 의논하며 가르치겠습니다.`]] },
  class: { q:'우리 학원의 수업을 한 장면으로 보여준다면 어떤 모습인가요?', titleFromKey:true,
    targets:multi('수업 특징', 3, n => [`item${n}`, `item${n}d`]), put:(k, t, n) => ({ [`item${n}`]:k, [`item${n}d`]:t }),
    rows:[['개념부터 이해하기', '새 개념을 배울 때는 간단한 예를 먼저 살펴봅니다. 예에서 찾은 규칙이 식으로 어떻게 표현되는지 연결해 봅니다.'],
      ['풀이를 말로 설명하기', '답을 구한 뒤에는 어떤 조건을 보고 그 방법을 골랐는지 이야기합니다. 설명하다 막히는 부분은 선생님과 함께 다시 짚어봅니다.'],
      ['학생별 개별 진도', '학생이 혼자 풀 수 있는 문제와 도움이 필요한 문제를 살펴봅니다. 그 결과에 따라 더 연습할 단원과 새로 배울 내용을 정합니다.'],
      ['일대일 질문 시간', '문제를 풀다 막힌 학생과 처음 풀이부터 함께 봅니다. 어디까지 생각했는지 듣고, 스스로 다음 줄을 써볼 수 있도록 단서를 건넵니다.'],
      ['여러 풀이 비교하기', '한 문제를 서로 다른 방법으로 풀어봅니다. 두 풀이에서 공통으로 사용한 개념과 각 방법이 편리한 이유를 비교합니다.']] },
  space: { q:'이 사진은 어떤 공간이고, 학생들은 여기서 무엇을 하나요?',
    targets:multi('사진', 4, n => [`cap${n}`]), put:(k, t, n) => ({ [`cap${n}`]:t }),
    rows:[['수업하는 교실', '선생님의 설명을 듣고, 배운 개념을 문제에 직접 적용해 보는 교실입니다.'],
      ['자습 공간', '수업 전후로 숙제를 하거나 그날 배운 내용을 자기 속도에 맞춰 복습하는 공간입니다.'],
      ['질문·클리닉 공간', '혼자 풀다 막힌 문제를 가져와 선생님과 풀이를 한 줄씩 살펴보는 공간입니다.'],
      ['학부모 상담 공간', '학생의 교재와 학습 자료를 펴놓고, 현재 학습 상황과 앞으로의 계획을 함께 이야기하는 곳입니다.']] },
  flow: { q:'처음 문의한 학부모님은 어떤 순서로 상담을 받게 되나요?', titleFromKey:true, hint:'실제로 운영하는 단계만 골라 넣어 주세요.',
    targets:multi('상담 단계', 4, n => [`step${n}`, `step${n}d`]), put:(k, t, n) => ({ [`step${n}`]:k, [`step${n}d`]:t }),
    rows:[['상담 예약', '학생의 학년과 상담하고 싶은 내용을 알려주시면, 방문 가능한 시간을 안내해 드립니다.'],
      ['학습 고민 확인', '지금 배우는 단원과 평소 공부 방법을 듣고, 학생과 학부모님이 가장 궁금해하는 점을 먼저 확인합니다.'],
      ['진단평가', '학생이 직접 푼 문제를 보며 익숙한 개념과 보완할 부분을 확인합니다. 풀이 과정도 상담 자료로 함께 살펴봅니다.'],
      ['교재·노트 상담', '평소 사용하는 교재나 풀이 노트를 함께 보며 자주 막히는 유형과 학습 습관을 짚어봅니다.'],
      ['반 배정·첫 수업 안내', '상담 내용을 바탕으로 학생에게 맞는 수업을 제안하고, 반 편성·교재·첫 수업 준비 사항을 안내해 드립니다.']] },
  timetable: { q:'학부모님이 시간표를 볼 때 어떤 기준으로 우리 아이의 수업을 찾으면 될까요?', hint:'표 안의 요일·시간·반 이름은 그대로 두고, 위쪽 안내 문구만 바뀌어요.',
    targets:[{ name:'시간표 안내', keys:['lead'] }], put:(k, t) => ({ lead:t }),
    rows:[['학년별 시간표', '학생의 학년을 먼저 찾은 뒤, 해당 학년에서 운영하는 반과 수업 요일을 확인해 주세요.'],
      ['수준별 반 편성', '같은 학년 안에서도 배우는 내용과 진도에 따라 반이 나뉩니다. 어떤 반이 적합할지는 상담 시 안내해 드립니다.'],
      ['정규 수업·클리닉 구분', '새 진도를 배우는 정규 수업과 부족한 부분을 보완하는 클리닉 시간을 구분해 확인해 주세요.'],
      ['상담 후 시간 조율', '가능한 요일과 시간대를 알려주세요. 현재 운영 중인 반 가운데 학생의 진도와 일정에 맞는 수업을 안내해 드립니다.']] },
  teacher: { q:'이 선생님이 학생을 가르칠 때 가장 중요하게 여기는 점은 무엇인가요?', hint:'성함·담당 학년·약력은 그대로 두고, 지도 한마디만 바뀌어요.',
    targets:multi('선생님', 4, n => [`t${n}m`]), put:(k, t, n) => ({ [`t${n}m`]:t }),
    rows:[['질문을 잘 들어주는 선생님', '“어디가 어려워?”라는 질문부터 시작합니다. 학생이 헷갈린 부분을 자기 말로 이야기할 수 있도록 기다립니다.'],
      ['개념을 쉽게 풀어주는 선생님', '낯선 개념은 학생이 이미 알고 있는 예에서 출발해 설명합니다. 익숙한 생각과 새로 배운 내용을 연결하도록 돕습니다.'],
      ['풀이 과정을 살피는 선생님', '학생이 쓴 식을 처음부터 읽어봅니다. 답이 달라진 지점을 함께 찾고, 다음 문제에서 스스로 확인할 방법을 알려줍니다.'],
      ['도전할 기회를 주는 선생님', '처음 보는 문제도 아는 조건부터 표시해 보도록 격려합니다. 학생이 직접 떠올린 아이디어를 풀이로 발전시키는 과정을 함께합니다.']] },
  curriculum: { q:'이 과정에서 학생이 익히게 될 가장 중요한 능력은 무엇인가요?', hint:'학년·반 이름과 과정 제목은 그대로 두고, 학습 목표만 바뀌어요.',
    targets:multi('학습 과정', 4, n => [`desc${n}`]), put:(k, t, n) => ({ [`desc${n}`]:t }),
    rows:[['기초 다지기', '현재 단원을 배우는 데 필요한 이전 개념부터 확인합니다. 자주 막히는 계산과 기본 문제를 연습하며 다음 단계로 넘어갈 준비를 합니다.'],
      ['현행 개념 익히기', '학교에서 배우는 단원의 핵심 개념을 정리하고 대표 문제에 적용합니다. 문제의 조건을 읽고 알맞은 식을 세우는 연습에 집중합니다.'],
      ['응용·심화', '익숙한 문제의 조건이 바뀌었을 때도 같은 개념을 활용할 수 있는지 살펴봅니다. 여러 개념을 연결해 스스로 풀이 계획을 세워봅니다.'],
      ['내신 대비', '시험 범위에 맞춰 단원별 핵심 내용을 정리합니다. 자주 틀리는 유형을 점검하고 서술형 답안에 필요한 풀이 과정을 연습합니다.'],
      ['다음 학년 준비', '다음 학년에 이어지는 개념을 미리 만나봅니다. 이전 학년에서 배운 내용과 무엇이 연결되고 달라지는지 살펴봅니다.']] },
  care: { q:'수업이 끝난 뒤 숙제나 오답을 언제, 어떻게 다시 확인하시나요?', titleFromKey:true,
    targets:multi('학생 관리', 3, n => [`c${n}`, `c${n}d`]), put:(k, t, n) => ({ [`c${n}`]:k, [`c${n}d`]:t }),
    rows:[['다음 수업 전 숙제 확인', '다음 수업을 시작하기 전, 숙제에서 혼자 해결한 문제와 막혀서 남겨둔 문제를 확인합니다. 도움이 필요한 부분부터 함께 살펴봅니다.'],
      ['오답 다시 풀기', '틀린 문제는 해설을 덮고 다시 풀어봅니다. 처음에 막혔던 부분을 이번에는 스스로 해결할 수 있는지 확인합니다.'],
      ['반복 실수 따로 정리', '부호를 놓치거나 문제의 조건을 빠뜨리는 등 반복되는 실수를 모아봅니다. 학생이 다음 풀이에서 무엇을 확인할지 직접 정리합니다.'],
      ['학부모께 결과 안내', '최근 배운 단원과 학생이 혼자 해결하게 된 부분을 학부모님께 전합니다. 가정에서 지켜봐 주시면 좋을 점도 함께 안내합니다.'],
      ['필요할 때 개별 상담', '같은 어려움이 이어지거나 학습 습관에 변화가 보이면 학생과 먼저 이야기합니다. 필요한 경우 학부모님과도 지도 방향을 의논합니다.']] },
  books: { q:'이 교재는 어떤 학생이, 어떤 목적으로 사용하나요?', hint:'교재명·대상과 사진은 그대로 두고, 활용 설명만 바뀌어요.',
    targets:multi('교재', 3, n => [`b${n}d`]), put:(k, t, n) => ({ [`b${n}d`]:t }),
    rows:[['개념 학습용', '새로운 단원을 시작할 때 사용하는 교재입니다. 개념 설명과 예제를 함께 보며 처음 배운 내용을 문제에 적용해 봅니다.'],
      ['유형 연습용', '같은 개념이 여러 형태의 문제에 어떻게 쓰이는지 연습하는 교재입니다. 문제에서 주어진 조건을 보고 풀이 방법을 고르는 힘을 기릅니다.'],
      ['학생별 맞춤 교재', '학생이 더 연습할 단원과 유형을 골라 구성한 교재입니다. 이미 익숙한 내용보다 지금 보완할 부분에 집중할 수 있습니다.'],
      ['오답 복습용', '수업에서 틀렸거나 풀이가 불확실했던 문제를 다시 만나는 교재입니다. 이전 풀이와 비교하며 달라진 점을 확인합니다.'],
      ['시험 대비용', '시험 범위에 맞춰 주요 개념과 문제를 정리한 교재입니다. 시험 전에 다시 볼 유형과 주의해야 할 문제를 점검합니다.']] },
};
// 백지 자유편집: 키워드·추천 문구 없이 편집 화면에만 보이는 안내(책에는 인쇄되지 않음)
const BLANK_GUIDE = '우리 학부모님께 따로 보여드리고 싶은 내용이 있나요? 수업 활동 사진, 방학 특강 안내, 학부모님이 자주 묻는 질문 등을 자유롭게 담아보세요.';

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

const SAVE_PROPS = ['role', 'key', 'label', 'auto', 'cellbg', 'pill', 'rowX', 'boxL', 'boxT', 'boxW', 'boxH', 'logoBox'];
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
const MH_MSG = '미리보기입니다. 이 구간에는 이후 선택하신 매쓰홀릭 프로그램 페이지가 들어갑니다.';
const pagesOf = () => [{ info:'p1' }, { info:'p2' }, book.first, ...book.spreads, book.last, ...((opts.backPages && opts.backPages()) || [])];
const isInfo = () => cur < INFO_N;
const isMh = (i = cur) => !!(pagesOf()[i] || {}).mh;
const isFixed = (i = cur) => { const s = pagesOf()[i]; return !s || s.info || s === book.first || s === book.last || !!s.mh; };
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
        <div class="dx-canvas-wrap" id="dxCanvasWrap"><canvas id="dxCanvas"></canvas><div class="dx-static" id="dxStatic" hidden></div><div class="dx-lock" id="dxLock" hidden><span></span></div></div>
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
}
const isOpen = () => mounted && $('dxModal').classList.contains('show');
function setMsg(m, warn){ const el = $('dxMsg'); el.textContent = m; el.className = warn ? 'warn' : ''; }
const labelsAt = i => { const s = pagesOf()[i]; if(i < INFO_N) return [i === 0 ? '표1' : '표2']; if(s && s.mh) return s.imgs.map(x => `${x.no}p`); return opts.labelsFor ? opts.labelsFor(s) : []; };
const nameAt = i => { const s = pagesOf()[i]; if(i < INFO_N) return i === 0 ? '앞표지' : '안쪽 표지'; if(s.mh) return s.title || '매쓰홀릭 프로그램'; return (LAYOUTS[s.layout] || {}).name; };
// 구간 표시: [성격, 이름] — 모달·편집기·아래 줄 어디서나 같은 글
function sectionAt(i){
  const s = pagesOf()[i];
  if(i < INFO_N) return ['고정', i === 0 ? '표1 앞표지' : '표2 안쪽 표지'];
  if(s === book.first) return ['고정', `${labelsAt(i)[0].replace('p', '')}쪽 학원 소개`];
  if(s === book.last) return ['고정', `${labelsAt(i)[0].replace('p', '')}쪽 ${(LAYOUTS[s.layout] || {}).name || ''}`];
  if(s.mh) return ['매쓰홀릭', `${s.imgs.map(x => x.no).join('~')}쪽${s.sample ? ' 예시' : ''}`];
  const l = labelsAt(i); return ['맞춤', `${l[0].replace('p', '')}~${l[l.length - 1].replace('p', '')}쪽 ${nameAt(i)}`];
}
const secHtml = i => { const [k, t] = sectionAt(i); return `<span class="dx-sec ${k === '맞춤' ? 'cus' : k === '고정' ? 'fix' : 'mh'}">${k}</span> ${esc(t)}`; };

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
  if(isFree()) setMsg('백지예요. [이 펼침면 자유 편집하기]를 눌러 글과 사진을 넣어 보세요.');
  else setMsg(`${LAYOUTS[id].name} 템플릿으로 바꿨어요. ${slot.saved ? '전에 쓰던 글과 사진을 되살렸어요.' : '작성 도우미에서 키워드를 골라 적용하거나 본문 칸을 채워 주세요.'}`);
  refreshUI(); renderStrip(); renderStageBar(); scheduleSave();
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
function undo(){ if(history.length < 2) return; future.push(history.pop()); restore(history[history.length - 1]).then(() => { dirty = true; scheduleSave(); }); }
function redo(){ if(!future.length) return; const s = future.pop(); history.push(s); restore(s).then(() => { dirty = true; scheduleSave(); }); }
function refreshUI(){ setInteractive(); renderTop(); renderForm(); renderLayers(); renderProps(); }

// 자동 저장: 바뀐 내용을 책(slot.saved)에 넣고 opts.onSave로 알려 index.html이 브라우저(IndexedDB)에 저장합니다.
let saveTimer = null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => { const was = slot && !!slot.saved; commit(); opts.onSave && opts.onSave(); if(slot && !was && slot.saved) renderStrip(); else updateDoneBtn(); }, 600); }

function renderTop(){
  const noEdit = isFixedNoCanvas();
  $('dxTools').innerHTML = (noEdit ? '' : `<button class="dx-tb" data-a="undo" ${history.length < 2 ? 'disabled' : ''}>되돌리기</button>
    <button class="dx-tb" data-a="redo" ${future.length ? '' : 'disabled'}>다시하기</button><span class="dx-sep"></span>
    <button class="dx-tb ${showGuides ? 'on' : ''}" data-a="guides">재단선·안전 영역</button><span class="dx-sep"></span>`) +
    (isMh() ? '' : `<button class="dx-tb" data-a="zoom-">−</button><span class="dx-zoom">${Math.round(userZoom * 100)}%</span><button class="dx-tb" data-a="zoom+">+</button>
    <button class="dx-tb" data-a="zoomfit">화면 맞춤</button>`) + `<span class="dx-sep"></span><span class="dx-where">${secHtml(cur)}</span>`;
}
// 미리보기 위 버튼: [이 펼침면 상세 편집] / 백지면 [이 펼침면 자유 편집하기] / 상세 편집 중이면 [내용 입력으로]
function renderStageBar(){
  const el = $('dxStageBar');
  if(isFixed()){ el.innerHTML = `<span class="dx-where">${secHtml(cur)}</span>`; return; }
  el.innerHTML = `<span class="dx-where">${secHtml(cur)}</span>` + (mode === 'A'
    ? `<button class="dx-btn small ${isFree() ? 'primary' : ''}" data-a="toB">${isFree() ? '이 펼침면 자유 편집하기' : '이 펼침면 상세 편집'}</button>`
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
  if(!slot || isFixed()){ box.hidden = true; return; }
  box.hidden = false;
  $('dxLayouts').innerHTML = SPREAD_LAYOUTS.map(id => { const l = LAYOUTS[id];
    return `<button type="button" class="dx-tpl ${id === state.layout ? 'on' : ''} ${l.free ? 'free' : ''}" data-l="${id}" title="${esc(l.sub)}"><b>${l.name}</b><span>${esc(l.sub)}</span>${slot.cache && slot.cache[id] && id !== state.layout ? '<i>작성함</i>' : ''}</button>`; }).join('');
  $('dxColors').innerHTML = '배경 색 ' + Object.entries(THEMES).map(([id, t]) => `<button class="dx-dot ${id === state.theme ? 'on' : ''}" title="${t.name}" data-all="${id}" style="background:${t.dot}"></button>`).join('');
}

// ---------- 작성 도우미 ----------
// 도우미 상태(펼침면·템플릿마다): t = 고른 항목 번호(0부터), kw = 고른 키워드(하나), own = 직접 쓴 한 줄
const gState = () => { if(!slot) return { t:0, kw:'', own:'' }; slot.guide = slot.guide || {}; const g0 = slot.guide[state.layout] = slot.guide[state.layout] || {}; if(typeof g0.t !== 'number') g0.t = 0; if(typeof g0.kw !== 'string') g0.kw = ''; if(typeof g0.own !== 'string') g0.own = ''; delete g0.tags; delete g0.ans; delete g0.open; return g0; };
const guideOf = () => slot && GUIDES[state.layout];
const curTarget = (G, st) => G.targets[Math.min(st.t, G.targets.length - 1)];
const fieldText = k => { const o = byKey(k, canvas); return o && o.type === 'textbox' ? String(o.text || '') : ''; };
function suggestionText(G, kw){ const r = G.rows.find(x => x[0] === kw); if(!r) return ''; return G.names ? fillNames(r[1], book.info) : r[1]; }
function renderGuide(){
  const box = $('dxGuide'), G = guideOf();
  if(mode !== 'A' || isMh() || isInfo() || !slot){ box.innerHTML = ''; return; }
  if(isFree()){ box.innerHTML = `<div class="dx-guide"><p class="dx-gnote">${esc(BLANK_GUIDE)}</p><p class="dx-note" style="margin:0 0 10px;">이 안내는 편집 화면에만 보이고 책에는 인쇄되지 않아요.</p><button class="dx-btn primary" data-a="toB" style="width:100%;">이 펼침면 자유 편집하기</button></div>`; return; }
  if(!G){ box.innerHTML = ''; return; }
  const st = gState(), tg = curTarget(G, st), sug = st.kw ? suggestionText(G, st.kw) : '';
  const multiT = G.targets.length > 1;
  const now = tg.keys.map(fieldText).filter(Boolean).join(' · ');
  box.innerHTML = `<div class="dx-guide">
    <div class="dx-gstep">작성 도우미 <small>① 질문 → ② 키워드 선택 → ③ 추천 문구 확인 → ④ 적용</small></div>
    <div class="dx-gq">${esc(G.q)}</div>
    ${G.hint ? `<p class="dx-note" style="margin:-4px 0 8px;">${esc(G.hint)}</p>` : ''}
    ${multiT ? `<div class="dx-glabel">편집할 항목 <small>먼저 고르면 그 항목에만 들어가요</small></div>
      <div class="dx-gtargets">${G.targets.map((t, i) => `<button type="button" class="dx-gtarget ${i === st.t ? 'on' : ''}" data-gt="${i}">${esc(t.name.replace(/^.* /, ''))}</button>`).join('')}</div>
      <div class="dx-gnow"><b>${esc(tg.name)}</b> 지금 글: ${now ? esc(now.length > 60 ? now.slice(0, 60) + '…' : now) : '<i>비어 있음</i>'}</div>` : ''}
    <div class="dx-glabel">키워드 <small>하나를 누르면 연결된 추천 문구가 바로 보여요</small></div>
    <div class="dx-gtags" role="radiogroup">${G.rows.map(([k]) => `<button type="button" role="radio" aria-checked="${k === st.kw}" class="dx-chip ${k === st.kw ? 'on' : ''}" data-gkw="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    ${sug ? `<div class="dx-sug"><div class="dx-sug-h"><span class="dx-sug-badge">추천 문구 · ${esc(tg.name)}</span></div>
      ${G.titleFromKey ? `<div class="dx-sug-body"><div><em>소제목</em>${esc(st.kw)}</div><div><em>설명</em>${esc(sug)}</div></div>` : `<div class="dx-sug-body"><div>${esc(sug)}</div></div>`}
      <button type="button" class="dx-btn small primary" data-apply="kw" style="width:100%;">${esc(tg.name)}에 적용</button></div>` : `<p class="dx-note" style="margin:8px 0 0;">키워드를 누르면 추천 문구가 여기에 보여요. [적용]을 누르기 전에는 본문이 바뀌지 않아요.</p>`}
    <details class="dx-own" ${st.own ? 'open' : ''}><summary>직접 작성 · 우리 학원만의 한 줄 추가</summary>
      <textarea id="dxOwn" rows="3" placeholder="원장님이 쓰신 문장은 고치지 않고 그대로 들어가요.">${esc(st.own)}</textarea>
      <div class="dx-own-acts"><button type="button" class="dx-btn small" data-apply="own">${esc(tg.name)}에 그대로 넣기</button><button type="button" class="dx-btn small" data-apply="append">끝에 한 줄 덧붙이기</button></div></details>
  </div>`;
}
// 키를 가진 칸이 지금 펼침면에 없으면(예: 예전에 저장한 선생님 소개에 '지도 한마디' 칸이 없을 때) 템플릿 원래 위치에 만들어 넣습니다.
function ensureField(k){
  let o = byKey(k, canvas); if(o) return o;
  const tpl = buildObjs(state.layout, g).find(x => x.key === k);
  if(tpl){ canvas.add(tpl); setInteractive(); o = tpl; }
  return o;
}
// 고른 항목(target)의 칸에만 넣습니다. 다른 항목·왼쪽 대표 문구는 건드리지 않습니다.
function applyGuide(how){
  const G = guideOf(); if(!G) return;
  const st = gState(), tg = curTarget(G, st), n = Math.min(st.t, G.targets.length - 1) + 1;
  let fields;
  if(how === 'kw'){ if(!st.kw) return; fields = G.put(st.kw, suggestionText(G, st.kw), n); }
  else{
    const own = ($('dxOwn') && $('dxOwn').value || '').trim(); if(!own){ setMsg('먼저 직접 쓰실 문장을 입력해 주세요.', true); return; }
    const bodyKey = tg.keys[tg.keys.length - 1];   // 소제목+설명 칸이면 설명 칸에
    const prev = fieldText(bodyKey).trim();
    fields = { [bodyKey]:how === 'append' && prev ? `${prev} ${own}` : own };
  }
  Object.entries(fields).forEach(([k, v]) => { const o = ensureField(k); if(o && o.type === 'textbox'){ o.set('text', v); syncCellBg(o); } });
  canvas.requestRenderAll(); pushHistory();
  const first = document.querySelector(`#dxForm textarea[data-k="${tg.keys[tg.keys.length - 1]}"], #dxForm input[type=text][data-k="${tg.keys[tg.keys.length - 1]}"]`);
  if(first){ const f = first.closest('.dx-fld') || first; f.classList.add('flash'); setTimeout(() => f.classList.remove('flash'), 1100); first.scrollIntoView({ block:'nearest' }); }
  setMsg(`${tg.name}에 넣었어요. 왼쪽 본문 칸이나 페이지의 글을 눌러 바로 고칠 수 있어요.`);
}
function syncCellBg(o){
  if(o && /^tag\d+$/.test(o.key || '')) reflowTags(canvas.getObjects());
  if(!o || !/^cell_/.test(o.key || '')) return;
  const bg = canvas.getObjects().find(x => x.cellbg === o.key);
  if(bg) bg.set('fill', String(o.text || '').trim() ? C.paleMint : '#F6F8F8');
}

// 왼쪽 본문 칸 (실제 책에 들어가는 글)
const LONG = k => /^(title|lead|gtitle|gbody|note|rtitle)$|d$|^desc/.test(k);
function fieldHtml(o){
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
  return `<div class="dx-fld" data-k="${k}"><label>${o.label}</label>` +
    (LONG(k) ? `<textarea data-k="${k}" rows="${rows}">${esc(o.text || '')}</textarea>` : `<input type="text" data-k="${k}" value="${esc(o.text || '')}">`) + '</div>';
}
function renderForm(){
  const box = $('dxForm');
  renderGuide();
  if(mode !== 'A') return;
  if(isInfo()) return renderInfoForm();
  if(isImagePage(slot)){
    $('dxFormTitle').textContent = LAYOUTS[slot.layout].name;
    box.innerHTML = '<div class="dx-lockcard"><b>매쓰홀릭이 준비한 고정 페이지예요</b><p>다음 쪽부터 주제별 구성이 시작돼요. 따로 꾸미지 않아도 돼요.</p></div>';
    return;
  }
  if(isMh()){
    $('dxFormTitle').textContent = '매쓰홀릭 프로그램 영역';
    box.innerHTML = `<div class="dx-lockcard"><b>이 구간은 편집하지 않아요</b><p>13쪽부터는 [주제별 구성]에서 고른 매쓰홀릭 프로그램 페이지가 들어가요. 지금은 ${pagesOf()[cur].sample ? '주제를 고르기 전이라 예시 페이지를' : '고르신 주제의 실제 페이지를'} 보여드리고 있어요.</p></div>`;
    return;
  }
  $('dxFormTitle').innerHTML = isFixed() ? '내용 입력 <small style="font-weight:500;">이 페이지는 위치·레이아웃이 고정이라 글과 사진만 바꿀 수 있어요</small>' : '본문 <small style="font-weight:500;">실제 책에 들어가는 글이에요. 기존 원고는 그대로 붙여넣으세요</small>';
  const objs = canvas.getObjects().filter(o => o.key);
  if(!objs.length){ box.innerHTML = '<p class="dx-note">백지예요. 위의 [이 펼침면 자유 편집하기]를 눌러 글과 사진을 넣어요.</p>'; return; }
  if(state.layout === 'timetable'){
    const isT = k => /^(day|row|cell)_/.test(k);
    const v = k => esc((byKey(k, canvas) || {}).text || '');
    const grid = `<div class="dx-fld"><label>시간표 <small>칸을 고치면 바로 표에 들어가요. 비워 두면 수업 없는 칸이에요</small></label><div class="dx-ttgrid"><table>
      <tr><th>반</th>${TT_DAYS.map((d, j) => `<th><input type="text" data-k="day_${j}" value="${v(`day_${j}`)}"></th>`).join('')}</tr>
      ${Array.from({ length:TT_ROWS }, (_, i) => `<tr><th><input type="text" data-k="row_${i}" value="${v(`row_${i}`)}" placeholder="반 이름"></th>${TT_DAYS.map((d, j) => `<td><input type="text" data-k="cell_${i}_${j}" value="${v(`cell_${i}_${j}`)}"></td>`).join('')}</tr>`).join('')}
    </table></div></div>`;
    const rest = objs.filter(o => !isT(o.key));
    const head = rest.filter(o => ['title', 'lead'].includes(o.key)), tail = rest.filter(o => !['title', 'lead'].includes(o.key));
    box.innerHTML = head.map(fieldHtml).join('') + grid + tail.map(fieldHtml).join('');
    return;
  }
  box.innerHTML = objs.map(fieldHtml).join('');
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
  $('dxLayers').innerHTML = objs.map((o, i) => [o, i]).reverse().map(([o, i]) =>
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
    : isImagePage(slot) ? '매쓰홀릭이 준비한 고정 페이지예요. 다음 쪽부터 주제별 구성이 시작돼요.'
    : isFixed() ? '이 페이지는 레이아웃이 고정이에요. 왼쪽 칸에 글을 쓰거나 사진을 올리면 바로 반영돼요.'
    : m === 'A' ? (isFree() ? '백지예요. [이 펼침면 자유 편집하기]를 눌러 글과 사진을 넣어 보세요.' : '템플릿을 고르고, 작성 도우미에서 키워드를 골라 [적용]하거나 본문 칸을 채우면 바로 반영돼요. 페이지의 글을 누르면 해당 칸으로 가요.')
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
  : pagesOf()[i] === book.first ? '작성 도우미에서 키워드를 고르고 [3쪽 학원 소개에 적용]을 누르거나, 소개 문구를 한 글자라도 고치면 완료돼요.'
  : pagesOf()[i].layout === 'greeting' ? '마지막 문장이 안쪽 표지에도 들어가요. 키워드를 고르고 [인사말에 적용]을 누르거나 직접 고치면 완료돼요.'
  : '작성 도우미에서 키워드를 골라 [적용]하거나, 글을 직접 고치면 완료돼요.';
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
    return `${s.mh && i > 0 && !pages[i - 1].mh ? '<span class="dx-st-sep" title="여기부터 매쓰홀릭 프로그램 영역"></span>' : ''}<div class="dx-st ${i === cur ? 'on' : ''} ${s.info ? 'single' : s.mh ? 'mh spread' : s.kind}" data-go="${i}">
      <div class="dx-st-img" data-thumb="${i}">${fix ? '<em class="dx-st-lock"></em>' : ''}</div>
      ${isRequired(i) && isDone(i) ? '<span class="dx-st-done" title="채움">✓</span>' : ''}
      <div class="dx-st-cap">${secHtml(i)}</div></div>`;
  });
  updateDoneBtn();
  $('dxStrip').innerHTML = `<div class="dx-strip-head"><b>전체 구성 미리보기</b><span><span class="dx-sec fix">고정</span> 위치·레이아웃 고정 <span class="dx-sec cus">맞춤</span> 4~11쪽 템플릿·상세 편집 <span class="dx-sec mh">매쓰홀릭</span> 주제 선택 후 반영</span></div>
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
async function goTo(i){
  commit();
  if(i !== cur && opts.onSave) opts.onSave();
  cur = i;
  const s = pagesOf()[i];
  slot = (s.info || s.mh) ? null : s;
  const mh = !!s.mh;
  g = s.info ? INFO_GEOM : mh ? geom('spread') : geom(s.kind, s.side);
  $('dxTitle').innerHTML = `우리 학원 소개하기<small>${secHtml(i)}</small>`;
  $('dxLabels').innerHTML = s.info ? '' : labelsAt(i).map(l => `<span>${l}</span>`).join('');
  $('dxTabs').style.visibility = isFixed(i) ? 'hidden' : '';
  $('dxStageNote').textContent = s.info ? '표지 글자는 대략적인 모습이에요.' : '';
  $('dxStatic').hidden = !mh;
  canvas.wrapperEl.style.display = mh ? 'none' : '';
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
    if(mode !== 'A' || !target || !target.key) return;
    const G = guideOf();
    if(G && G.targets.length > 1){ const i = G.targets.findIndex(t => t.keys.includes(target.key)); if(i >= 0 && i !== gState().t){ gState().t = i; renderGuide(); } }
    const inp = document.querySelector(`#dxForm input[type=text][data-k="${target.key}"], #dxForm textarea[data-k="${target.key}"]`) || document.querySelector(`#dxForm .dx-fld[data-k="${target.key}"]`);
    if(!inp) return;
    const f = inp.closest('.dx-fld') || inp;
    inp.scrollIntoView({ block:'center', behavior:'smooth' });
    if(/INPUT|TEXTAREA/.test(inp.tagName)) inp.focus({ preventScroll:true });
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
  canvas.on('object:modified', pushHistory);
  canvas.on('text:editing:exited', pushHistory);
  canvas.on('text:changed', ({ target }) => syncCellBg(target));
  ['object:added', 'object:removed'].forEach(ev => canvas.on(ev, () => { if(!muted) renderLayers(); }));
  ['selection:created', 'selection:updated', 'selection:cleared'].forEach(e => canvas.on(e, () => { renderProps(); renderLayers(); }));
  canvas.on('object:moving', renderProps); canvas.on('object:scaling', renderProps);

  $('dxLayouts').onclick = e => { const b = e.target.closest('[data-l]'); if(b) switchLayout(b.dataset.l); };
  $('dxColors').onclick = e => { const b = e.target.closest('[data-all]'); if(b){ applyTheme(b.dataset.all); pushHistory(); } };
  // 작성 도우미: 키워드는 하나만, 누르면 추천 영역만 바뀜(본문은 [적용]을 눌러야 바뀜)
  $('dxGuide').addEventListener('click', e => {
    const st = gState();
    const t = e.target.closest('[data-gt]');
    if(t){ st.t = +t.dataset.gt; renderGuide(); scheduleSave(); return; }
    const k = e.target.closest('[data-gkw]');
    if(k){ st.kw = k.dataset.gkw; renderGuide(); scheduleSave(); return; }
    const ap = e.target.closest('[data-apply]');
    if(ap) applyGuide(ap.dataset.apply);
  });
  $('dxGuide').addEventListener('input', e => { if(e.target.id === 'dxOwn'){ gState().own = e.target.value; scheduleSave(); } });
  $('dxForm').addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.info){ book.info[t.dataset.info] = t.value.trim() ? t.value : ''; redrawInfo(); opts.onChange && opts.onChange(); if(t.dataset.info !== 'cover') renderStrip(); scheduleSave(); return; }
    const k = t.dataset.k; if(!k || t.type === 'file') return;
    const o = byKey(k, canvas); if(o && o.type === 'textbox'){ o.set('text', t.value); syncCellBg(o); canvas.requestRenderAll(); dirty = true; scheduleSave(); }
  });
  $('dxForm').addEventListener('change', async e => {
    const t = e.target;
    if(t.dataset.infoFile){ if(t.files[0]){ book.info[t.dataset.infoFile] = await readUrl(t.files[0]); await afterInfoFile(); } return; }
    const k = t.dataset.k; if(!k || t.dataset.info) return;
    if(t.type === 'file'){ if(t.files[0]) placePhoto(t.files[0], byKey(k, canvas)); }
    else{ history.push(snapshot()); future = []; dirty = true; renderTop(); renderStrip(); scheduleSave(); }   // 입력 중에는 칸을 다시 그리지 않도록 기록만
  });
  $('dxForm').addEventListener('click', e => {
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
  BLEED, PAGE_W, PAGE_H, PRINT_PPI, LAYOUTS, SPREAD_LAYOUTS, THEMES, GUIDES, geom,
  setBook(b){ book = b; },
  loadTheme,
  openBook, renderPages, greetingText, closingText, flush,
  requiredDone: () => book ? missingRequired() == null : false,
};
loadTheme();
})();
