// 네이버 예약 알림 이메일 파서 (3 이벤트 지원)
//
// 제목 패턴:
//   1) "[네이버 예약] ... 새로운 예약이 접수 되었습니다."
//        → eventType=created, newReservation 채워짐
//   2) "[네이버 예약] ... 고객님이 예약을 취소하셨습니다."
//        → eventType=canceled, canceledReservation + cancelReason 채워짐
//   3) "[네이버 예약] ... 고객님이 예약을 변경 하셨습니다."
//        → eventType=changed, newReservation + canceledReservation 모두 채워짐 (서로 다른 예약번호)
//
// 본문 구조: 라벨-값 쌍이 줄 단위. 변경 메일은 두 섹션 존재:
//   "신규예약내역" → 새 번호
//   "예약취소내역" → 기존 번호 (취소됨)
// 취소 메일은 "예약취소내역" 만 존재. 접수 메일은 "예약내역" 섹션 (플랫 구조).

export type NaverBookingEventType = "created" | "canceled" | "changed";

export interface ParsedReservationItem {
  externalReservationId: string;
  reservationAt: Date;
  productName?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  expectedAmount?: string;
  requests?: string;
}

export interface NaverBookingEmailParsed {
  eventType: NaverBookingEventType;
  patientName: string;
  submittedAt?: Date;
  changedAt?: Date;
  canceledAt?: Date;
  cancelReason?: string;
  /** created / changed 의 신규 예약 */
  newReservation?: ParsedReservationItem;
  /** canceled / changed 의 취소 예약 */
  canceledReservation?: ParsedReservationItem;
  confidence: number;
  warnings: string[];
  raw: {
    subject?: string;
    from?: string;
    bodyExcerpt: string;
  };
}

const VALID_FROM = /naverbooking(_noreply)?@navercorp\.com/i;

function detectEvent(subject: string | undefined): NaverBookingEventType | null {
  if (!subject) return null;
  // "새로운 예약이 접수 되었습니다" (관리자 확인 모드) 또는
  // "새로운 예약이 확정 되었습니다" (즉시 확정 모드) 둘 다 created 로 처리.
  if (/새로운\s*예약.*(접수|확정)/.test(subject)) return "created";
  if (/예약을?\s*취소/.test(subject)) return "canceled";
  if (/예약을?\s*변경/.test(subject)) return "changed";
  return null;
}

function normalize(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n");
}

/** anchor 라벨 다음부터 다음 anchor 또는 끝까지 블록 잘라냄. */
function extractSection(text: string, anchor: RegExp, nextAnchors: RegExp[]): string | null {
  const m = anchor.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  let end = text.length;
  for (const n of nextAnchors) {
    const clone = new RegExp(n.source, n.flags.includes("g") ? n.flags : n.flags + "g");
    clone.lastIndex = start;
    const nm = clone.exec(text);
    if (nm && nm.index < end) end = nm.index;
  }
  return text.slice(start, end);
}

function pickLabel(section: string, label: string): string | undefined {
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `${safe}\\s*[:：]?\\s*([^\\n]*?)(?=\\s*(?:예약자명|예약신청\\s*일시|예약변경\\s*일시|예약취소\\s*일시|예약번호|예약상품|이용일시|결제상태|결제수단|환불금액|환불수수료|결제예상금액|매장방문결제|취소사유|요청사항|자세히\\s*보기|스마트플레이스|$))`,
    "su",
  );
  const m = section.match(re);
  if (!m) return undefined;
  return m[1]!.trim().replace(/\s+/g, " ") || undefined;
}

