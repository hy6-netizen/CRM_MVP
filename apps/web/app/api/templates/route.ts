import { NextResponse } from "next/server";
import { z } from "zod";
import { templates, recordAudit, __mockMeta } from "../../../src/lib/mockStore";
import type { TemplateRow } from "../../../src/lib/mockStore";

const CreateSchema = z.object({
  code: z.string().min(2),
  channel: z.enum(["naver_reservation","naver_talk","naver_review","kakao_channel","kakao_biz","manual","unknown"]),
  intent: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
  requiresHumanReview: z.boolean().optional(),
  complianceLevel: z.enum(["standard","strict"]).optional(),
});

export async function GET() {
  return NextResponse.json({ items: templates, count: templates.length });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const row: TemplateRow = {
    id: __mockMeta.nextId("tpl"),
    code: parsed.data.code,
    channel: parsed.data.channel,
    intent: parsed.data.intent,
    title: parsed.data.title,
    body: parsed.data.body,
    enabled: parsed.data.enabled ?? true,
    requiresHumanReview: parsed.data.requiresHumanReview ?? false,
    complianceLevel: parsed.data.complianceLevel ?? "standard",
    updatedAt: __mockMeta.now(),
  };
  templates.unshift(row);
  recordAudit({ entityType: "Template", entityId: row.id, action: "template.created", after: row });
  return NextResponse.json(row, { status: 201 });
}
