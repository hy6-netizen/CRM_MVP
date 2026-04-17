import type { ReviewEngineOutput } from "@hub/domain/src/types";
const sensitiveKeywords = ["부작용", "환불", "분쟁", "과잉진료", "의료사고", "신고"];
export function generateReviewReply(input: { rating: number; content: string }): ReviewEngineOutput {
const high = input.rating <= 3 || sensitiveKeywords.some((k) => input.content.includes(k));
const empathy = high ? "남겨주신 불편 사항을 무겁게 받아들이고 원내에서 신중히 확인하겠습니다." : "소중한 후기와 따뜻한 말씀 남겨주셔서 진심으로 감사드립니다.";
return {
sentiment: high ? "sensitive" : "positive",
category: high ? "불만" : "친절",
riskLevel: high ? "high" : "low",
draft: 안녕하세요~ 의성한방병원입니다. ${empathy} 앞으로도 세심한 안내와 진료로 보답드리겠습니다. 감사합니다~^^,
reasons: [high ? "고위험 분류" : "일반 후기 분류", high ? "사람 검토 필요" : "승인 후보"],
needsHumanReview: high
};
}
