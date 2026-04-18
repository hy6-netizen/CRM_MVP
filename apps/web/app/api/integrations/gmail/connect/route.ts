import { NextResponse } from "next/server";
import { getAuthUrl } from "../../../../../src/lib/gmail";

// 관리자가 /settings/integrations/gmail 에서 "Gmail 연결" 누르면 여기로 GET
// → Google OAuth 동의 화면으로 리다이렉트
export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "oauth_init_failed", message: msg }, { status: 500 });
  }
}
