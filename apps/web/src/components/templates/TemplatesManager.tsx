"use client";

import { useState, useTransition } from "react";
import type { TemplateRow } from "../../lib/mockStore";
import { relativeTime } from "../../lib/format";

const EMPTY: Omit<TemplateRow, "id" | "updatedAt"> = {
  code: "TALK_HOURS",
  channel: "kakao_channel",
  intent: "진료시간",
  title: "",
  body: "",
  enabled: true,
  requiresHumanReview: false,
  complianceLevel: "standard",
};

export function TemplatesManager({ initial }: { initial: TemplateRow[] }) {
  const [items, setItems] = useState<TemplateRow[]>(initial);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<typeof EMPTY>(EMPTY);
  const [pending, startTransition] = useTransition();

  function startEdit(t: TemplateRow) {
    setEditing(t);
    setCreating(false);
  }
  function startCreate() {
    setEditing(null);
    setCreating(true);
    setDraft(EMPTY);
  }

  async function save() {
    if (creating) {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) return;
      const created = await res.json();
      setItems((p) => [created, ...p]);
      setCreating(false);
      return;
    }
    if (editing) {
      const res = await fetch(`/api/templates/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setItems((p) => p.map((t) => (t.id === updated.id ? updated : t)));
      setEditing(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((p) => p.filter((t) => t.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm">템플릿 ({items.length})</h2>
          <button className="btn-primary" onClick={startCreate}>새 템플릿</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">코드</th>
              <th className="text-left px-3 py-2">제목</th>
              <th className="text-left px-3 py-2">채널</th>
              <th className="text-left px-3 py-2">컴플라</th>
              <th className="text-left px-3 py-2">활성</th>
              <th className="text-right px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{t.code}</td>
                <td className="px-3 py-2">{t.title}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{t.channel}</td>
                <td className="px-3 py-2"><span className={"badge " + (t.complianceLevel === "strict" ? "bg-red-50 text-red-700 border border-red-200" : "badge-neutral")}>{t.complianceLevel}</span></td>
                <td className="px-3 py-2">{t.enabled ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button className="text-xs text-brand mr-2" onClick={() => startEdit(t)}>수정</button>
                  <button className="text-xs text-red-600" onClick={() => startTransition(() => remove(t.id))}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        {!editing && !creating && <div className="text-sm text-slate-400">템플릿을 선택하거나 새로 만드세요.</div>}
        {(editing || creating) && (
          <div className="space-y-3">
            <h3 className="font-semibold">{creating ? "새 템플릿" : `편집: ${editing!.title}`}</h3>
            <FormFields
              data={creating ? draft : editing!}
              onChange={(patch) => {
                if (creating) setDraft({ ...draft, ...patch });
                else setEditing({ ...editing!, ...patch });
              }}
            />
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                {!creating && editing?.updatedAt && <>최근 수정 {relativeTime(editing.updatedAt)}</>}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => { setEditing(null); setCreating(false); }}>취소</button>
                <button className="btn-primary" disabled={pending} onClick={() => startTransition(save)}>저장</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormFields({ data, onChange }: { data: Partial<TemplateRow>; onChange: (patch: Partial<TemplateRow>) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">코드</label>
          <input className="input" value={data.code ?? ""} onChange={(e) => onChange({ code: e.target.value })} />
        </div>
        <div>
          <label className="label">의도</label>
          <input className="input" value={data.intent ?? ""} onChange={(e) => onChange({ intent: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">채널</label>
          <select className="input" value={data.channel ?? "kakao_channel"} onChange={(e) => onChange({ channel: e.target.value as TemplateRow["channel"] })}>
            <option value="kakao_channel">kakao_channel</option>
            <option value="kakao_biz">kakao_biz</option>
            <option value="naver_talk">naver_talk</option>
            <option value="naver_review">naver_review</option>
            <option value="manual">manual</option>
          </select>
        </div>
        <div>
          <label className="label">컴플라이언스 등급</label>
          <select className="input" value={data.complianceLevel ?? "standard"} onChange={(e) => onChange({ complianceLevel: e.target.value as "standard" | "strict" })}>
            <option value="standard">standard</option>
            <option value="strict">strict</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">제목</label>
        <input className="input" value={data.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <label className="label">본문</label>
        <textarea className="input min-h-[120px]" value={data.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
      </div>
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={data.enabled ?? true} onChange={(e) => onChange({ enabled: e.target.checked })} />
          활성
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={data.requiresHumanReview ?? false} onChange={(e) => onChange({ requiresHumanReview: e.target.checked })} />
          사람 검토 필수
        </label>
      </div>
    </div>
  );
}
