"use client";

import { useState } from "react";
import type { ComplianceResult } from "@hub/domain/src/types";

const SAMPLE = "안녕하세요~ 의성한방병원입니다. 저희는 100% 완치를 보장하며, 후기 작성 시 혜택도 드립니다.";

export function ComplianceTester() {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: text }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea className="input min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-primary" onClick={run} disabled={loading || !text}>
        {loading ? "검사 중..." : "검사 실행"}
      </button>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">결과:</span>
            <span className={
              "badge " + (result.status === "approved"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : result.status === "rejected"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200")
            }>{result.status}</span>
          </div>
          {result.issues.length > 0 && (
            <ul className="text-xs space-y-1">
              {result.issues.map((i, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={"badge " + (i.type === "BLOCKED" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>{i.type}</span>
                  <span>'{i.expression}' — {i.suggestion} <span className="text-slate-400">({i.rule})</span></span>
                </li>
              ))}
            </ul>
          )}
          {result.approvedDraft && (
            <div>
              <div className="text-xs text-slate-500 mb-1">최종 통과/제안 문장</div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-sm">{result.approvedDraft}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
