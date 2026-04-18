import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "no_id" }, { status: 400 });
  const acct = await prisma.gmailAccount.findUnique({ where: { id } });
  if (!acct) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.gmailAccount.delete({ where: { id } });
  await recordAudit({
    actorName: "gmail-admin",
    entityType: "GmailAccount",
    entityId: id,
    action: "gmail.disconnected",
    before: { email: acct.email },
  });
  return NextResponse.json({ ok: true });
}