function parseKoreanDateTime(s: string): Date | null {
  const full = s.match(
    /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?\s*(?:\([가-힣]\))?\s*(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})(?::(\d{2}))?/,
  );
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]) - 1;
    const day = Number(full[3]);
    let hour = Number(full[5]);
    const minute = Number(full[6]);
    const sec = Number(full[7] ?? "0");
    const mark = full[4];
    if (mark === "오후" && hour < 12) hour += 12;
    if (mark === "오전" && hour === 12) hour = 0;
    const d = new Date(year, month, day, hour, minute, sec);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseItem(section: string): ParsedReservationItem | null {
  const no = pickLabel(section, "예약번호");
  const useAt = pickLabel(section, "이용일시");
  if (!no || !useAt) return null;
  const d = parseKoreanDateTime(useAt);
  if (!d) return null;
  return {
    externalReservationId: `naver_rsv_${no}`,
    reservationAt: d,
    productName: nullEmpty(pickLabel(section, "예약상품")),
    paymentStatus: nullEmpty(pickLabel(section, "결제상태")),
    paymentMethod: nullEmpty(pickLabel(section, "결제수단")),
    expectedAmount: nullEmpty(pickLabel(section, "결제예상금액")),
    requests: nullEmpty(pickLabel(section, "요청사항")),
  };
}

function nullEmpty(v: string | undefined): string | undefined {
  if (!v) return undefined;
  if (v.trim() === "-") return undefined;
  return v;
}

export function parseNaverBookingEmail(opts: {
  subject?: string;
  body: string;
  from?: string;
}): NaverBookingEmailParsed | null {
  const warnings: string[] = [];
  const eventType = detectEvent(opts.subject);
  if (!eventType) return null;

  if (opts.from && !VALID_FROM.test(opts.from)) {
    warnings.push(`발신자 도메인 미일치: ${opts.from}`);
  }

  const text = normalize(opts.body);
  const nameRaw = pickLabel(text, "예약자명");
  const patientName = nameRaw?.replace(/님\s*$/, "").trim();
  if (!patientName) {
    warnings.push("예약자명 미추출");
    return null;
  }

  const submittedAt = parseKoreanDateTime(pickLabel(text, "예약신청 일시") ?? "") ?? undefined;
  const changedAt = parseKoreanDateTime(pickLabel(text, "예약변경 일시") ?? "") ?? undefined;
  const canceledAt = parseKoreanDateTime(pickLabel(text, "예약취소 일시") ?? "") ?? undefined;
  const cancelReason = nullEmpty(pickLabel(text, "취소사유"));

  let newReservation: ParsedReservationItem | undefined;
  let canceledReservation: ParsedReservationItem | undefined;

  if (eventType === "created") {
    newReservation = parseItem(text) ?? undefined;
    if (!newReservation) warnings.push("신규 예약 필드 추출 실패");
  } else if (eventType === "canceled") {
    const section = extractSection(text, /예약취소내역/, [/자세히\s*보기/, /스마트플레이스/]);
    canceledReservation = (section ? parseItem(section) : parseItem(text)) ?? undefined;
    if (!canceledReservation) warnings.push("취소 예약 필드 추출 실패");
  } else if (eventType === "changed") {
    const newSec = extractSection(text, /신규예약내역/, [/예약취소내역/, /자세히\s*보기/, /스마트플레이스/]);
    const canSec = extractSection(text, /예약취소내역/, [/예약확정\s*하러\s*가기/, /자세히\s*보기/, /스마트플레이스/]);
    if (newSec) newReservation = parseItem(newSec) ?? undefined;
    if (canSec) canceledReservation = parseItem(canSec) ?? undefined;
    if (!newReservation) warnings.push("변경 메일 — 신규예약내역 추출 실패");
    if (!canceledReservation) warnings.push("변경 메일 — 예약취소내역 추출 실패");
  }

  let confidence = 1.0 - 0.1 * warnings.length;
  if (!opts.from) confidence -= 0.05;
  if (!opts.subject) confidence -= 0.05;
  confidence = Math.max(0.3, Math.min(1.0, confidence));

  return {
    eventType,
    patientName,
    submittedAt,
    changedAt,
    canceledAt,
    cancelReason,
    newReservation,
    canceledReservation,
    confidence,
    warnings,
    raw: {
      subject: opts.subject,
      from: opts.from,
      bodyExcerpt: text.slice(0, 200),
    },
  };
}
