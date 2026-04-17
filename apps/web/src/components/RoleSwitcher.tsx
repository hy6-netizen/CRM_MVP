"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Role } from "@hub/domain/src/types";
import { ROLE_LABEL, ROLES } from "../lib/roleShared";

export function RoleSwitcher({ current }: { current: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  async function change(next: Role) {
    await fetch("/api/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    start(() => router.refresh());
  }

  return (
    <div className="px-3 py-2 border-t border-slate-100">
      <label className="label">현재 역할 (데모)</label>
      <select
        className="input py-1 text-xs"
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value as Role)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      <p className="text-[10px] text-slate-400 mt-1 leading-tight">
        NextAuth 도입 시 제거됨
      </p>
    </div>
  );
}
