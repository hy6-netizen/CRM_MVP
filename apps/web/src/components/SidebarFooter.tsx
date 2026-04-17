"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";

export function SidebarFooter({ user }: { user: { name: string; email: string; role: string } | null }) {
  const [pending, start] = useTransition();
  if (!user) {
    return (
      <div className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-400">
        © 의성한방병원
      </div>
    );
  }
  return (
    <div className="px-3 py-3 border-t border-slate-100 space-y-2">
      <div className="text-xs">
        <div className="font-medium text-slate-800 truncate">{user.name}</div>
        <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{user.role}</div>
      </div>
      <button
        className="btn-ghost w-full text-xs py-1"
        disabled={pending}
        onClick={() => start(() => signOut({ redirectTo: "/login" }))}
      >
        로그아웃
      </button>
    </div>
  );
}
