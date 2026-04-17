import { NextResponse } from "next/server";
import { findReservation, recordAudit } from "../../../../src/lib/mockStore";
import type { ReservationStatus } from "@hub/domain/src/types";

const VALID_STATUSES: ReservationStatus[] = [
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
  const r = findReservation(id);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const before = { ...r };
  if (typeof body.status === "string" && (VALID_STATUSES as string[]).includes(body.status)) {
    r.status = body.status as ReservationStatus;
  }
  if (typeof body.assigneeId === "string") r.assigneeId = body.assigneeId;
  if (typeof body.notes === "string") r.notes = body.notes;
  recordAudit({ entityType: "Reservation", entityId: id, action: "reservation.updated", before, after: { ...r } });
  return NextResponse.json(r);
}
