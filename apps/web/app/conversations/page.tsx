export default function ConversationsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">상담 통합 인박스</h1>
      <section className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 rounded border p-3">스레드 목록 (채널/미응답시간/위험도)</aside>
        <article className="col-span-12 md:col-span-6 rounded border p-3">대화 내용 + 내부 메모</article>
        <aside className="col-span-12 md:col-span-3 rounded border p-3">자동 분류 + 템플릿 추천 + 사람검토 라우팅</aside>
      </section>
    </main>
  );
}
