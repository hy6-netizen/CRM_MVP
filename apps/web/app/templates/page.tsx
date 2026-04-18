import { TemplatesManager } from "../../src/components/templates/TemplatesManager";
import { prisma } from "../../src/lib/db";
import { toTemplateRow } from "../../src/lib/viewAdapters";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const rows = await prisma.template.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">템플릿 관리</h1>
        <p className="text-sm text-slate-500 mt-1">
          진료시간 / 위치 / 비용 / 예약 안내 등 자주 쓰는 응대 문구를 채널 · 의도별로 관리합니다.
          strict 등급 템플릿은 컴플라이언스 검사를 강제합니다.
        </p>
      </div>
      <TemplatesManager initial={rows.map(toTemplateRow)} />
    </div>
  );
}
