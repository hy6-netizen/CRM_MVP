"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReviewRow } from "../../lib/mockStore";
import {
  REVIEW_STATUS_LABEL,
  relativeTime,
  riskBadgeClass,
  riskLabel,
} from "../../lib/format";
import type { ComplianceResult, ReviewStatus } from "@hub/domain/src/types";

const STATUS_FILTERS: { key: "all" | ReviewStatus; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "new", label: "신규" },
  { key: "draft_generated", label: "초안 생성" },
  { key: "needs_review", label: "검토 필요" },
  { key: "approved", label: "승인" },
  { key: "posted", label: "등록 완료" },
  { key: "escalated", label: "에스컬레이션" },
];

export function ReviewInbox({ initial }: { initial: ReviewRow[] }) {
  const [items, setItems] = useState<ReviewRow[]>(initial);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [ratingMin, setRatingMin] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const [draftEdit, setDraftEdit] = useState<string>("");
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    return items
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => r.rating >= ratingMin)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [items, filter, ratingMin]);

  const selected = items.find((r) => r.id === selectedId) ?? null;

  function refreshOne(updated: ReviewRow) {
    setItems((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  async function generateDraft(id: string) {
    setError(null);
    const res = await fetch(`/api/reviews/${id}/generate-draft`, { method: "POST" });
    if (!res.ok) {
      setError("초안 생성 실패");
      return;
    }
    const data = await res.json();
    refreshOne(data.review);
    setDraftEdit(data.review.approvedDraft || data.review.draft || "");
    setCompliance(data.compliance);
  }

  async function check(id: string, draft: string) {
    setError(null);
    const res = await fetch(`/api/reviews/${id}/compliance-check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft }),
    });
    if (!res.ok) {
      setError("컴플라이언스 검사 실패");
      return;
    }
    const data = await res.json();
    refreshOne(data.review);
    setCompliance(data.compliance);
  }

  async function approve(id: string, draft: string) {
    setError(null);
    const res = await fetch(`/api/reviews/${id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === "compliance_rejected" ? "컴플라이언스 거절 — 표현을 수정하세요." : "승인 실패");
      if (data.compliance) setCompliance(data.compliance);
      return;
    }
    const data = await res.json();
    refreshOne(data.review);
    setCompliance(data.compliance);
  }

  async function postReview(id: string) {
    setError(null);
    const res = await fetch(`/api/reviews/${id}/post`, { method: "POST" });
    if (!res.ok) {
      setError("등록 완료 처리 실패 (승인 상태인지 확인)");
      return;
    }
    const data = await res.json();
    refreshOne(data);
  }

  function selectReview(id: string) {
    setSelectedId(id);
    const r = items.find((x) => x.id === id);
    setDraftEdit(r?.approvedDraft || r?.draft || "");
    setCompliance(null);
    setError(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className="card p-0 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "px-2 py-0.5 rounded-full text-xs border " +
                  (filter === f.key
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <label>최소 별점</label>
            <select className="input py-1 text-xs w-20" value={ratingMin} onChange={(e) => setRatingMin(Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="ml-auto">{list.length}건</span>
          </div>
        </div>
        <ul className="overflow-y-auto divide-y divide-slate-100">
          {list.map((r) => {
            const active = r.id === selectedId;
            return (
              <li key={r.id}>
                <button
                  onClick={() => selectReview(r.id)}
                  className={"w-full text-left p-3 hover:bg-slate-50 " + (active ? "bg-brand-50" : "")}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-medium text-slate-700">★ {r.rating} · {r.reviewerNameMasked}</span>
                    <span className={riskBadgeClass(r.riskLevel)}>{riskLabel(r.riskLevel)}</span>
                  </div>
                  <div className="text-sm text-slate-800 line-clamp-2">{r.content}</div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                    <span className="badge-neutral">{REVIEW_STATUS_LABEL[r.status]}</span>
                    <span>{relativeTime(r.createdAt)}</span>
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-xs text-slate-400">조건에 맞는 리뷰 없음</li>}
        </ul>
      </div>

      <div className="card">
        {!selected && <div className="text-sm text-slate-400">왼쪽에서 리뷰를 선택하세요.</div>}
        {selected && (
          <div className="space-y-4">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  ★ {selected.rating} · {selected.reviewerNameMasked} · {relativeTime(selected.createdAt)}
                </div>
                <p className="text-base text-slate-800 whitespace-pre-line">{selected.content}</p>
                {selected.imageUrl && (
                  <a href={selected.imageUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-brand">
                    📎 첨부 이미지 열기
                  </a>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={riskBadgeClass(selected.riskLevel)}>{riskLabel(selected.riskLevel)}</span>
                <span className="badge-neutral">{REVIEW_STATUS_LABEL[selected.status]}</span>
                {selected.sentiment && <span className="badge-neutral">{selected.sentiment}</span>}
              </div>
            </header>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">답글 초안</h3>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-ghost"
                    disabled={pending}
                    onClick={() => startTransition(() => generateDraft(selected.id))}
                  >
                    초안 생성 / 재생성
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={pending || !draftEdit}
                    onClick={() => startTransition(() => check(selected.id, draftEdit))}
                  >
                    컴플라이언스 검사
                  </button>
                  <button
                    className="btn-primary"
                    disabled={pending || !draftEdit}
                    onClick={() => startTransition(() => approve(selected.id, draftEdit))}
                  >
                    승인
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={pending || selected.status !== "approved"}
                    onClick={() => startTransition(() => postReview(selected.id))}
                  >
                    등록 완료 처리
                  </button>
                </div>
              </div>
              <textarea
                className="input min-h-[140px] font-medium"
                placeholder="아직 초안이 없습니다. 위의 ‘초안 생성’ 버튼을 누르세요."
                value={draftEdit}
                onChange={(e) => setDraftEdit(e.target.value)}
              />
              {selected.draftReasons && selected.draftReasons.length > 0 && (
                <ul className="mt-2 text-xs text-slate-500 list-disc pl-4 space-y-0.5">
                  {selected.draftReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            </section>

            {compliance && (
              <section className="bg-slate-50 border border-slate-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold">컴플라이언스 결과</h4>
                  <span className={
                    "badge " + (compliance.status === "approved"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : compliance.status === "rejected"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200")
                  }>{compliance.status}</span>
                </div>
                {compliance.issues.length === 0 ? (
                  <div className="text-xs text-slate-500">문제 표현 없음.</div>
                ) : (
                  <ul className="text-xs space-y-1">
                    {compliance.issues.map((i, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className={"badge " + (i.type === "BLOCKED" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>{i.type}</span>
                        <span className="text-slate-700">'{i.expression}' — {i.suggestion} <span className="text-slate-400">({i.rule})</span></span>
                      </li>
                    ))}
                  </ul>
                )}
                {compliance.approvedDraft && compliance.status !== "approved" && (
                  <div className="mt-2 text-xs">
                    <div className="text-slate-500 mb-1">자동 수정 제안:</div>
                    <div className="bg-white border border-slate-200 rounded p-2">{compliance.approvedDraft}</div>
                    <button
                      className="btn-ghost mt-2"
                      onClick={() => setDraftEdit(compliance.approvedDraft)}
                    >
                      이 수정안으로 교체
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
