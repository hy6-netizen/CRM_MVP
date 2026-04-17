import { NextResponse } from "next/server";
import { generateReviewReply as deterministicReviewReply } from "@hub/ai/src/reviewReplyEngine";
import { runComplianceCheck as keywordCompliance } from "@hub/ai/src/complianceChecker";
import { getLLM } from "@hub/ai/src/llm";
import type { ComplianceResult, ReviewEngineOutput } from "@hub/domain/src/types";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const llm = getLLM();

  let engine: ReviewEngineOutput;
  let generator = llm.name;
  let llmError: string | null = null;
  let llmUsage: unknown;
  try {
    const resp = await llm.generateReviewReply({
      rating: review.rating,
      content: review.content,
      treatmentMentioned: review.treatmentMentioned ?? undefined,
      staffMentioned: review.staffMentioned ?? undefined,
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
      treatmentMentioned: review.treatmentMentioned ?? undefined,
      staffMentioned: review.staffMentioned ?? undefined,
    });
    generator = "mock(fallback)";
  }

  const keyword = keywordCompliance(engine.draft);
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
      console.error("[generate-draft] 의도 검사 실패", e);
    }
  }

  const nextStatus =
    engine.needsHumanReview || compliance.status !== "approved" ? "needs_review" : "draft_generated";

  const updated = await prisma.review.update({
    where: { id },
    data: {
      draft: engine.draft,
      draftReasons: engine.reasons,
      sentiment: engine.sentiment,
      category: mapReviewCategory(engine.category),
      riskLevel: engine.riskLevel,
      complianceStatus: compliance.status,
      approvedDraft: compliance.approvedDraft || engine.draft,
      status: nextStatus,
    },
  });

  await recordAudit({
    actorName: "system",
    entityType: "Review",
    entityId: id,
    action: "review.draft_generated",
    before: review,
    after: {
      status: updated.status,
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
    review: updated,
    meta: { generator, intentChecker, llmError, usage: llmUsage, intentUsage },
  });
}

// ReviewCategory enum 한글 키 → prisma 매핑값
function mapReviewCategory(c: ReviewEngineOutput["category"]): string {
  const map: Record<ReviewEngineOutput["category"], string> = {
    친절: "KIND",
    치료만족: "TREATMENT",
    회복후기: "RECOVERY",
    짧은감사: "SHORT_THX",
    재방문의사: "REVISIT",
    불만: "COMPLAINT",
    기타: "OTHER",
  };
  return map[c];
}
