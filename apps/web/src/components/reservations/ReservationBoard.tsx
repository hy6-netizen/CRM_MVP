"use client";

import { useState, useTransition } from "react";
import type { ReservationRow } from "../../lib/mockStore";
import { RESERVATION_STATUS_LABEL, formatDateTime, relativeTime } from "../../lib/format";
import type { ReservationStatus } from "@hub/domain/src/types";

const COLUMNS: ReservationStatus[] = [
  "new",
  "pending_confirmation",
  "confirmed",
  "change_requested",
  "no_show_risk",
  "completed",
  "canceled",
];

export function ReservationBoard({ initial }: { initial: ReservationRow[] }) {
  const [items, setItems] = useState<ReservationRow[]>(initial);
  const [pending, startTransition] = useTransition();

  async function setStatus(id: string, status: ReservationStatus) {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {COLUMNS.map((col) => {
        const list = items.filter((r) => r.status === col).sort((a, b) => +new Date(a.reservationAt) - +new Date(b.reservationAt));
        return (
          <div key={col} className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">{RESERVATION_STATUS_LABEL[col]}</h3>
              <span className="badge-neutral">{list.length}</span>
            </div>
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.id} className="border border-slate-200 rounded-md p-2 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-medium text-slate-700">{r.patientName}</span>
                    <span>{formatDateTime(r.reservationAt)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{r.phoneMasked} · {r.sourceChannel}</div>
                  {r.notes && <div className="text-xs text-slate-700 mt-1">{r.notes}</div>}
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                    <span>등록 {relativeTime(r.createdAt)}</span>
                    <select
                      className="input py-0.5 text-[10px]"
                      value={r.status}
                      disabled={pending}
                      onChange={(e) => startTransition(() => setStatus(r.id, e.target.value as ReservationStatus))}
                    >
                      {COLUMNS.map((s) => <option key={s} value={s}>{RESERVATION_STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </li>
              ))}
              {list.length === 0 && <li className="text-[11px] text-slate-300 text-center py-3">없음</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
