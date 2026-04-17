import { ConversationsInbox } from "../../src/components/conversations/ConversationsInbox";
import { conversations, messages } from "../../src/lib/mockStore";

export const dynamic = "force-dynamic";

export default function ConversationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">상담 통합 인박스</h1>
        <p className="text-sm text-slate-500 mt-1">
          네이버 톡톡 / 카카오 채널 / 카카오 비즈가 한 화면에 모입니다.
          민감 키워드(악화/환불/분쟁 등)는 자동으로 에스컬레이션됩니다.
        </p>
      </div>
      <ConversationsInbox initial={conversations} initialMessages={messages} />
    </div>
  );
}
