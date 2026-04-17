import { ComplianceTester } from "../../../src/components/settings/ComplianceTester";
import { AccessDenied } from "../../../src/components/AccessDenied";
import { COMPLIANCE_RULE_BOOK } from "@hub/ai/src/complianceChecker";
import { getCurrentRole } from "../../../src/lib/role";

export const dynamic = "force-dynamic";

const REQUIRED = ["admin", "manager"] as const;

export default async function CompliancePage() {
  const role = await getCurrentRole();
  if (!(REQUIRED as readonly string[]).includes(role)) {
    return <AccessDenied role={role} required={[...REQUIRED]} />;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">컴플라이언스 규칙</h1>
        <p className="text-sm text-slate-500 mt-1">
          의료광고법 위반 가능 표현 목록과 자동 수정 매핑입니다.
          아래 텍스트박스에 문구를 입력해 즉시 검사할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-4">
        <div className="card">
          <h2 className="font-semibold text-sm mb-3">규칙 목록</h2>
          <details open>
            <summary className="cursor-pointer text-sm font-medium text-red-700">BLOCKED ({COMPLIANCE_RULE_BOOK.blocked.length})</summary>
            <ul className="mt-2 text-xs space-y-1">
              {COMPLIANCE_RULE_BOOK.blocked.map((r) => (
                <li key={r.rule} className="grid grid-cols-[80px_120px_1fr] gap-2 border-b border-slate-100 py-1">
                  <span className="font-mono text-[10px] text-slate-400">{r.rule}</span>
                  <span className="text-red-700 font-medium">{r.expression}</span>
                  <span className="text-slate-600">{r.suggestion}</span>
                </li>
              ))}
            </ul>
          </details>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-amber-700">CAUTION ({COMPLIANCE_RULE_BOOK.caution.length})</summary>
            <ul className="mt-2 text-xs space-y-1">
              {COMPLIANCE_RULE_BOOK.caution.map((r) => (
                <li key={r.rule} className="grid grid-cols-[80px_120px_1fr] gap-2 border-b border-slate-100 py-1">
                  <span className="font-mono text-[10px] text-slate-400">{r.rule}</span>
                  <span className="text-amber-700 font-medium">{r.expression}</span>
                  <span className="text-slate-600">{r.suggestion}</span>
                </li>
              ))}
            </ul>
          </details>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">자동 수정 매핑 ({Object.keys(COMPLIANCE_RULE_BOOK.rewriteMap).length})</summary>
            <ul className="mt-2 text-xs space-y-1">
              {Object.entries(COMPLIANCE_RULE_BOOK.rewriteMap).map(([from, to]) => (
                <li key={from} className="grid grid-cols-[1fr_20px_1fr] gap-2 border-b border-slate-100 py-1">
                  <span className="text-amber-700">{from}</span>
                  <span className="text-slate-400 text-center">→</span>
                  <span className="text-emerald-700">{to}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <div className="card">
          <h2 className="font-semibold text-sm mb-3">즉시 검사</h2>
          <ComplianceTester />
        </div>
      </div>
    </div>
  );
}
