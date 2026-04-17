import { NextResponse } from "next/server";
import { classifyConversation } from "@hub/ai/src/conversationClassifier";
import { findConversation, messages, recordAudit } from "../../../../../src/lib/mockStore";
import type { ConversationCategory } from "@hub/domain/src/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = findConversation(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const text = messages
    .filter((m) => m.conversationId === id && m.direction === "inbound")
    .map((m) => m.content)
    .join(" ") || c.lastMessagePreview;
  const result = classifyConversation(text);
  const before = { ...c };
  c.category = result.category as ConversationCategory;
  c.riskLevel = result.riskLevel;
  if (result.riskLevel === "high" && c.status !== "escalated") {
    c.status = "escalated";
  }
  recordAudit({ entityType: "Conversation", entityId: id, action: "conversation.classified", before, after: { category: c.category, riskLevel: c.riskLevel } });
  return NextResponse.json({ classification: result, conversation: c });
}
