import { NextResponse } from "next/server";
import { exchangeCode } from "../../../../../src/lib/gmail";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(new URL(`/settings/integrations/gmail?error=${encodeURIComponent(err)}`, url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings/integrations/gmail?error=no_code", url));
  }

  try {
    const { tokens, email } = await exchangeCode(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      // refresh_token 이 없으면 이후 자동 갱신 불가 → 사용자가 prompt=consent 로 재시도해야.
      return NextResponse.redirect(new URL("/settings/integrations/gmail?error=no_refresh_token", url));
    }
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);
    const acct = await prisma.gmailAccount.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenScope: tokens.scope ?? null,
        expiresAt,
        enabled: true,
      },
      create: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenScope: tokens.scope ?? null,
        expiresAt,
      },
    });
    await recordAudit({
      actorName: "gmail-oauth",
      entityType: "GmailAccount",
      entityId: acct.id,
      action: "gmail.connected",
      after: { email },
    });
    return NextResponse.redirect(new URL("/settings/integrations/gmail?connected=1", url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(new URL(`/settings/integrations/gmail?error=${encodeURIComponent(msg)}`, url));
  }
}
