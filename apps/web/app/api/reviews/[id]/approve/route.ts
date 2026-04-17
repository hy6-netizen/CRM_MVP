import { NextResponse } from "next/server";
import { runComplianceCheck } from "@hub/ai/src/complianceChecker";
import { findReview, recordAudit, __mockMeta } from "../../../../../src/lib/mockStore";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const draft = typeof body.draft === "string" && body.draft.length > 0 ? body.draft : review.approvedDraft || review.draft;
  if (!draft) return NextResponse.json({ error: "no_draft" }, { status: 400 });

  const compliance = runComplianceCheck(draft);
  if (compliance.status === "rejected") {
    return NextResponse.json({ error: "compliance_rejected", compliance }, { status: 422 });
  }

  const before = { ...review };
  review.status = "approved";
  review.approvedDraft = compliance.approvedDraft || draft;
  review.complianceStatus = compliance.status;
  review.approvedById = body.actorId || "u_rev";
  review.approvedAt = __mockMeta.now();
  recordAudit({
    actorId: review.approvedById,
    entityType: "Review",
    entityId: id,
    action: "review.draft_approved",
    before,
    after: { status: review.status, approvedDraft: review.approvedDraft },
  });
  return NextResponse.json({ review, compliance });
}
