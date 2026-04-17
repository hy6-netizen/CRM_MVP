"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ImportResult {
  ok: boolean;
  total: number;
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
  headers?: string[];
}

export function CsvImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File) {
    reset();
    start(async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/reservations/import-csv", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ? `${data.error}: ${JSON.stringify(data.headers ?? "")}` : "import 실패");
        return;
      }
      setResult(data as ImportResult);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={pending}>
        📥 CSV 임포트
      </button>

      {(result || error) && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={reset}
        >
          <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">네이버 예약 CSV 임포트 결과</h3>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
            {result && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="badge-neutral">총 {result.total}건</span>
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">신규 {result.created}</span>
                  <span className="badge bg-blue-50 text-blue-700 border border-blue-200">업데이트 {result.updated}</span>
                  {result.errors.length > 0 && (
                    <span className="badge bg-red-50 text-red-700 border border-red-200">에러 {result.errors.length}</span>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">에러 (행 번호)</div>
                    <ul className="text-xs bg-slate-50 rounded p-2 max-h-40 overflow-y-auto space-y-0.5">
                      {result.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>행 {e.row}: {e.reason}</li>
                      ))}
                      {result.errors.length > 20 && <li className="text-slate-400">... {result.errors.length - 20} 개 더</li>}
                    </ul>
                  </div>
                )}
                {result.headers && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">감지된 컬럼</div>
                    <div className="text-[11px] text-slate-600 font-mono bg-slate-50 rounded p-1">
                      {result.headers.join(" | ")}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button className="btn-primary" onClick={reset}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
