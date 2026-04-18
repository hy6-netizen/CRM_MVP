import type { ComplianceIssue, ComplianceResult } from "@hub/domain/src/types";

// compliance_rules.md 와 CRM MVP prompt §11 의 규칙을 코드로 옮긴 결정형 검사기.
// blocked 1건이라도 있으면 rejected. caution 만 있으면 revision_required + suggestion 적용.

interface Rule {
  expression: string;
  rule: string;
  suggestion: string;
}

export const BLOCKED_RULES: readonly Rule[] = [
  { expression: "완치", rule: "MED-ADV-B-01", suggestion: "“증상 완화에 도움이 될 수 있다”로 수정" },
  { expression: "100%", rule: "MED-ADV-B-02", suggestion: "확정적 비율 표현 삭제" },
  { expression: "반드시 낫", rule: "MED-ADV-B-03", suggestion: "“개인차가 있을 수 있다”로 수정" },
  { expression: "확실히 효과", rule: "MED-ADV-B-04", suggestion: "“효과를 기대해볼 수 있다”로 수정" },
  { expression: "부작용 없는", rule: "MED-ADV-B-05", suggestion: "부작용 단정 표현 삭제" },
  { expression: "부작용 제로", rule: "MED-ADV-B-05", suggestion: "부작용 단정 표현 삭제" },
  { expression: "최고", rule: "MED-ADV-B-06", suggestion: "비교/우월 표현 제거" },
  { expression: "최초", rule: "MED-ADV-B-07", suggestion: "최초 주장 근거 없으면 삭제" },
  { expression: "유일", rule: "MED-ADV-B-08", suggestion: "유일성 주장 삭제" },
  { expression: "독보적", rule: "MED-ADV-B-09", suggestion: "비교/우월 표현 제거" },
  { expression: "국내 1위", rule: "MED-ADV-B-10", suggestion: "순위 주장 삭제" },
  { expression: "가장 많은 시술", rule: "MED-ADV-B-11", suggestion: "수치 비교 표현 삭제" },
  { expression: "무료 시술", rule: "MED-ADV-B-12", suggestion: "유인 광고 표현 삭제" },
  { expression: "할인 이벤트", rule: "MED-ADV-B-13", suggestion: "유인 광고 표현 삭제" },
  { expression: "지금 안 하면", rule: "MED-ADV-B-14", suggestion: "공포/조급함 유발 문구 삭제" },
  { expression: "후기 작성 시 혜택", rule: "MED-ADV-B-15", suggestion: "후기 대가성 표현 삭제 (의료법 위반)" },
  { expression: "타 병원과 달리", rule: "MED-ADV-B-16", suggestion: "비교 광고 표현 삭제" },
  { expression: "타 병원보다 우수", rule: "MED-ADV-B-16", suggestion: "비교 광고 표현 삭제" },
  { expression: "양방에서는 못 고치는", rule: "MED-ADV-B-17", suggestion: "한방/양방 비교 표현 삭제" },
  { expression: "한약으로 완치", rule: "MED-ADV-B-18", suggestion: "단정 표현 삭제" },
  { expression: "침 한 번이면", rule: "MED-ADV-B-19", suggestion: "단정 표현 삭제" },
  { expression: "동의보감에 나온 치료법으로 확실히", rule: "MED-ADV-B-20", suggestion: "고전 출처 + 확정 표현 삭제" },
];

export const CAUTION_RULES: readonly Rule[] = [
  { expression: "반드시", rule: "MED-ADV-C-01", suggestion: "“도움이 될 수 있다”로 완화" },
  { expression: "확실히", rule: "MED-ADV-C-02", suggestion: "“기대해볼 수 있다”로 완화" },
  { expression: "절대", rule: "MED-ADV-C-03", suggestion: "단정 표현 완화" },
  { expression: "완벽", rule: "MED-ADV-C-04", suggestion: "“충분히 살피겠다” 등으로 완화" },
  { expression: "100% ", rule: "MED-ADV-C-05", suggestion: "비율 단정 표현 완화" },
  { expression: "최상", rule: "MED-ADV-C-06", suggestion: "비교 표현 완화" },
  { expression: "유명한", rule: "MED-ADV-C-07", suggestion: "주관적 평가 표현 완화" },
  { expression: "특별 할인", rule: "MED-ADV-C-08", suggestion: "유인성 표현 검토" },
  { expression: "이벤트 진행", rule: "MED-ADV-C-09", suggestion: "유인성 표현 검토" },
];

const REWRITE_MAP: Record<string, string> = {
  반드시: "도움이 될 수 있도록",
  확실히: "신중히",
  절대: "최대한",
  완벽: "세심",
  최상: "정성스러운",
  "100% ": "충분히 ",
  "특별 할인": "안내",
  "이벤트 진행": "안내 진행",
};

function findIssues(draft: string, rules: readonly Rule[], type: "BLOCKED" | "CAUTION"): ComplianceIssue[] {
  const out: ComplianceIssue[] = [];
  for (const r of rules) {
    const idx = draft.indexOf(r.expression);
    if (idx >= 0) {
      out.push({
        type,
        expression: r.expression,
        location: `pos:${idx}`,
        rule: r.rule,
        suggestion: r.suggestion,
      });
    }
  }
  return out;
}

function applyRewrite(draft: string): string {
  let out = draft;
  for (const [from, to] of Object.entries(REWRITE_MAP)) {
    out = out.split(from).join(to);
  }
  return out;
}

export function runComplianceCheck(draft: string): ComplianceResult {
  const blocked = findIssues(draft, BLOCKED_RULES, "BLOCKED");
  const cautions = findIssues(draft, CAUTION_RULES, "CAUTION");
  const issues = [...blocked, ...cautions];

  if (blocked.length > 0) {
    return { status: "rejected", issues, approvedDraft: "" };
  }
  if (cautions.length > 0) {
    return { status: "revision_required", issues, approvedDraft: applyRewrite(draft) };
  }
  return { status: "approved", issues: [], approvedDraft: draft };
}

// 운영자가 화면에서 직접 테스트할 수 있도록 규칙 목록 export.
export const COMPLIANCE_RULE_BOOK = {
  blocked: BLOCKED_RULES,
  caution: CAUTION_RULES,
  rewriteMap: REWRITE_MAP,
};
