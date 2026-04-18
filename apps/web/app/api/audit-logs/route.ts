import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const items = await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ items, count: items.length });
}
