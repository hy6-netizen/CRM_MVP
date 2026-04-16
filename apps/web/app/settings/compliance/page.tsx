export default function CompliancePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">컴플라이언스 규칙</h1>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="rounded border p-3">금지 표현(BLOCKED) 사전</article>
        <article className="rounded border p-3">주의 표현(CAUTION) 사전</article>
      </section>
    </main>
  );
}
