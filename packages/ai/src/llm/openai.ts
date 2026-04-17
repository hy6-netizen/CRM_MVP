// OpenAI provider — GPT-4o-mini 기본, AI_MODEL env 로 gpt-4o / gpt-4.1 등 전환 가능.
//
// Structured Outputs (response_format: json_schema + strict:true) 로 JSON 형식 강제.
// 프롬프트 캐싱은 1024 토큰 이상 prefix 자동 적용 (50% 할인), 별도 지시 불필요.
//
// 한국어 의료톤 규칙은 review-reply-agent.md 와 compliance_rules.md 를 코드로 옮긴 것.
// LLM 이 규칙을 못 지키면 결정형 engine 으로 fallback (호출자 측에서 try/catch).

import OpenAI from "openai";
import { PLEDGE_PHRASES } from "../reviewReplyEngine";
import type {
  ComplianceIssue,
  ComplianceResult,
  ReviewCategory,
  ReviewEngineInput,
  ReviewEngineOutput,
  RiskLevel,
  Sentiment,
} from "@hub/domain/src/types";
import type { LLMComplianceResponse, LLMProvider, LLMReviewReplyResponse, LLMUsage } from "./types";

// 모델별 단가 (2026-04 기준, 1M 토큰 USD). 캐시 할인 전 값.
const PRICE_TABLE: Record<string, { input: number; output: number; cachedInput: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6, cachedInput: 0.075 },
  "gpt-4o": { input: 2.5, output: 10, cachedInput: 1.25 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cachedInput: 0.1 },
  "gpt-4.1": { input: 2, output: 8, cachedInput: 0.5 },
};

const REVIEW_SYSTEM = `당신은 의성한방병원의 운영자입니다.
네이버 플레이스 리뷰에 대한 답글 초안을 작성합니다.
존칭을 사용하고, 한국 의료법·의료광고법 위반 표현을 절대 사용하지 않습니다.

[고정 규칙]
1. 모든 답글은 정확히 "안녕하세요~ 의성한방병원입니다." 로 시작합니다.
2. 환자가 언급한 포인트(치료, 친절, 회복, 편안함 등) 중 하나를 골라 1~2문장 공감을 표현합니다.
3. "다행입니다" 표현은 남용하지 않습니다(2회 이상 금지).
4. 아래 다짐 문구 중 상황에 맞는 **정확히 한 개**를 선택해 원문 그대로 삽입합니다 (한 자도 바꾸지 마세요):
${PLEDGE_PHRASES.map((p, i) => `   ${i + 1}. ${p}`).join("\n")}
5. 모든 답글은 정확히 "감사합니다~^^" 로 마무리합니다.
6. 전체 2~4문장으로 구성합니다. 존칭 유지. 같은 표현 반복 금지.
7. 치료명/직원명이 언급되면 자연스럽게 연결합니다.
8. 과도한 의학적 표현은 피합니다.

[금지 표현 — 절대 사용 금지]
- 확정적 결과: 완치, 100%, 반드시 낫습니다, 확실히 효과, 확실한 개선
- 안전 단정: 부작용 없는, 부작용 제로, 안전성 보장
- 비교·우월: 최고, 최초, 유일, 독보적, 국내 1위, 가장 많은 시술, 타 병원보다 우수, 양방에서는 못 고치는
- 유인/대가성: 후기 작성 시 혜택, 무료 시술, 할인 이벤트, 지금 안 하면
- 의도 레벨 과장: "모든 증상/질환을 낫게 한다", "어떤 증상이든 해결", "확실히 낫습니다", "완전히 해결"

[허용 표현]
- "개선에 도움이 될 수 있습니다"
- "증상 완화를 기대해볼 수 있습니다"
- "개인에 따라 차이가 있을 수 있습니다"
- "전문가와 상담 후 결정하시는 것을 권장합니다"
- "편안하게 진료를 받으실 수 있도록 노력하겠습니다"

[리스크 판정 — needsHumanReview=true 강제 조건]
- 별점 1~3점
- 비용/치료/효과 불만
- 증상 악화 언급 (더 아프다, 더 심해졌다)
- 부작용/후유증 뉘앙스
- 환불/분쟁/법적 대응 암시
- 공격적 표현, 과잉진료 의심, 의료사고 암시

위 조건 1개 이상이면 needsHumanReview=true 필수. riskLevel 은 low/medium/high 중 판단.
별점 1~3점 혹은 악화/부작용/환불 언급 시 riskLevel=high. category 는 긍정 리뷰면 친절/치료만족/회복후기/짧은감사/재방문의사 중, 부정이면 불만.

출력은 반드시 지정된 JSON schema 를 준수합니다.`;

