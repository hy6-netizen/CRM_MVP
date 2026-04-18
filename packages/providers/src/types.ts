// Channel adapter 인터페이스.
//
// 핵심 원칙(from-gpt-to-claude 문서 반영):
// - 공식 API 미확인 영역을 "지원됨"인 것처럼 가정하지 않는다.
// - 각 기능을 CapabilityFlag 로 세분화해 UI 에서 상태와 근거를 보여준다.
// - capability=false 여도 UI 에서 숨기지 않고 "수동 처리" 흐름으로 fallback.
// - 카카오는 상담톡/챗봇/비즈메시지를 별개 provider 로 다룬다 (성격이 다르므로).

import type { Channel } from "@hub/domain/src/types";

export type CapabilityStatus =
  | "supported"    // 공식 API/상품으로 확인됨, 앱이 자동 처리
  | "manual"       // 앱이 UI 제공, 실제 외부 조작은 운영자 수동
  | "unknown"      // 공식 가이드 미확인, 추가 조사 필요
  | "unavailable"; // 공식적으로 불가 / 대행사·딜러사 계약 필요

export interface CapabilityFlag {
  status: CapabilityStatus;
  /** UI 에 표시할 근거/안내 한 문장. */
  note?: string;
  /** supported 로 전환 시 필요한 조건 (딜러사 계약, 템플릿 심사 등). */
  unblock?: string;
}

/**
 * from-gpt-to-claude §5-2 에서 요구한 capability flag 네이밍 준수.
 * 각 provider 는 이 중 자신이 다루는 필드만 채우고 나머지는 unavailable/unknown 으로 둔다.
 */
export interface ProviderCapability {
  canReceiveMessages: CapabilityFlag;
  canSendMessages: CapabilityFlag;
  canSyncReservations: CapabilityFlag;
  canAutoConfirmReservations: CapabilityFlag;
  canImportReviews: CapabilityFlag;
  canPostReviewReplies: CapabilityFlag;
  canAutoRespondFaq: CapabilityFlag;
  canSendBizMessage: CapabilityFlag;
}

export function cap(status: CapabilityStatus, note?: string, unblock?: string): CapabilityFlag {
  return { status, note, unblock };
}

export const defaultCapability: ProviderCapability = {
  canReceiveMessages: cap("unavailable"),
  canSendMessages: cap("unavailable"),
  canSyncReservations: cap("unavailable"),
  canAutoConfirmReservations: cap("unavailable"),
  canImportReviews: cap("unavailable"),
  canPostReviewReplies: cap("unavailable"),
  canAutoRespondFaq: cap("unavailable"),
  canSendBizMessage: cap("unavailable"),
};

export interface SyncProviderResult {
  success: boolean;
  message: string;
  importedCount?: number;
}

// ─────────────────────────────────────
// Data shape interfaces
// ─────────────────────────────────────

export interface ReservationFetchInput {
  since?: string;
  until?: string;
}

export interface ReservationFetchItem {
  externalReservationId: string;
  patientName: string;
  phoneMasked?: string;
  reservationAt: string;
  status?: string;
}

export interface ReviewFetchItem {
  externalReviewId: string;
  reviewerNameMasked?: string;
  rating: number;
  content: string;
  imageUrl?: string;
  createdAt: string;
}

export interface MessageIngestItem {
  externalThreadId: string;
  contactName?: string;
  content: string;
  createdAt: string;
}

// ─────────────────────────────────────
// Provider interfaces (by role, not by vendor)
// ─────────────────────────────────────

export interface BaseProvider {
  name: string;
  channel: Channel;
  capability: ProviderCapability;
}

export interface ReservationProvider extends BaseProvider {
  fetchReservations(input: ReservationFetchInput): Promise<ReservationFetchItem[]>;
  confirmReservation(externalId: string): Promise<SyncProviderResult>;
}

export interface ReviewProvider extends BaseProvider {
  fetchReviews(): Promise<ReviewFetchItem[]>;
  postReply(externalReviewId: string, body: string): Promise<SyncProviderResult>;
}

/** 실시간 양방향 상담 (카카오 상담톡, 네이버 톡톡 통합 등). */
export interface ConsultProvider extends BaseProvider {
  fetchMessages(): Promise<MessageIngestItem[]>;
  sendMessage(threadId: string, body: string): Promise<SyncProviderResult>;
}

/** FAQ 자동응답 (카카오 챗봇 등). 웹훅 기반이라 push 는 없고 verify/respond 만. */
export interface ChatbotProvider extends BaseProvider {
  /** webhook payload 검증 (signature / bot id). 향후 구현. */
  verifyWebhook(headers: Record<string, string>, body: string): Promise<boolean>;
  /** intent → 템플릿 매칭으로 답변 생성. */
  buildResponse(utterance: string): Promise<{ text: string; matched: boolean }>;
}

/** 정보성/마케팅 발송 전용 (알림톡, 친구톡, 문자). */
export interface BizMessageProvider extends BaseProvider {
  sendTemplateMessage(
    phone: string,
    templateCode: string,
    variables: Record<string, string>,
  ): Promise<SyncProviderResult>;
}
