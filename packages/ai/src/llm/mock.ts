// 결정형 mock provider — LLM key 가 없거나 AI_PROVIDER=mock 일 때 사용.
// 기존 reviewReplyEngine + complianceChecker 를 LLMProvider 인터페이스로 감싼 것.

import { generateReviewReply as deterministicReviewReply } from "../reviewReplyEngine";
import { runComplianceCheck as deterministicCompliance } from "../complianceChecker";
import type { LLMComplianceResponse, LLMProvider, LLMReviewReplyResponse } from "./types";
import type { ReviewEngineInput } from "@hub/domain/src/types";

export const mockLLMProvider: LLMProvider = {
  name: "mock",
  async generateReviewReply(input: ReviewEngineInput): Promise<LLMReviewReplyResponse> {
    return { result: deterministicReviewReply(input), provider: "mock" };
  },
  async runIntentComplianceCheck(draft: string): Promise<LLMComplianceResponse> {
    // mock 은 키워드 검사만 가능. 의도 레벨 탐지 불가.
    return { result: deterministicCompliance(draft), provider: "mock" };
  },
  async extractReviewFromImage() {
    throw new Error("mock provider does not support image extraction. AI_PROVIDER=openai 필요.");
  },
};
