import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("workspace yaml 존재", async () => {
  const c = await fs.readFile("pnpm-workspace.yaml", "utf8");
  assert.ok(c.includes("packages"));
});

test("8 개 핵심 페이지 라우트 존재", async () => {
  for (const p of [
    "apps/web/app/dashboard/page.tsx",
    "apps/web/app/reservations/page.tsx",
    "apps/web/app/conversations/page.tsx",
    "apps/web/app/reviews/page.tsx",
    "apps/web/app/templates/page.tsx",
    "apps/web/app/settings/integrations/page.tsx",
    "apps/web/app/settings/compliance/page.tsx",
    "apps/web/app/logs/page.tsx",
  ]) {
    await fs.access(p);
  }
});

test("리뷰 핵심 API 라우트 존재", async () => {
  for (const p of [
    "apps/web/app/api/reviews/route.ts",
    "apps/web/app/api/reviews/[id]/generate-draft/route.ts",
    "apps/web/app/api/reviews/[id]/compliance-check/route.ts",
    "apps/web/app/api/reviews/[id]/approve/route.ts",
    "apps/web/app/api/reviews/[id]/post/route.ts",
    "apps/web/app/api/templates/route.ts",
    "apps/web/app/api/conversations/route.ts",
    "apps/web/app/api/reservations/route.ts",
    "apps/web/app/api/audit-logs/route.ts",
    "apps/web/app/api/compliance/test/route.ts",
  ]) {
    await fs.access(p);
  }
});

test("Tailwind 설정 존재", async () => {
  await fs.access("apps/web/tailwind.config.ts");
  await fs.access("apps/web/postcss.config.cjs");
  const css = await fs.readFile("apps/web/app/globals.css", "utf8");
  assert.ok(css.includes("@tailwind base"));
});

test("Prisma 연결 기반 설정", async () => {
  await fs.access("apps/web/src/lib/db.ts");
  await fs.access("apps/web/src/lib/viewAdapters.ts");
  await fs.access("apps/web/src/lib/dashboard.ts");
  const pkg = JSON.parse(await fs.readFile("apps/web/package.json", "utf8"));
  assert.ok(pkg.dependencies["@prisma/client"], "@prisma/client 의존성 필요");
  const schema = await fs.readFile("packages/db/prisma/schema.prisma", "utf8");
  assert.ok(schema.includes("model Notification"), "Notification 모델 필요");
  assert.ok(schema.includes("contactName") && schema.includes("contactPhoneMasked"), "Conversation denormalized 필드 필요");
  assert.ok(schema.includes("passwordHash"), "User.passwordHash 필드 필요");
});

test("네이버 톡톡 빠른 입력 — 분류 + 초안 제안", async () => {
  await fs.access("apps/web/app/api/conversations/quick-add/route.ts");
  await fs.access("apps/web/src/components/conversations/QuickAddButton.tsx");
  const r = await fs.readFile("apps/web/app/api/conversations/quick-add/route.ts", "utf8");
  assert.ok(r.includes("classifyConversation"), "자동 분류기 연동 필요");
  assert.ok(r.includes("prisma.template.findUnique"), "Template DB 조회로 초안 필요");
  assert.ok(r.includes("HUMAN_ONLY"), "사람 검토 강제 카테고리 처리 필요");
});

test("네이버 예약 CSV 임포트 — 라우트 + 한글 컬럼 매핑", async () => {
  await fs.access("apps/web/app/api/reservations/import-csv/route.ts");
  await fs.access("apps/web/src/components/reservations/CsvImportButton.tsx");
  const r = await fs.readFile("apps/web/app/api/reservations/import-csv/route.ts", "utf8");
  for (const k of ["이름", "고객명", "예약자", "연락처", "예약일시", "예약상태"]) {
    assert.ok(r.includes(k), `한글 컬럼 매핑 누락: ${k}`);
  }
  assert.ok(r.includes("externalReservationId"), "dedupe 필수");
  assert.ok(r.includes("maskPhone"), "전화번호 마스킹 필수");
});

test("네이버 리뷰 배치 import — ai-system 연동 스크립트", async () => {
  await fs.access("packages/db/scripts/import-naver-reviews.ts");
  await fs.access("scripts/sync-naver-reviews.sh");
  const pkg = JSON.parse(await fs.readFile("packages/db/package.json", "utf8"));
  assert.ok(pkg.scripts["import:naver-reviews"], "import:naver-reviews 스크립트 필요");
  const code = await fs.readFile("packages/db/scripts/import-naver-reviews.ts", "utf8");
  assert.ok(code.includes("externalReviewId"), "dedupe 용 externalReviewId 생성 필요");
  assert.ok(code.includes("sha1"), "sha1 해시로 안정적 dedupe");
});

test("네이버 리뷰 이미지 OCR — Vision 라우트 + 버튼", async () => {
  await fs.access("apps/web/app/api/reviews/extract-image/route.ts");
  await fs.access("apps/web/src/components/reviews/ImageImportButton.tsx");
  const openai = await fs.readFile("packages/ai/src/llm/openai.ts", "utf8");
  assert.ok(openai.includes("extractReviewFromImage"), "openai provider 에 extractReviewFromImage 필요");
  assert.ok(openai.includes("image_url"), "vision 입력 (image_url) 필수");
  assert.ok(openai.includes("IMAGE_EXTRACT_SCHEMA"), "이미지 추출 schema 필요");
});

test("NextAuth 로그인 구성", async () => {
  await fs.access("apps/web/src/lib/auth.ts");
  await fs.access("apps/web/app/api/auth/[...nextauth]/route.ts");
  await fs.access("apps/web/middleware.ts");
  await fs.access("apps/web/app/login/page.tsx");
  await fs.access("apps/web/src/components/LoginForm.tsx");
  const pkg = JSON.parse(await fs.readFile("apps/web/package.json", "utf8"));
  assert.ok(pkg.dependencies["next-auth"], "next-auth 의존성 필요");
  assert.ok(pkg.dependencies["bcryptjs"], "bcryptjs 의존성 필요");
  const mw = await fs.readFile("apps/web/middleware.ts", "utf8");
  assert.ok(mw.includes("/login"), "로그인 리다이렉트 경로 필요");
  assert.ok(mw.includes("/api/webhooks"), "웹훅 엔드포인트는 인증 제외해야 함");
});
