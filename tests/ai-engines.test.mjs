// AI 엔진 결정형 동작 검증 (LLM 미사용 베이스라인).
// node:test 만 사용하여 ts 파일을 정적 grep + 가벼운 기능 점검.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("review engine — 고정 인사/마무리 문구 포함", async () => {
  const c = await fs.readFile("packages/ai/src/reviewReplyEngine.ts", "utf8");
  assert.ok(c.includes("안녕하세요~ ${HOSPITAL_NAME}입니다."), "GREETING 누락");
  assert.ok(c.includes('CLOSING = "감사합니다~^^"'), "CLOSING 누락");
});

test("review engine — 11개 다짐 문구 정의", async () => {
  const c = await fs.readFile("packages/ai/src/reviewReplyEngine.ts", "utf8");
  const m = c.match(/PLEDGE_PHRASES[^\[]*\[([\s\S]*?)\]\s*as const/);
  assert.ok(m, "PLEDGE_PHRASES 배열 미발견");
  const items = m[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith("`") || l.startsWith("\""));
  assert.equal(items.length, 11, `다짐 문구 11개 필요, 현재 ${items.length}`);
});

test("compliance — BLOCKED 핵심 표현 포함", async () => {
  const c = await fs.readFile("packages/ai/src/complianceChecker.ts", "utf8");
  for (const expr of ["완치", "100%", "최고", "유일", "후기 작성 시 혜택", "양방에서는 못 고치는"]) {
    assert.ok(c.includes(expr), `BLOCKED 누락: ${expr}`);
  }
});

test("conversation classifier — 11 카테고리 + 라우팅", async () => {
  const c = await fs.readFile("packages/ai/src/conversationClassifier.ts", "utf8");
  for (const cat of ["진료시간", "위치/주차", "예약문의", "예약변경취소", "비용문의", "준비물복장", "서류문의", "증상상담", "불만민원", "환불분쟁"]) {
    assert.ok(c.includes(cat), `카테고리 누락: ${cat}`);
  }
  assert.ok(c.includes("autoResponseCandidate"), "라우팅 플래그 누락");
});

test("queue — 10개 job type + retry policy", async () => {
  const c = await fs.readFile("packages/queue/src/jobTypes.ts", "utf8");
  for (const t of [
    "ingest_review",
    "extract_review_from_image",
    "classify_review",
    "generate_review_reply",
    "run_compliance_check",
    "notify_staff_unanswered",
    "reservation_followup",
    "reservation_reminder",
    "sync_provider_data",
    "escalate_sensitive_case",
  ]) {
    assert.ok(c.includes(t), `JOB_TYPE 누락: ${t}`);
  }
  assert.ok(c.includes("RETRY_POLICY"), "RETRY_POLICY 미정의");
});

test("prisma schema — 14 핵심 모델", async () => {
  const c = await fs.readFile("packages/db/prisma/schema.prisma", "utf8");
  for (const model of [
    "model User",
    "model PatientContact",
    "model Conversation",
    "model Message",
    "model Reservation",
    "model Review",
    "model ReviewReplyDraft",
    "model Template",
    "model AuditLog",
    "model Job",
  ]) {
    assert.ok(c.includes(model), `모델 누락: ${model}`);
  }
});
