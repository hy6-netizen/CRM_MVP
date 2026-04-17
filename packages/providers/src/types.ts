// Channel adapter 인터페이스. 공식 API 미확인 영역을 mock 으로 먼저 구현하고
// 추후 실제 SDK 가 확보되면 동일 인터페이스로 교체한다.

import type { Channel } from "@hub/domain/src/types";

export interface ProviderCapability {
  canFetchReservations: boolean;
  canFetchReviews: boolean;
  canPostReviewReply: boolean;
  canSendBizMessage: boolean;
  canAutoConfirmReservation: boolean;
  canIngestMessages: boolean;
}

export interface SyncProviderResult {
  success: boolean;
  message: string;
  importedCount?: number;
}

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

export interface ReservationProvider {
  channel: Channel;
  capability: ProviderCapability;
  fetchReservations(input: ReservationFetchInput): Promise<ReservationFetchItem[]>;
  confirmReservation(externalId: string): Promise<SyncProviderResult>;
}

export interface ReviewProvider {
  channel: Channel;
  capability: ProviderCapability;
  fetchReviews(): Promise<ReviewFetchItem[]>;
  postReply(externalReviewId: string, body: string): Promise<SyncProviderResult>;
}

export interface MessageProvider {
  channel: Channel;
  capability: ProviderCapability;
  fetchMessages(): Promise<MessageIngestItem[]>;
  sendMessage(threadId: string, body: string): Promise<SyncProviderResult>;
}
