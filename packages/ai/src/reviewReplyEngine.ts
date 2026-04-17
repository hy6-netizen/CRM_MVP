import type {
  ReviewEngineInput,
  ReviewEngineOutput,
  ReviewCategory,
  RiskLevel,
  Sentiment,
} from "@hub/domain/src/types";

// 의성한방병원 운영 규칙(review-reply-agent.md) 기반 결정형 리뷰 답글 엔진.
// 실제 LLM 호출 전 단계에서 동작하는 deterministic 베이스라인.
// LLM provider가 붙으면 generateReviewReply 의 자리에 wrapping 만 추가하면 됨.

const HOSPITAL_NAME = "의성한방병원";
const GREETING = `안녕하세요~ ${HOSPITAL_NAME}입니다.`;
const CLOSING = "감사합니다~^^";

// review-reply-agent.md 기준 다짐 문구 11개.
export const PLEDGE_PHRASES: readonly string[] = [
  `가족의 마음으로 환자분의 건강을 최우선으로 생각하는 ${HOSPITAL_NAME}이 되겠습니다.`,
  "앞으로도 최선의 진료를 하도록 노력하겠습니다.",
  `언제나 정성을 다해 진료하는 ${HOSPITAL_NAME}이 되겠습니다.`,
  "오시는 발걸음보다 더 가벼운 걸음으로 가실 수 있도록 최선을 다하겠습니다.",
  `편안하고 따뜻한 진료를 하는 ${HOSPITAL_NAME}이 되겠습니다.`,
  "환자 한 분 한 분을 소중히 여기며 최선의 진료를 하겠습니다.",
  "건강한 일상으로 돌아가실 수 있도록 늘 노력하겠습니다.",
  "언제든 믿고 찾으실 수 있는 병원이 되도록 정성을 다하겠습니다.",
  `환자분의 빠른 회복을 위해 정성을 다하는 ${HOSPITAL_NAME}이 되겠습니다.`,
  `편안한 치료와 세심한 돌봄을 위해 노력하는 ${HOSPITAL_NAME}이 되겠습니다.`,
  `항상 환자를 가족같이 생각하여 최선의 진료를 하는 ${HOSPITAL_NAME}이 되겠습니다.`,
] as const;

const SENSITIVE_KEYWORDS = [
  "부작용",
  "후유증",
  "환불",
  "분쟁",
  "과잉진료",
  "의료사고",
  "신고",
  "고소",
  "악화",
  "더 아파",
  "더 심해",
  "책임",
  "보상",
];

const COST_KEYWORDS = ["비싸", "비쌌", "가격", "바가지", "돈", "환불"];
const TREATMENT_DISSAT = ["효과 없", "차도가 없", "낫지 않", "그대로", "안 나아"];

const KIND_KEYWORDS = ["친절", "상냥", "다정", "응대", "선생님", "간호사", "데스크", "직원"];
const RECOVERY_KEYWORDS = ["회복", "좋아졌", "나아", "호전", "걷게", "잘 자", "몸이 가벼"];
const TREATMENT_KEYWORDS = ["침", "한약", "추나", "부항", "뜸", "물리치료", "도수", "치료"];
const RETURN_KEYWORDS = ["또 갈", "또 방문", "다시 갈", "재방문", "꾸준히"];

function pickPledge(seed: string, exclude?: number): string {
  // 콘텐츠 해시 기반으로 다짐 문구를 결정적으로 선택해 같은 리뷰엔 같은 답이 나오도록.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  let idx = hash % PLEDGE_PHRASES.length;
  if (exclude !== undefined && idx === exclude) idx = (idx + 1) % PLEDGE_PHRASES.length;
  return PLEDGE_PHRASES[idx]!;
}

function classifyCategory(content: string, rating: number): ReviewCategory {
  if (rating <= 3) return "불만";
  if (RETURN_KEYWORDS.some((k) => content.includes(k))) return "재방문의사";
  if (RECOVERY_KEYWORDS.some((k) => content.includes(k))) return "회복후기";
  if (TREATMENT_KEYWORDS.some((k) => content.includes(k))) return "치료만족";
  if (KIND_KEYWORDS.some((k) => content.includes(k))) return "친절";
  if (content.length <= 20) return "짧은감사";
  return "기타";
}

