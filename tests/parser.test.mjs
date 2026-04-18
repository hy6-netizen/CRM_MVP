// 네이버 예약 이메일 파서 정적 검증. 실제 동적 테스트는 dev 서버에서 .eml POST.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("네이버 예약 이메일 파서 — 3 이벤트 (created/canceled/changed)", async () => {
  const c = await fs.readFile("apps/web/src/lib/parsers/naverBookingEmail.ts", "utf8");
  for (const label of ["예약자명", "예약신청 일시", "예약번호", "예약상품", "이용일시", "결제상태", "결제수단", "결제예상금액", "요청사항", "취소사유", "예약변경 일시", "예약취소 일시"]) {
    assert.ok(c.includes(label), `라벨 누락: ${label}`);
  }
  for (const pat of ["새로운", "취소", "변경"]) assert.ok(c.includes(pat), `제목 패턴 누락: ${pat}`);
  // 즉시 확정 모드 지원 — "새로운 예약이 확정 되었습니다" 제목
  assert.ok(/접수\|확정|접수.*확정|확정.*접수/.test(c), "즉시 확정 모드 지원 (접수|확정 패턴) 필요");
  for (const ev of ["created", "canceled", "changed"]) {
    assert.ok(c.includes(`"${ev}"`), `eventType 누락: ${ev}`);
  }
  assert.ok(c.includes("신규예약내역") && c.includes("예약취소내역"), "변경 메일 섹션 분할 필요");
  assert.ok(c.includes("naverbooking") && c.includes("navercorp"), "발신자 검증 필요");
});

test("네이버 예약 이벤트 적용 로직 — create/cancel 분기", async () => {
  await fs.access("apps/web/src/lib/naverBookingApply.ts");
  const c = await fs.readFile("apps/web/src/lib/naverBookingApply.ts", "utf8");
  assert.ok(c.includes("canceledReservation"), "canceled 분기 필요");
  assert.ok(c.includes("newReservation"), "신규 분기 필요");
  assert.ok(c.includes('status: "canceled"'), "취소 상태 업데이트 필요");
  assert.ok(c.includes('status: "new"'), "신규 상태 생성 필요");
});

test("ingest 라우트 — multipart + JSON + 이벤트 적용 통합", async () => {
  await fs.access("apps/web/app/api/ingest/naver-booking-email/route.ts");
  const c = await fs.readFile("apps/web/app/api/ingest/naver-booking-email/route.ts", "utf8");
  assert.ok(c.includes("multipart/form-data"), "multipart 업로드 지원 필요");
  assert.ok(c.includes("parseNaverBookingEmail"), "파서 호출");
  assert.ok(c.includes("applyNaverBookingEvent"), "이벤트 적용 공유 함수 사용");
  assert.ok(c.includes("\\r?\\n[ \\t]+"), "folded headers 재조립 필요");
  const mw = await fs.readFile("apps/web/middleware.ts", "utf8");
  assert.ok(mw.includes("/api/ingest"), "middleware 가 /api/ingest 를 public 으로 허용해야 함");
});
