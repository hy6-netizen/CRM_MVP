// Gmail API wrapper.
// - OAuth2 client 생성
// - 저장된 refresh token 으로 자동 갱신
// - messages.list / messages.get / history.list 편의 래퍼
// - 본문 (text/plain 우선) 디코드해서 string 반환

import { google, gmail_v1 } from "googleapis";
import { prisma } from "./db";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const NAVER_SENDER = "naverbooking_noreply@navercorp.com";
export const NAVER_BOOKING_QUERY = `from:${NAVER_SENDER}`;

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/integrations/gmail/callback";
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 가 .env 에 없습니다.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state?: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // 항상 refresh_token 받도록
    scope: GMAIL_SCOPES,
    state: state ?? "gmail-connect",
  });
}

export async function exchangeCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  return {
    tokens,
    email: me.data.email!,
  };
}

/**
 * 저장된 GmailAccount 로 인증된 gmail client 반환.
 * refresh token 으로 access token 자동 갱신 시 DB 에도 반영.
 */
export async function getAuthedGmail(accountId: string): Promise<{
  gmail: gmail_v1.Gmail;
  accountEmail: string;
}> {
  const acct = await prisma.gmailAccount.findUnique({ where: { id: accountId } });
  if (!acct) throw new Error(`GmailAccount ${accountId} not found`);

  const client = createOAuthClient();
  client.setCredentials({
    access_token: acct.accessToken,
    refresh_token: acct.refreshToken,
    expiry_date: acct.expiresAt.getTime(),
    scope: acct.tokenScope ?? undefined,
  });

  client.on("tokens", async (newTokens) => {
    try {
      await prisma.gmailAccount.update({
        where: { id: acct.id },
        data: {
          accessToken: newTokens.access_token ?? acct.accessToken,
          refreshToken: newTokens.refresh_token ?? acct.refreshToken,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : acct.expiresAt,
        },
      });
    } catch (e) {
      console.error("[gmail] token refresh persist failed", e);
    }
  });

  return { gmail: google.gmail({ version: "v1", auth: client }), accountEmail: acct.email };
}

export async function listNaverBookingMessageIds(gmail: gmail_v1.Gmail, sinceUnixTs?: number): Promise<string[]> {
  let q = NAVER_BOOKING_QUERY;
  if (sinceUnixTs) q += ` after:${sinceUnixTs}`;
  const out: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 50,
      pageToken,
    });
    for (const m of res.data.messages ?? []) if (m.id) out.push(m.id);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export async function fetchMessageRaw(gmail: gmail_v1.Gmail, messageId: string): Promise<{
  subject?: string;
  from?: string;
  body: string;
  internalDate?: number;
}> {
  // `format: full` 로 payload 구조 받아서 직접 text 추출 (raw 보다 파싱 쉬움)
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const h = (name: string) => headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
  const subject = h("Subject");
  const from = h("From");
  const body = extractBodyText(msg.payload ?? undefined);
  const internalDate = msg.internalDate ? Number(msg.internalDate) : undefined;
  return { subject, from, body, internalDate };
}

function extractBodyText(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";
  // 재귀로 text/plain 을 우선, 없으면 text/html 찾기.
  const plain = findPart(payload, "text/plain");
  if (plain) return decodePart(plain);
  const html = findPart(payload, "text/html");
  if (html) return decodePart(html);
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function findPart(part: gmail_v1.Schema$MessagePart, mime: string): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const sub of part.parts ?? []) {
    const hit = findPart(sub, mime);
    if (hit) return hit;
  }
  return null;
}

function decodePart(part: gmail_v1.Schema$MessagePart): string {
  const data = part.body?.data ?? "";
  return decodeBase64Url(data);
}

function decodeBase64Url(s: string): string {
  if (!s) return "";
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}
