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
  "escalate_sensitive_case"
] as const;

export type JobType = (typeof JOB_TYPES)[number];
