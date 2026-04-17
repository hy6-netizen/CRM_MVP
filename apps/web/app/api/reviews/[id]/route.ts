import { NextResponse } from "next/server";
import { findReview, recordAudit } from "../../../../src/lib/mockStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(review);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const before = { ...review };
  if (typeof body.status === "string") review.status = body.status;
  if (typeof body.assigneeId === "string") review.assigneeId = body.assigneeId;
  if (typeof body.approvedDraft === "string") review.approvedDraft = body.approvedDraft;
  recordAudit({ entityType: "Review", entityId: id, action: "review.updated", before, after: { ...review } });
  return NextResponse.json(review);
}
