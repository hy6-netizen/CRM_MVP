export type UserRole = "admin" | "manager" | "staff" | "reviewer";

export type ConversationCategory =
  | "진료시간 문의"
  | "위치/주차"
  | "예약 문의"
  | "예약 변경/취소"
  | "비용 문의"
  | "준비물/복장"
  | "서류 문의"
  | "증상 상담"
  | "불만/민원"
  | "환불/분쟁"
  | "기타";

export type RiskLevel = "low" | "medium" | "high";

export interface ReviewEngineOutput {
  sentiment: "positive" | "neutral" | "negative" | "sensitive";
  category: "친절" | "치료만족" | "회복후기" | "짧은감사" | "재방문의사" | "불만" | "기타";
  riskLevel: RiskLevel;
  draft: string;
  reasons: string[];
  needsHumanReview: boolean;
}

export interface ComplianceIssue {
  type: "BLOCKED" | "CAUTION";
  expression: string;
  rule: string;
  suggestion: string;
}

export interface ComplianceResult {
  status: "approved" | "rejected" | "revision_required";
  issues: ComplianceIssue[];
  approvedDraft: string;
}
