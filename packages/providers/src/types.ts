export interface ProviderCapability { canFetchReservations: boolean; canFetchReviews: boolean; canPostReviewReply: boolean; canSendBizMessage: boolean; canAutoConfirmReservation: boolean; }
export interface SyncProviderResult { success: boolean; message: string; importedCount?: number; }
