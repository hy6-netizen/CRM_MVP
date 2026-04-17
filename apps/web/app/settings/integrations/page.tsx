import { AccessDenied } from "../../../src/components/AccessDenied";
import { getCurrentRole } from "../../../src/lib/role";

export const dynamic = "force-dynamic";

const REQUIRED = ["admin"] as const;

interface ProviderInfo {
  name: string;
  channel: string;
  capabilities: { key: string; label: string; status: "supported" | "manual" | "tbd" }[];
  notes: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    name: "네이버 예약",
    channel: "naver_reservation",
    capabilities: [
      { key: "fetch", label: "예약 수집", status: "manual" },
      { key: "auto_confirm", label: "자동 확정", status: "tbd" },
      { key: "remind", label: "알림 발송", status: "manual" },
    ],
    notes: "공개 API 미확인. 운영자 수동 입력 또는 CSV 임포트로 대체.",
  },
  {
    name: "네이버 톡톡",
    channel: "naver_talk",
    capabilities: [
      { key: "ingest", label: "메시지 수신", status: "manual" },
      { key: "auto_send", label: "자동 발송", status: "tbd" },
    ],
    notes: "외부채널 카드로 표시 + 운영자가 직접 응대. 향후 어댑터 교체 가능.",
  },
  {
    name: "네이버 리뷰",
    channel: "naver_review",
    capabilities: [
      { key: "ingest_text", label: "텍스트 입력", status: "supported" },
      { key: "ingest_image", label: "이미지 OCR", status: "tbd" },
      { key: "csv", label: "CSV 임포트", status: "manual" },
      { key: "auto_post", label: "답글 자동 등록", status: "tbd" },
    ],
    notes: "답글은 “초안 → 승인 → 등록 완료 처리” 흐름 사용. 자동 등록은 capability 확인 후.",
  },
  {
    name: "카카오 비즈 메시지",
    channel: "kakao_biz",
    capabilities: [
      { key: "alimtalk", label: "알림톡", status: "tbd" },
      { key: "friendtalk", label: "친구톡", status: "tbd" },
      { key: "webhook", label: "웹훅 수신", status: "tbd" },
    ],
    notes: "사업자 채널 + 발송대행사 연동 후 활성화. MVP에선 인터페이스/템플릿만 준비.",
  },
  {
    name: "카카오 채널",
    channel: "kakao_channel",
    capabilities: [
      { key: "ingest", label: "유입 수신", status: "manual" },
      { key: "auto_reply", label: "챗봇 자동응답", status: "tbd" },
    ],
    notes: "채널 운영도구를 통해 메시지 확인 + 운영자 응대.",
  },
];

const STATUS_BADGE: Record<ProviderInfo["capabilities"][number]["status"], string> = {
  supported: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  manual: "bg-amber-50 text-amber-700 border border-amber-200",
  tbd: "bg-slate-100 text-slate-600 border border-slate-200",
};

const STATUS_LABEL: Record<ProviderInfo["capabilities"][number]["status"], string> = {
  supported: "지원",
  manual: "수동",
  tbd: "검토 필요",
};

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
          채널별 capability 매트릭스. 공식 API 가 미확인인 영역은 어댑터 인터페이스 + 수동 흐름으로 운영합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROVIDERS.map((p) => (
          <div key={p.channel} className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">{p.name}</h3>
              <span className="badge-neutral text-[10px] font-mono">{p.channel}</span>
            </div>
            <ul className="space-y-1 text-xs">
              {p.capabilities.map((c) => (
                <li key={c.key} className="flex items-center justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-700">{c.label}</span>
                  <span className={"badge " + STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{p.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
