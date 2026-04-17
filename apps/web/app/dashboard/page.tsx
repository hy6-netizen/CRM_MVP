import Link from "next/link";
import {
  buildDashboardSummary,
  conversations,
  reservations,
  reviews,
} from "../../src/lib/mockStore";
import {
  CONVERSATION_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  channelLabel,
  formatTime,
  relativeTime,
  riskBadgeClass,
  riskLabel,
} from "../../src/lib/format";
import { openNotifications, runNoShowSweep } from "../../src/lib/noShowSweep";
import { NoShowAlertBanner } from "../../src/components/NoShowAlertBanner";

export const dynamic = "force-dynamic";

const CARD_DEFS: { key: keyof ReturnType<typeof buildDashboardSummary>; label: string; tone: string; href: string }[] = [
  { key: "todayReservations", label: "오늘 예약", tone: "text-brand", href: "/reservations" },
  { key: "unconfirmedReservations", label: "미확정 예약", tone: "text-amber-600", href: "/reservations?status=pending_confirmation" },
  { key: "staleReservationsOver30m", label: "30분+ 미처리", tone: "text-red-600", href: "/reservations?status=pending_confirmation" },
  { key: "newConversations", label: "신규 상담", tone: "text-brand", href: "/conversations?status=new" },
  { key: "unansweredConversations", label: "미응답 상담", tone: "text-amber-600", href: "/conversations" },
  { key: "newReviews", label: "신규 리뷰", tone: "text-brand", href: "/reviews?status=new" },
  { key: "reviewsPendingReply", label: "답글 대기", tone: "text-amber-600", href: "/reviews" },
  { key: "sensitiveIssues", label: "민감 이슈", tone: "text-red-600", href: "/reviews?risk=high" },
];

export default async function DashboardPage() {
  // 대시보드 렌더 시점에 20분 경과 예약을 자동으로 no_show_risk 로 전환하고 관리자 알림 발행.
  // BullMQ 도입 전 임시 cron 대체. idempotent (이미 알림 있는 건은 skip).
  await runNoShowSweep();
  const alerts = openNotifications();
  const summary = buildDashboardSummary();

  const urgentReviews = reviews
    .filter((r) => r.riskLevel === "high" && r.status !== "posted" && r.status !== "archived")
    .slice(0, 5);
  const pendingReservations = reservations
    .filter((r) => r.status === "pending_confirmation" || r.status === "new" || r.status === "change_requested")
    .sort((a, b) => +new Date(a.reservationAt) - +new Date(b.reservationAt))
    .slice(0, 6);
  const newConversations = conversations
    .filter((c) => c.status === "new" || c.status === "in_progress")
    .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">오늘 처리해야 할 일</h1>
          <p className="text-sm text-slate-500 mt-1">
            예약 · 상담 · 리뷰의 긴급 항목을 한눈에 확인하세요. {new Date().toLocaleDateString("ko-KR", { dateStyle: "long" })}
          </p>
        </div>
      </div>

      <NoShowAlertBanner initial={alerts} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CARD_DEFS.map((c) => (
          <Link key={c.key} href={c.href} className="card hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 mb-1">{c.label}</div>
            <div className={`text-3xl font-bold ${c.tone}`}>{summary[c.key]}</div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">긴급 리뷰</h2>
            <Link href="/reviews" className="text-xs text-brand hover:underline">전체 보기 →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {urgentReviews.length === 0 && <li className="text-xs text-slate-400 py-4">긴급 리뷰가 없습니다.</li>}
            {urgentReviews.map((r) => (
              <li key={r.id} className="py-2">
                <Link href={`/reviews?focus=${r.id}`} className="block hover:bg-slate-50 -mx-2 px-2 py-1 rounded">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>★ {r.rating} · {r.reviewerNameMasked}</span>
                    <span className={riskBadgeClass(r.riskLevel)}>{riskLabel(r.riskLevel)}</span>
                  </div>
                  <div className="text-sm text-slate-800 line-clamp-2">{r.content}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{REVIEW_STATUS_LABEL[r.status]} · {relativeTime(r.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">대기 예약</h2>
            <Link href="/reservations" className="text-xs text-brand hover:underline">전체 보기 →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {pendingReservations.length === 0 && <li className="text-xs text-slate-400 py-4">대기 예약이 없습니다.</li>}
            {pendingReservations.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{r.patientName}</span>
                  <span className="text-slate-500">{formatTime(r.reservationAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-slate-500">{r.notes ?? "-"}</span>
                  <span className="badge-neutral">{RESERVATION_STATUS_LABEL[r.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">신규 상담</h2>
            <Link href="/conversations" className="text-xs text-brand hover:underline">전체 보기 →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {newConversations.length === 0 && <li className="text-xs text-slate-400 py-4">신규 상담이 없습니다.</li>}
            {newConversations.map((c) => (
              <li key={c.id} className="py-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{c.contactName} · {channelLabel(c.channel)}</span>
                  <span className={riskBadgeClass(c.riskLevel)}>{riskLabel(c.riskLevel)}</span>
                </div>
                <div className="text-sm text-slate-800 line-clamp-2">{c.lastMessagePreview}</div>
                <div className="text-[10px] text-slate-400 mt-1">{CONVERSATION_STATUS_LABEL[c.status]} · {relativeTime(c.lastMessageAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
