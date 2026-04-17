// 네이버 예약 알림 이메일 파서
//
// 대상 이메일 예시:
//   From: naverbooking_noreply@navercorp.com
//   Subject: [네이버 예약] 의성한방병원 새로운 예약이 접수 되었습니다.
//   Body (text 또는 html-stripped):
//     예약자명 한*우님
//     예약신청 일시 2026.04.17. 17:14:41
//     예약번호 1211203147
//     예약상품 통원치료 예약
//     이용일시 2026.04.18.(토) 오후 4:00
//     결제상태 -
//     결제수단 -
//     결제예상금액 0원
//     요청사항 -
//
// 파싱 규칙:
//   - 각 필드는 "라벨 값" 형태로 한 줄에 있거나 바로 뒤 줄에 있음.
//   - 공백/탭/줄바꿈은 단일 공백으로 정규화 후 regex 적용.
//   - 이용일시: "YYYY.MM.DD.(요일) 오전|오후 HH:MM" → Date.
//   - 예약자명 끝의 '님' 제거, 이름은 이미 마스킹(*)되어 있음.
//   - 예약번호 = externalReservationId (dedupe key).
//   - 파싱 실패 필드는 confidence 낮추고 warnings 에 수집.

export interface NaverBookingEmailParsed {
  externalReservationId: string;
  patientName: string;
  reservationAt: Date;
  submittedAt?: Date;
  productName?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  expectedAmount?: string;
  requests?: string;
  confidence: number;
  warnings: string[];
  raw: {
    subject?: string;
    from?: string;
    bodyExcerpt: string;
  };
}

const VALID_FROM = /naverbooking(_noreply)?@navercorp\.com/i;
const SUBJECT_PATTERN = /\[네이버\s*예약\].*새로운\s*예약.*접수/;

function pickLabel(text: string, label: string): string | undefined {
  // 라벨 + 공백(또는 줄바꿈) + 값(다음 라벨/빈줄 전까지).
  // 여러 라인에 걸쳐 있을 수 있어 DOTALL 로.
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 라벨 바로 뒤 공백(+개행) 후 값 — 다음 라벨(한글 2~6자 + 공백) 또는 두 줄 개행 전까지.
  const re = new RegExp(`${safe}\\s*[:：]?\\s*([^\\n]*?)(?=\\s*(?:예약자명|예약신청\\s*일시|예약번호|예약상품|이용일시|결제상태|결제수단|결제예상금액|요청사항|$))`, "su");
  const m = text.match(re);
  if (!m) return undefined;
  return m[1]!.trim().replace(/\s+/g, " ") || undefined;
}

function parseUseDate(s: string): { date: Date | null; warnings: string[] } {
  const warnings: string[] = [];
  // 예: "2026.04.18.(토) 오후 4:00" / "2026-04-18 16:00"
  // 1) 한국어 포맷
  const m = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?\s*(?:\([가-힣]\))?\s*(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    let hour = Number(m[5]);
    const minute = Number(m[6]);
    const mark = m[4];
    if (mark === "오후" && hour < 12) hour += 12;
    if (mark === "오전" && hour === 12) hour = 0;
    const d = new Date(year, month, day, hour, minute, 0);
    if (!isNaN(d.getTime())) return { date: d, warnings };
  }
  // 2) ISO-ish fallback
  const iso = new Date(s.replace(/\./g, "-"));
  if (!isNaN(iso.getTime())) return { date: iso, warnings };
  warnings.push(`이용일시 파싱 실패: "${s}"`);
  return { date: null, warnings };
}

function parseSubmittedAt(s: string): Date | undefined {
  // 예: "2026.04.17. 17:14:41"
  const m = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? "0"));
  return isNaN(d.getTime()) ? undefined : d;
}

export function parseNaverBookingEmail(opts: {
  subject?: string;
  body: string;
  from?: string;
}): NaverBookingEmailParsed | null {
  const warnings: string[] = [];
  if (opts.from && !VALID_FROM.test(opts.from)) {
    warnings.push(`발신자 도메인 미일치: ${opts.from}`);
  }
  if (opts.subject && !SUBJECT_PATTERN.test(opts.subject)) {
    warnings.push(`제목 패턴 미일치: ${opts.subject}`);
  }

  // HTML tag 간단 제거 + 공백 정규화 (이미 text 라도 안전)
  const text = opts.body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n");

  const nameRaw = pickLabel(text, "예약자명");
  const patientName = nameRaw?.replace(/님\s*$/, "").trim();
  const reservationNo = pickLabel(text, "예약번호");
  const productName = pickLabel(text, "예약상품");
  const useAtRaw = pickLabel(text, "이용일시");
  const submittedAtRaw = pickLabel(text, "예약신청 일시");
  const paymentStatus = pickLabel(text, "결제상태");
  const paymentMethod = pickLabel(text, "결제수단");
  const expectedAmount = pickLabel(text, "결제예상금액");
  const requests = pickLabel(text, "요청사항");

  if (!patientName) warnings.push("예약자명 미추출");
  if (!reservationNo) warnings.push("예약번호 미추출 — dedupe key 없음");
  if (!useAtRaw) warnings.push("이용일시 미추출 — 필수 필드 누락");

  // 필수 필드 부재 시 null
  if (!patientName || !reservationNo || !useAtRaw) return null;

  const { date: reservationAt, warnings: useWarn } = parseUseDate(useAtRaw);
  warnings.push(...useWarn);
  if (!reservationAt) return null;

  const submittedAt = submittedAtRaw ? parseSubmittedAt(submittedAtRaw) : undefined;

  // confidence: 필드별 가중치
  let confidence = 1.0;
  if (warnings.length > 0) confidence -= 0.1 * warnings.length;
  if (!opts.from) confidence -= 0.05;
  if (!opts.subject) confidence -= 0.05;
  confidence = Math.max(0.3, Math.min(1.0, confidence));

  return {
    externalReservationId: `naver_rsv_${reservationNo}`,
    patientName,
    reservationAt,
    submittedAt,
    productName: productName === "-" ? undefined : productName,
    paymentStatus: paymentStatus === "-" ? undefined : paymentStatus,
    paymentMethod: paymentMethod === "-" ? undefined : paymentMethod,
    expectedAmount: expectedAmount === "-" ? undefined : expectedAmount,
    requests: requests === "-" ? undefined : requests,
    confidence,
    warnings,
    raw: {
      subject: opts.subject,
      from: opts.from,
      bodyExcerpt: text.slice(0, 200),
    },
  };
}
