import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/db";

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });
  return NextResponse.json({ items: users });
}
