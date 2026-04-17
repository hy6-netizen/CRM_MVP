// 파싱된 네이버 예약 이메일 이벤트를 DB 에 적용.
// ingest 라우트와 gmailPoll 워커가 공유해서 쓰는 정책 모듈.

import { prisma } from "./db";
import type { NaverBookingEmailParsed, ParsedReservationItem } from "./parsers/naverBookingEmail";
import { recordAudit } from "./audit";

export interface ApplyResult {
  created: number;
  updated: number;
  canceled: number;
  skipped: number;
  records: Array<{
    externalReservationId: string;
    op: "create" | "update" | "cancel" | "skip";
    reason?: string;
  }>;
}

function buildNotes(item: ParsedReservationItem, extra?: string): string | undefined {
  const parts = [
    item.productName && `상품: ${item.productName}`,
    item.requests && `요청: ${item.requests}`,
    extra,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export async function applyNaverBookingEvent(
  parsed: NaverBookingEmailParsed,
  context: { actorName?: string; source?: string } = {},
): Promise<ApplyResult> {
  const result: ApplyResult = { created: 0, updated: 0, canceled: 0, skipped: 0, records: [] };
  const actorName = context.actorName ?? "naver-email-ingest";
  const sourceLabel = context.source ?? "email";

  // 1) 취소 대상 처리 (canceled 및 changed 모두에서 발생 가능)
  if (parsed.canceledReservation) {
    const c = parsed.canceledReservation;
    const existing = await prisma.reservation.findFirst({
      where: { externalReservationId: c.externalReservationId },
    });
    const notes = buildNotes(
      c,
      parsed.cancelReason ? `취소사유: ${parsed.cancelReason}` : "네이버에서 취소됨",
    );
    if (existing) {
      if (existing.status !== "canceled") {
        await prisma.reservation.update({
          where: { id: existing.id },
          data: { status: "canceled", notes: notes ?? existing.notes },
        });
        await recordAudit({
          actorName,
          entityType: "Reservation",
          entityId: existing.id,
          action: `reservation.canceled_from_${sourceLabel}`,
          before: { status: existing.status },
          after: { status: "canceled", reason: parsed.cancelReason },
        });
        result.canceled++;
        result.records.push({ externalReservationId: c.externalReservationId, op: "cancel" });
      } else {
        result.skipped++;
        result.records.push({ externalReservationId: c.externalReservationId, op: "skip", reason: "이미 canceled" });
      }
    } else {
      // 레코드 없는데 취소 메일 → 취소 상태로 새로 생성 (이력 보존)
      const created = await prisma.reservation.create({
        data: {
          sourceChannel: "naver_reservation",
          externalReservationId: c.externalReservationId,
          patientName: parsed.patientName,
          phoneMasked: "-",
          reservationAt: c.reservationAt,
          status: "canceled",
          notes,
        },
      });
      await recordAudit({
        actorName,
        entityType: "Reservation",
        entityId: created.id,
        action: `reservation.backfilled_canceled_from_${sourceLabel}`,
        after: { externalReservationId: c.externalReservationId, reason: parsed.cancelReason },
      });
      result.canceled++;
      result.records.push({ externalReservationId: c.externalReservationId, op: "cancel", reason: "신규 레코드(backfill) 생성 후 canceled" });
    }
  }

  // 2) 신규 / 변경의 신규예약내역 처리
  if (parsed.newReservation) {
    const n = parsed.newReservation;
    const existing = await prisma.reservation.findFirst({
      where: { externalReservationId: n.externalReservationId },
    });
    const notes = buildNotes(
      n,
      parsed.eventType === "changed" ? "변경된 예약 (이전 예약은 취소됨)" : undefined,
    );
    if (existing) {
      await prisma.reservation.update({
        where: { id: existing.id },
        data: { reservationAt: n.reservationAt, notes: notes ?? existing.notes },
      });
      result.updated++;
      result.records.push({ externalReservationId: n.externalReservationId, op: "update" });
    } else {
      const created = await prisma.reservation.create({
        data: {
          sourceChannel: "naver_reservation",
          externalReservationId: n.externalReservationId,
          patientName: parsed.patientName,
          phoneMasked: "-",
          reservationAt: n.reservationAt,
          status: "new",
          notes,
        },
      });
      await recordAudit({
        actorName,
        entityType: "Reservation",
        entityId: created.id,
        action:
          parsed.eventType === "changed"
            ? `reservation.ingested_change_from_${sourceLabel}`
            : `reservation.ingested_from_${sourceLabel}`,
        after: { confidence: parsed.confidence, warnings: parsed.warnings },
      });
      result.created++;
      result.records.push({ externalReservationId: n.externalReservationId, op: "create" });
    }
  }

  return result;
}
