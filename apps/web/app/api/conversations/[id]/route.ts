import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { recordAudit } from "../../../../src/lib/audit";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { messages, ...rest } = conversation;
  return NextResponse.json({ conversation: rest, messages });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = await prisma.conversation.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.assigneeId === "string") data.assigneeId = body.assigneeId;
  const conversation = await prisma.conversation.update({ where: { id }, data });
  await recordAudit({ entityType: "Conversation", entityId: id, action: "conversation.updated", before, after: conversation });
  return NextResponse.json(conversation);
}
