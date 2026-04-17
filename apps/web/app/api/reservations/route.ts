import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/db";
import { recordAudit } from "../../../src/lib/audit";

const CreateSchema = z.object({
  patientName: z.string().min(1),
  phoneMasked: z.string().min(4),
  reservationAt: z.string().min(1),
  notes: z.string().optional(),
  sourceChannel: z
    .enum(["naver_reservation", "naver_talk", "naver_review", "kakao_channel", "kakao_biz", "manual", "unknown"])
    .default("manual"),
  status: z
    .enum(["new", "pending_confirmation", "confirmed", "change_requested", "canceled", "no_show_risk", "completed"])
    .default("pending_confirmation"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const items = await prisma.reservation.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { reservationAt: "asc" },
    take: 500,
  });
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const row = await prisma.reservation.create({
    data: {
      sourceChannel: parsed.data.sourceChannel as never,
      patientName: parsed.data.patientName,
      phoneMasked: parsed.data.phoneMasked,
      reservationAt: new Date(parsed.data.reservationAt),
      status: parsed.data.status as never,
      notes: parsed.data.notes,
    },
  });
  await recordAudit({
    actorName: "operator",
    entityType: "Reservation",
    entityId: row.id,
    action: "reservation.created_manual",
    after: row,
  });
  return NextResponse.json(row, { status: 201 });
}
