import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { recordAudit } from "../../../../src/lib/audit";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(review);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = await prisma.review.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.assigneeId === "string") data.assigneeId = body.assigneeId;
  if (typeof body.approvedDraft === "string") data.approvedDraft = body.approvedDraft;
  const review = await prisma.review.update({ where: { id }, data });
  await recordAudit({ entityType: "Review", entityId: id, action: "review.updated", before, after: review });
  return NextResponse.json(review);
}
