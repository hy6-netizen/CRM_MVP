import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { recordAudit } from "../../../../src/lib/audit";

const VALID_STATUSES = [
  "new",
  "pending_confirmation",
  "confirmed",
  "change_requested",
  "canceled",
  "no_show_risk",
  "completed",
];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = await prisma.reservation.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.status === "string" && VALID_STATUSES.includes(body.status)) data.status = body.status;
  if (typeof body.assigneeId === "string") data.assigneeId = body.assigneeId;
  if (typeof body.notes === "string") data.notes = body.notes;
  const reservation = await prisma.reservation.update({ where: { id }, data });
  await recordAudit({
    entityType: "Reservation",
    entityId: id,
    action: "reservation.updated",
    before,
    after: reservation,
  });
  return NextResponse.json(reservation);
}
