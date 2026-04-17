import { NextResponse } from "next/server";
import { findTemplate, templates, recordAudit, __mockMeta } from "../../../../src/lib/mockStore";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = findTemplate(id);
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  const before = { ...t };
  for (const k of ["title", "body", "intent", "complianceLevel"] as const) {
    if (typeof body[k] === "string") (t as Record<string, unknown>)[k] = body[k];
  }
  for (const k of ["enabled", "requiresHumanReview"] as const) {
    if (typeof body[k] === "boolean") (t as Record<string, unknown>)[k] = body[k];
  }
  t.updatedAt = __mockMeta.now();
  recordAudit({ entityType: "Template", entityId: id, action: "template.updated", before, after: { ...t } });
  return NextResponse.json(t);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const idx = templates.findIndex((t) => t.id === id);
  if (idx < 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [removed] = templates.splice(idx, 1);
  recordAudit({ entityType: "Template", entityId: id, action: "template.deleted", before: removed });
  return NextResponse.json({ ok: true });
}
