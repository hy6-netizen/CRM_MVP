import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/db";

export async function GET() {
  const accounts = await prisma.gmailAccount.findMany({
    select: {
      id: true,
      email: true,
      enabled: true,
      lastPolledAt: true,
      lastHistoryId: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ accounts });
}
