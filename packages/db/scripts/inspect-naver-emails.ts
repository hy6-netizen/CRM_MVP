// 디버그: 연결된 Gmail 계정에서 네이버 예약 관련 메일을 최근 20개 나열.
// 제목 / 발신자 / Internal Date / 본문 앞 200자 를 출력.
// 사용: pnpm --filter @hub/db inspect:naver-emails

import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";

const prisma = new PrismaClient();

async function main() {
  const acct = await prisma.gmailAccount.findFirst({ where: { enabled: true } });
  if (!acct) {
    console.error("연결된 Gmail 계정 없음");
    process.exit(1);
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  client.setCredentials({
    access_token: acct.accessToken,
    refresh_token: acct.refreshToken,
    expiry_date: acct.expiresAt.getTime(),
  });
  const gmail = google.gmail({ version: "v1", auth: client });

  // 네이버 예약에서 오는 모든 메일 (booking/noreply/payment 등)
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "from:naver OR from:navercorp.com",
    maxResults: 30,
  });

  console.log(`총 ${res.data.messages?.length ?? 0} 개 조회`);
  for (const m of res.data.messages ?? []) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    const headers = full.data.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value;
    const subject = h("Subject") ?? "";
    const from = h("From") ?? "";
    const date = h("Date") ?? "";
    // 본문 발췌
    const body = extractBody(full.data.payload ?? undefined);
    const compact = body.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").trim();
    console.log("----");
    console.log(`[${date}]`);
    console.log(`From:    ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body(full): ${compact.slice(0, 1500)}`);
  }
}

function extractBody(part?: import("googleapis").gmail_v1.Schema$MessagePart): string {
  if (!part) return "";
  const findPlain = (p: import("googleapis").gmail_v1.Schema$MessagePart): import("googleapis").gmail_v1.Schema$MessagePart | null => {
    if (p.mimeType === "text/plain" && p.body?.data) return p;
    for (const s of p.parts ?? []) {
      const hit = findPlain(s);
      if (hit) return hit;
    }
    return null;
  };
  const plain = findPlain(part);
  const data = plain?.body?.data ?? part.body?.data ?? "";
  if (!data) return "";
  const pad = "=".repeat((4 - (data.length % 4)) % 4);
  const b64 = (data + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
