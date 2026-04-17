import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyConversation } from "@hub/ai/src/conversationClassifier";
import { getLLM } from "@hub/ai/src/llm";
import { prisma } from "../../../../src/lib/db";
import { recordAudit } from "../../../../src/lib/audit";
import type { ConversationCategory } from "@hub/domain/src/types";

// 네이버 톡톡 (또는 기타 외부 채널) 상담 붙여넣기 → 자동 분류 + (선택) 초안 생성 + Conversation 생성.
//
// 흐름:
//   1. 운영자가 환자 메시지 텍스트 붙여넣기
//   2. 자동 분류기 돌려서 category/riskLevel 판정
//   3. 민감/사람검토 카테고리면 escalated 상태로 생성
//   4. 정보형이면 매칭되는 Template 으로 초안 응답 제안 (사용자가 확인 후 붙여넣기)
//   5. Conversation + inbound Message + (초안 제안 시) draft Message 생성

const CATEGORY_MAP: Record<string, string> = {
  진료시간: "CONSULT_HOURS",
  "위치/주차": "LOCATION_PARKING",
  예약문의: "RESERVATION_INQUIRY",
  예약변경취소: "RESERVATION_CHANGE",
  비용문의: "PRICE",
  준비물복장: "PREP_DRESS",
  서류문의: "DOCUMENTS",
  증상상담: "SYMPTOM",
  불만민원: "COMPLAINT",
  환불분쟁: "REFUND_DISPUTE",
  기타: "OTHER",
};

const TEMPLATE_MAP: Record<string, string> = {
  진료시간: "TALK_HOURS",
  "위치/주차": "TALK_LOCATION",
  예약문의: "TALK_HOURS",
  비용문의: "TALK_PRICE_RANGE",
  준비물복장: "TALK_DOCUMENTS",
  서류문의: "TALK_DOCUMENTS",
};

const HUMAN_ONLY = new Set<ConversationCategory>(["증상상담", "환불분쟁", "불만민원", "예약변경취소"]);

const Schema = z.object({
  content: z.string().min(1),
  channel: z.enum(["naver_talk", "kakao_channel", "manual"]).default("naver_talk"),
  contactName: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const { content, channel, contactName } = parsed.data;

  // 1) 자동 분류
  const classification = classifyConversation(content);
  const forceHuman = HUMAN_ONLY.has(classification.category) || classification.riskLevel === "high";

  // 2) Conversation + inbound message 생성
  const conversation = await prisma.conversation.create({
    data: {
      channel: channel as never,
      contactName: contactName || "환자",
      status: forceHuman ? "escalated" : "new",
      category: CATEGORY_MAP[classification.category] as never,
      riskLevel: classification.riskLevel,
      lastMessageAt: new Date(),
      lastMessagePreview: content.slice(0, 120),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      sourceChannel: channel as never,
      content,
    },
  });

  // 3) 초안 생성 (정보형 카테고리만)
  let draftText: string | null = null;
  let draftSource: string | null = null;

  if (!forceHuman) {
    const templateCode = TEMPLATE_MAP[classification.category];
    if (templateCode) {
      const tpl = await prisma.template.findUnique({ where: { code: templateCode } });
      if (tpl?.enabled) {
        draftText = tpl.body;
        draftSource = `template:${tpl.code}`;
      }
    }

    // 템플릿 매칭 실패 시 LLM 으로 초안 (AI_PROVIDER=openai 일 때만)
    const llm = getLLM();
    if (!draftText && llm.name !== "mock") {
      // 최소한의 안내 초안 (별도 LLM 메서드 없이 템플릿 수준으로)
      draftText = "안녕하세요, 의성한방병원입니다. 문의 주신 내용 확인 후 빠르게 답변드리겠습니다.";
      draftSource = "fallback";
    }
  }

  if (draftText) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "draft",
        sourceChannel: channel as never,
        content: draftText,
        metaJson: { source: draftSource } as object,
      },
    });
  }

  if (forceHuman) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "system",
        sourceChannel: channel as never,
        content: `${classification.riskLevel === "high" ? "민감 " : ""}${classification.category} 감지 → 관리자 검토 필요`,
      },
    });
  }

  await recordAudit({
    actorName: "operator",
    entityType: "Conversation",
    entityId: conversation.id,
    action: "conversation.quick_added",
    after: {
      channel,
      category: classification.category,
      riskLevel: classification.riskLevel,
      hasDraft: !!draftText,
      draftSource,
    },
  });

  return NextResponse.json({
    conversation,
    classification,
    draft: draftText ? { text: draftText, source: draftSource } : null,
    forceHuman,
  });
}
