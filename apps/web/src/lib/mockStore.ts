// ⚠️ DEPRECATED: 데이터 저장소 역할은 Prisma (src/lib/db.ts) 로 이전됨.
// 이 파일은 UI 컴포넌트가 쓰는 **view 타입** (Date 를 string ISO 로 serialize한 형태) 만 제공.
// Client component 는 Prisma 타입을 직접 받지 않고 이 shape 으로 변환된 데이터를 props 로 받음.

import type {
  Channel,
  ConversationCategory,
  ConversationStatus,
  MessageDirection,
  ReservationStatus,
  ReviewCategory,
  ReviewStatus,
  RiskLevel,
  Role,
  Sentiment,
  TemplateCode,
} from "@hub/domain/src/types";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ReservationRow {
  id: string;
  sourceChannel: Channel;
  patientName: string;
  phoneMasked: string;
  reservationAt: string;
  status: ReservationStatus;
  assigneeId?: string;
  notes?: string;
  createdAt: string;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  content: string;
  createdAt: string;
}

export interface ConversationRow {
  id: string;
  channel: Channel;
  contactName: string;
  phoneMasked: string;
  status: ConversationStatus;
  category?: ConversationCategory;
  riskLevel: RiskLevel;
  assigneeId?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export interface ReviewRow {
  id: string;
  sourceChannel: Channel;
  reviewerNameMasked: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  sentiment?: Sentiment;
  riskLevel: RiskLevel;
  category?: ReviewCategory;
  imageUrl?: string;
  createdAt: string;
  draft?: string;
  draftReasons?: string[];
  complianceStatus?: "approved" | "rejected" | "revision_required" | "pending";
  approvedDraft?: string;
  postedAt?: string;
  approvedAt?: string;
  approvedById?: string;
  assigneeId?: string;
  treatmentMentioned?: string;
  staffMentioned?: string;
}

export interface TemplateRow {
  id: string;
  code: TemplateCode | string;
  channel: Channel;
  intent: string;
  title: string;
  body: string;
  enabled: boolean;
  requiresHumanReview: boolean;
  complianceLevel: "standard" | "strict";
  updatedAt: string;
}

export interface AuditLogRow {
  id: string;
  actorId?: string;
  actorName?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface NotificationRow {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  dismissedAt?: string;
  deliveredVia?: "alimtalk" | "stub" | "in_app_only";
}
