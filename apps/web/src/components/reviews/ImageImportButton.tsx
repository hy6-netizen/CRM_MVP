"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

interface Extracted {
  rating: number;
  reviewerNameMasked?: string;
  content: string;
  createdAt?: string;
  treatmentMentioned?: string;
  staffMentioned?: string;
  confidence: number;
  warnings: string[];
  meta?: { provider?: string };
}

export function ImageImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [editForm, setEditForm] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  function reset() {
    setPreview(null);
    setExtracted(null);
    setEditForm(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File) {
    reset();
    setOpen(true);
    setPreview(URL.createObjectURL(file));
    setError(null);
    startLoading(async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/reviews/extract-image", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || data.error || "추출 실패");
        return;
      }
      const data = (await res.json()) as Extracted;
      setExtracted(data);
      setEditForm({ ...data });
    });
  }

  async function save() {
    if (!editForm) return;
    startSaving(async () => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewerNameMasked: editForm.reviewerNameMasked,
          rating: editForm.rating,
          content: editForm.content,
          treatmentMentioned: editForm.treatmentMentioned,
          staffMentioned: editForm.staffMentioned,
        }),
      });
      if (!res.ok) {
        setError("리뷰 저장 실패");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
        📎 이미지로 리뷰 추가
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          <div
            className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3">네이버 리뷰 이미지에서 가져오기</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">원본 이미지</div>
                {preview ? (
                  <img src={preview} alt="preview" className="w-full rounded border border-slate-200" />
                ) : (
                  <div className="text-xs text-slate-400">미리보기 없음</div>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-xs text-slate-500">Vision 추출 결과 (수정 가능)</div>
                {loading && <div className="text-xs text-slate-500">추출 중...</div>}
                {error && <div className="text-xs text-red-600 p-2 bg-red-50 rounded">{error}</div>}
                {editForm && (
                  <>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="badge-neutral">신뢰도 {(editForm.confidence * 100).toFixed(0)}%</span>
                      {editForm.meta?.provider && <span className="badge-neutral">{editForm.meta.provider}</span>}
                    </div>
                    {editForm.warnings.length > 0 && (
                      <ul className="text-[11px] text-amber-700 bg-amber-50 rounded p-2 list-disc pl-4">
                        {editForm.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    )}
                    <div>
                      <label className="label">별점</label>
                      <select
                        className="input"
                        value={editForm.rating}
                        onChange={(e) => setEditForm({ ...editForm, rating: Number(e.target.value) })}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{"★".repeat(n)} ({n})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">작성자 (마스킹된 상태)</label>
                      <input
                        className="input"
                        value={editForm.reviewerNameMasked ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, reviewerNameMasked: e.target.value })}
                        placeholder="김**"
                      />
                    </div>
                    <div>
                      <label className="label">본문</label>
                      <textarea
                        className="input min-h-[120px]"
                        value={editForm.content}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">언급 치료 (선택)</label>
                        <input
                          className="input"
                          value={editForm.treatmentMentioned ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, treatmentMentioned: e.target.value })}
                          placeholder="침/추나"
                        />
                      </div>
                      <div>
                        <label className="label">언급 직원 (선택)</label>
                        <input
                          className="input"
                          value={editForm.staffMentioned ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, staffMentioned: e.target.value })}
                          placeholder="김"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
              <button
                className="btn-ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={saving || loading}
              >
                취소
              </button>
              <button className="btn-primary" onClick={save} disabled={saving || loading || !editForm}>
                {saving ? "등록 중..." : "리뷰로 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
