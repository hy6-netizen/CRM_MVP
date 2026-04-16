import type { ComplianceIssue, ComplianceResult } from "@hub/domain/src/types";

const BLOCKED_EXPRESSIONS = [
  "완치",
  "100%",
  "반드시 낫습니다",
  "부작용 없는",
  "최고",
  "최초",
  "유일",
  "국내 1위",
  "후기 작성 시 혜택",
  "타 병원과 달리",
  "양방에서는 못 고치는"
];

const CAUTION_EXPRESSIONS = ["반드시", "확실히", "절대", "완벽하게"];

export function runComplianceCheck(draft: string): ComplianceResult {
  const issues: ComplianceIssue[] = [];

  for (const expression of BLOCKED_EXPRESSIONS) {
    if (draft.includes(expression)) {
      issues.push({
        type: "BLOCKED",
        expression,
        rule: "MED-ADV-BLOCK-01",
        suggestion: "개인차가 있을 수 있다는 표현과 일반적 안내 문구로 수정하세요."
      });
    }
  }

  for (const expression of CAUTION_EXPRESSIONS) {
    if (draft.includes(expression)) {
      issues.push({
        type: "CAUTION",
        expression,
        rule: "MED-ADV-CAUTION-01",
        suggestion: "단정 표현을 피하고 가능성 중심 표현으로 수정하세요."
      });
    }
  }

  if (issues.some((item) => item.type === "BLOCKED")) {
    return { status: "rejected", issues, approvedDraft: "" };
  }

  if (issues.length > 0) {
    const revised = draft.replaceAll("반드시", "도움이 될 수 있도록").replaceAll("확실히", "신중히");
    return { status: "revision_required", issues, approvedDraft: revised };
  }

  return { status: "approved", issues: [], approvedDraft: draft };
}
