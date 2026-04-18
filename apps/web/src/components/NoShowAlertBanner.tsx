"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { NotificationRow } from "../lib/mockStore";
import { relativeTime } from "../lib/format";

export function NoShowAlertBanner({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (items.length === 0) return null;

  async function dismiss(id: string) {
    await fetch(`/api/notifications/${id}/dismiss`, { method: "POST" });
    setItems((p) => p.filter((n) => n.id !== id));
    start(() => router.refresh());
  }

  return (
    <section className="space-y-2">
      {items.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 border border-red-200 bg-red-50 rounded-lg px-4 py-3"
        >
          <div className="text-red-600 text-xl">⚠️</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <strong className="text-sm text-red-800">{n.title}</strong>
              <span className="text-[10px] text-red-700/70">{relativeTime(n.createdAt)}</span>
              {n.deliveredVia === "alimtalk" ? (
                <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">알림톡 발송됨</span>
              ) : (
                <span className="badge bg-amber-100 text-amber-800 border border-amber-200">알림톡 미연동 (stub)</span>
              )}
            </div>
            <p className="text-xs text-red-700 mt-0.5">{n.body}</p>
          </div>
          <button
            className="btn-ghost text-xs"
            disabled={pending}
            onClick={() => dismiss(n.id)}
          >
            확인함
          </button>
        </div>
      ))}
    </section>
  );
}
