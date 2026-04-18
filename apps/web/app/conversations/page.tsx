import { ConversationsInbox } from "../../src/components/conversations/ConversationsInbox";
import { QuickAddButton } from "../../src/components/conversations/QuickAddButton";
import { prisma } from "../../src/lib/db";
import { toConversationRow, toMessageRow } from "../../src/lib/viewAdapters";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const [convs, msgs] = await Promise.all([
    prisma.conversation.findMany({ orderBy: { lastMessageAt: "desc" }, take: 200 }),
    prisma.message.findMany({ orderBy: { createdAt: "asc" }, take: 1000 }),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">상담 통합 인박스</h1>
          <p className="text-sm text-slate-500 mt-1">
            네이버 톡톡 / 카카오 채널이 외부 공식 API 미연동이라,
            운영자가 외부 앱의 환자 메시지를 붙여넣으면 <strong>자동 분류 + 응답 초안 제안</strong>을 받는 방식입니다.
            민감 키워드(악화/환불/분쟁 등)는 자동으로 검토 필요 상태가 됩니다.
          </p>
        </div>
        <QuickAddButton />
      </div>
      <ConversationsInbox initial={convs.map(toConversationRow)} initialMessages={msgs.map(toMessageRow)} />
    </div>
  );
}
