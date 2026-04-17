// Prisma 결과를 UI view row 타입으로 변환.
// Date → ISO string, Prisma enum(한글 매핑된 @map) → domain enum.

import type {
  AuditLog,
  Conversation,
  Message,
  Notification,
  Reservation,
  Review,
  Template,
} from "@prisma/client";
import type {
  AuditLogRow,
  ConversationRow,
  MessageRow,
  NotificationRow,
  ReservationRow,
  ReviewRow,
  TemplateRow,
} from "./mockStore";
import type {
  Channel,
  ConversationCategory,
  ConversationStatus,
  MessageDirection,
  ReservationStatus,
  ReviewCategory,
  ReviewStatus,
  RiskLevel,
  Sentiment,
} from "@hub/domain/src/types";

// Prisma enum(영문 코드) → domain enum(한글) 역매핑
const CATEGORY_ENUM_TO_KR: Record<string, ConversationCategory> = {
  CONSULT_HOURS: "진료시간",
  LOCATION_PARKING: "위치/주차",
  RESERVATION_INQUIRY: "예약문의",
  RESERVATION_CHANGE: "예약변경취소",
  PRICE: "비용문의",
  PREP_DRESS: "준비물복장",
  DOCUMENTS: "서류문의",
  SYMPTOM: "증상상담",
  COMPLAINT: "불만민원",
  REFUND_DISPUTE: "환불분쟁",
  OTHER: "기타",
};

const REVIEW_CATEGORY_ENUM_TO_KR: Record<string, ReviewCategory> = {
  KIND: "친절",
  TREATMENT: "치료만족",
  RECOVERY: "회복후기",
  SHORT_THX: "짧은감사",
  REVISIT: "재방문의사",
  COMPLAINT: "불만",
  OTHER: "기타",
};

export function toReviewRow(r: Review): ReviewRow {
  return {
    id: r.id,
    sourceChannel: r.sourceChannel as Channel,
    reviewerNameMasked: r.reviewerNameMasked ?? "익명",
    rating: r.rating,
    content: r.content,
    status: r.status as ReviewStatus,
    sentiment: (r.sentiment ?? undefined) as Sentiment | undefined,
    riskLevel: r.riskLevel as RiskLevel,
    category: r.category ? REVIEW_CATEGORY_ENUM_TO_KR[r.category as string] : undefined,
    imageUrl: r.imageUrl ?? undefined,
    createdAt: r.createdAt.toISOString(),
    draft: r.draft ?? undefined,
    draftReasons: Array.isArray(r.draftReasons) ? (r.draftReasons as string[]) : undefined,
    complianceStatus: (r.complianceStatus ?? undefined) as ReviewRow["complianceStatus"],
    approvedDraft: r.approvedDraft ?? undefined,
    postedAt: r.postedAt?.toISOString(),
    approvedAt: r.approvedAt?.toISOString(),
    approvedById: r.approvedById ?? undefined,
    treatmentMentioned: r.treatmentMentioned ?? undefined,
    staffMentioned: r.staffMentioned ?? undefined,
  };
}

export function toConversationRow(c: Conversation): ConversationRow {
  return {
    id: c.id,
    channel: c.channel as Channel,
    contactName: c.contactName ?? "-",
    phoneMasked: c.contactPhoneMasked ?? "-",
    status: c.status as ConversationStatus,
    category: c.category ? CATEGORY_ENUM_TO_KR[c.category as string] : undefined,
    riskLevel: c.riskLevel as RiskLevel,
    assigneeId: c.assigneeId ?? undefined,
    lastMessageAt: c.lastMessageAt.toISOString(),
    lastMessagePreview: c.lastMessagePreview ?? "",
  };
}

export function toMessageRow(m: Message): MessageRow {
  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.direction as MessageDirection,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toReservationRow(r: Reservation): ReservationRow {
  return {
    id: r.id,
    sourceChannel: r.sourceChannel as Channel,
    patientName: r.patientName,
    phoneMasked: r.phoneMasked ?? "-",
    reservationAt: r.reservationAt.toISOString(),
    status: r.status as ReservationStatus,
    assigneeId: r.assigneeId ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toTemplateRow(t: Template): TemplateRow {
  return {
    id: t.id,
    code: t.code,
    channel: t.channel as Channel,
    intent: t.intent,
    title: t.title,
    body: t.body,
    enabled: t.enabled,
    requiresHumanReview: t.requiresHumanReview,
    complianceLevel: (t.complianceLevel as "standard" | "strict") ?? "standard",
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toAuditLogRow(l: AuditLog): AuditLogRow {
  return {
    id: l.id,
    actorId: l.actorId ?? undefined,
    actorName: l.actorName ?? undefined,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    before: l.beforeJson ?? undefined,
    after: l.afterJson ?? undefined,
    createdAt: l.createdAt.toISOString(),
  };
}

export function toNotificationRow(n: Notification): NotificationRow {
  return {
    id: n.id,
    level: n.level as NotificationRow["level"],
    title: n.title,
    body: n.body,
    entityType: n.entityType ?? undefined,
    entityId: n.entityId ?? undefined,
    createdAt: n.createdAt.toISOString(),
    dismissedAt: n.dismissedAt?.toISOString(),
    deliveredVia: (n.deliveredVia ?? undefined) as NotificationRow["deliveredVia"],
  };
}
