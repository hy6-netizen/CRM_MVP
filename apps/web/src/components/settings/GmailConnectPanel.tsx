"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Account {
  id: string;
  email: string;
  enabled: boolean;
  lastPolledAt: string | null;
  createdAt: string;
  expiresAt: string;
}

interface PollResult {
  account: string;
  scanned: number;
  parsed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export function GmailConnectPanel({ initialAccounts, hasEnv }: { initialAccounts: Account[]; hasEnv: boolean }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [polling, startPolling] = useTransition();
  const [result, setResult] = useState<PollResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function connect() {
    if (!hasEnv) {
      setError("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 를 .env 에 설정하고 서버 재시작 후 다시 시도하세요.");
      return;
    }
    window.location.href = "/api/integrations/gmail/connect";
  }

  function poll() {
    setError(null);
    setResult(null);
    startPolling(async () => {
      const res = await fetch("/api/cron/gmail-poll", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "폴링 실패");
        return;
      }
      setResult(data.results as PollResult[]);
      // 상태 업데이트 (lastPolledAt)
      const s = await fetch("/api/integrations/gmail/status");
      if (s.ok) {
        const sd = await s.json();
        setAccounts(sd.accounts ?? []);
      }
      router.refresh();
    });
  }

  async function disconnect(id: string) {
    if (!confirm("이 Gmail 연결을 해제하시겠습니까? (예약 데이터는 유지됩니다)")) return;
    const res = await fetch("/api/integrations/gmail/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setAccounts((p) => p.filter((a) => a.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">연결된 Gmail 계정</h3>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={poll} disabled={polling || accounts.length === 0}>
              {polling ? "가져오는 중..." : "지금 폴링"}
            </button>
            <button className="btn-primary" onClick={connect}>
              + Gmail 연결
            </button>
          </div>
        </div>

        {!hasEnv && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
            ⚠️ .env 에 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 가 비어있습니다. 설정 후 서버를 재시작하세요.
          </div>
        )}

        {accounts.length === 0 && hasEnv && (
          <div className="mt-3 text-xs text-slate-500">연결된 계정이 없습니다. 오른쪽 위 "+ Gmail 연결" 버튼을 눌러주세요.</div>
        )}

        {accounts.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100">
            {accounts.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-slate-800">{a.email}</div>
                  <div className="text-[11px] text-slate-500">
                    연결: {new Date(a.createdAt).toLocaleString("ko-KR")}
                    {a.lastPolledAt && ` · 마지막 폴링: ${new Date(a.lastPolledAt).toLocaleString("ko-KR")}`}
                  </div>
                </div>
                <button className="btn-ghost text-xs" onClick={() => disconnect(a.id)}>
                  연결 해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="card bg-red-50 border-red-200 text-sm text-red-800">⚠️ {error}</div>}

      {result && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-2">폴링 결과</h3>
          <ul className="text-sm space-y-1">
            {result.map((r) => (
              <li key={r.account} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{r.account}</span>
                <span className="badge-neutral">스캔 {r.scanned}</span>
                <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">신규 {r.created}</span>
                <span className="badge bg-blue-50 text-blue-700 border border-blue-200">업데이트 {r.updated}</span>
                {r.failed > 0 && <span className="badge bg-red-50 text-red-700 border border-red-200">실패 {r.failed}</span>}
              </li>
            ))}
          </ul>
          {result.some((r) => r.errors.length > 0) && (
            <details className="mt-2">
              <summary className="text-xs text-red-700 cursor-pointer">에러 상세</summary>
              <pre className="mt-1 bg-slate-50 p-2 rounded text-[10px] overflow-x-auto">
                {result.flatMap((r) => r.errors).join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
