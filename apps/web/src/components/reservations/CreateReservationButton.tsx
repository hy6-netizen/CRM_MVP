"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function defaultReservationAt(): string {
  // 오늘 기준 현재 + 2시간 을 datetime-local 값으로.
  const d = new Date(Date.now() + 2 * 60 * 60_000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function maskPhone(raw: string): string {
  // 010-1234-5678 → 010-****-5678
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 11 && digits.length !== 10) return raw;
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
}

export function CreateReservationButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [at, setAt] = useState(defaultReservationAt());
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    setError(null);
    if (!name || !phone || !at) {
      setError("이름/전화/시간은 필수입니다.");
      return;
    }
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientName: name,
        phoneMasked: maskPhone(phone),
        reservationAt: new Date(at).toISOString(),
        notes: notes || undefined,
        sourceChannel: "manual",
        status: "pending_confirmation",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === "validation" ? "입력값을 확인하세요." : "예약 생성 실패");
      return;
    }
    setOpen(false);
    setName("");
    setPhone("");
    setAt(defaultReservationAt());
    setNotes("");
    start(() => router.refresh());
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + 수동 예약 추가
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3">수동 예약 추가</h3>
            <div className="space-y-2">
              <div>
                <label className="label">환자 이름</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="김○○" />
              </div>
              <div>
                <label className="label">전화번호</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  저장 시 중간 자리는 자동 마스킹됩니다 (010-****-5678).
                </p>
              </div>
              <div>
                <label className="label">예약 일시</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              </div>
              <div>
                <label className="label">메모 (선택)</label>
                <input
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="초진 / 허리 통증"
                />
              </div>
            </div>

            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>취소</button>
              <button className="btn-primary" onClick={submit} disabled={pending}>저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
