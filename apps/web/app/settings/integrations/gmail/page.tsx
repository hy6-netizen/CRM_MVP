import { AccessDenied } from "../../../../src/components/AccessDenied";
import { getCurrentRole } from "../../../../src/lib/role";
import { prisma } from "../../../../src/lib/db";
import { GmailConnectPanel } from "../../../../src/components/settings/GmailConnectPanel";

export const dynamic = "force-dynamic";

const REQUIRED = ["admin"] as const;

export default async function GmailSettingsPage(props: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const role = await getCurrentRole();
  if (!(REQUIRED as readonly string[]).includes(role)) {
    return <AccessDenied role={role} required={[...REQUIRED]} />;
  }
  const params = await props.searchParams;

  const accounts = await prisma.gmailAccount.findMany({
    select: {
      id: true,
      email: true,
      enabled: true,
      lastPolledAt: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const hasEnv = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gmail 연결 (네이버 예약 알림 자동 수신)</h1>
        <p className="text-sm text-slate-500 mt-1">
          네이버 예약 알림 이메일을 받는 Gmail 계정을 연결하면, 새 예약이 자동으로{" "}
          <strong>"예약 보드"</strong> 에 올라옵니다.
          읽기 권한만 요청하고, 메일 내용은 서버에 저장하지 않습니다 (파싱된 예약 정보만 저장).
        </p>
      </div>

      {params.connected && (
        <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm">
          ✅ Gmail 연결 완료! 아래 계정이 등록되었습니다. 수동 폴링 버튼으로 바로 가져올 수 있습니다.
        </div>
      )}
      {params.error && (
        <div className="card bg-red-50 border-red-200 text-red-800 text-sm">
          ⚠️ 연결 실패: {decodeURIComponent(params.error)}
        </div>
      )}

      <GmailConnectPanel initialAccounts={accounts.map((a) => ({
        ...a,
        lastPolledAt: a.lastPolledAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        expiresAt: a.expiresAt.toISOString(),
      }))} hasEnv={hasEnv} />

      <div className="card text-xs text-slate-600 space-y-2">
        <h3 className="font-semibold text-sm text-slate-800">설정 체크리스트</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Google Cloud Console → Gmail API 활성화 + OAuth 클라이언트 생성 (웹 애플리케이션)</li>
          <li>승인된 리디렉션 URI: <code className="bg-slate-100 px-1">http://localhost:3001/api/integrations/gmail/callback</code></li>
          <li>.env 에 <code className="bg-slate-100 px-1">GOOGLE_CLIENT_ID</code>, <code className="bg-slate-100 px-1">GOOGLE_CLIENT_SECRET</code> 설정 후 서버 재시작</li>
          <li>위 "Gmail 연결" 버튼 클릭 → Google 로그인 → 읽기 권한 동의</li>
          <li>자동 주기 폴링은 <code className="bg-slate-100 px-1">launchd</code> 로 설정 (docs/DEPLOYMENT.md 참고)</li>
        </ol>
        <p className="text-slate-500">
          필터 쿼리: <code className="bg-slate-100 px-1">from:naverbooking_noreply@navercorp.com</code>
        </p>
      </div>
    </div>
  );
}
