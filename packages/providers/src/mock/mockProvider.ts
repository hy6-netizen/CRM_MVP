import type { ReservationAdapter, ReviewAdapter, SyncProviderResult } from "../types";

const unsupportedPost: SyncProviderResult = {
  success: false,
  message: "공식 연동 capability가 없어 자동 등록을 지원하지 않습니다. 수동 등록으로 전환하세요."
};

export const mockReservationAdapter: ReservationAdapter = {
  providerName: "mock_naver_reservation",
  capability: {
    canFetchReservations: true,
    canFetchReviews: false,
    canPostReviewReply: false,
    canSendBizMessage: false,
    canAutoConfirmReservation: false
  },
  async syncReservations() {
    return { success: true, message: "Mock reservations synced", importedCount: 5 };
  }
};

export const mockReviewAdapter: ReviewAdapter = {
  providerName: "mock_naver_review",
  capability: {
    canFetchReservations: false,
    canFetchReviews: true,
    canPostReviewReply: false,
    canSendBizMessage: false,
    canAutoConfirmReservation: false
  },
  async ingestReviews() {
    return { success: true, message: "Mock reviews imported", importedCount: 3 };
  },
  async postReply() {
    return unsupportedPost;
  }
};
