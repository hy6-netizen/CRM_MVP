// Hospital Ops Hub 초기 데이터 seed.
//
// 실행: `pnpm --filter @hub/db seed`
//
// 전제:
// - DATABASE_URL 설정됨
// - `pnpm --filter @hub/db prisma migrate dev` 로 스키마 마이그레이션 완료
//
// 이 seed 는 idempotent — 여러 번 실행해도 안전. upsert 기반.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const hoursAgo = (h: number) => minutesAgo(h * 60);
const inHours = (h: number) => new Date(now.getTime() + h * 60 * 60_000);

async function main() {
  console.log("[seed] 시작");

  // ─── Users ───
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@uskmh.kr" },
      update: {},
      create: { id: "u_admin", name: "원장", email: "admin@uskmh.kr", role: "admin" },
    }),
    prisma.user.upsert({
      where: { email: "mgr@uskmh.kr" },
      update: {},
      create: { id: "u_mgr", name: "이매니저", email: "mgr@uskmh.kr", role: "manager" },
    }),
    prisma.user.upsert({
      where: { email: "staff1@uskmh.kr" },
      update: {},
      create: { id: "u_staff1", name: "박상담", email: "staff1@uskmh.kr", role: "staff" },
    }),
    prisma.user.upsert({
      where: { email: "staff2@uskmh.kr" },
      update: {},
      create: { id: "u_staff2", name: "정데스크", email: "staff2@uskmh.kr", role: "staff" },
    }),
    prisma.user.upsert({
      where: { email: "rev@uskmh.kr" },
      update: {},
      create: { id: "u_rev", name: "최리뷰", email: "rev@uskmh.kr", role: "reviewer" },
    }),
  ]);
  console.log(`[seed] users: ${users.length}`);

  // ─── Templates ───
  const templates: { code: string; channel: string; intent: string; title: string; body: string; enabled: boolean; requiresHumanReview: boolean; complianceLevel: string }[] = [
    { code: "TALK_HOURS", channel: "kakao_channel", intent: "진료시간", title: "진료시간 안내", body: "안녕하세요. 의성한방병원입니다.\n진료시간은 평일 09:00~18:00, 토요일 09:00~13:00입니다. 점심시간은 13:00~14:00입니다.\n공휴일은 휴진입니다.", enabled: true, requiresHumanReview: false, complianceLevel: "standard" },
    { code: "TALK_LOCATION", channel: "kakao_channel", intent: "위치/주차", title: "위치·주차 안내", body: "병원은 OO역 3번 출구에서 도보 5분 거리에 있습니다.\n건물 지하 주차장을 1시간 무료 이용 가능합니다.", enabled: true, requiresHumanReview: false, complianceLevel: "standard" },
    { code: "TALK_PARKING", channel: "kakao_channel", intent: "주차", title: "주차 안내", body: "지하 1~2층 주차장 이용 가능하며 진료 환자분께는 1시간 무료 주차권을 제공해드립니다.", enabled: true, requiresHumanReview: false, complianceLevel: "standard" },
    { code: "TALK_PRICE_RANGE", channel: "kakao_channel", intent: "비용", title: "비용 안내(범위)", body: "치료 항목과 처방에 따라 비용이 달라집니다. 대략적인 범위는 진료 후 자세히 안내드릴 수 있도록 하겠습니다.", enabled: true, requiresHumanReview: true, complianceLevel: "strict" },
    { code: "TALK_DOCUMENTS", channel: "kakao_channel", intent: "서류", title: "서류 발급 안내", body: "진료확인서/진단서/영수증은 데스크에서 발급 가능합니다. 본인 신분증 지참 부탁드립니다.", enabled: true, requiresHumanReview: false, complianceLevel: "standard" },
    { code: "RESERVATION_CONFIRM", channel: "kakao_biz", intent: "예약확정", title: "예약 확정 알림", body: "{{name}}님, {{date}} {{time}} 의성한방병원 예약이 확정되었습니다. 변경/취소는 데스크 또는 채널 메시지로 연락주세요.", enabled: true, requiresHumanReview: false, complianceLevel: "standard" },
    { code: "RESERVATION_REMINDER", channel: "kakao_biz", intent: "예약리마인드", title: "예약 리마인드", body: "{{name}}님, 내일 {{time}} 진료 예약 리마인드 드립니다. 늦지 않게 도착 부탁드립니다.", enabled: true, requiresHumanReview: false, complianceLevel: "standard" },
    { code: "REVIEW_POSITIVE_KINDNESS", channel: "naver_review", intent: "긍정-친절", title: "리뷰 답글(친절)", body: "안녕하세요~ 의성한방병원입니다. 친절히 응대해드릴 수 있어 저희도 기쁩니다. 언제나 정성을 다해 진료하는 의성한방병원이 되겠습니다. 감사합니다~^^", enabled: true, requiresHumanReview: false, complianceLevel: "strict" },
    { code: "REVIEW_NEGATIVE_FIRST_RESPONSE", channel: "naver_review", intent: "부정-1차응대", title: "리뷰 답글(부정·1차)", body: "안녕하세요~ 의성한방병원입니다. 불편을 드린 점에 대해 죄송한 마음입니다. 남겨주신 말씀을 원내에서 신중히 확인하고, 별도 연락드리도록 하겠습니다. 감사합니다~^^", enabled: true, requiresHumanReview: true, complianceLevel: "strict" },
  ];
  for (const t of templates) {
    await prisma.template.upsert({
      where: { code: t.code },
      update: {},
      // @ts-expect-error — channel 은 enum 이라 string 캐스팅
      create: { ...t, createdById: "u_admin", updatedById: "u_admin" },
    });
  }
  console.log(`[seed] templates: ${templates.length}`);

  // ─── Reservations (기존 항목은 skip) ───
  const rsvCount = await prisma.reservation.count();
  if (rsvCount === 0) {
    await prisma.reservation.createMany({
      data: [
        { id: "rsv_1", sourceChannel: "naver_reservation", patientName: "김○○", phoneMasked: "010-****-1234", reservationAt: inHours(2), status: "pending_confirmation", createdAt: minutesAgo(35), notes: "초진 / 허리 통증" },
        { id: "rsv_2", sourceChannel: "naver_reservation", patientName: "이○○", phoneMasked: "010-****-5689", reservationAt: inHours(3), status: "confirmed", assigneeId: "u_staff1", createdAt: hoursAgo(4), notes: "재진 / 추나" },
        { id: "rsv_3", sourceChannel: "manual", patientName: "박○○", phoneMasked: "010-****-3344", reservationAt: inHours(5), status: "new", createdAt: minutesAgo(10) },
        { id: "rsv_4", sourceChannel: "naver_reservation", patientName: "최○○", phoneMasked: "010-****-7788", reservationAt: inHours(1), status: "change_requested", assigneeId: "u_staff2", createdAt: minutesAgo(50), notes: "시간 변경 요청" },
        { id: "rsv_5", sourceChannel: "naver_reservation", patientName: "정○○", phoneMasked: "010-****-9911", reservationAt: hoursAgo(1), status: "no_show_risk", assigneeId: "u_staff1", createdAt: hoursAgo(3) },
        { id: "rsv_6", sourceChannel: "naver_reservation", patientName: "한○○", phoneMasked: "010-****-2244", reservationAt: hoursAgo(2), status: "completed", assigneeId: "u_staff2", createdAt: hoursAgo(5) },
        { id: "rsv_7", sourceChannel: "manual", patientName: "조○○", phoneMasked: "010-****-1111", reservationAt: inHours(6), status: "pending_confirmation", createdAt: minutesAgo(45), notes: "산후조리 한약 상담" },
        { id: "rsv_8", sourceChannel: "naver_reservation", patientName: "윤○○", phoneMasked: "010-****-3838", reservationAt: inHours(4), status: "confirmed", assigneeId: "u_staff1", createdAt: hoursAgo(2) },
      ],
    });
    console.log("[seed] reservations: 8");
  }

  // ─── Conversations + Messages ───
  const convCount = await prisma.conversation.count();
  if (convCount === 0) {
    const conversationData = [
      { id: "cv_1", channel: "kakao_channel" as const, contactName: "강○○", contactPhoneMasked: "010-****-1212", status: "new" as const, category: "CONSULT_HOURS" as const, riskLevel: "low" as const, lastMessageAt: minutesAgo(3), lastMessagePreview: "오늘 몇 시까지 진료하나요?" },
      { id: "cv_2", channel: "naver_talk" as const, contactName: "이○○", contactPhoneMasked: "010-****-3434", status: "in_progress" as const, category: "RESERVATION_CHANGE" as const, riskLevel: "low" as const, assigneeId: "u_staff1", lastMessageAt: minutesAgo(15), lastMessagePreview: "내일 오후로 시간 바꿔주실 수 있을까요?" },
      { id: "cv_3", channel: "kakao_channel" as const, contactName: "박○○", contactPhoneMasked: "010-****-5656", status: "new" as const, category: "PRICE" as const, riskLevel: "low" as const, lastMessageAt: minutesAgo(7), lastMessagePreview: "한약 가격이 보통 어떻게 되나요?" },
      { id: "cv_4", channel: "naver_talk" as const, contactName: "최○○", contactPhoneMasked: "010-****-7878", status: "waiting_patient" as const, category: "LOCATION_PARKING" as const, riskLevel: "low" as const, assigneeId: "u_staff2", lastMessageAt: minutesAgo(40), lastMessagePreview: "주차 안내 보내드렸습니다." },
      { id: "cv_5", channel: "naver_talk" as const, contactName: "한○○", contactPhoneMasked: "010-****-2323", status: "escalated" as const, category: "REFUND_DISPUTE" as const, riskLevel: "high" as const, assigneeId: "u_mgr", lastMessageAt: hoursAgo(1), lastMessagePreview: "치료 후 통증이 더 심해졌는데 환불 가능한가요?" },
      { id: "cv_6", channel: "kakao_channel" as const, contactName: "윤○○", contactPhoneMasked: "010-****-9090", status: "new" as const, category: "SYMPTOM" as const, riskLevel: "medium" as const, lastMessageAt: minutesAgo(20), lastMessagePreview: "디스크 진단을 받았는데 한방 치료가 가능한가요?" },
      { id: "cv_7", channel: "kakao_biz" as const, contactName: "조○○", contactPhoneMasked: "010-****-4545", status: "resolved" as const, category: "PREP_DRESS" as const, riskLevel: "low" as const, assigneeId: "u_staff1", lastMessageAt: hoursAgo(3), lastMessagePreview: "공복 안내 드렸습니다." },
    ];
    for (const c of conversationData) {
      await prisma.conversation.create({ data: c });
    }
    await prisma.message.createMany({
      data: [
        { conversationId: "cv_1", direction: "inbound", sourceChannel: "kakao_channel", content: "오늘 몇 시까지 진료하나요?", createdAt: minutesAgo(3) },
        { conversationId: "cv_2", direction: "inbound", sourceChannel: "naver_talk", content: "내일 오후 시간으로 변경 가능할까요?", createdAt: minutesAgo(20) },
        { conversationId: "cv_2", direction: "outbound", sourceChannel: "naver_talk", content: "네 가능합니다. 오후 2시 / 4시 중 선택 부탁드립니다.", createdAt: minutesAgo(15) },
        { conversationId: "cv_5", direction: "inbound", sourceChannel: "naver_talk", content: "치료 후 통증이 더 심해진 것 같습니다. 환불 가능한가요?", createdAt: hoursAgo(1) },
        { conversationId: "cv_5", direction: "system", sourceChannel: "naver_talk", content: "민감 키워드(악화, 환불) 감지 → 관리자 검토 필요", createdAt: hoursAgo(1) },
        { conversationId: "cv_6", direction: "inbound", sourceChannel: "kakao_channel", content: "디스크 진단을 받았는데 한방치료가 도움될까요?", createdAt: minutesAgo(20) },
      ],
    });
    console.log(`[seed] conversations: ${conversationData.length}, messages: 6`);
  }

  // ─── Reviews ───
  const reviewCount = await prisma.review.count();
  if (reviewCount === 0) {
    await prisma.review.createMany({
      data: [
        { id: "rv_1", sourceChannel: "naver_review", reviewerNameMasked: "김**", rating: 5, content: "허리가 정말 안 좋았는데 침과 추나 치료 받고 많이 좋아졌어요. 김선생님 친절하시고 설명도 자세하게 해주세요.", status: "new", riskLevel: "low", createdAt: hoursAgo(2), treatmentMentioned: "침/추나", staffMentioned: "김" },
        { id: "rv_2", sourceChannel: "naver_review", reviewerNameMasked: "이**", rating: 5, content: "친절하게 안내해주셔서 편안했습니다.", status: "new", riskLevel: "low", createdAt: hoursAgo(5) },
        { id: "rv_3", sourceChannel: "naver_review", reviewerNameMasked: "박**", rating: 2, content: "치료 후 통증이 더 심해진 것 같아 걱정됩니다. 비용도 생각보다 비쌌어요.", status: "needs_review", riskLevel: "high", createdAt: hoursAgo(8) },
        { id: "rv_4", sourceChannel: "naver_review", reviewerNameMasked: "최**", rating: 5, content: "산후조리 한약 잘 먹고 컨디션 회복했어요. 다음에도 또 갈게요.", status: "draft_generated", riskLevel: "low", createdAt: hoursAgo(20) },
        { id: "rv_5", sourceChannel: "naver_review", reviewerNameMasked: "정**", rating: 4, content: "직원분들 모두 친절하셨고 대기시간도 길지 않아 좋았습니다.", status: "approved", riskLevel: "low", createdAt: hoursAgo(30), approvedById: "u_rev", approvedAt: hoursAgo(10) },
        { id: "rv_6", sourceChannel: "naver_review", reviewerNameMasked: "한**", rating: 1, content: "예약하고 갔는데 한참 기다렸고 효과도 별로 없었어요. 환불 문의드립니다.", status: "escalated", riskLevel: "high", createdAt: hoursAgo(2) },
      ],
    });
    console.log("[seed] reviews: 6");
  }

  // ─── Audit logs ───
  const logCount = await prisma.auditLog.count();
  if (logCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        { actorId: "u_rev", actorName: "최리뷰", entityType: "Review", entityId: "rv_5", action: "draft.approved", createdAt: hoursAgo(10) },
        { actorId: "u_mgr", actorName: "이매니저", entityType: "Conversation", entityId: "cv_5", action: "conversation.escalated", createdAt: hoursAgo(1) },
        { actorId: "u_admin", actorName: "원장", entityType: "Template", entityId: "TALK_PRICE_RANGE", action: "template.updated", beforeJson: { complianceLevel: "standard" }, afterJson: { complianceLevel: "strict" }, createdAt: hoursAgo(72) },
        { actorId: "u_staff1", actorName: "박상담", entityType: "Reservation", entityId: "rsv_2", action: "reservation.confirmed", createdAt: hoursAgo(4) },
      ],
    });
    console.log("[seed] audit logs: 4");
  }

  console.log("[seed] 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