const COMPLIANCE_SYSTEM = `당신은 의료광고법 콘텐츠 검사기입니다.
입력된 문구를 한국 의료법·의료광고법·의료기관 광고 심의 기준으로 검토합니다.
특히 **의도 레벨**의 과장·단정 표현을 잡아냅니다.

[차단 (BLOCKED) — status=rejected 로 판정]
- 치료 결과 단정: "완치", "100%", "반드시 낫습니다", "확실히 효과"
- 의도 레벨 과장 (키워드로는 잡히지 않음):
  · "환자의 모든 질환을 낫게 한다"
  · "어떤 증상이든 해결됩니다"
  · "다 낫게 해드립니다"
  · "모든 문제를 해결"
  · "완전히 나을 수 있습니다"
- 부작용/안전 단정: "부작용 없는", "안전성이 보장된"
- 비교/우월: "최고", "유일", "국내 1위", "타 병원보다 우수", "양방에서는 못 고치는"
- 유인·대가성: "무료 시술", "특별 할인", "후기 작성 시 혜택"

[주의 (CAUTION) — status=revision_required 로 판정]
- 단정: "반드시", "확실히", "절대", "완벽"
- 주관적 평가: "최상", "유명한"
- 유인 뉘앙스: "특별 할인", "이벤트 진행"

[허용 — status=approved]
- 가능성/개인차 전제 표현
- 한의학 관점 설명
- "도움이 될 수 있습니다", "기대해볼 수 있습니다"

[판정 원칙]
- BLOCKED 1건 이상 → status=rejected, approvedDraft="" (빈 문자열)
- CAUTION 만 있으면 → status=revision_required, approvedDraft 에 완화된 수정본 제안
- 둘 다 없으면 → status=approved, approvedDraft=원문 그대로

issues 의 각 항목:
- type: BLOCKED | CAUTION
- expression: 문제가 된 표현 원문 그대로
- rule: 규칙 코드 (키워드면 "MED-ADV-B-XX" / "MED-ADV-C-XX", 의도 레벨이면 "MED-ADV-INTENT")
- suggestion: 수정 방향 한 줄
- location: "pos:<index>" 또는 "intent" 또는 빈 문자열

출력은 반드시 지정된 JSON schema 를 준수합니다.`;

const REVIEW_SCHEMA = {
  type: "object" as const,
  properties: {
    sentiment: { type: "string", enum: ["positive", "neutral", "negative", "sensitive"] },
    category: { type: "string", enum: ["친절", "치료만족", "회복후기", "짧은감사", "재방문의사", "불만", "기타"] },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    needsHumanReview: { type: "boolean" },
    draft: { type: "string" },
    pledgeUsed: { type: "string" },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: ["sentiment", "category", "riskLevel", "needsHumanReview", "draft", "pledgeUsed", "reasons"],
  additionalProperties: false,
};

const COMPLIANCE_SCHEMA = {
  type: "object" as const,
  properties: {
    status: { type: "string", enum: ["approved", "rejected", "revision_required"] },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["BLOCKED", "CAUTION"] },
          expression: { type: "string" },
          rule: { type: "string" },
          suggestion: { type: "string" },
          location: { type: "string" },
        },
        required: ["type", "expression", "rule", "suggestion", "location"],
        additionalProperties: false,
      },
    },
    approvedDraft: { type: "string" },
  },
  required: ["status", "issues", "approvedDraft"],
  additionalProperties: false,
};

