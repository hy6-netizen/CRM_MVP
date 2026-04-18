import { NextResponse } from "next/server";
import { runComplianceCheck } from "@hub/ai/src/complianceChecker";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const draft = typeof body.draft === "string" && body.draft.length > 0 ? body.draft : review.approvedDraft || review.draft;
  if (!draft) return NextResponse.json({ error: "no_draft" }, { status: 400 });

  const compliance = runComplianceCheck(draft);
  if (compliance.status === "rejected") {
    return NextResponse.json({ error: "compliance_rejected", compliance }, { status: 422 });
  }

  const before = { ...review };
  const updated = await prisma.review.update({
    where: { id },
    data: {
      status: "approved",
      approvedDraft: compliance.approvedDraft || draft,
      complianceStatus: compliance.status,
      approvedById: body.actorId || "u_rev",
      approvedAt: new Date(),
    },
  });
  await recordAudit({
    actorId: updated.approvedById ?? undefined,
    entityType: "Review",
    entityId: id,
    action: "review.draft_approved",
    before,
    after: { status: updated.status, approvedDraft: updated.approvedDraft },
  });
  return NextResponse.json({ review: updated, compliance });
}
