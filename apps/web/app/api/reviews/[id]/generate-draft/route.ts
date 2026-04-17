import { NextResponse } from "next/server";
import { generateReviewReply } from "@hub/ai/src/reviewReplyEngine";
import { runComplianceCheck } from "@hub/ai/src/complianceChecker";
import { findReview, recordAudit } from "../../../../../src/lib/mockStore";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const engine = generateReviewReply({
    rating: review.rating,
    content: review.content,
    treatmentMentioned: review.treatmentMentioned,
    staffMentioned: review.staffMentioned,
  });
  const compliance = runComplianceCheck(engine.draft);

  const before = { ...review };
  review.draft = engine.draft;
  review.draftReasons = engine.reasons;
  review.sentiment = engine.sentiment;
  review.category = engine.category;
  review.riskLevel = engine.riskLevel;
  review.complianceStatus = compliance.status;
  review.approvedDraft = compliance.approvedDraft || engine.draft;
  if (engine.needsHumanReview || compliance.status !== "approved") {
    review.status = "needs_review";
  } else {
    review.status = "draft_generated";
  }

  recordAudit({
    entityType: "Review",
    entityId: id,
    action: "review.draft_generated",
    before,
    after: { status: review.status, complianceStatus: compliance.status },
  });

  return NextResponse.json({ engine, compliance, review });
}
