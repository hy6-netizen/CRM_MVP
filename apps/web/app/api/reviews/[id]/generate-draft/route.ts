import { NextResponse } from "next/server";
import { generateReviewReply as deterministicReviewReply } from "@hub/ai/src/reviewReplyEngine";
import { runComplianceCheck as keywordCompliance } from "@hub/ai/src/complianceChecker";
import { getLLM } from "@hub/ai/src/llm";
import type { ComplianceResult, ReviewEngineOutput } from "@hub/domain/src/types";
import { findReview, recordAudit } from "../../../../../src/lib/mockStore";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const llm = getLLM();

  // 1) 초안 생성. LLM 실패 시 결정형 엔진으로 fallback.
  let engine: ReviewEngineOutput;
  let generator = llm.name;
  let llmError: string | null = null;
  let llmUsage: unknown;
  try {
    const resp = await llm.generateReviewReply({
      rating: review.rating,
      content: review.content,
      treatmentMentioned: review.treatmentMentioned,
      staffMentioned: review.staffMentioned,
    });
    engine = resp.result;
    generator = resp.provider;
    llmUsage = resp.usage;
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e);
    console.error("[generate-draft] LLM 실패, 결정형 fallback", llmError);
    engine = deterministicReviewReply({
      rating: review.rating,
      content: review.content,
      treatmentMentioned: review.treatmentMentioned,
      staffMentioned: review.staffMentioned,
    });
    generator = "mock(fallback)";
  }

  // 2) 키워드 기반 컴플라이언스 검사 (빠르고 무료).
  const keyword = keywordCompliance(engine.draft);

  // 3) 키워드 통과 시 + LLM 사용 중이면 의도 레벨 재검사.
  let compliance: ComplianceResult = keyword;
  let intentChecker: string | null = null;
  let intentUsage: unknown;
  if (keyword.status === "approved" && llm.name !== "mock") {
    try {
      const intent = await llm.runIntentComplianceCheck(engine.draft);
      compliance = intent.result;
      intentChecker = intent.provider;
      intentUsage = intent.usage;
    } catch (e) {
      console.error("[generate-draft] 의도 검사 실패 (키워드 결과 유지)", e);
    }
  }

  // 4) 상태/리뷰 업데이트
  const before = { ...review };
  review.draft = engine.draft;
  review.draftReasons = engine.reasons;
  review.sentiment = engine.sentiment;
  review.category = engine.category;
  review.riskLevel = engine.riskLevel;
  review.complianceStatus = compliance.status;
  review.approvedDraft = compliance.approvedDraft || engine.draft;
  review.status = engine.needsHumanReview || compliance.status !== "approved" ? "needs_review" : "draft_generated";

  recordAudit({
    actorName: "system",
    entityType: "Review",
    entityId: id,
    action: "review.draft_generated",
    before,
    after: {
      status: review.status,
      complianceStatus: compliance.status,
      generator,
      intentChecker,
      llmError,
      usage: llmUsage,
      intentUsage,
    },
  });

  return NextResponse.json({
    engine,
    compliance,
    review,
    meta: { generator, intentChecker, llmError, usage: llmUsage, intentUsage },
  });
}
