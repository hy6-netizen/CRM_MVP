// 시간 기반 자동 감지 — 대시보드 렌더 시 idempotent 실행.
// 1) runNoShowSweep: 20분+ 지난 예약을 no_show_risk 로 전환 + 알림
// 2) runUnansweredConversationSweep: 30분+ 미응답 new/in_progress 상담 → 알림

import { sendManagerAlert } from "@hub/providers/src/kakao/managerAlert";
import { prisma } from "./db";

const NO_SHOW_THRESHOLD_MS = 20 * 60_000;
const UNANSWERED_THRESHOLD_MS = 30 * 60_000;

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

export async function runUnansweredConversationSweep(): Promise<{ alertsQueued: number }> {
  const cutoff = new Date(Date.now() - UNANSWERED_THRESHOLD_MS);
  let alertsQueued = 0;

  // new / in_progress 상태이면서 마지막 메시지가 30분+ 전인 대화.
  // waiting_patient 는 환자 답을 기다리는 거라 제외.
  const stale = await prisma.conversation.findMany({
    where: {
      status: { in: ["new", "in_progress"] },
      lastMessageAt: { lt: cutoff },
    },
    include: { assignee: true },
  });

  const fallbackManager = await prisma.user.findFirst({ where: { role: { in: ["manager", "admin"] } } });

  for (const c of stale) {
    const existing = await prisma.notification.findFirst({
      where: { entityType: "Conversation", entityId: c.id, dismissedAt: null },
    });
    if (existing) continue;

    const target = c.assignee ?? fallbackManager;
    const elapsed = Math.floor((Date.now() - c.lastMessageAt.getTime()) / 60_000);
    const title = `미응답 상담 ${elapsed}분 경과: ${c.contactName ?? "환자"}`;
    const body = `${c.contactName ?? "환자"} 님이 보낸 메시지에 ${elapsed}분 동안 응답이 없습니다. 담당자 확인 부탁드립니다.`;

    const alertResult = target
      ? await sendManagerAlert({
          reason: "custom",
          managerName: target.name,
          managerPhoneMasked: "010-****-0000",
          title,
          body,
          relatedEntity: { type: "Conversation", id: c.id },
        })
      : { delivered: false as const, provider: "stub" as const };

    await prisma.notification.create({
      data: {
        level: "warning",
        title,
        body,
        entityType: "Conversation",
        entityId: c.id,
        deliveredVia: alertResult.delivered ? "alimtalk" : "in_app_only",
      },
    });

    await prisma.auditLog.create({
      data: {
        actorName: "system",
        entityType: "Conversation",
        entityId: c.id,
        action: alertResult.delivered ? "alert.alimtalk_sent" : "alert.queued_stub",
        afterJson: { reason: "unanswered_30m", minutes: elapsed, targetId: target?.id } as object,
      },
    });
    alertsQueued++;
  }

  return { alertsQueued };
}

export async function runAllSweeps() {
  const [noShow, unanswered] = await Promise.all([runNoShowSweep(), runUnansweredConversationSweep()]);
  return { noShow, unanswered };
}

export async function openNotifications() {
  return prisma.notification.findMany({
    where: { dismissedAt: null },
    orderBy: { createdAt: "desc" },
  });
}
