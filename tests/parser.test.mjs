// 네이버 예약 이메일 파서 정적 검증. 실제 동적 테스트는 dev 서버에서 .eml POST.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("네이버 예약 이메일 파서 — 필수 필드 라벨 8종", async () => {
  const c = await fs.readFile("apps/web/src/lib/parsers/naverBookingEmail.ts", "utf8");
  for (const label of ["예약자명", "예약신청 일시", "예약번호", "예약상품", "이용일시", "결제상태", "결제수단", "결제예상금액", "요청사항"]) {
    assert.ok(c.includes(label), `라벨 누락: ${label}`);
  }
  assert.ok(c.includes("naverbooking") && c.includes("navercorp.com"), "발신자 검증 필요");
  assert.ok(c.includes("오전") && c.includes("오후"), "한국어 시각 파싱 필요");
  assert.ok(c.includes("externalReservationId"), "dedupe key 반환 필요");
});

test("네이버 예약 이메일 ingest 라우트 — multipart + JSON 양쪽 지원", async () => {
  await fs.access("apps/web/app/api/ingest/naver-booking-email/route.ts");
  const c = await fs.readFile("apps/web/app/api/ingest/naver-booking-email/route.ts", "utf8");
  assert.ok(c.includes("multipart/form-data"), "multipart 업로드 지원 필요");
  assert.ok(c.includes("parseNaverBookingEmail"), "파서 호출");
  assert.ok(c.includes("upsert") || c.includes("findFirst"), "externalReservationId dedupe");
  // RFC 2822 folded headers 처리
  assert.ok(c.includes("\\r?\\n[ \\t]+"), "folded headers 재조립 필요");
  // middleware 에서 인증 제외
  const mw = await fs.readFile("apps/web/middleware.ts", "utf8");
  assert.ok(mw.includes("/api/ingest"), "middleware 가 /api/ingest 를 public 으로 허용해야 함");
});
