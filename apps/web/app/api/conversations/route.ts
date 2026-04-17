import { NextResponse } from "next/server";
import { conversations, messages } from "../../../src/lib/mockStore";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const channel = url.searchParams.get("channel");
  let list = [...conversations];
  if (status) list = list.filter((c) => c.status === status);
  if (channel) list = list.filter((c) => c.channel === channel);
  list.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  return NextResponse.json({
    items: list.map((c) => ({
      ...c,
      messageCount: messages.filter((m) => m.conversationId === c.id).length,
    })),
    count: list.length,
  });
}
