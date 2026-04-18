import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/db";
import { classifyConversation } from "@hub/ai/src/conversationClassifier";

// 카카오 i 오픈빌더 스킬 엔드포인트.
// 흐름:
//   1. 웹훅 수신 (signature 검증은 TODO — 카카오는 botId 헤더 제공)
//   2. 발화 텍스트에 대해:
//      a. 자동 분류 → category 판정
//      b. 매칭되는 Template 조회 (자동응답 후보만)
//      c. 민감/사람검토 카테고리면 운영자 인계 메시지 + Conversation 생성
//      d. 응답 JSON 반환 (카카오 Skill v2)
//   3. 항상 빠른 2xx 응답 (오픈빌더 타임아웃 방지)
//
// category → Template intent/code 매핑. 자동응답으로 쓸 템플릿만 나열.

const CATEGORY_TEMPLATE_MAP: Record<string, string> = {
  진료시간: "TALK_HOURS",
  "위치/주차": "TALK_LOCATION",
  예약문의: "TALK_HOURS", // 예약 관련은 진료시간 안내로 대체 후 인계
  비용문의: "TALK_PRICE_RANGE",
  준비물복장: "TALK_DOCUMENTS",
  서류문의: "TALK_DOCUMENTS",
};

// 사람 검토 강제 카테고리 (챗봇이 답변 생성 금지)
const HUMAN_ESCALATE_CATEGORIES = new Set(["증상상담", "환불분쟁", "불만민원", "예약변경취소"]);

interface KakaoUserRequest {
  utterance?: string;
  user?: { id?: string };
}
interface KakaoSkillPayload {
  userRequest?: KakaoUserRequest;
}

function buildSkillResponse(text: string) {
  return {
    version: "2.0",
    template: { outputs: [{ simpleText: { text } }] },
  };
}

async function createOrAppendConversation(params: {
  utterance: string;
  externalUserId: string | undefined;
  escalated: boolean;
  category: string;
  riskLevel: "low" | "medium" | "high";
}) {
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
  const externalThreadId = params.externalUserId ?? null;

  // 기존 오픈 대화가 있으면 메시지만 append
  const existing = externalThreadId
    ? await prisma.conversation.findFirst({
        where: {
          channel: "kakao_channel",
          externalThreadId,
          status: { in: ["new", "in_progress", "waiting_patient", "escalated"] },
        },
        orderBy: { lastMessageAt: "desc" },
      })
    : null;

  if (existing) {
    await prisma.message.create({
      data: {
        conversationId: existing.id,
        direction: "inbound",
        sourceChannel: "kakao_channel",
        content: params.utterance,
      },
    });
    await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: params.utterance.slice(0, 120),
        ...(params.escalated && existing.status !== "escalated" ? { status: "escalated" as const } : {}),
      },
    });
    return existing;
  }

  const created = await prisma.conversation.create({
    data: {
      channel: "kakao_channel",
      externalThreadId,
      contactName: "카카오 사용자",
      status: params.escalated ? "escalated" : "new",
      category: CATEGORY_MAP[params.category] as never,
      riskLevel: params.riskLevel,
      lastMessageAt: new Date(),
      lastMessagePreview: params.utterance.slice(0, 120),
    },
  });
  await prisma.message.create({
    data: {
      conversationId: created.id,
      direction: "inbound",
      sourceChannel: "kakao_channel",
      content: params.utterance,
    },
  });
  if (params.escalated) {
    await prisma.message.create({
      data: {
        conversationId: created.id,
        direction: "system",
        sourceChannel: "kakao_channel",
        content: "민감/사람검토 카테고리 감지 → 관리자 검토 필요",
      },
    });
  }
  return created;
}

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(buildSkillResponse("요청을 받지 못했습니다."));
  }

  let payload: KakaoSkillPayload = {};
  try {
    payload = JSON.parse(rawBody) as KakaoSkillPayload;
  } catch {
    // invalid JSON → 2xx + 안내
    return NextResponse.json(buildSkillResponse("요청을 처리할 수 없습니다."));
  }

  const utterance = (payload.userRequest?.utterance ?? "").trim();
  const externalUserId = payload.userRequest?.user?.id;

  if (!utterance) {
    return NextResponse.json(buildSkillResponse("무엇을 도와드릴까요?"));
  }

  // 1) 자동 분류
  const classification = classifyConversation(utterance);
  const forceHuman = HUMAN_ESCALATE_CATEGORIES.has(classification.category) || classification.riskLevel === "high";

  // 2) Conversation 기록 (양방향 연속 대화 가정)
  await createOrAppendConversation({
    utterance,
    externalUserId,
    escalated: forceHuman,
    category: classification.category,
    riskLevel: classification.riskLevel,
  });

  // 3) 민감 카테고리면 자동응답 금지
  if (forceHuman) {
    return NextResponse.json(
      buildSkillResponse(
        "남겨주신 내용은 담당자가 직접 확인해 연락드리도록 하겠습니다. 급하신 경우 원내로 전화 부탁드립니다.",
      ),
    );
  }

  // 4) 자동응답 후보 카테고리면 Template 조회
  const templateCode = CATEGORY_TEMPLATE_MAP[classification.category];
  if (templateCode) {
    const template = await prisma.template.findUnique({ where: { code: templateCode } });
    if (template && template.enabled) {
      return NextResponse.json(buildSkillResponse(template.body));
    }
  }

  // 5) 매칭 실패 → 담당자 인계
  return NextResponse.json(
    buildSkillResponse("문의 주신 내용은 담당자가 확인 후 연락드리도록 하겠습니다."),
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "kakao-chatbot-skill" });
}
