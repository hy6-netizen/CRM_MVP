import { NextResponse } from "next/server";
import { z } from "zod";
import { reviews, recordAudit, __mockMeta } from "../../../src/lib/mockStore";
import type { ReviewRow } from "../../../src/lib/mockStore";

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
  let list = [...reviews];
  if (status) list = list.filter((r) => r.status === status);
  if (minRating) list = list.filter((r) => r.rating >= Number(minRating));
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ items: list, count: list.length });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.format() }, { status: 400 });
  }
  const row: ReviewRow = {
    id: __mockMeta.nextId("rv"),
    sourceChannel: "naver_review",
    reviewerNameMasked: parsed.data.reviewerNameMasked ?? "익명",
    rating: parsed.data.rating,
    content: parsed.data.content,
    status: "new",
    riskLevel: parsed.data.rating <= 3 ? "high" : "low",
    imageUrl: parsed.data.imageUrl,
    treatmentMentioned: parsed.data.treatmentMentioned,
    staffMentioned: parsed.data.staffMentioned,
    createdAt: __mockMeta.now(),
  };
  reviews.unshift(row);
  recordAudit({ entityType: "Review", entityId: row.id, action: "review.created", after: row });
  return NextResponse.json(row, { status: 201 });
}
