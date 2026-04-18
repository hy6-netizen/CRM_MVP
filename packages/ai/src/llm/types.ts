// LLM provider 추상화
// AI_PROVIDER env 로 스위치 (mock | openai). 언제든 anthropic/gemini/ollama 추가 가능.

import type {
  ComplianceResult,
  ReviewEngineInput,
  ReviewEngineOutput,
} from "@hub/domain/src/types";

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  model: string;
  /** 대략적인 달러 비용 (provider 별 per-token 가격 * 토큰 수). 감사 로그용. */
  costEstimateUsd?: number;
}

export interface LLMReviewReplyResponse {
  result: ReviewEngineOutput;
  provider: string;
  usage?: LLMUsage;
}

export interface LLMComplianceResponse {
  result: ComplianceResult;
  provider: string;
  usage?: LLMUsage;
}

export interface ReviewImageExtractResult {
  rating: number; // 1~5
  reviewerNameMasked?: string;
  content: string;
  createdAt?: string; // 리뷰 작성일 (extract 가능 시)
  treatmentMentioned?: string;
  staffMentioned?: string;
  confidence: number; // 0.0 ~ 1.0
  warnings: string[];
}

export interface LLMImageExtractResponse {
  result: ReviewImageExtractResult;
  provider: string;
  usage?: LLMUsage;
}

export interface LLMProvider {
  name: string;
  /** 리뷰 답글 초안 생성. 결정형/LLM 모두 같은 인터페이스. */
  generateReviewReply(input: ReviewEngineInput): Promise<LLMReviewReplyResponse>;
  /**
   * 의도 레벨 컴플라이언스 재검사.
   * 키워드 검사(runComplianceCheck)가 통과한 draft 를 LLM 에게 "의도상" 위반 여부 재확인.
   * 키워드로는 잡히지 않는 "모든 질환을 낫게 한다" 같은 표현을 걸러냄.
   */
  runIntentComplianceCheck(draft: string): Promise<LLMComplianceResponse>;
  /**
   * 네이버 리뷰 캡처 이미지에서 별점/작성자/본문 추출.
   * Vision 지원 provider (openai gpt-4o-mini 이상) 에서만 동작.
   * mock 은 에러 반환.
   */
  extractReviewFromImage(imageDataUrl: string): Promise<LLMImageExtractResponse>;
}
