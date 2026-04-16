export default function DashboardPage() {
  const cards = [
    "오늘 예약 수",
    "미확정 예약 수",
    "30분 이상 미처리 예약",
    "신규 상담 수",
    "미응답 상담 수",
    "신규 리뷰 수",
    "답글 대기 리뷰 수",
    "민감 이슈 수"
  ];

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">오늘 처리해야 할 일</h1>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <article key={card} className="rounded border p-3">
            <p className="text-sm text-gray-500">{card}</p>
            <p className="text-2xl font-semibold">-</p>
          </article>
        ))}
      </section>
    </main>
  );
}
