"use client";

import { useMemo, useState, useTransition } from "react";
import type { ConversationRow, MessageRow } from "../../lib/mockStore";
import {
  CONVERSATION_STATUS_LABEL,
  channelLabel,
  relativeTime,
  riskBadgeClass,
  riskLabel,
} from "../../lib/format";
import { AssigneeSelect } from "../AssigneeSelect";
import type { ConversationStatus, Channel } from "@hub/domain/src/types";

const STATUS_FILTERS: { key: "all" | ConversationStatus; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "new", label: "신규" },
  { key: "in_progress", label: "응대 중" },
  { key: "waiting_patient", label: "환자 회신 대기" },
  { key: "resolved", label: "완료" },
  { key: "escalated", label: "검토 필요" },
];

const CHANNEL_FILTERS: { key: "all" | Channel; label: string }[] = [
  { key: "all", label: "전체 채널" },
  { key: "naver_talk", label: "네이버 톡톡" },
  { key: "kakao_channel", label: "카카오 채널" },
  { key: "kakao_biz", label: "카카오 비즈" },
  { key: "manual", label: "수동 입력" },
];

export function ConversationsInbox({ initial, initialMessages }: { initial: ConversationRow[]; initialMessages: MessageRow[] }) {
  const [items, setItems] = useState<ConversationRow[]>(initial);
  const [messages] = useState<MessageRow[]>(initialMessages);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [channelFilter, setChannelFilter] = useState<(typeof CHANNEL_FILTERS)[number]["key"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  const list = useMemo(() => items
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => channelFilter === "all" || c.channel === channelFilter)
    .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)), [items, statusFilter, channelFilter]);

  const selected = items.find((c) => c.id === selectedId) ?? null;
  const selectedMessages = selected ? messages.filter((m) => m.conversationId === selected.id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)) : [];

  function refresh(updated: ConversationRow) {
    setItems((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  async function classify(id: string) {
    const res = await fetch(`/api/conversations/${id}/classify`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    refresh(data.conversation);
  }

  async function setStatus(id: string, status: ConversationStatus) {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    refresh(await res.json());
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className="card p-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={"px-2 py-0.5 rounded-full text-xs border " + (statusFilter === f.key ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200")}
              >{f.label}</button>
            ))}
          </div>
          <div className="flex gap-2 text-xs">
            <select className="input py-1 text-xs" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as typeof channelFilter)}>
              {CHANNEL_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <span className="ml-auto text-slate-500 self-center">{list.length}건</span>
          </div>
        </div>
        <ul className="overflow-y-auto divide-y divide-slate-100">
          {list.map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelectedId(c.id)} className={"w-full text-left p-3 hover:bg-slate-50 " + (c.id === selectedId ? "bg-brand-50" : "")}>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-medium text-slate-700">{c.contactName}</span>
                  <span className={riskBadgeClass(c.riskLevel)}>{riskLabel(c.riskLevel)}</span>
                </div>
                <div className="text-sm text-slate-800 line-clamp-2">{c.lastMessagePreview}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{channelLabel(c.channel)} {c.category ? `· ${c.category}` : ""}</span>
                  <span>{relativeTime(c.lastMessageAt)}</span>
                </div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="p-6 text-center text-xs text-slate-400">조건에 맞는 상담 없음</li>}
        </ul>
      </div>

      <div className="card">
        {!selected && <div className="text-sm text-slate-400">왼쪽에서 상담을 선택하세요.</div>}
        {selected && (
          <div className="space-y-4">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-base font-semibold">{selected.contactName} <span className="text-xs text-slate-400 font-normal">{selected.phoneMasked}</span></div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span className="badge-neutral">{channelLabel(selected.channel)}</span>
                  {selected.category && <span className="badge-neutral">{selected.category}</span>}
                  <span className={riskBadgeClass(selected.riskLevel)}>{riskLabel(selected.riskLevel)}</span>
                  <span className="badge-neutral">{CONVERSATION_STATUS_LABEL[selected.status]}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost" disabled={pending} onClick={() => startTransition(() => classify(selected.id))}>자동 분류</button>
                <AssigneeSelect
                  entity="conversations"
                  id={selected.id}
                  currentAssigneeId={selected.assigneeId}
                />
                <select
                  className="input py-1 text-xs"
                  value={selected.status}
                  onChange={(e) => startTransition(() => setStatus(selected.id, e.target.value as ConversationStatus))}
                >
                  {STATUS_FILTERS.filter((s) => s.key !== "all").map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </header>

            <section className="space-y-2">
              {selectedMessages.length === 0 && <div className="text-xs text-slate-400">메시지가 없습니다.</div>}
              {selectedMessages.map((m) => (
                <div key={m.id} className={"flex " + (m.direction === "outbound" ? "justify-end" : m.direction === "system" ? "justify-center" : "justify-start")}>
                  <div className={"rounded-lg px-3 py-2 text-sm max-w-[75%] " + (
                    m.direction === "outbound" ? "bg-brand text-white" :
                    m.direction === "system" ? "bg-amber-50 text-amber-800 border border-amber-200 text-xs" :
                    "bg-slate-100 text-slate-800"
                  )}>
                    {m.content}
                    <div className={"text-[10px] mt-1 " + (m.direction === "outbound" ? "text-white/80" : "text-slate-400")}>{relativeTime(m.createdAt)}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
