import { ReviewInbox } from "../../src/components/reviews/ReviewInbox";
import { ImageImportButton } from "../../src/components/reviews/ImageImportButton";
import { prisma } from "../../src/lib/db";
import { toReviewRow } from "../../src/lib/viewAdapters";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const rows = await prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const reviews = rows.map(toReviewRow);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">리뷰 인박스</h1>
          <p className="text-sm text-slate-500 mt-1">
            초안 생성 → 컴플라이언스 검사 → 승인 → 등록 완료 처리.
            1~3점 리뷰와 민감 키워드 리뷰는 자동 승인되지 않습니다.
            네이버 플레이스 캡처 이미지를 업로드하면 별점/본문이 자동 추출됩니다.
          </p>
        </div>
        <ImageImportButton />
      </div>
      <ReviewInbox initial={reviews} />
    </div>
  );
}
