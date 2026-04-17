import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { recordAudit } from "../../../../src/lib/audit";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = await prisma.template.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["title", "body", "intent", "complianceLevel"] as const) {
    if (typeof body[k] === "string") data[k] = body[k];
  }
  for (const k of ["enabled", "requiresHumanReview"] as const) {
    if (typeof body[k] === "boolean") data[k] = body[k];
  }
  const template = await prisma.template.update({ where: { id }, data });
  await recordAudit({ entityType: "Template", entityId: id, action: "template.updated", before, after: template });
  return NextResponse.json(template);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const removed = await prisma.template.findUnique({ where: { id } });
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.template.delete({ where: { id } });
  await recordAudit({ entityType: "Template", entityId: id, action: "template.deleted", before: removed });
  return NextResponse.json({ ok: true });
}
