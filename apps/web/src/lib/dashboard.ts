import type { DashboardSummary } from "@hub/domain/src/types";
import { prisma } from "./db";

export async function buildDashboardSummary(): Promise<DashboardSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const staleCutoff = new Date(Date.now() - 30 * 60_000);

  const [
    todayReservations,
    unconfirmedReservations,
    staleReservationsOver30m,
    newConversations,
    unansweredConversations,
    newReviews,
    reviewsPendingReply,
    sensitiveReviews,
    sensitiveConversations,
  ] = await Promise.all([
    prisma.reservation.count({ where: { reservationAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.reservation.count({ where: { status: { in: ["pending_confirmation", "new"] } } }),
    prisma.reservation.count({
      where: {
        status: { in: ["pending_confirmation", "new"] },
        createdAt: { lt: staleCutoff },
      },
    }),
    prisma.conversation.count({ where: { status: "new" } }),
    prisma.conversation.count({ where: { status: { in: ["new", "in_progress"] } } }),
    prisma.review.count({ where: { status: "new" } }),
    prisma.review.count({ where: { status: { in: ["new", "draft_generated", "needs_review"] } } }),
    prisma.review.count({ where: { riskLevel: "high" } }),
    prisma.conversation.count({ where: { riskLevel: "high" } }),
  ]);

  return {
    todayReservations,
    unconfirmedReservations,
    staleReservationsOver30m,
    newConversations,
    unansweredConversations,
    newReviews,
    reviewsPendingReply,
    sensitiveIssues: sensitiveReviews + sensitiveConversations,
  };
}
