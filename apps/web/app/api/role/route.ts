import { NextResponse } from "next/server";
import { ROLE_COOKIE, ROLES } from "../../../src/lib/role";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const role = typeof body.role === "string" ? body.role : "";
  if (!(ROLES as string[]).includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(ROLE_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
