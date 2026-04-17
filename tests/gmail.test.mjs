// Gmail 연동 정적 검증.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("GmailAccount 모델 + 마이그레이션 파일", async () => {
  const schema = await fs.readFile("packages/db/prisma/schema.prisma", "utf8");
  assert.ok(schema.includes("model GmailAccount"), "GmailAccount 모델 필요");
  for (const f of ["accessToken", "refreshToken", "lastHistoryId", "lastPolledAt"]) {
    assert.ok(schema.includes(f), `필드 누락: ${f}`);
  }
  const migs = await fs.readdir("packages/db/prisma/migrations");
  const hasGmailMig = migs.some((m) => m.includes("gmail"));
  assert.ok(hasGmailMig, "gmail 마이그레이션 디렉토리 없음");
});

test("Gmail OAuth 라우트 4종", async () => {
  for (const p of [
    "apps/web/app/api/integrations/gmail/connect/route.ts",
    "apps/web/app/api/integrations/gmail/callback/route.ts",
    "apps/web/app/api/integrations/gmail/status/route.ts",
    "apps/web/app/api/integrations/gmail/disconnect/route.ts",
  ]) {
    await fs.access(p);
  }
  const mw = await fs.readFile("apps/web/middleware.ts", "utf8");
  assert.ok(mw.includes("/api/integrations/gmail/callback"), "OAuth callback 은 public 허용 필요");
  assert.ok(mw.includes("/api/cron"), "cron 엔드포인트 public (자체 Bearer secret 검증)");
});

test("Gmail wrapper + 폴링 워커", async () => {
  await fs.access("apps/web/src/lib/gmail.ts");
  await fs.access("apps/web/src/lib/gmailPoll.ts");
  await fs.access("apps/web/app/api/cron/gmail-poll/route.ts");
  const gm = await fs.readFile("apps/web/src/lib/gmail.ts", "utf8");
  assert.ok(gm.includes("gmail.readonly"), "readonly scope 요청 필요");
  assert.ok(gm.includes("naverbooking_noreply@navercorp.com"), "네이버 발신자 필터");
  const poll = await fs.readFile("apps/web/src/lib/gmailPoll.ts", "utf8");
  assert.ok(poll.includes("parseNaverBookingEmail"), "파서 호출");
  assert.ok(poll.includes("applyNaverBookingEvent"), "이벤트 적용 공유 로직 사용 (dedupe 은 거기서)");
});

test("Gmail 설정 UI + launchd 템플릿", async () => {
  await fs.access("apps/web/app/settings/integrations/gmail/page.tsx");
  await fs.access("apps/web/src/components/settings/GmailConnectPanel.tsx");
  await fs.access("scripts/launchd/com.uskmh.gmail-poll.plist.template");
});
