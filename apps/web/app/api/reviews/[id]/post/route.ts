import { NextResponse } from "next/server";
import { findReview, recordAudit, __mockMeta } from "../../../../../src/lib/mockStore";

// 네이버 리뷰 등록은 공식 API 미확인 영역.
// MVP 에선 운영자가 외부에서 등록 후 “등록 완료 처리” 액션으로 상태만 전환한다.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = findReview(id);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (review.status !== "approved") {
    return NextResponse.json({ error: "not_approved" }, { status: 400 });
  }
  const before = { ...review };
  review.status = "posted";
  review.postedAt = __mockMeta.now();
  recordAudit({
    entityType: "Review",
    entityId: id,
    action: "review.posted",
    before,
    after: { status: review.status, postedAt: review.postedAt },
  });
  return NextResponse.json(review);
}
