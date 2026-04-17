// 노쇼 감지 sweep. 대시보드 렌더 시 idempotent 실행.
// 20분 이상 지난 pending/confirmed/new 예약을 no_show_risk 로 전환 + 관리자 알림 생성.

import { sendManagerAlert } from "@hub/providers/src/kakao/managerAlert";
import { prisma } from "./db";

const NO_SHOW_THRESHOLD_MS = 20 * 60_000;

function minutesLate(reservationAt: Date): number {
  return Math.floor((Date.now() - reservationAt.getTime()) / 60_000);
}

export async function runNoShowSweep(): Promise<{ transitioned: number; alertsQueued: number }> {
  const cutoff = new Date(Date.now() - NO_SHOW_THRESHOLD_MS);
  let transitioned = 0;
  let alertsQueued = 0;

  const candidates = await prisma.reservation.findMany({
    where: {
      reservationAt: { lt: cutoff },
      status: { in: ["pending_confirmation", "confirmed", "new", "no_show_risk"] },
    },
  });

  const manager = await prisma.user.findFirst({ where: { role: { in: ["manager", "admin"] } } });

  for (const r of candidates) {
    const wasActive = r.status !== "no_show_risk";
    if (wasActive) {
      await prisma.reservation.update({ where: { id: r.id }, data: { status: "no_show_risk" } });
      await prisma.auditLog.create({
        data: {
          actorName: "system",
          entityType: "Reservation",
          entityId: r.id,
          action: "reservation.no_show_risk.auto_detected",
          beforeJson: { status: r.status } as object,
          afterJson: { status: "no_show_risk" } as object,
        },
      });
      transitioned++;
    }

    // 이미 dismiss 되지 않은 알림이 있으면 중복 생성 방지
    const existing = await prisma.notification.findFirst({
      where: { entityType: "Reservation", entityId: r.id, dismissedAt: null },
    });
    if (existing) continue;

    const title = `노쇼 위험: ${r.patientName} 님 (${minutesLate(r.reservationAt)}분 경과)`;
    const body = `${r.patientName}(${r.phoneMasked ?? "-"}) 님이 예약 시간에서 20분 이상 도착하지 않았습니다. 전화로 확인 부탁드립니다.`;

    const alertResult = manager
      ? await sendManagerAlert({
          reason: "no_show_20m",
          managerName: manager.name,
          managerPhoneMasked: "010-****-0000",
          title,
          body,
          relatedEntity: { type: "Reservation", id: r.id },
        })
      : { delivered: false as const, provider: "stub" as const };

    await prisma.notification.create({
      data: {
        level: "critical",
        title,
        body,
        entityType: "Reservation",
        entityId: r.id,
        deliveredVia: alertResult.delivered ? "alimtalk" : "in_app_only",
      },
    });

    await prisma.auditLog.create({
      data: {
        actorName: "system",
        entityType: "Reservation",
        entityId: r.id,
        action: alertResult.delivered ? "alert.alimtalk_sent" : "alert.queued_stub",
        afterJson: { provider: alertResult.provider, delivered: alertResult.delivered } as object,
      },
    });

    alertsQueued++;
  }

  return { transitioned, alertsQueued };
}

export async function openNotifications() {
  return prisma.notification.findMany({
    where: { dismissedAt: null },
    orderBy: { createdAt: "desc" },
  });
}
