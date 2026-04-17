import { ReviewInbox } from "../../src/components/reviews/ReviewInbox";
import { reviews } from "../../src/lib/mockStore";

export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">리뷰 인박스</h1>
        <p className="text-sm text-slate-500 mt-1">
          초안 생성 → 컴플라이언스 검사 → 승인 → 등록 완료 처리.
          1~3점 리뷰와 민감 키워드 리뷰는 자동 승인되지 않습니다.
        </p>
      </div>
      <ReviewInbox initial={reviews} />
    </div>
  );
}