function buildReviewUser(input: ReviewEngineInput): string {
  const parts = [`리뷰 별점: ${input.rating}`, `리뷰 내용:`, input.content];
  if (input.treatmentMentioned) parts.push(`(언급된 치료/시술: ${input.treatmentMentioned})`);
  if (input.staffMentioned) parts.push(`(언급된 직원/선생님: ${input.staffMentioned})`);
  parts.push("");
  parts.push("위 규칙에 따라 답글 초안을 작성하고, JSON 으로만 응답하세요.");
  return parts.join("\n");
}

function estimateCost(model: string, usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }): number | undefined {
  const price = PRICE_TABLE[model];
  if (!price) return undefined;
  const inTotal = usage.prompt_tokens ?? 0;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const uncached = Math.max(0, inTotal - cached);
  const out = usage.completion_tokens ?? 0;
  const costInput = (uncached * price.input + cached * price.cachedInput) / 1_000_000;
  const costOutput = (out * price.output) / 1_000_000;
  return Number((costInput + costOutput).toFixed(6));
}

function makeUsage(model: string, u: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }): LLMUsage {
  return {
    model,
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    costEstimateUsd: estimateCost(model, u),
  };
}

export function createOpenAIProvider(opts: { apiKey: string; model?: string }): LLMProvider {
  const client = new OpenAI({ apiKey: opts.apiKey });
  const model = opts.model ?? "gpt-4o-mini";

  async function generateReviewReply(input: ReviewEngineInput): Promise<LLMReviewReplyResponse> {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 800,
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: { name: "review_reply", schema: REVIEW_SCHEMA, strict: true },
      },
      messages: [
        { role: "system", content: REVIEW_SYSTEM },
        { role: "user", content: buildReviewUser(input) },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("openai: empty response");
    const parsed = JSON.parse(raw) as Partial<ReviewEngineOutput>;

    const result: ReviewEngineOutput = {
      sentiment: (parsed.sentiment ?? "positive") as Sentiment,
      category: (parsed.category ?? "기타") as ReviewCategory,
      riskLevel: (parsed.riskLevel ?? "low") as RiskLevel,
      needsHumanReview: parsed.needsHumanReview ?? false,
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      pledgeUsed: typeof parsed.pledgeUsed === "string" ? parsed.pledgeUsed : undefined,
    };

    return {
      result,
      provider: `openai:${model}`,
      usage: response.usage ? makeUsage(model, response.usage) : undefined,
    };
  }

  async function runIntentComplianceCheck(draft: string): Promise<LLMComplianceResponse> {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 600,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: { name: "compliance_check", schema: COMPLIANCE_SCHEMA, strict: true },
      },
      messages: [
        { role: "system", content: COMPLIANCE_SYSTEM },
        { role: "user", content: `다음 문장을 검사하세요:\n\n${draft}` },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("openai: empty response");
    const parsed = JSON.parse(raw) as Partial<ComplianceResult>;

    const result: ComplianceResult = {
      status: (parsed.status ?? "approved") as "approved" | "rejected" | "revision_required",
      issues: Array.isArray(parsed.issues) ? (parsed.issues as ComplianceIssue[]) : [],
      approvedDraft: typeof parsed.approvedDraft === "string" ? parsed.approvedDraft : draft,
    };

    return {
      result,
      provider: `openai:${model}`,
      usage: response.usage ? makeUsage(model, response.usage) : undefined,
    };
  }

  return { name: `openai:${model}`, generateReviewReply, runIntentComplianceCheck };
}
