import type { ComplianceIssue, ComplianceResult } from "@hub/domain/src/types";
const BLOCKED = ["완치","100%","반드시 낫습니다","부작용 없는","최고","최초","유일","국내 1위","후기 작성 시 혜택","타 병원과 달리","양방에서는 못 고치는"];
const CAUTION = ["반드시","확실히","절대","완벽하게"];
export function runComplianceCheck(draft: string): ComplianceResult {
const issues: ComplianceIssue[] = [];
for (const e of BLOCKED) if (draft.includes(e)) issues.push({ type: "BLOCKED", expression: e, rule: "MED-ADV-BLOCK-01", suggestion: "가능성/개인차 표현으로 수정" });
for (const e of CAUTION) if (draft.includes(e)) issues.push({ type: "CAUTION", expression: e, rule: "MED-ADV-CAUTION-01", suggestion: "단정 표현 완화" });
if (issues.some((i) => i.type === "BLOCKED")) return { status: "rejected", issues, approvedDraft: "" };
if (issues.length) return { status: "revision_required", issues, approvedDraft: draft.replaceAll("반드시","도움이 될 수 있도록").replaceAll("확실히","신중히") };
return { status: "approved", issues: [], approvedDraft: draft };
}
