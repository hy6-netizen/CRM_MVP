import Link from "next/link";
import { prisma } from "../../src/lib/db";
import { buildDashboardSummary } from "../../src/lib/dashboard";
import { openNotifications, runAllSweeps } from "../../src/lib/noShowSweep";
import { NoShowAlertBanner } from "../../src/components/NoShowAlertBanner";
import { toNotificationRow } from "../../src/lib/viewAdapters";
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

export const dynamic = "force-dynamic";

const CARD_DEFS: { key: keyof Awaited<ReturnType<typeof buildDashboardSummary>>; label: string; tone: string; href: string }[] = [
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
  // 시간 기반 자동 감지 idempotent 실행 (BullMQ cron 도입 전 대체):
  // - 노쇼 위험 (예약 시간 + 20분)
  // - 미응답 상담 (메시지 후 30분)
  await runAllSweeps();
  const [summary, alerts, urgentReviews, pendingReservations, newConversations] = await Promise.all([
    buildDashboardSummary(),
    openNotifications(),
    prisma.review.findMany({
      where: { riskLevel: "high", status: { notIn: ["posted", "archived"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: { status: { in: ["pending_confirmation", "new", "change_requested"] } },
      orderBy: { reservationAt: "asc" },
      take: 6,
    }),
    prisma.conversation.findMany({
      where: { status: { in: ["new", "in_progress"] } },
      orderBy: { lastMessageAt: "desc" },
      take: 6,
    }),
  ]);

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

      <NoShowAlertBanner initial={alerts.map(toNotificationRow)} />

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
                  <div className="text-[10px] text-slate-400 mt-1">{REVIEW_STATUS_LABEL[r.status]} · {relativeTime(r.createdAt.toISOString())}</div>
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
                  <span className="text-slate-500">{formatTime(r.reservationAt.toISOString())}</span>
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
                  <span>{c.contactName ?? "-"} · {channelLabel(c.channel)}</span>
                  <span className={riskBadgeClass(c.riskLevel)}>{riskLabel(c.riskLevel)}</span>
                </div>
                <div className="text-sm text-slate-800 line-clamp-2">{c.lastMessagePreview}</div>
                <div className="text-[10px] text-slate-400 mt-1">{CONVERSATION_STATUS_LABEL[c.status]} · {relativeTime(c.lastMessageAt.toISOString())}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
