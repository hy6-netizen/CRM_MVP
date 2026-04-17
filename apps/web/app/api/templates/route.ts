import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/db";
import { recordAudit } from "../../../src/lib/audit";

const CreateSchema = z.object({
  code: z.string().min(2),
  channel: z.enum(["naver_reservation", "naver_talk", "naver_review", "kakao_channel", "kakao_biz", "manual", "unknown"]),
  intent: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
  requiresHumanReview: z.boolean().optional(),
  complianceLevel: z.enum(["standard", "strict"]).optional(),
});

export async function GET() {
  const items = await prisma.template.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const row = await prisma.template.create({
    data: {
      code: parsed.data.code,
      channel: parsed.data.channel as never,
      intent: parsed.data.intent,
      title: parsed.data.title,
      body: parsed.data.body,
      enabled: parsed.data.enabled ?? true,
      requiresHumanReview: parsed.data.requiresHumanReview ?? false,
      complianceLevel: parsed.data.complianceLevel ?? "standard",
    },
  });
  await recordAudit({ entityType: "Template", entityId: row.id, action: "template.created", after: row });
  return NextResponse.json(row, { status: 201 });
}
