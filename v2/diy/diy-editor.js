/* 우리학원 브랜드북 — 앞부분(3~12p) 직접 꾸미기 편집기 (2026-11-05)
 *
 * 맞춤형 앞부분 10p(3~12p)를 원장님이 고른 페이지로 바꿉니다. 단위는 세 가지:
 *   3p  = 낱장(오른쪽, 표2와 마주 봄)
 *   4~11p = 펼침면 0~4개
 *   마지막 = 낱장(왼쪽)
 * 쪽수가 늘 짝수라 13p부터의 뒷부분 좌우가 바뀌지 않습니다.
 *
 * 책(book) = { info, first, spreads:[], last }
 *   info: 학원 기본 정보 { academy, director, cover(표지 문구), logoUrl, profileUrl } — 편집기 맨 앞 [학원 기본 정보]에서 입력
 *   한 칸(slot) = { kind:'single'|'spread', side:'R'|'L'(낱장만), layout, theme, saved }
 *     saved: 편집한 상태(JSON 문자열). 없으면 layout의 예시 내용으로 그립니다.
 *
 * 쓰는 법 (index.html):
 *   DiyEditor.setBook(book)                            // 학원명·로고가 꾸미기 페이지 학원명 자리에 자동으로 들어감
 *   DiyEditor.openBook(book, { start, cover:'01', cv, labelsFor, onChange, onClose })
 *   await DiyEditor.renderPages(slot, { ppi, bleed })  // 쪽마다 이미지(dataURL) 배열
 *   DiyEditor.greetingText(slot)                       // 인사말 펼침면이면 그 글(표2 맺음용), 아니면 ''
 * AI 문구 도우미는 쓰지 않음(2026-11-05 회의) — 칸마다 [추천 문구]로 대신합니다.
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

// ===================== 구성 (임시 콘텐츠 — 김영주님 기획이 오면 바꿈) =====================
// build(g): g의 쪽 위치 기준으로 글·사진 칸을 만듭니다. L = 첫 쪽 안전 영역 왼쪽, R = 둘째 쪽(펼침면) 안전 영역 왼쪽.
// key·label이 있는 칸은 [1. 테마·내용]의 오른쪽 입력칸에 나옵니다.
const COL = PAGE_W - SAFE * 2;
const at = g => ({ L:g.pages[0].x + SAFE, R:(g.pages[1] || g.pages[0]).x + SAFE });
const LAYOUTS = {
  // ---------- 낱장 ----------
  intro: { kind:'single', name:'학원 소개', sub:'제목 + 소개 글 + 사진', build: g => { const { L } = at(g); return [
    text('#ABOUT US', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('우리 학원은\n이렇게 다릅니다', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'제목' }),
    text('한 문제를 풀어도 왜 그런지 끝까지 묻게 합니다. 학생마다 다른 출발점에서 시작해 스스로 답을 찾는 힘을 기릅니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 100, COL, 130, 'photo1', '사진'),
    academyText(L),
  ]; } },
  message: { kind:'single', name:'핵심 메시지', sub:'큰 문장 한 줄', build: g => { const { L } = at(g); return [
    text('#OUR MESSAGE', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal, textAlign:'center' }),
    text('생각하는 힘을 키우는\n수학 공부', L, 96, COL, 10, { fontWeight:700, lineHeight:1.3, textAlign:'center', key:'title', label:'핵심 문장' }),
    text('정답보다 풀이 과정을, 속도보다 이해를 먼저 봅니다.', L, 132, COL, 3.8, { fill:C.body, lineHeight:1.6, textAlign:'center', key:'lead', label:'덧붙이는 글' }),
    academyText(L),
  ]; } },
  contact: { kind:'single', name:'오시는 길', sub:'주소·전화·운영 시간 + 사진', build: g => { const { L } = at(g); return [
    text('#VISIT US', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('오시는 길', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    frame(L, 52, COL, 110, 'photo1', '지도·건물 사진'),
    ...[['주소', 'addr', '서울시 ○○구 ○○로 12, 3층'], ['전화', 'tel', '02-000-0000'], ['운영 시간', 'hours', '평일 14:00~22:00 · 토요일 10:00~18:00']].map(([lb, k, v], i) => [
      text(lb, L, 172 + i * 18, 30, 3.4, { fontWeight:700, fill:C.teal }),
      text(v, L + 32, 172 + i * 18, COL - 32, 3.6, { fill:C.ink, key:k, label:lb }),
    ]).flat(),
    academyText(L),
  ]; } },
  blank1: { kind:'single', name:'빈 페이지', sub:'처음부터 직접', build: g => [academyText(at(g).L)] },
  // 고정 페이지: 디자이너가 만든 그림(재단 크기 182×257) 한 장. 원장님은 바꾸지 않고, 구성 목록에도 나오지 않습니다.
  // 12p 안내(#OUR WAY) — 13p부터 주제별 간지가 시작됨을 알림(2026-11-05).
  prologue: { kind:'single', name:'쉬어 가는 페이지', sub:'고정', fixed:'diy/fixed/p012_prologue.jpg?v=20261105h', build: () => [] },

  // ---------- 펼침면 ----------
  greeting: { kind:'spread', name:'인사말', sub:'제목 + 본문 (마지막 문장은 안쪽 표지에도)', greeting:true, build: g => { const { L, R } = at(g); return [
    text('#GREETING', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('아이들과 함께 자라는\n학원이 되고 싶습니다.', L, 33, COL, 8, { fontWeight:700, lineHeight:1.3, key:'gtitle', label:'첫 문장 (제목)' }),
    frame(L, 80, COL, 150, 'photo1', '원장님 사진'),
    text('저는 이 지역에서 아이들에게 수학을 가르치고 있습니다. 같은 문제를 풀어도 아이마다 걸리는 곳이 다르기에, 한 명 한 명의 속도에 맞춰 차근차근 이끌어 가려 합니다.\n\n이 책에 저희 학원이 아이들을 어떻게 가르치고 살피는지 담았습니다. 아이의 공부를 함께 고민하는 데 작은 도움이 되길 바랍니다.',
      R, 33, COL, 3.6, { fill:C.body, lineHeight:1.8, key:'gbody', label:'본문' }),
    text('원장 ○○○ 드림', R, 200, COL, 4, { fontWeight:600, textAlign:'right', key:'sign', label:'서명' }),
    academyText(L),
  ]; } },
  class: { kind:'spread', name:'수업 방식', sub:'강점 3가지 + 사진 2장', build: g => { const { L, R } = at(g); return [
    text('#OUR CLASS', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('생각을 끝까지\n따라가는 수업', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'제목' }),
    text('정답을 맞히는 것보다 왜 그런지 설명할 수 있는 힘을 기릅니다. 한 문제를 풀어도 끝까지 묻고, 스스로 답을 찾을 때까지 기다립니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 108, COL, 132, 'photo1', '큰 사진'),
    ...[0, 1, 2].map(i => [
      text(`0${i + 1}`, R, 30 + i * 62, 20, 8, { fontWeight:700, fill:C.grayGreen }),
      text(['오답 원인 노트', '1:1 질문 시간', '소수 정예 반'][i], R + 22, 31 + i * 62, COL - 22, 5, { fontWeight:700, key:`item${i + 1}`, label:`강점 ${i + 1}` }),
      text(['틀린 문제는 이유부터 적고, 같은 유형을 다시 풀어 완전히 내 것으로 만듭니다.',
            '수업이 끝나면 한 명씩 질문 시간을 가져 모르는 채로 넘어가지 않게 합니다.',
            '한 반 8명 이내로 운영해 학생 한 명 한 명의 풀이 과정을 살핍니다.'][i],
        R + 22, 41 + i * 62, COL - 22, 3.5, { fill:C.body, lineHeight:1.6, key:`item${i + 1}d`, label:`강점 ${i + 1} 설명` }),
    ]).flat(),
    frame(R, 214, COL, 24, 'photo2', '작은 사진'),
    academyText(L),
  ]; } },
  space: { kind:'spread', name:'학원 공간', sub:'사진 4장 + 설명', build: g => { const { L, R } = at(g); return [
    text('#OUR SPACE', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('아이들이 머무는 공간', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    frame(L, 52, COL, 160, 'photo1', '사진 1'),
    text('강의실 · 한 반 8명이 둘러앉는 원형 책상', L, 217, COL, 3.5, { fill:C.body, key:'cap1', label:'사진 1 설명' }),
    frame(R, 24, COL, 100, 'photo2', '사진 2'),
    text('자습실 · 수업 전후 언제든 열려 있어요', R, 127, COL, 3.5, { fill:C.body, key:'cap2', label:'사진 2 설명' }),
    frame(R, 140, 78, 96, 'photo3', '사진 3'),
    frame(R + 84, 140, 78, 96, 'photo4', '사진 4'),
    text('상담실', R, 239, 78, 3.5, { fill:C.body, key:'cap3', label:'사진 3 설명' }),
    text('복도 게시판', R + 84, 239, 78, 3.5, { fill:C.body, key:'cap4', label:'사진 4 설명' }),
    academyText(L),
  ]; } },
  flow: { kind:'spread', name:'상담 절차', sub:'4단계 + 사진 1장', build: g => { const { L, R } = at(g); return [
    text('#HOW TO START', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('처음 오시는 길,\n이렇게 함께해요', L, 33, COL, 9, { fontWeight:700, lineHeight:1.25, key:'title', label:'제목' }),
    text('레벨테스트부터 첫 수업까지, 학생에게 맞는 반을 함께 찾습니다.', L, 61, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 80, COL, 160, 'photo1', '사진'),
    ...[0, 1, 2, 3].map(i => [
      new fabric.Rect({ left:R, top:24 + i * 57, width:COL, height:50, rx:4, ry:4, fill:C.paleMint, strokeWidth:0 }),
      text(`STEP ${i + 1}`, R + 8, 31 + i * 57, 40, 3.6, { fontWeight:700, fill:C.teal }),
      text(['전화·방문 상담 예약', '레벨테스트 (40분)', '결과 상담과 반 배정', '첫 수업과 2주 뒤 점검'][i], R + 8, 38 + i * 57, COL - 16, 5, { fontWeight:700, key:`step${i + 1}`, label:`${i + 1}단계` }),
      text(['편하신 시간에 예약해 주세요.', '학년별 진단지로 지금 위치를 확인해요.', '부모님과 함께 결과를 보고 반을 정해요.', '2주 뒤 적응 상황을 다시 알려드려요.'][i],
        R + 8, 46 + i * 57, COL - 16, 3.5, { fill:C.body, key:`step${i + 1}d`, label:`${i + 1}단계 설명` }),
    ]).flat(),
    academyText(L),
  ]; } },
  teacher: { kind:'spread', name:'선생님 소개', sub:'단체 사진 + 선생님 4명', build: g => { const { L, R } = at(g); return [
    text('#OUR TEACHERS', L, 24, COL, 3.6, { fontWeight:700, fill:C.teal }),
    text('함께하는 선생님', L, 33, COL, 9, { fontWeight:700, key:'title', label:'제목' }),
    text('학년별 담임 선생님이 수업부터 상담까지 끝까지 함께합니다.', L, 52, COL, 3.6, { fill:C.body, lineHeight:1.6, key:'lead', label:'소개 글' }),
    frame(L, 72, COL, 168, 'photo1', '단체 사진'),
    ...[0, 1, 2, 3].map(i => {
      const x = R + (i % 2) * 84, y = 24 + Math.floor(i / 2) * 112;
      return [
        frame(x, y, 78, 70, `tp${i + 1}`, `선생님 ${i + 1} 사진`),
        text(['김수학 선생님', '이수학 선생님', '박수학 선생님', '최수학 선생님'][i], x, y + 74, 78, 4.2, { fontWeight:700, key:`t${i + 1}`, label:`선생님 ${i + 1}` }),
        text(['중등 담당 · 개념 정리', '고등 담당 · 수능 대비', '초등 담당 · 사고력', '오답 클리닉'][i], x, y + 81, 78, 3.4, { fill:C.body, key:`t${i + 1}d`, label:`선생님 ${i + 1} 소개` }),
      ];
    }).flat(),
    academyText(L),
  ]; } },
  blank: { kind:'spread', name:'빈 펼침면', sub:'처음부터 직접', build: g => [academyText(at(g).L)] },
};

// 칸마다 [추천 문구] (매쓰홀릭이 준비한 문장 — 임시, 김영주님 콘텐츠로 바꿀 자리)
const PRESETS = {
  intro: { title:['우리 학원은\n이렇게 다릅니다', '생각하는 힘을\n키우는 곳', '한 명 한 명을\n끝까지 봅니다'],
    lead:['한 문제를 풀어도 왜 그런지 끝까지 묻게 합니다. 학생마다 다른 출발점에서 시작해 스스로 답을 찾는 힘을 기릅니다.',
          '정답보다 풀이 과정을 먼저 봅니다. 틀린 문제에서 출발해, 같은 실수를 다시 하지 않을 때까지 함께합니다.'] },
  message: { title:['생각하는 힘을 키우는\n수학 공부', '포기하지 않는\n수학 습관', '어제보다 한 문제 더'],
    lead:['정답보다 풀이 과정을, 속도보다 이해를 먼저 봅니다.', '아이의 속도에 맞춰, 끝까지 함께 갑니다.'] },
  contact: { hours:['평일 14:00~22:00 · 토요일 10:00~18:00', '평일 15:00~22:00 · 주말은 상담 예약제'] },
  greeting: { gtitle:['아이들과 함께 자라는\n학원이 되고 싶습니다.', '아이의 속도에 맞추면\n수학은 반드시 따라옵니다.', '처음 상담 오시는 부모님께\n늘 드리는 말씀이 있습니다.'],
    gbody:['저는 이 지역에서 아이들에게 수학을 가르치고 있습니다. 같은 문제를 풀어도 아이마다 걸리는 곳이 다르기에, 한 명 한 명의 속도에 맞춰 차근차근 이끌어 가려 합니다.\n\n이 책에 저희 학원이 아이들을 어떻게 가르치고 살피는지 담았습니다. 아이의 공부를 함께 고민하는 데 작은 도움이 되길 바랍니다.',
           '수학은 누가 더 빨리 가느냐보다, 아이가 지금 어디에서 막혀 있는지를 정확히 아는 것에서 시작됩니다.\n\n진단으로 출발점을 확인하고, 틀린 문제는 이해할 때까지 다시 확인합니다. 아이가 스스로 "이제 알겠다"고 말하는 순간까지 함께하겠습니다.'] },
  class: { title:['생각을 끝까지\n따라가는 수업', '틀린 문제에서\n시작하는 수업'],
    lead:['정답을 맞히는 것보다 왜 그런지 설명할 수 있는 힘을 기릅니다. 한 문제를 풀어도 끝까지 묻고, 스스로 답을 찾을 때까지 기다립니다.'] },
  space: { title:['아이들이 머무는 공간', '공부가 잘 되는 자리'] },
  flow: { title:['처음 오시는 길,\n이렇게 함께해요', '상담부터 첫 수업까지'],
    lead:['레벨테스트부터 첫 수업까지, 학생에게 맞는 반을 함께 찾습니다.'] },
  teacher: { title:['함께하는 선생님', '끝까지 책임지는 선생님'],
    lead:['학년별 담임 선생님이 수업부터 상담까지 끝까지 함께합니다.'] },
};

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
// 로고는 3p(학원 소개)에만 — 나머지 페이지 학원명 자리는 글자 그대로 (2026-11-05 QA)
async function fillAuto(cv, s = slot){
  const { academy } = getAuto(), logoUrl = book && s === book.first ? book.info.logoUrl : null;
  const o = byKey('academy', cv); if(!o) return;
  const idx = cv.getObjects().indexOf(o);
  if(logoUrl){
    const img = await new Promise(res => fabric.Image.fromURL(logoUrl, res));
    const s = Math.min(9 / img.height, 60 / img.width);
    img.set({ left:o.left, top:o.role === 'logo' ? o.top : o.top - 4, scaleX:s, scaleY:s, role:'logo', key:'academy', label:'학원 로고', lockSkewingX:true, lockSkewingY:true });
    img.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false });
    cv.remove(o); cv.insertAt(img, idx);
  }else if(o.role === 'logo'){
    cv.remove(o); cv.insertAt(academyText(o.left, academy || '학원명', o.top + 4), idx);
  }else{
    o.set('text', academy || '학원명');
  }
}

const SAVE_PROPS = ['role', 'key', 'label'];
const loadFonts = () => Promise.all([`400 10px ${FONT}`, `600 10px ${FONT}`, `700 10px ${FONT}`, `400 10px ${PEN}`].map(f => document.fonts.load(f)));
const loadJSON = (cv, json) => new Promise(res => cv.loadFromJSON(json, res));
const isFixed = s => !!(s && LAYOUTS[s.layout] && LAYOUTS[s.layout].fixed);
// 고정 페이지 그림을 재단선에 맞춰 놓음(도련은 흰색 — 인쇄본은 본사가 InDesign 원본으로 만듦)
async function fixedImage(s, g){
  const img = await new Promise(res => fabric.Image.fromURL(LAYOUTS[s.layout].fixed, res));
  img.set({ left:g.pages[0].x, top:BLEED, scaleX:PAGE_W / img.width, scaleY:PAGE_H / img.height, selectable:false, evented:false });
  return img;
}

// ===================== 내보내기 (팝업을 열지 않고 칸 하나를 그림) =====================
// bleed가 true면 도련 포함(인쇄용, 접히는 쪽은 도련 없음), false면 재단 크기(미리보기용).
async function renderPages(slot, { ppi = 150, bleed = false, type = 'jpeg', quality = 0.9 } = {}){
  await loadFonts();
  const g = geom(slot.kind, slot.side), k = PX_PER_MM(ppi);
  const sc = new fabric.StaticCanvas(null, { width:g.W * k, height:g.H * k, backgroundColor:'#fff', renderOnAddRemove:false, enableRetinaScaling:false });
  sc.setZoom(k);
  let theme = slot.theme;
  if(isFixed(slot)){ sc.add(await fixedImage(slot, g)); theme = null; }
  else if(slot.saved){ const s = JSON.parse(slot.saved); theme = s.theme; await loadJSON(sc, s.canvas); }
  else LAYOUTS[slot.layout].build(g).forEach(o => sc.add(o));
  await fillAuto(sc, slot);
  if(theme) sc.backgroundImage = themeGroup(g, theme);
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

// 인사말 펼침면이면 제목 + 본문(표2 맺음말을 여기서 가져감). 편집하지 않았으면 예시 글.
function greetingText(slot){
  if(!LAYOUTS[slot.layout] || !LAYOUTS[slot.layout].greeting) return '';
  let objs;
  if(slot.saved) objs = JSON.parse(slot.saved).canvas.objects || [];
  else objs = LAYOUTS[slot.layout].build(geom(slot.kind, slot.side));
  const get = k => { const o = objs.find(x => x.key === k); return o && o.text ? o.text.trim() : ''; };
  return [get('gtitle').replace(/\n/g, ' '), get('gbody')].filter(Boolean).join('\n');
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
// 표지 기본 정보: 표1(앞표지)·표2(안쪽 표지)를 낱장으로 하나씩 (2026-11-05 QA — 뒤표지는 빼고, 펼침면 대신 크게)
const INFO_N = 2;   // 아래 줄 맨 앞 두 칸 = 표1, 표2
const INFO_GEOM = { W:PAGE_W, H:PAGE_H, pages:[], fold:0, info:true };   // 재단 크기만(흰 테두리·이름 줄 없이 — 2026-11-05 QA)
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
  const close = (book && book.spreads.map(greetingText).find(Boolean) || '').split(/(?<=[.!?。])\s+/).filter(Boolean).slice(-2).join(' ');
  if(gr && close) stack(cv, [[close, gr.paragraphs[0]]], X + gr.panelMm.x, Y1 + gr.panelMm.y, gr.panelMm.w);
  cv.requestRenderAll();
}

// ===================== 편집 팝업 (책 한 권: 기본 정보 + 앞부분 전체) =====================
// 아래 줄(슬라이드)에서 페이지를 고르면 그 페이지를 편집합니다. 다른 페이지로 옮길 때 편집한 내용은 자동으로 저장됩니다.
let mounted = false, canvas, g, slot = null, cur = 0, opts = {};
let state = { theme:'clean', layout:null };
let mode = 'A', zoom = 2, userZoom = 1, showGuides = true;
let history = [], future = [], muted = false, doneAsked = false;
const pagesOf = () => [{ info:'p1' }, { info:'p2' }, book.first, ...book.spreads, book.last];

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
    <div class="dx-tools" id="dxTools"></div>
    <div class="dx-body">
      <aside class="dx-pane left">
        <div class="dx-onlyA">
          <div id="dxLayoutBox"><h3>구성</h3><div class="dx-chips" id="dxLayouts"></div><div class="dx-chips" id="dxColors"></div></div>
          <h3 id="dxFormTitle">내용 입력</h3><div id="dxForm"></div>
          <div class="dx-detail" id="dxDetailBox"><b style="font-size:13.5px;">사진 위치나 글 크기를 바꾸고 싶다면</b>
            <p class="dx-note" style="margin:4px 0 10px;">대부분은 여기서 끝나요. 끌어서 옮기거나 글을 더 넣고 싶을 때만 눌러 주세요.</p>
            <button class="dx-btn small primary" id="dxToDetail" style="width:100%;">상세 편집</button></div>
        </div>
        <div class="dx-onlyB"><h3>넣기</h3>
          <div class="dx-add"><button class="dx-btn small" id="dxAddTitle">제목 글</button><button class="dx-btn small" id="dxAddBody">본문 글</button>
            <button class="dx-btn small" id="dxAddFrame">사진 칸</button><label class="dx-btn small">사진 올리기<input type="file" id="dxPhoto" accept="image/png,image/jpeg" hidden></label></div>
          <p class="dx-note">사진 칸을 고른 뒤 [사진 올리기]를 누르면 칸에 맞춰 들어가요.</p>
          <h3>레이어 <small style="font-weight:500;">(위에 있을수록 앞)</small></h3><div class="dx-layers" id="dxLayers"></div></div>
      </aside>
      <div class="dx-stage" id="dxStage"><div class="dx-stage-inner"><div class="dx-labels" id="dxLabels"></div><canvas id="dxCanvas"></canvas><p class="dx-note" id="dxStageNote" style="text-align:center;"></p></div></div>
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
const isInfo = () => cur < INFO_N;
const isLocked = () => isFixed(slot);   // 고정 페이지: 보기만
function setMsg(m, warn){ const el = $('dxMsg'); el.textContent = m; el.className = warn ? 'warn' : ''; }
const labelsAt = i => i < INFO_N ? [i === 0 ? '표1' : '표2'] : (opts.labelsFor ? opts.labelsFor(pagesOf()[i]) : []);
const nameAt = i => i < INFO_N ? (i === 0 ? '앞표지' : '안쪽 표지') : (LAYOUTS[pagesOf()[i].layout] || {}).name;

function fitCanvas(){
  const stage = $('dxStage');
  const fit = Math.min((stage.clientWidth - 48) / g.W, (stage.clientHeight - 80) / g.H);
  zoom = Math.max(0.4, fit) * userZoom;
  canvas.setDimensions({ width:g.W * zoom, height:g.H * zoom });
  canvas.setZoom(zoom);
  canvas.requestRenderAll();
}
function applyTheme(id){
  state.theme = id;
  canvas.setBackgroundImage(themeGroup(g, id), canvas.renderAll.bind(canvas));
  renderLayoutChips();
}
async function applyLayout(id, themeId, ask = true){
  if(ask && history.length > 1 && !confirm('지금 편집한 내용을 지우고 이 구성으로 바꿀까요?')) return;
  state.layout = id;
  silent(() => { canvas.clear(); canvas.backgroundColor = '#fff'; LAYOUTS[id].build(g).forEach(o => canvas.add(o)); });
  await fillAuto(canvas);
  applyTheme(themeId || state.theme);
  history = []; future = [];
  pushHistory();
  if(ask) history.unshift(history[0]);   // 구성을 바꾼 것도 '편집함'으로 칩니다
}
function setInteractive(){
  const edit = mode === 'B' && !isInfo() && !isLocked();
  canvas.selection = edit;
  canvas.getObjects().forEach(o => o.set({ selectable:edit, evented:edit || !!o.key, hoverCursor:edit ? 'move' : (o.key ? 'pointer' : 'default') }));
}

// 되돌리기
function snapshot(){ const j = canvas.toJSON(SAVE_PROPS); delete j.backgroundImage; return JSON.stringify({ theme:state.theme, layout:state.layout, canvas:j }); }
function silent(fn){ muted = true; try{ fn(); } finally{ muted = false; } }
function pushHistory(){ if(muted || isInfo() || isLocked()) return; history.push(snapshot()); if(history.length > 60) history.shift(); future = []; refreshUI(); }
async function restore(json){
  const s = JSON.parse(json);
  muted = true;
  await loadJSON(canvas, s.canvas);
  state.theme = s.theme; state.layout = s.layout;
  canvas.getObjects().filter(o => o.role === 'photo' || o.role === 'logo').forEach(o => o.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false }));
  applyTheme(s.theme);
  muted = false; canvas.requestRenderAll(); refreshUI();
}
function undo(){ if(history.length < 2) return; future.push(history.pop()); restore(history[history.length - 1]); }
function redo(){ if(!future.length) return; const s = future.pop(); history.push(s); restore(s); }
function refreshUI(){ setInteractive(); renderTop(); renderForm(); renderLayers(); renderProps(); }

function renderTop(){
  const info = isInfo();
  $('dxTools').innerHTML = (info ? '' : `<button class="dx-tb" data-a="undo" ${history.length < 2 ? 'disabled' : ''}>되돌리기</button>
    <button class="dx-tb" data-a="redo" ${future.length ? '' : 'disabled'}>다시하기</button><span class="dx-sep"></span>
    <button class="dx-tb ${showGuides ? 'on' : ''}" data-a="guides">재단선·안전 영역</button><span class="dx-sep"></span>`) +
    `<button class="dx-tb" data-a="zoom-">−</button><span class="dx-zoom">${Math.round(userZoom * 100)}%</span><button class="dx-tb" data-a="zoom+">+</button>
    <button class="dx-tb" data-a="zoomfit">화면 맞춤</button>`;
}

// 구성 고르기 (같은 단위 — 낱장/펼침면 — 의 구성만) + 색
function renderLayoutChips(){
  if(!slot) return;
  // 앞부분 고정(opts.fixed)이면 쪽마다 구성이 정해져 있어 고르지 않고 색만 (2026-11-05 QA — 구성을 누르면 글이 지워져 테마 바꾸기로 오해)
  $('dxLayoutBox').querySelector('h3').textContent = opts.fixed ? '색' : '구성';
  $('dxLayouts').hidden = !!opts.fixed;
  $('dxLayouts').innerHTML = opts.fixed ? '' : Object.entries(LAYOUTS).filter(([, l]) => l.kind === slot.kind && !l.fixed)
    .map(([id, l]) => `<button class="dx-chip ${id === state.layout ? 'on' : ''}" data-l="${id}" title="${l.sub}">${l.name}</button>`).join('');
  $('dxColors').innerHTML = (opts.fixed ? '' : '색 ') + Object.entries(THEMES).map(([id, t]) => `<button class="dx-dot ${id === state.theme ? 'on' : ''}" title="${t.name}" data-all="${id}" style="background:${t.dot}"></button>`).join('');
}

// 왼쪽 입력칸
const LONG = k => /^(title|lead|gtitle|gbody)$|d$/.test(k);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function presetBtn(k){
  const list = (PRESETS[state.layout] || {})[k];
  return list ? `<button type="button" class="dx-preset-btn" data-preset="${k}">추천 문구</button>` : '';
}
function renderForm(){
  const box = $('dxForm');
  if(mode !== 'A') return;
  if(isInfo()) return renderInfoForm();
  if(isLocked()){ box.innerHTML = '<p class="dx-note">매쓰홀릭이 준비한 고정 페이지예요. 다음 쪽부터 주제별 구성이 시작돼요. 따로 꾸미지 않아도 돼요.</p>'; return; }
  const objs = canvas.getObjects().filter(o => o.key);
  if(!objs.length){ box.innerHTML = '<p class="dx-note">빈 페이지는 [상세 편집]에서 글과 사진을 넣어요.</p>'; return; }
  box.innerHTML = objs.map(o => {
    const k = o.key;
    if(o.role === 'frame' || o.role === 'photo'){
      const ok = o.role === 'photo';
      return `<div class="dx-fld" data-k="${k}"><label>${o.label}</label><div class="dx-photo"><span class="st ${ok ? 'ok' : ''}">${ok ? '사진 들어감' : '비어 있음'}</span>
        <label class="dx-btn small" style="margin:0;">${ok ? '바꾸기' : '사진 올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-k="${k}"></label></div></div>`;
    }
    if(k === 'academy' && slot === book.first){
      const u = book.info.logoUrl;
      return `<div class="dx-fld"><label>로고 <small>올리지 않으면 학원명이 들어가요 · PNG 권장</small></label><div class="dx-photo">
        ${u ? `<img class="dx-thumb" alt="" src="${u}">` : '<span class="st">아직 없어요</span>'}
        <span class="dx-photo-act">${u ? '<button type="button" class="dx-link" data-clear="logoUrl">지우기</button>' : ''}<label class="dx-btn small" style="margin:0;">${u ? '바꾸기' : '올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-info-file="logoUrl"></label></span></div></div>`;
    }
    if(k === 'academy') return `<div class="dx-fld" data-k="${k}"><label>학원명 <small>[앞표지]에서 넣은 이름이 들어가요</small></label></div>`;
    return `<div class="dx-fld" data-k="${k}"><label>${o.label}${presetBtn(k)}</label><div class="dx-presets" data-for="${k}" hidden></div>` +
      (LONG(k) ? `<textarea data-k="${k}" rows="${k === 'gbody' ? 8 : /title/.test(k) ? 2 : 3}">${esc(o.text || '')}</textarea>` : `<input type="text" data-k="${k}" value="${esc(o.text || '')}">`) + '</div>';
  }).join('');
}
function renderInfoForm(){
  const i = book.info;
  // 올린 사진·로고는 글자('들어감') 대신 작은 썸네일로 보여줍니다
  const file = (k, label, hint) => `<div class="dx-fld"><label>${label} <small>${hint}</small></label><div class="dx-photo">
    ${i[k] ? `<img class="dx-thumb ${k === 'profileUrl' ? 'round' : ''}" alt="" src="${i[k]}">` : '<span class="st">아직 없어요</span>'}
    <span class="dx-photo-act">${i[k] ? `<button type="button" class="dx-link" data-clear="${k}">지우기</button>` : ''}<label class="dx-btn small" style="margin:0;">${i[k] ? '바꾸기' : '올리기'}<input type="file" accept="image/png,image/jpeg" hidden data-info-file="${k}"></label></span></div></div>`;
  if(cur === 1){
    $('dxForm').innerHTML = `
    <div class="dx-fld"><label>원장명</label><input type="text" data-info="director" value="${esc(i.director)}" placeholder="예: 김홀릭"></div>
    ${file('profileUrl', '원장님 프로필 사진', '얼굴이 가운데 오는 사진')}
    <p class="dx-note">아래 맺음말은 4~5p 인사말의 마지막 문장이 들어가요. 오른쪽은 대략적인 모습이고, 정확한 배치는 다음 단계 미리보기에서 확인할 수 있어요.</p>`;
    return;
  }
  $('dxForm').innerHTML = `
    <div class="dx-fld"><label>학원명</label><input type="text" data-info="academy" value="${esc(i.academy)}" placeholder="예: 홀릭수학학원"></div>
    <div class="dx-fld"><label>표지 문구 <small>앞표지</small></label>
      <p class="dx-hint">비워두면 '학원명 + BRANDBOOK'이 들어가요. 직접 쓰실 땐 두 줄로 써 주세요(첫 줄 얇은 글씨, 둘째 줄 굵은 글씨).</p>
      <textarea data-info="cover" rows="2" placeholder="예: 생각하는 힘을 키우는&#10;홀릭수학학원">${esc(i.cover)}</textarea></div>
    <p class="dx-note">표지는 STEP 1에서 고른 디자인으로 보여드려요. 오른쪽은 대략적인 모습이고, 정확한 배치는 다음 단계 미리보기에서 확인할 수 있어요.</p>`;
}
// 사진·로고를 올리거나 지운 뒤: 표지면 표지를 다시 그리고, 3p(로고)면 페이지에 넣고 편집함으로 기록
async function afterInfoFile(){
  if(isInfo()){ renderInfoForm(); redrawInfo(); }
  else{ await fillAuto(canvas); canvas.requestRenderAll(); pushHistory(); }
  opts.onChange && opts.onChange(); renderStrip();
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
  if(!o || o.type === 'activeSelection'){ el.innerHTML = '<h3>선택한 것</h3><p class="dx-note">캔버스에서 글이나 사진을 누르거나 왼쪽 레이어에서 고르면, 여기서 크기·색·순서를 바꿀 수 있어요.</p><h3>사용법</h3><p class="dx-note">글은 두 번 눌러 고치고, 모서리를 끌어 크기를 바꿔요. 지우기는 Delete 키, 되돌리기는 ⌘Z예요.</p>'; return; }
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
  if(isInfo()) m = 'A';
  mode = m;
  $('dxEditor').dataset.mode = m;
  $('dxEditor').dataset.info = isInfo() ? '1' : '';
  document.querySelectorAll('#dxTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  canvas.discardActiveObject();
  setMsg(isInfo() ? (cur === 0 ? '학원명을 넣으면 앞표지에 바로 반영돼요.' : '원장명을 넣으면 안쪽 표지에 바로 반영돼요.')
    : m === 'A' ? (opts.fixed ? '' : '구성을 고르고 ') + '왼쪽 칸을 채우면 바로 반영돼요. 페이지의 글을 누르면 해당 칸으로 가요.'
    : '끌어서 옮기고, 모서리를 끌어 크기를 바꿔요. 글은 두 번 눌러 고쳐요.');
  refreshUI();
  fitCanvas();
}

// 앞부분은 모든 페이지가 책에 들어감(opts.fixed — 2026-11-05: 10p 고정). 그중 직접 써야 하는 것(필수)은
// 학원 기본 정보(학원명·원장명) + 3p 학원 소개 + 인사말 펼침면(안쪽 표지 맺음말에도 쓰임).
// 나머지는 추천 문구가 채워진 채로 들어가고, 고치면 '완료'로 표시됩니다.
const requiredList = () => [0, 1, INFO_N, ...pagesOf().map((s, i) => (i > INFO_N && s.layout === 'greeting') ? i : -1).filter(i => i > 0)];
const isRequired = i => requiredList().includes(i);
const isDone = i => i === 0 ? !!book.info.academy.trim() : i === 1 ? !!book.info.director.trim() : !!pagesOf()[i].saved;   // 표1 = 학원명, 표2 = 원장명
// ✓ 표시: 꼭 써야 하는 페이지는 채웠을 때, 나머지는 한 번 열어 봤을 때(추천 문구 그대로여도 됨)
const visited = () => (book._visited = book._visited || []);
const isClear = i => isRequired(i) ? isDone(i) : (visited().includes(i) || !!(pagesOf()[i] || {}).saved);
const allClear = () => pagesOf().every((s, i) => isClear(i));
function missingRequired(){ return requiredList().find(i => !isDone(i)); }

// 아래 줄: 기본 정보 + 앞부분 페이지 (펼침면 빼기·더하기)
const stripCache = new WeakMap();
async function stripThumb(s){
  const { academy, logoUrl } = getAuto();
  const key = `${s.layout}|${s.theme}|${s.saved || ''}|${academy}|${s === book.first && logoUrl ? logoUrl.length : 0}`;
  const c = stripCache.get(s);
  if(c && c.key === key) return c.p;
  const p = renderPages(s, { ppi:22, quality:0.75 });
  stripCache.set(s, { key, p });
  return p;
}
// 표1·표2 썸네일: 입력한 학원명·표지 문구가 들어간 모습
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
  const max = opts.maxSpreads || 4;
  const items = pages.map((s, i) => `<div class="dx-st ${i === cur ? 'on' : ''} ${s.info ? 'single' : s.kind}" data-go="${i}">
      <div class="dx-st-img" data-thumb="${i}"></div>
      <div class="dx-st-cap">${labelsAt(i).join('~')}<b>${nameAt(i)}</b></div>
      ${isClear(i) ? '<span class="dx-st-done" title="확인함">✓</span>' : ''}
      ${s.kind === 'spread' && !opts.fixed ? `<button type="button" class="dx-st-del" data-del="${i}" title="이 펼침면 빼기">✕</button>` : ''}
    </div>`);
  if(!opts.fixed && book.spreads.length < max) items.splice(items.length - 1, 0, `<button type="button" class="dx-st-add" id="dxAddSpread">+ 펼침면<br><small>2쪽 추가</small></button>`);
  // 아래 줄은 썸네일 + 쪽·이름만(2026-11-05 QA — '필수/추천 문구/고정' 표시와 진행 줄이 복잡해 뺌). 꾸민 페이지는 ✓만.
  // 꼭 써야 하는 페이지는 [완료]를 누를 때 그 페이지로 옮겨 안내함(missingRequired)
  $('dxStrip').innerHTML = `<div class="dx-strip-row">${items.join('')}</div>`;
  // [완료]는 모든 칸을 확인했을 때 채운 색으로 (그 전에는 흰 버튼 — 누르면 남은 페이지로 안내)
  $('dxDone').classList.toggle('ready', allClear());
  $('dxStrip').querySelectorAll('[data-thumb]').forEach(async el => {
    const i = +el.dataset.thumb;
    const urls = i < INFO_N ? [await infoThumb(i)] : await stripThumb(pages[i]);
    if(el.isConnected) el.innerHTML = urls.map(u => `<img alt="" src="${u}">`).join('');
  });
}
// 지금 페이지를 책에 저장 (편집했을 때만)
function commit(){
  if(!slot || isInfo() || isLocked()) return;
  if(history.length > 1 || slot.saved){ slot.saved = snapshot(); slot.layout = state.layout; slot.theme = state.theme; }
}
async function goTo(i){
  commit();
  cur = i;
  if(!visited().includes(i)) visited().push(i);
  const s = pagesOf()[i];
  slot = s.info ? null : s;
  g = s.info ? INFO_GEOM : geom(s.kind, s.side);
  $('dxTitle').innerHTML = `우리 학원 소개하기<small>${labelsAt(i).join(' · ')} · ${esc(nameAt(i))}</small>`;
  $('dxLabels').innerHTML = s.info ? '' : labelsAt(i).map(l => `<span>${l}</span>`).join('');
  const lock = !s.info && isFixed(s);
  $('dxLayoutBox').hidden = $('dxDetailBox').hidden = !!s.info || lock;
  $('dxTabs').style.visibility = s.info || lock ? 'hidden' : '';
  $('dxFormTitle').textContent = s.info ? (i === 0 ? '앞표지' : '안쪽 표지') : lock ? nameAt(i) : '내용 입력';   // 고정 페이지는 꼭지명(쉬어 가는 페이지)
  $('dxStageNote').textContent = s.info ? '표지 글자는 대략적인 모습이에요.' : '';
  userZoom = 1;
  canvas.setBackgroundImage(null); canvas.setDimensions({ width:g.W * zoom, height:g.H * zoom }); canvas.setZoom(zoom);
  history = []; future = [];
  if(s.info){ await drawInfo(canvas, book.info, opts.cover, opts.cv, opts.base || 'brandbook/', s.info); }
  else if(lock){ canvas.clear(); canvas.backgroundColor = '#fff'; state.layout = slot.layout; canvas.add(await fixedImage(slot, g)); canvas.requestRenderAll(); }
  else if(slot.saved){ await restore(slot.saved); await fillAuto(canvas); history = [snapshot()]; }
  else await applyLayout(slot.layout, slot.theme, false);
  setMode('A');
  renderLayoutChips();
  renderStrip();
  if(allClear()) setMsg('모두 확인했어요. 오른쪽 위 [완료]를 눌러 주세요.');
}

// 사진: 사진 칸(또는 넣어 둔 사진)이 골라져 있으면 그 크기에 맞춰 가운데를 잘라 넣고, 없으면 가로 80mm로 넣습니다.
function placePhoto(file, target){
  const reader = new FileReader();
  reader.onload = () => fabric.Image.fromURL(reader.result, img => {
    const iw = img.width, ih = img.height;
    const fits = target && (target.role === 'frame' || target.role === 'photo');
    const box = fits ? { x:target.left, y:target.top, w:target.getScaledWidth(), h:target.getScaledHeight() }
                     : { x:at(g).L + 20, y:60, w:80, h:80 * ih / iw };
    const s = Math.max(box.w / iw, box.h / ih);
    const cw = box.w / s, ch = box.h / s;
    img.set({ left:box.x, top:box.y, cropX:(iw - cw) / 2, cropY:(ih - ch) / 2, width:cw, height:ch, scaleX:s, scaleY:s, role:'photo',
      key:fits ? target.key : undefined, label:fits ? target.label : undefined, lockSkewingX:true, lockSkewingY:true });
    img.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false });
    if(fits){ canvas.insertAt(img, canvas.getObjects().indexOf(target)); canvas.remove(target); }
    else canvas.add(img);
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

function bind(){
  window.addEventListener('resize', () => { if(isOpen()) fitCanvas(); });
  // 아래 줄 썸네일이 늦게 채워져 무대 높이가 바뀌어도 다시 맞춤(처음 열 때 표지 아래가 잘렸음)
  if(window.ResizeObserver) new ResizeObserver(() => { if(isOpen() && g) fitCanvas(); }).observe($('dxStage'));
  canvas.on('mouse:down', ({ target }) => {
    if(mode !== 'A' || !target || !target.key) return;
    const f = document.querySelector(`#dxForm .dx-fld[data-k="${target.key}"]`); if(!f) return;
    f.scrollIntoView({ block:'nearest', behavior:'smooth' });
    const inp = f.querySelector('input[type=text], textarea'); if(inp) inp.focus();
    f.classList.add('flash'); setTimeout(() => f.classList.remove('flash'), 900);
  });
  canvas.on('after:render', ({ ctx }) => {
    if(!showGuides || !ctx || !g || isInfo()) return;
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
  ['object:added', 'object:removed'].forEach(ev => canvas.on(ev, () => { if(!muted) renderLayers(); }));
  ['selection:created', 'selection:updated', 'selection:cleared'].forEach(e => canvas.on(e, () => { renderProps(); renderLayers(); }));
  canvas.on('object:moving', renderProps); canvas.on('object:scaling', renderProps);

  $('dxLayouts').onclick = e => { const b = e.target.closest('[data-l]'); if(b && b.dataset.l !== state.layout) applyLayout(b.dataset.l, state.theme); };
  $('dxColors').onclick = e => { const b = e.target.closest('[data-all]'); if(b){ applyTheme(b.dataset.all); pushHistory(); } };
  $('dxForm').addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.info){ book.info[t.dataset.info] = t.value.trim() ? t.value : ''; redrawInfo(); opts.onChange && opts.onChange(); if(t.dataset.info !== 'cover') renderStrip(); return; }
    const k = t.dataset.k; if(!k || t.type === 'file') return;
    const o = byKey(k, canvas); if(o && o.type === 'textbox'){ o.set('text', t.value); canvas.requestRenderAll(); }
  });
  $('dxForm').addEventListener('change', async e => {
    const t = e.target;
    if(t.dataset.infoFile){ if(t.files[0]){ book.info[t.dataset.infoFile] = await readUrl(t.files[0]); await afterInfoFile(); } return; }
    const k = t.dataset.k; if(!k || t.dataset.info) return;
    if(t.type === 'file'){ if(t.files[0]) placePhoto(t.files[0], byKey(k, canvas)); }
    else{ history.push(snapshot()); future = []; renderTop(); }   // 입력 중에는 칸을 다시 그리지 않도록 기록만
  });
  $('dxForm').addEventListener('click', e => {
    const clr = e.target.closest('[data-clear]');
    if(clr){ book.info[clr.dataset.clear] = null; afterInfoFile(); return; }
    const pb = e.target.closest('[data-preset]');
    if(pb){
      const k = pb.dataset.preset, box = document.querySelector(`#dxForm .dx-presets[data-for="${k}"]`);
      box.hidden = !box.hidden;
      box.innerHTML = PRESETS[state.layout][k].map((t, i) => `<button type="button" class="dx-preset" data-k="${k}" data-pi="${i}">${esc(t).replace(/\n/g, ' / ')}</button>`).join('');
      return;
    }
    const pi = e.target.closest('.dx-preset');
    if(pi){
      const k = pi.dataset.k, v = PRESETS[state.layout][k][+pi.dataset.pi];
      const o = byKey(k, canvas); if(o){ o.set('text', v); canvas.requestRenderAll(); pushHistory(); }
      setMsg('추천 문구를 넣었어요. 칸에서 우리 학원에 맞게 고쳐 쓰셔도 돼요.');
    }
  });
  $('dxStrip').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if(del){
      const s = pagesOf()[+del.dataset.del];
      if(s.saved && !confirm('이 펼침면에 꾸민 내용이 있어요. 빼면 지워져요. 뺄까요?')) return;
      const wasCur = +del.dataset.del === cur;
      if(!wasCur) commit();
      book.spreads.splice(book.spreads.indexOf(s), 1);
      opts.onChange && opts.onChange();
      if(wasCur){ slot = null; goTo(Math.min(cur, pagesOf().length - 1)); }
      else{ cur = pagesOf().indexOf(slot) >= 0 ? pagesOf().indexOf(slot) : cur; renderStrip(); }
      return;
    }
    if(e.target.closest('#dxAddSpread')){
      commit();
      const used = book.spreads.map(s => s.layout);
      const layout = (opts.spreadOrder || []).find(l => !used.includes(l)) || 'blank';
      book.spreads.push({ kind:'spread', layout, theme:'clean', saved:null });
      opts.onChange && opts.onChange();
      return goTo(book.spreads.length);   // 새 펼침면으로 이동
    }
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
  $('dxEditor').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if(!b || b.tagName === 'INPUT') return;
    const a = b.dataset.a, o = sel();
    if(a === 'undo') return undo();
    if(a === 'redo') return redo();
    if(a === 'guides'){ showGuides = !showGuides; canvas.requestRenderAll(); return renderTop(); }
    if(a === 'zoom+' || a === 'zoom-' || a === 'zoomfit'){
      userZoom = a === 'zoomfit' ? 1 : Math.min(3, Math.max(0.5, userZoom + (a === 'zoom+' ? 0.25 : -0.25)));
      fitCanvas(); return renderTop();
    }
    if(!o) return;
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
  $('dxToDetail').onclick = () => setMode('B');
  $('dxPhoto').addEventListener('change', e => { if(e.target.files[0]) placePhoto(e.target.files[0], sel()); e.target.value = ''; });
  $('dxAddTitle').onclick = () => addObj(text('제목을 입력하세요', at(g).L + 10, 40, 120, 7, { fontWeight:700 }));
  $('dxAddBody').onclick = () => addObj(text('내용을 입력하세요. 두 번 누르면 글을 고칠 수 있어요.', at(g).L + 10, 60, 120, 3.6, { fill:C.body, lineHeight:1.6 }));
  $('dxAddFrame').onclick = () => addObj(frame(at(g).L + 20, 80, 100, 70));
  $('dxDone').onclick = async () => {
    canvas.discardActiveObject();
    commit();
    const miss = missingRequired();
    if(miss != null){
      if(miss !== cur) await goTo(miss);
      return setMsg(miss === 0 ? '학원명을 넣어 주세요. 앞표지와 페이지 곳곳에 들어가요.'
        : miss === 1 ? '원장명을 넣어 주세요. 안쪽 표지에 들어가요.'
        : miss === INFO_N ? '3p 학원 소개는 꼭 꾸며 주세요. 예시 문구를 고치거나 [추천 문구]를 골라도 돼요.'
        : '인사말은 꼭 써 주세요. 마지막 문장은 안쪽 표지에도 들어가요. [추천 문구]를 골라 고쳐 써도 돼요.', true);
    }
    // 아직 안 연 페이지가 있으면 그 페이지로 한 번 안내(한 번 더 누르면 닫힘 — 안 고친 페이지는 추천 문구로 들어감)
    const unseen = pagesOf().findIndex((x, i) => !isClear(i));
    if(unseen >= 0 && !doneAsked){
      doneAsked = true;
      if(unseen !== cur) await goTo(unseen);
      return setMsg('아직 확인하지 않은 페이지예요. 고치지 않으면 추천 문구로 들어가요. 그대로 마치려면 [완료]를 한 번 더 눌러 주세요.', true);
    }
    doneAsked = false;
    $('dxModal').classList.remove('show');
    opts.onClose && opts.onClose({ complete:true });
  };
}

async function openBook(b, o = {}){
  book = b; opts = o;
  mount();
  $('dxModal').classList.add('show');
  await loadFonts();
  await Promise.all(['100 10px DxSuit', '200 10px DxSuit', '300 10px DxSuit', '600 10px DxSuit'].map(f => document.fonts.load(f)));
  slot = null; cur = 0;
  await goTo(o.start || 0);
}

window.DiyEditor = {
  BLEED, PAGE_W, PAGE_H, PRINT_PPI, LAYOUTS, THEMES, geom,
  setBook(b){ book = b; },
  openBook, renderPages, greetingText,
  requiredDone: () => book ? missingRequired() == null : false,
};
})();
