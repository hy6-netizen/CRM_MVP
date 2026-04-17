export const dashboardSummary = {
todayReservations: 24,
unconfirmedReservations: 7,
staleReservationsOver30m: 3,
newConversations: 19,
unansweredConversations: 8,
newReviews: 11,
reviewsPendingReply: 6,
sensitiveIssues: 2
};

export const reviews = [
{ id: "r1", rating: 5, content: "친절하게 안내해주셔서 편안했습니다." },
{ id: "r2", rating: 2, content: "치료 후 통증이 더 심해진 것 같아 걱정됩니다." }
];

export function getReviewById(id: string) {
return reviews.find((r) => r.id === id);
}
