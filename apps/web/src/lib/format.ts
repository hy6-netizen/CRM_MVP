// 시간/리스크/상태 라벨 등을 화면에서 표시할 때 쓰는 헬퍼.

import type {
  ConversationStatus,
  ReservationStatus,
  ReviewStatus,
  RiskLevel,
} from "@hub/domain/src/types";

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < -60) return formatDateTime(iso);
  if (m < 0) return `${Math.abs(m)}분 후`;
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  new: "신규",
  pending_confirmation: "확정 대기",
  confirmed: "확정 완료",
  change_requested: "변경 요청",
  canceled: "취소",
  no_show_risk: "노쇼 위험",
  completed: "완료",
};

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  new: "신규",
  in_progress: "응대 중",
  waiting_patient: "환자 회신 대기",
  resolved: "완료",
  escalated: "에스컬레이션",
  archived: "보관",
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  new: "신규",
  draft_generated: "초안 생성",
  needs_review: "검토 필요",
  approved: "승인",
  posted: "등록 완료",
  archived: "보관",
  escalated: "에스컬레이션",
};

export function riskBadgeClass(r: RiskLevel) {
  return r === "high" ? "badge-high" : r === "medium" ? "badge-medium" : "badge-low";
}

export function riskLabel(r: RiskLevel) {
  return r === "high" ? "고위험" : r === "medium" ? "주의" : "안전";
}
