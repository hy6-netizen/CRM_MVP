import { NextResponse } from "next/server";
import { findConversation, messages, recordAudit } from "../../../../src/lib/mockStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = findConversation(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ms = messages.filter((m) => m.conversationId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  return NextResponse.json({ conversation: c, messages: ms });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = findConversation(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const before = { ...c };
  if (typeof body.status === "string") c.status = body.status;
  if (typeof body.assigneeId === "string") c.assigneeId = body.assigneeId;
  recordAudit({ entityType: "Conversation", entityId: id, action: "conversation.updated", before, after: { ...c } });
  return NextResponse.json(c);
}
