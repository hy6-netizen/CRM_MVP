import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const channel = url.searchParams.get("channel");
  const items = await prisma.conversation.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(channel ? { channel: channel as never } : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({ items, count: items.length });
}
