import type {
  MessageProvider,
  ProviderCapability,
  ReservationProvider,
  ReviewProvider,
  SyncProviderResult,
} from "../types";

export const unsupportedPost: SyncProviderResult = {
  success: false,
  message: "자동 등록 미지원. 운영자 수동 등록 + 등록 완료 처리를 사용하세요.",
};

const baseCapability: ProviderCapability = {
  canFetchReservations: false,
  canFetchReviews: false,
  canPostReviewReply: false,
  canSendBizMessage: false,
  canAutoConfirmReservation: false,
  canIngestMessages: false,
};

export const mockReservationProvider: ReservationProvider = {
  channel: "naver_reservation",
  capability: { ...baseCapability, canFetchReservations: true },
  async fetchReservations() {
    return [
      {
        externalReservationId: "naver-rsv-mock-001",
        patientName: "김○○",
        phoneMasked: "010-****-1234",
        reservationAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        status: "pending_confirmation",
      },
    ];
  },
  async confirmReservation() {
    return { success: false, message: "자동 확정 미지원. 매니저 승인 후 manual confirm 사용." };
  },
};

export const mockReviewProvider: ReviewProvider = {
  channel: "naver_review",
  capability: { ...baseCapability, canFetchReviews: true },
  async fetchReviews() {
    return [
      {
        externalReviewId: "naver-rv-mock-001",
        reviewerNameMasked: "이**",
        rating: 5,
        content: "친절히 설명해주셔서 감사했습니다.",
        createdAt: new Date().toISOString(),
      },
    ];
  },
  async postReply() {
    return unsupportedPost;
  },
};

export const mockMessageProvider: MessageProvider = {
  channel: "kakao_channel",
  capability: { ...baseCapability, canIngestMessages: true },
  async fetchMessages() {
    return [
      {
        externalThreadId: "kakao-thread-mock-001",
        contactName: "강○○",
        content: "오늘 진료시간 어떻게 되나요?",
        createdAt: new Date().toISOString(),
      },
    ];
  },
  async sendMessage() {
    return { success: false, message: "비즈 메시지 발송 sandbox 미연결." };
  },
};
