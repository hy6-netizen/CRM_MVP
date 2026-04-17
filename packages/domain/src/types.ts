export type RiskLevel = "low" | "medium" | "high";
export interface ComplianceIssue { type: "BLOCKED" | "CAUTION"; expression: string; rule: string; suggestion: string; }
export interface ComplianceResult { status: "approved" | "rejected" | "revision_required"; issues: ComplianceIssue[]; approvedDraft: string; }
export interface ReviewEngineOutput {
sentiment: "positive" | "neutral" | "negative" | "sensitive";
category: "친절" | "치료만족" | "회복후기" | "짧은감사" | "재방문의사" | "불만" | "기타";
riskLevel: RiskLevel;
draft: string;
reasons: string[];
needsHumanReview: boolean;
}
