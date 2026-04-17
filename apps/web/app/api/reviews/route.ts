import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/db";
import { recordAudit } from "../../../src/lib/audit";

const CreateSchema = z.object({
  reviewerNameMasked: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1),
  imageUrl: z.string().url().optional(),
  treatmentMentioned: z.string().optional(),
  staffMentioned: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const minRating = url.searchParams.get("minRating");
  const items = await prisma.review.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(minRating ? { rating: { gte: Number(minRating) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const row = await prisma.review.create({
    data: {
      sourceChannel: "naver_review",
      reviewerNameMasked: parsed.data.reviewerNameMasked ?? "익명",
      rating: parsed.data.rating,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl,
      treatmentMentioned: parsed.data.treatmentMentioned,
      staffMentioned: parsed.data.staffMentioned,
      status: "new",
      riskLevel: parsed.data.rating <= 3 ? "high" : "low",
    },
  });
  await recordAudit({ entityType: "Review", entityId: row.id, action: "review.created", after: row });
  return NextResponse.json(row, { status: 201 });
}
