import { NextResponse } from "next/server";
import { auditLogs } from "../../../src/lib/mockStore";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  let list = [...auditLogs];
  if (entityType) list = list.filter((l) => l.entityType === entityType);
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ items: list, count: list.length });
}
