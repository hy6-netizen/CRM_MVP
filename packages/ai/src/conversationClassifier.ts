import type { ConversationCategory, RiskLevel } from "@hub/domain/src/types";

// 상담 인박스의 자동 분류기.
// CRM MVP prompt §9.3 의 11개 카테고리 + 라우팅 규칙(정보형 vs 사람검토형)을 구현.

interface CategoryRule {
  category: ConversationCategory;
  keywords: readonly string[];
  // routing: 정보형이면 자동응답 후보, 그 외엔 사람 검토.
  autoResponseCandidate: boolean;
}

export const CATEGORY_RULES: readonly CategoryRule[] = [
  { category: "진료시간", keywords: ["진료시간", "영업시간", "몇 시", "몇시", "오픈", "마감", "휴진", "공휴일", "주말"], autoResponseCandidate: true },
  { category: "위치/주차", keywords: ["위치", "어디", "주소", "찾아가", "주차", "지하철", "버스"], autoResponseCandidate: true },
  { category: "예약변경취소", keywords: ["예약 변경", "예약변경", "예약 취소", "예약취소", "시간 바꿔", "다른 날", "리스케줄"], autoResponseCandidate: false },
  { category: "예약문의", keywords: ["예약", "초진", "재진", "당일", "내일 진료"], autoResponseCandidate: true },
  { category: "비용문의", keywords: ["비용", "가격", "얼마", "수가", "한약 가격", "비급여", "보험"], autoResponseCandidate: true },
  { category: "준비물복장", keywords: ["준비물", "뭘 가져", "복장", "옷차림", "공복", "식사하고"], autoResponseCandidate: true },
  { category: "서류문의", keywords: ["진단서", "소견서", "진료확인서", "영수증", "서류"], autoResponseCandidate: true },
  { category: "증상상담", keywords: ["허리", "디스크", "어깨", "목", "두통", "어지럼", "소화", "위염", "수면", "불면", "갱년기", "임신", "산후", "다이어트", "비염"], autoResponseCandidate: false },
  { category: "환불분쟁", keywords: ["환불", "분쟁", "고소", "신고", "민원", "변호사", "보상"], autoResponseCandidate: false },
  { category: "불만민원", keywords: ["불친절", "불만", "기분 나빠", "화가", "왜 그런", "항의"], autoResponseCandidate: false },
];

const SENSITIVE_PATTERNS = [
  "악화", "더 아파", "더 심해", "부작용", "후유증", "쓰러", "응급",
  "의료사고", "책임", "고소", "변호사", "신고",
];

export interface ConversationClassification {
  category: ConversationCategory;
  riskLevel: RiskLevel;
  autoResponseCandidate: boolean;
  matchedKeywords: string[];
  reasons: string[];
}

export function classifyConversation(text: string): ConversationClassification {
  const reasons: string[] = [];
  const matchedKeywords: string[] = [];

  let chosen: CategoryRule | undefined;
  for (const rule of CATEGORY_RULES) {
    const hit = rule.keywords.find((k) => text.includes(k));
    if (hit) {
      chosen = rule;
      matchedKeywords.push(hit);
      reasons.push(`'${hit}' 키워드 매칭 → ${rule.category}`);
      break;
    }
  }

  const sensitiveHit = SENSITIVE_PATTERNS.find((p) => text.includes(p));
  let riskLevel: RiskLevel = "low";
  if (sensitiveHit) {
    riskLevel = "high";
    reasons.push(`민감 표현 '${sensitiveHit}' 감지 → 사람 검토 필요`);
  }

  if (!chosen) {
    return {
      category: "기타",
      riskLevel,
      autoResponseCandidate: false,
      matchedKeywords,
      reasons: [...reasons, "매칭된 카테고리 없음 → 기타"],
    };
  }

  return {
    category: chosen.category,
    riskLevel,
    autoResponseCandidate: chosen.autoResponseCandidate && riskLevel !== "high",
    matchedKeywords,
    reasons,
  };
}
