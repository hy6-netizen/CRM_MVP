import { AccessDenied } from "../../../src/components/AccessDenied";
import { getCurrentRole } from "../../../src/lib/role";
import { providerRegistry } from "@hub/providers/src/mock/mockProvider";
import type {
  BaseProvider,
  CapabilityFlag,
  CapabilityStatus,
  ProviderCapability,
} from "@hub/providers/src/types";

export const dynamic = "force-dynamic";

const REQUIRED = ["admin"] as const;

interface DisplayProvider {
  title: string;
  subtitle: string;
  provider: BaseProvider;
  // 해당 provider 에서 의미 있는 capability 만 표시.
  relevantFlags: Array<{ key: keyof ProviderCapability; label: string }>;
}

const PROVIDERS: DisplayProvider[] = [
  {
    title: "네이버 예약",
    subtitle: "공식 공개 API 미확인 — 수동 / CSV 기반 운영",
    provider: providerRegistry.naverReservation,
    relevantFlags: [
      { key: "canSyncReservations", label: "예약 수집" },
      { key: "canAutoConfirmReservations", label: "자동 확정" },
    ],
  },
  {
    title: "네이버 톡톡",
    subtitle: "외부 양방향 공개 API 미확인 — 운영 보조형",
    provider: providerRegistry.naverTalk,
    relevantFlags: [
      { key: "canReceiveMessages", label: "메시지 수신" },
      { key: "canSendMessages", label: "메시지 송신" },
    ],
  },
  {
    title: "네이버 리뷰",
    subtitle: "답글은 초안 → 승인 → 네이버에서 직접 등록 → '등록 완료 처리'",
    provider: providerRegistry.naverReview,
    relevantFlags: [
      { key: "canImportReviews", label: "리뷰 수집" },
      { key: "canPostReviewReplies", label: "답글 자동 등록" },
    ],
  },
  {
    title: "카카오 상담톡",
    subtitle: "실시간 양방향 상담 — 딜러사 계약 필요",
    provider: providerRegistry.kakaoConsult,
    relevantFlags: [
      { key: "canReceiveMessages", label: "메시지 수신" },
      { key: "canSendMessages", label: "메시지 송신" },
    ],
  },
  {
    title: "카카오 챗봇 (FAQ 자동응답)",
    subtitle: "카카오 i 오픈빌더 + 본 앱 /api/webhooks/kakao/chatbot",
    provider: providerRegistry.kakaoChatbot,
    relevantFlags: [
      { key: "canAutoRespondFaq", label: "FAQ 자동응답" },
    ],
  },
  {
    title: "카카오 비즈메시지 (알림톡·친구톡)",
    subtitle: "발송대행사 계약 + 템플릿 심사 승인 필요",
    provider: providerRegistry.kakaoBizMessage,
    relevantFlags: [
      { key: "canSendBizMessage", label: "알림톡·친구톡 발송" },
    ],
  },
];

const STATUS_BADGE: Record<CapabilityStatus, string> = {
  supported: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  manual: "bg-amber-50 text-amber-700 border border-amber-200",
  unknown: "bg-slate-100 text-slate-600 border border-slate-200",
  unavailable: "bg-red-50 text-red-700 border border-red-200",
};

const STATUS_LABEL: Record<CapabilityStatus, string> = {
  supported: "지원",
  manual: "수동",
  unknown: "미확인",
  unavailable: "불가/계약필요",
};

function Flag({ label, flag }: { label: string; flag: CapabilityFlag }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={"badge " + STATUS_BADGE[flag.status]}>{STATUS_LABEL[flag.status]}</span>
      </div>
      {flag.note && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{flag.note}</p>}
      {flag.unblock && (
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          ↳ 활성화 조건: <span className="text-slate-600">{flag.unblock}</span>
        </p>
      )}
    </div>
  );
}

export default async function IntegrationsPage() {
  const role = await getCurrentRole();
  if (!(REQUIRED as readonly string[]).includes(role)) {
    return <AccessDenied role={role} required={[...REQUIRED]} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">연동 설정</h1>
        <p className="text-sm text-slate-500 mt-1">
          채널별 capability 매트릭스. <strong>공식 API가 확인된 기능만 "지원" </strong>으로 표시하며,
          그 외에는 <strong>수동 처리 / 조사 필요 / 계약 필요</strong>를 명시합니다.
          운영 경로는 항상 <strong>수동 fallback 이 먼저</strong> 동작합니다 (
          <a href="/docs/MANUAL_FALLBACKS.md" className="text-brand underline">수동 대체 경로</a>).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROVIDERS.map((p) => (
          <div key={p.title} className="card">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-800">{p.title}</h3>
                <span className="badge-neutral text-[10px] font-mono">{p.provider.channel}</span>
              </div>
              <p className="text-[11px] text-slate-500">{p.subtitle}</p>
            </div>
            <div>
              {p.relevantFlags.map(({ key, label }) => (
                <Flag key={key} label={label} flag={p.provider.capability[key]} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card border-brand/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">📧 Gmail 연결 (네이버 예약 이메일 자동 수신)</h3>
            <p className="text-xs text-slate-500 mt-1">
              네이버 예약 알림 이메일을 받는 Gmail 을 연결하면 새 예약이 자동으로 예약 보드에 올라옵니다.
            </p>
          </div>
          <a href="/settings/integrations/gmail" className="btn-primary">설정하기 →</a>
        </div>
      </div>

      <div className="card bg-slate-50 border-slate-200">
        <h3 className="font-semibold text-sm text-slate-700 mb-2">운영 원칙</h3>
        <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
          <li><strong>"지원"</strong> 이 아닌 기능은 앱에서 자동 처리되지 <em>않습니다</em>. UI는 수동 처리 흐름으로 보조합니다.</li>
          <li>공식 API가 명확해질 때까지 <em>비공식 크롤링/브라우저 자동화를 사용하지 않습니다</em>.</li>
          <li>카카오 상담톡 / 비즈메시지는 대행사 · 딜러사 계약이 선행되어야 활성화 가능.</li>
          <li>네이버 계열은 공식 Partner 접근 확보 시 provider를 교체합니다 (코드 변경 최소).</li>
        </ul>
      </div>
    </div>
  );
}
