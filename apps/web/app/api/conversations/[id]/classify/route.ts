import { NextResponse } from "next/server";
import { classifyConversation } from "@hub/ai/src/conversationClassifier";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

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

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { where: { direction: "inbound" }, orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const text = conversation.messages.map((m) => m.content).join(" ") || conversation.lastMessagePreview || "";
  const result = classifyConversation(text);

  const before = { ...conversation };
  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      category: CATEGORY_MAP[result.category] as never,
      riskLevel: result.riskLevel,
      ...(result.riskLevel === "high" && conversation.status !== "escalated" ? { status: "escalated" as const } : {}),
    },
  });
  await recordAudit({
    entityType: "Conversation",
    entityId: id,
    action: "conversation.classified",
    before,
    after: { category: updated.category, riskLevel: updated.riskLevel, status: updated.status },
  });

  return NextResponse.json({ classification: result, conversation: updated });
}
