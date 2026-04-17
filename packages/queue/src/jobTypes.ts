// CRM MVP prompt §16 정의된 백그라운드 작업 타입.
// MVP 단계에선 BullMQ wiring 없이 타입 + retry 정책만 정의.
// 추후 worker 프로세스에서 import 해 그대로 사용.

export const JOB_TYPES = [
  "ingest_review",
  "extract_review_from_image",
  "classify_review",
  "generate_review_reply",
  "run_compliance_check",
  "notify_staff_unanswered",
  "reservation_followup",
  "reservation_reminder",
  "sync_provider_data",
  "escalate_sensitive_case",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export interface RetryPolicy {
  maxAttempts: number;
  backoff: "exponential" | "fixed" | "none";
  baseDelayMs: number;
}

export const RETRY_POLICY: Record<JobType, RetryPolicy> = {
  ingest_review:                { maxAttempts: 5, backoff: "exponential", baseDelayMs: 1000 },
  extract_review_from_image:    { maxAttempts: 3, backoff: "exponential", baseDelayMs: 2000 },
  classify_review:              { maxAttempts: 2, backoff: "fixed", baseDelayMs: 1000 },
  generate_review_reply:        { maxAttempts: 2, backoff: "fixed", baseDelayMs: 1500 }, // AI 실패 최대 2회
  run_compliance_check:         { maxAttempts: 2, backoff: "fixed", baseDelayMs: 500 },  // 거절 시 1회 재생성 후 사람 검토
  notify_staff_unanswered:      { maxAttempts: 3, backoff: "fixed", baseDelayMs: 60_000 },
  reservation_followup:         { maxAttempts: 3, backoff: "exponential", baseDelayMs: 30_000 },
  reservation_reminder:         { maxAttempts: 3, backoff: "exponential", baseDelayMs: 30_000 },
  sync_provider_data:           { maxAttempts: 5, backoff: "exponential", baseDelayMs: 60_000 },
  escalate_sensitive_case:      { maxAttempts: 1, backoff: "none", baseDelayMs: 0 }, // 즉시 1회만
};
