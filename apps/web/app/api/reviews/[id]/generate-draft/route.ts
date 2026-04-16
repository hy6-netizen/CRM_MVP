import { NextResponse } from "next/server";
import { getReviewById } from "../../../../../src/lib/mockStore";
import { generateReviewReply } from "@hub/ai/src/reviewReplyEngine";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const review = getReviewById(id);

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const result = generateReviewReply({ rating: review.rating, content: review.content });
  return NextResponse.json(result);
}
