import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!n.dismissedAt) {
    const updated = await prisma.notification.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
    await recordAudit({
      actorName: "operator",
      entityType: "Notification",
      entityId: id,
      action: "notification.dismissed",
    });
    return NextResponse.json(updated);
  }
  return NextResponse.json(n);
}
