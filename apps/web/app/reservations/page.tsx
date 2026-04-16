const statuses = [
  "new",
  "pending_confirmation",
  "confirmed",
  "change_requested",
  "canceled",
  "no_show_risk",
  "completed"
] as const;

export default function ReservationsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">예약 보드</h1>
      <p className="text-sm text-gray-600">상태 변경/담당자 지정/내부 메모/후속 알림 작업을 처리합니다.</p>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {statuses.map((status) => (
          <article key={status} className="rounded border p-3 min-h-28">
            <h2 className="font-medium">{status}</h2>
            <p className="text-xs text-gray-500 mt-1">TODO: 예약 카드 목록</p>
          </article>
        ))}
      </section>
    </main>
  );
}