function buildEmpathy(category: ReviewCategory, content: string): string {
  // 같은 표현 반복 금지를 위해 카테고리별 표현 풀에서 콘텐츠 해시로 선택.
  const pool: Record<ReviewCategory, string[]> = {
    친절: [
      "친절히 응대해드릴 수 있어 저희도 기쁩니다.",
      "따뜻한 응대로 도움이 되어드릴 수 있어 감사한 마음입니다.",
      "정성스러운 응대를 좋게 봐주셔서 큰 힘이 됩니다.",
    ],
    치료만족: [
      "치료 과정이 도움이 되셨다니 저희도 마음이 놓입니다.",
      "치료를 잘 받아주신 덕분에 좋은 후기를 남겨주신 것 같습니다.",
      "차분히 치료에 임해주신 덕분에 좋은 결과로 이어진 듯합니다.",
    ],
    회복후기: [
      "회복에 도움이 되어드릴 수 있어 저희도 진심으로 기쁩니다.",
      "조금씩 좋아지시는 모습을 함께 지켜볼 수 있어 감사한 마음입니다.",
      "일상으로 돌아가시는 데 보탬이 되었다니 큰 보람을 느낍니다.",
    ],
    짧은감사: [
      "짧지만 따뜻한 후기를 남겨주셔서 감사한 마음입니다.",
      "남겨주신 한 줄 후기에 큰 힘을 얻습니다.",
    ],
    재방문의사: [
      "다시 찾아주시겠다는 말씀에 큰 책임감을 느낍니다.",
      "꾸준히 함께해 주시려는 마음에 진심으로 감사드립니다.",
    ],
    불만: [
      "불편을 드린 점에 대해 죄송한 마음으로 말씀을 무겁게 받아들이고 있습니다.",
      "남겨주신 의견을 원내에서 신중히 확인하고 있습니다.",
    ],
    기타: [
      "소중한 후기를 남겨주셔서 진심으로 감사드립니다.",
      "남겨주신 말씀 잘 읽었습니다. 깊이 새기겠습니다.",
    ],
  };
  let hash = 0;
  for (let i = 0; i < content.length; i++) hash = (hash * 17 + content.charCodeAt(i)) >>> 0;
  const arr = pool[category];
  return arr[hash % arr.length]!;
}

function attachMentions(input: ReviewEngineInput): string {
  const parts: string[] = [];
  if (input.treatmentMentioned) {
    parts.push(`${input.treatmentMentioned} 치료 과정에서 도움이 되어드릴 수 있어 다행으로 생각합니다.`);
  }
  if (input.staffMentioned) {
    parts.push(`${input.staffMentioned} 선생님께도 따뜻한 말씀 꼭 전해드리겠습니다.`);
  }
  return parts.join(" ");
}

function detectRisk(input: ReviewEngineInput): { riskLevel: RiskLevel; sensitive: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let sensitive = false;
  let riskLevel: RiskLevel = "low";

  if (input.rating <= 3) {
    riskLevel = "high";
    reasons.push(`별점 ${input.rating}점 — 사람 검토 우선`);
  }
  if (SENSITIVE_KEYWORDS.some((k) => input.content.includes(k))) {
    sensitive = true;
    riskLevel = "high";
    reasons.push("민감 키워드(부작용/분쟁/악화 등) 감지");
  }
  if (COST_KEYWORDS.some((k) => input.content.includes(k))) {
    riskLevel = riskLevel === "high" ? "high" : "medium";
    reasons.push("비용 관련 표현 감지");
  }
  if (TREATMENT_DISSAT.some((k) => input.content.includes(k))) {
    riskLevel = "high";
    reasons.push("치료 효과 불만 표현 감지");
  }
  return { riskLevel, sensitive, reasons };
}

export function generateReviewReply(input: ReviewEngineInput): ReviewEngineOutput {
  const { riskLevel, sensitive, reasons } = detectRisk(input);
  const category = classifyCategory(input.content, input.rating);
  const sentiment: Sentiment = sensitive
    ? "sensitive"
    : input.rating <= 2
      ? "negative"
      : input.rating === 3
        ? "neutral"
        : "positive";

  const empathy = buildEmpathy(category, input.content);
  const mentions = attachMentions(input);
  const pledge = pickPledge(input.content);

  // 2~4문장 구성: 인사 + 공감(+ 언급 처리) + 다짐 + 마무리
  const middle = [empathy, mentions].filter(Boolean).join(" ");
  const draft = [GREETING, middle, pledge, CLOSING].filter(Boolean).join(" ");

  const needsHumanReview = riskLevel === "high" || input.rating <= 3;

  if (needsHumanReview) {
    reasons.push("자동 승인 금지 — 운영자 검토 필요");
  } else {
    reasons.push("정보형/긍정형 후기 — 일반 승인 후보");
  }

  return {
    sentiment,
    category,
    riskLevel,
    draft,
    reasons,
    needsHumanReview,
    pledgeUsed: pledge,
  };
}

export const __engineMeta = { GREETING, CLOSING, HOSPITAL_NAME, PLEDGE_PHRASES };
