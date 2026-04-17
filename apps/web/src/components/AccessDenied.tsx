import type { Role } from "@hub/domain/src/types";
import { ROLE_LABEL } from "../lib/roleShared";

export function AccessDenied({ role, required }: { role: Role; required: Role[] }) {
  return (
    <div className="card max-w-lg mx-auto mt-10 text-center">
      <div className="text-5xl mb-3">🔒</div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">접근 권한이 없습니다</h2>
      <p className="text-sm text-slate-500">
        현재 역할: <strong>{ROLE_LABEL[role]}</strong>
      </p>
      <p className="text-sm text-slate-500">
        이 페이지는 {required.map((r) => ROLE_LABEL[r]).join(" / ")} 역할만 접근 가능합니다.
      </p>
      <p className="text-xs text-slate-400 mt-4">왼쪽 사이드바 하단에서 역할을 전환할 수 있습니다 (데모).</p>
    </div>
  );
}
