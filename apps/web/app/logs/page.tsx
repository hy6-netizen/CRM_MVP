import { auditLogs, findUser } from "../../src/lib/mockStore";
import { relativeTime } from "../../src/lib/format";

export const dynamic = "force-dynamic";

export default function LogsPage() {
  const list = [...auditLogs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">감사 로그</h1>
        <p className="text-sm text-slate-500 mt-1">
          승인/상태변경/템플릿수정/에스컬레이션 등 민감 작업 이력입니다.
        </p>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">시각</th>
              <th className="text-left px-3 py-2">행위자</th>
              <th className="text-left px-3 py-2">엔티티</th>
              <th className="text-left px-3 py-2">액션</th>
              <th className="text-left px-3 py-2">변경</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => {
              const actor = l.actorName ?? findUser(l.actorId)?.name ?? "system";
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-500" title={l.createdAt}>{relativeTime(l.createdAt)}</td>
                  <td className="px-3 py-2 text-xs">{actor}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.entityType}/{l.entityId}</td>
                  <td className="px-3 py-2 text-xs">{l.action}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">
                    {l.before || l.after ? (
                      <details>
                        <summary className="cursor-pointer text-brand">자세히</summary>
                        <pre className="bg-slate-50 p-2 rounded mt-1 text-[10px] overflow-x-auto max-w-md">{JSON.stringify({ before: l.before, after: l.after }, null, 2)}</pre>
                      </details>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="text-center text-xs text-slate-400 py-6">로그가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
