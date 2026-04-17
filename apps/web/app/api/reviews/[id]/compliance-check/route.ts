import { NextResponse } from "next/server";
import { runComplianceCheck } from "@hub/ai/src/complianceChecker";
import { findReview, recordAudit } from "../../../../../src/lib/mockStore";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const draft = typeof body.draft === "string" && body.draft.length > 0 ? body.draft : review.draft;
  if (!draft) return NextResponse.json({ error: "no_draft" }, { status: 400 });

  const compliance = runComplianceCheck(draft);
  review.complianceStatus = compliance.status;
  review.approvedDraft = compliance.approvedDraft || draft;
  recordAudit({
    entityType: "Review",
    entityId: id,
    action: "review.compliance_checked",
    after: { status: compliance.status, issues: compliance.issues.length },
  });
  return NextResponse.json({ compliance, review });
}
