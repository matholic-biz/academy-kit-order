/**
 * 학원맞춤키트 신청 페이지 - PDF 이메일 자동 발송용 구글 앱스 스크립트
 *
 * [배포 방법]
 * 1) https://script.google.com 접속 (회사 구글/Gmail 계정으로 로그인)
 * 2) 새 프로젝트 생성 -> 기본 Code.gs 내용을 지우고 이 파일 내용 전체를 붙여넣기
 * 3) 아래 PRINT_VENDOR_EMAIL, SHARED_SECRET 값을 실제 값으로 수정
 * 4) 저장 -> 우측 상단 "배포" -> "새 배포"
 *      - 유형 선택(톱니바퀴): 웹 앱
 *      - 설명: 아무거나 (예: academy-kit-order)
 *      - 실행 계정: 나 (Me)
 *      - 액세스 권한이 있는 사용자: 모든 사용자 (Anyone)
 *    -> 배포 클릭 -> 처음 실행 시 권한 승인 팝업이 뜨면 회사 계정으로 허용
 * 5) 배포 완료 후 나오는 "웹 앱 URL"을 복사
 * 6) index.html 안의 GAS_WEBHOOK_URL 상수에 그 URL을 붙여넣기
 *    (GAS_SHARED_SECRET 값도 아래 SHARED_SECRET과 반드시 동일하게 맞추기)
 *
 * [주의]
 * - "액세스 권한: 모든 사용자"로 설정하면 이 URL을 아는 누구나 호출할 수 있습니다.
 *   그래서 SHARED_SECRET(암호)을 함께 확인해서, 우리 신청 페이지에서 온 요청만 처리하도록 막아둡니다.
 * - PDF는 base64로 인코딩되어 전달되며, MailApp 첨부파일 용량 한도는 약 25MB입니다.
 * - 개인 Gmail 계정은 하루 발송 가능 메일 수에 제한이 있습니다(대략 100통/일).
 *   회사 Google Workspace 계정으로 배포하면 한도가 더 넉넉합니다.
 */

var PRINT_VENDOR_EMAIL = 'PRINT_VENDOR_EMAIL_여기에_실제_인쇄업체_이메일_입력'; // TODO: 실제 인쇄업체 이메일로 교체
var SHARED_SECRET = 'academy-kit-2026'; // TODO: index.html의 GAS_SHARED_SECRET과 동일하게 맞추기

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== SHARED_SECRET) {
      return jsonOutput({ status: 'error', message: '허용되지 않은 요청입니다.' });
    }
    if (!data.pdfBase64) {
      return jsonOutput({ status: 'error', message: 'PDF 데이터가 없습니다.' });
    }

    var fileName = data.fileName || '학원맞춤키트.pdf';
    var pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(data.pdfBase64),
      'application/pdf',
      fileName
    );

    var academyName = data.academyName || '(학원명 미입력)';
    var subject = '[학원맞춤키트 신청] ' + academyName;
    var bodyLines = [
      '학원맞춤키트 신청이 접수되었습니다.',
      '',
      '학원명: ' + (data.academyName || ''),
      '담당자: ' + (data.manager || ''),
      '연락처: ' + (data.phone || ''),
      '신청자 이메일: ' + (data.email || ''),
      '희망 부수: ' + (data.qty || ''),
      '배송 주소: ' + (data.address || ''),
      '',
      '첨부된 PDF를 확인해 인쇄를 진행해주세요.',
    ];

    var mailOptions = {
      to: PRINT_VENDOR_EMAIL,
      subject: subject,
      body: bodyLines.join('\n'),
      attachments: [pdfBlob],
      name: 'MATHOLIC 학원맞춤키트',
    };
    // 신청자 이메일이 유효한 형식이면 참조로 함께 보내기
    if (data.email && /.+@.+\..+/.test(data.email)) {
      mailOptions.cc = data.email;
    }

    MailApp.sendEmail(mailOptions);

    return jsonOutput({ status: 'ok' });
  } catch (err) {
    return jsonOutput({ status: 'error', message: String(err) });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
