import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (review.status !== "approved") {
    return NextResponse.json({ error: "not_approved" }, { status: 400 });
  }
  const updated = await prisma.review.update({
    where: { id },
    data: { status: "posted", postedAt: new Date() },
  });
  await recordAudit({
    entityType: "Review",
    entityId: id,
    action: "review.posted",
    before: review,
    after: { status: updated.status, postedAt: updated.postedAt },
  });
  return NextResponse.json(updated);
}
