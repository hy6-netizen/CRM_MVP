import { NextResponse } from "next/server";
import { pollAllGmailAccounts } from "../../../../src/lib/gmailPoll";

// 주기적 Gmail 폴링 엔드포인트.
// launchd / cron / 외부 스케줄러에서 POST 로 호출.
// 보안: CRON_SECRET 을 .env 에 설정하면 Authorization: Bearer <secret> 요구.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const results = await pollAllGmailAccounts();
  return NextResponse.json({ ok: true, results, at: new Date().toISOString() });
}

// GET 도 허용 (로컬 테스트 편의). 보안 우선되면 POST 만 사용 권장.
export async function GET(req: Request) {
  return POST(req);
}
