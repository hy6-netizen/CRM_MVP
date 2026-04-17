import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, reservations, __mockMeta } from "../../../src/lib/mockStore";
import type { ReservationRow } from "../../../src/lib/mockStore";

const CreateSchema = z.object({
  patientName: z.string().min(1),
  phoneMasked: z.string().min(4),
  reservationAt: z.string().min(1),
  notes: z.string().optional(),
  sourceChannel: z
    .enum([
      "naver_reservation",
      "naver_talk",
      "naver_review",
      "kakao_channel",
      "kakao_biz",
      "manual",
      "unknown",
    ])
    .default("manual"),
  status: z
    .enum([
      "new",
      "pending_confirmation",
      "confirmed",
      "change_requested",
      "canceled",
      "no_show_risk",
      "completed",
    ])
    .default("pending_confirmation"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let list = [...reservations];
  if (status) list = list.filter((r) => r.status === status);
  list.sort((a, b) => +new Date(a.reservationAt) - +new Date(b.reservationAt));
  return NextResponse.json({ items: list, count: list.length });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const row: ReservationRow = {
    id: __mockMeta.nextId("rsv"),
    sourceChannel: parsed.data.sourceChannel,
    patientName: parsed.data.patientName,
    phoneMasked: parsed.data.phoneMasked,
    reservationAt: parsed.data.reservationAt,
    status: parsed.data.status,
    notes: parsed.data.notes,
    createdAt: __mockMeta.now(),
  };
  reservations.unshift(row);
  recordAudit({
    actorName: "operator",
    entityType: "Reservation",
    entityId: row.id,
    action: "reservation.created_manual",
    after: row,
  });
  return NextResponse.json(row, { status: 201 });
}
