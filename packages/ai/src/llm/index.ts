// AI_PROVIDER 디스패처.
// - mock  : 결정형 엔진만 사용 (API key 불필요)
// - openai: GPT-4o-mini 기본 (OPENAI_API_KEY 필요). AI_MODEL 로 모델 오버라이드.
//
// 키가 없거나 provider 를 인식 못하면 자동으로 mock 으로 폴백 (경고 로그).

import { mockLLMProvider } from "./mock";
import { createOpenAIProvider } from "./openai";
import type { LLMProvider } from "./types";

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[llm] AI_PROVIDER=openai 인데 OPENAI_API_KEY 가 비어있음 → mock 으로 fallback");
      cached = mockLLMProvider;
    } else {
      cached = createOpenAIProvider({ apiKey, model: process.env.AI_MODEL });
    }
  } else if (provider === "mock") {
    cached = mockLLMProvider;
  } else {
    console.warn(`[llm] 알 수 없는 AI_PROVIDER=${provider} → mock 으로 fallback`);
    cached = mockLLMProvider;
  }
  return cached;
}

/** 테스트/환경 변경 시 재로드 */
export function resetLLM() {
  cached = null;
}

export * from "./types";
