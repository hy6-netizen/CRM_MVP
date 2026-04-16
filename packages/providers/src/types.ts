export interface ProviderCapability {
  canFetchReservations: boolean;
  canFetchReviews: boolean;
  canPostReviewReply: boolean;
  canSendBizMessage: boolean;
  canAutoConfirmReservation: boolean;
}

export interface SyncProviderResult {
  success: boolean;
  message: string;
  importedCount?: number;
}

export interface ReservationAdapter {
  providerName: string;
  capability: ProviderCapability;
  syncReservations(): Promise<SyncProviderResult>;
}

export interface ReviewAdapter {
  providerName: string;
  capability: ProviderCapability;
  ingestReviews(): Promise<SyncProviderResult>;
  postReply?(args: { reviewId: string; draft: string }): Promise<SyncProviderResult>;
}
