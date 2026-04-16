export default function ReviewsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">리뷰 인박스</h1>
      <p className="text-sm text-gray-600">초안 생성 → 컴플라이언스 검사 → 승인/수정 → 등록 대기</p>
      <section className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-4 rounded border p-3">필터/리뷰 목록</aside>
        <article className="col-span-12 md:col-span-5 rounded border p-3">리뷰 원문/이미지/추출 confidence</article>
        <aside className="col-span-12 md:col-span-3 rounded border p-3">초안/검사결과/승인 액션</aside>
      </section>
    </main>
  );
}
