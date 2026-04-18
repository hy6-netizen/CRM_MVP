"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Result {
  conversation: { id: string };
  classification: { category: string; riskLevel: string; reasons: string[] };
  draft: { text: string; source: string } | null;
  forceHuman: boolean;
}

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"naver_talk" | "kakao_channel" | "manual">("naver_talk");
  const [contactName, setContactName] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setChannel("naver_talk");
    setContactName("");
    setContent("");
    setResult(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!content.trim()) {
      setError("문의 내용을 입력해주세요.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/conversations/quick-add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, contactName: contactName || undefined, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "등록 실패");
        return;
      }
      setResult((await res.json()) as Result);
      router.refresh();
    });
  }

  async function copyDraft() {
    if (!result?.draft) return;
    await navigator.clipboard.writeText(result.draft.text);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + 상담 빠른 입력
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          <div className="card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">네이버 톡톡 / 카카오 상담 빠른 입력</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              외부 앱의 환자 메시지를 붙여넣으면 자동 분류 + 초안 제안을 받습니다.
              실제 답변은 네이버 톡톡/카카오 채널 관리자 화면에서 직접 보내주세요 (공식 API 미연동).
            </p>

            {!result && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">채널</label>
                    <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                      <option value="naver_talk">네이버 톡톡</option>
                      <option value="kakao_channel">카카오 채널</option>
                      <option value="manual">수동 입력</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">발신자 (선택)</label>
                    <input
                      className="input"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="김○○"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">환자 메시지</label>
                  <textarea
                    className="input min-h-[140px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="오늘 몇 시까지 진료하나요?"
                  />
                </div>
                {error && <div className="text-xs text-red-600">{error}</div>}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-3">
                  <button className="btn-ghost" onClick={() => { setOpen(false); reset(); }} disabled={pending}>취소</button>
                  <button className="btn-primary" onClick={submit} disabled={pending}>분류하고 초안 받기</button>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="badge-neutral">{result.classification.category}</span>
                  <span className={
                    "badge " + (result.classification.riskLevel === "high" ? "bg-red-50 text-red-700 border border-red-200"
                      : result.classification.riskLevel === "medium" ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200")
                  }>{result.classification.riskLevel}</span>
                  {result.forceHuman && <span className="badge bg-red-50 text-red-700 border border-red-200">사람 검토 필수</span>}
                </div>
                {result.classification.reasons.length > 0 && (
                  <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">
                    {result.classification.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}

                {result.draft ? (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      제안 답변 <span className="text-slate-400">({result.draft.source})</span>
                    </div>
                    <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-sm whitespace-pre-wrap font-sans">{result.draft.text}</pre>
                    <div className="flex gap-2 mt-2">
                      <button className="btn-ghost" onClick={copyDraft}>📋 답변 복사</button>
                      <a href={`/conversations`} className="btn-ghost">인박스에서 보기</a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                    이 카테고리는 자동 응답 후보가 아닙니다. 운영자가 직접 검토 후 답변하세요.
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-3">
                  <button className="btn-ghost" onClick={() => { setOpen(false); reset(); }}>닫기</button>
                  <button className="btn-primary" onClick={reset}>하나 더 입력</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
