import { auth } from "./src/lib/auth";

// /api/auth, /login, /api/health, /api/webhooks/* 는 인증 없이 허용.
// 나머지는 세션 필수. 세션 없으면 /login?callbackUrl= 으로 리다이렉트.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/ingest") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next");

  if (isPublic) return;

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
