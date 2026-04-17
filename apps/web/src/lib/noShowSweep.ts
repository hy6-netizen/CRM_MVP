// 노쇼 감지 sweep
//
// 규칙: reservationAt 이 "지금 - 20분" 보다 과거이면서
//       status 가 아직 pending_confirmation / confirmed / new 인 예약을 찾으면,
// 1) status 를 no_show_risk 로 전환
// 2) 관리자 알림 (알림톡 stub + in-app notification) 생성
// 3) 감사 로그 기록
//
// MVP 에선 전용 cron 없이, 대시보드가 로드될 때마다 idempotent 하게 실행.
// BullMQ 도입 시 이 함수를 periodic job 으로 옮기면 됨.

import { sendManagerAlert } from "@hub/providers/src/kakao/managerAlert";
import {
  addNotification,
  notifications,
  recordAudit,
  reservations,
  users,
} from "./mockStore";
import type { NotificationRow, ReservationRow } from "./mockStore";

const NO_SHOW_THRESHOLD_MS = 20 * 60_000; // 20분

function pickManager() {
  return users.find((u) => u.role === "manager") ?? users.find((u) => u.role === "admin");
}

function hasOpenNotification(reservationId: string): boolean {
  return notifications.some(
    (n) => n.entityType === "Reservation" && n.entityId === reservationId && !n.dismissedAt,
  );
}

async function handleSingle(r: ReservationRow) {
  if (r.status === "no_show_risk") {
    // 이미 전환되어 있다면 알림만 중복 방지.
    if (hasOpenNotification(r.id)) return;
  }

  const before = { ...r };
  const wasTransitioned = r.status !== "no_show_risk";
  if (wasTransitioned) {
    r.status = "no_show_risk";
    recordAudit({
      actorId: undefined,
      actorName: "system",
      entityType: "Reservation",
      entityId: r.id,
      action: "reservation.no_show_risk.auto_detected",
      before,
      after: { status: r.status },
    });
  }

  if (hasOpenNotification(r.id)) return;

  const manager = pickManager();
  const title = `노쇼 위험: ${r.patientName} 님 (${minutesLate(r.reservationAt)}분 경과)`;
  const body = `${r.patientName}(${r.phoneMasked}) 님이 예약 시간에서 20분 이상 도착하지 않았습니다. 전화로 확인 부탁드립니다.`;

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

  addNotification({
    level: "critical",
    title,
    body,
    entityType: "Reservation",
    entityId: r.id,
    deliveredVia: alertResult.delivered ? "alimtalk" : "in_app_only",
  });

  recordAudit({
    actorId: undefined,
    actorName: "system",
    entityType: "Reservation",
    entityId: r.id,
    action: alertResult.delivered ? "alert.alimtalk_sent" : "alert.queued_stub",
    after: { provider: alertResult.provider, delivered: alertResult.delivered },
  });
}

function minutesLate(reservationAtIso: string): number {
  return Math.floor((Date.now() - new Date(reservationAtIso).getTime()) / 60_000);
}

export async function runNoShowSweep(): Promise<{ transitioned: number; alertsQueued: number }> {
  let transitioned = 0;
  let alertsQueued = 0;
  const cutoff = Date.now() - NO_SHOW_THRESHOLD_MS;

  for (const r of reservations) {
    const at = new Date(r.reservationAt).getTime();
    if (at >= cutoff) continue;
    if (!["pending_confirmation", "confirmed", "new"].includes(r.status) && r.status !== "no_show_risk") continue;
    const wasActive = r.status !== "no_show_risk";
    await handleSingle(r);
    if (wasActive) transitioned++;
    alertsQueued++;
  }

  return { transitioned, alertsQueued };
}

export function openNotifications(): NotificationRow[] {
  return notifications.filter((n) => !n.dismissedAt);
}
