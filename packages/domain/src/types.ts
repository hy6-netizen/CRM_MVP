// Hospital Ops Hub — shared domain types
// 모든 패키지가 import 하는 공통 타입.

export type RiskLevel = "low" | "medium" | "high";
export type Sentiment = "positive" | "neutral" | "negative" | "sensitive";
export type ReviewCategory =
  | "친절"
  | "치료만족"
  | "회복후기"
  | "짧은감사"
  | "재방문의사"
  | "불만"
  | "기타";

export type Channel =
  | "naver_reservation"
  | "naver_talk"
  | "naver_review"
  | "kakao_channel"
  | "kakao_biz"
  | "manual"
  | "unknown";

export type Role = "admin" | "manager" | "staff" | "reviewer";

export type ReservationStatus =
  | "new"
  | "pending_confirmation"
  | "confirmed"
  | "change_requested"
  | "canceled"
  | "no_show_risk"
  | "completed";

export type ConversationStatus =
  | "new"
  | "in_progress"
  | "waiting_patient"
  | "resolved"
  | "escalated"
  | "archived";

export type ConversationCategory =
  | "진료시간"
  | "위치/주차"
  | "예약문의"
  | "예약변경취소"
  | "비용문의"
  | "준비물복장"
  | "서류문의"
  | "증상상담"
  | "불만민원"
  | "환불분쟁"
  | "기타";

export type ReviewStatus =
  | "new"
  | "draft_generated"
  | "needs_review"
  | "approved"
  | "posted"
  | "archived"
  | "escalated";

export type MessageDirection = "inbound" | "outbound" | "draft" | "system";

export type TemplateCode =
  | "RESERVATION_CONFIRM"
  | "RESERVATION_REMINDER"
  | "RESERVATION_CHANGE"
  | "TALK_HOURS"
  | "TALK_LOCATION"
  | "TALK_PARKING"
  | "TALK_PRICE_RANGE"
  | "TALK_DOCUMENTS"
  | "REVIEW_POSITIVE_SHORT"
  | "REVIEW_POSITIVE_TREATMENT"
  | "REVIEW_POSITIVE_KINDNESS"
  | "REVIEW_NEGATIVE_FIRST_RESPONSE";

export interface ComplianceIssue {
  type: "BLOCKED" | "CAUTION";
  expression: string;
  location?: string;
  rule: string;
  suggestion: string;
}

export interface ComplianceResult {
  status: "approved" | "rejected" | "revision_required";
  issues: ComplianceIssue[];
  approvedDraft: string;
}

export interface ReviewEngineInput {
  rating: number;
  content: string;
  reviewerName?: string;
  treatmentMentioned?: string;
  staffMentioned?: string;
}

export interface ReviewEngineOutput {
  sentiment: Sentiment;
  category: ReviewCategory;
  riskLevel: RiskLevel;
  draft: string;
  reasons: string[];
  needsHumanReview: boolean;
  pledgeUsed?: string;
}

export interface DashboardSummary {
  todayReservations: number;
  unconfirmedReservations: number;
  staleReservationsOver30m: number;
  newConversations: number;
  unansweredConversations: number;
  newReviews: number;
  reviewsPendingReply: number;
  sensitiveIssues: number;
}
