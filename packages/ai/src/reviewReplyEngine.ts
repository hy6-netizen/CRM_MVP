import type { ReviewEngineOutput } from "@hub/domain/src/types";

const sensitiveKeywords = ["부작용", "환불", "분쟁", "과잉진료", "의료사고", "신고"];
const pledgeCandidates = [
  "앞으로도 세심한 안내와 진료로 보답드리겠습니다.",
  "더 편안하게 내원하실 수 있도록 꾸준히 노력하겠습니다.",
  "남겨주신 말씀을 바탕으로 더욱 정성껏 진료하겠습니다."
];

export function generateReviewReply(input: { rating: number; content: string }): ReviewEngineOutput {
  const isLowRating = input.rating <= 3;
  const hasSensitive = sensitiveKeywords.some((k) => input.content.includes(k));

  const riskLevel = isLowRating || hasSensitive ? "high" : "low";
  const needsHumanReview = riskLevel === "high";

  const empathy = hasSensitive
    ? "남겨주신 불편 사항을 무겁게 받아들이고 원내에서 신중히 확인하겠습니다."
    : "소중한 후기와 따뜻한 말씀 남겨주셔서 진심으로 감사드립니다.";

  const pledge = pledgeCandidates[input.content.length % pledgeCandidates.length];

  return {
    sentiment: hasSensitive ? "sensitive" : isLowRating ? "negative" : "positive",
    category: hasSensitive ? "불만" : "친절",
    riskLevel,
    draft: `안녕하세요~ 의성한방병원입니다. ${empathy} ${pledge} 감사합니다~^^`,
    reasons: [
      hasSensitive ? "민감 키워드가 포함되어 고위험으로 분류했습니다." : "일반 후기 톤으로 분류했습니다.",
      needsHumanReview ? "사람 검토가 필요합니다." : "자동 승인 후보이나 최종 승인 절차를 유지합니다."
    ],
    needsHumanReview
  };
}
