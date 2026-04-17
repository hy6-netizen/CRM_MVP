import { NextResponse } from "next/server";
import { findNotification, recordAudit, __mockMeta } from "../../../../../src/lib/mockStore";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = findNotification(id);
  if (!n) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!n.dismissedAt) {
    n.dismissedAt = __mockMeta.now();
    recordAudit({
      actorName: "operator",
      entityType: "Notification",
      entityId: id,
      action: "notification.dismissed",
    });
  }
  return NextResponse.json(n);
}
