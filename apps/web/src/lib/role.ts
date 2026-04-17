// 역할 시스템 (MVP / pre-auth)
//
// NextAuth 붙이기 전까지의 **임시 역할 게이트**.
// 쿠키(hub_role)에 admin / manager / staff / reviewer 중 하나를 저장하고,
// 서버 컴포넌트와 API 라우트에서 이 값을 읽어 화면/접근을 제한한다.
//
// NextAuth 도입 시 getCurrentRole() 한 함수만 session.user.role 로 바꾸면 됨.

import { cookies } from "next/headers";
import type { Role } from "@hub/domain/src/types";

export const ROLE_COOKIE = "hub_role";
export const ROLES: Role[] = ["admin", "manager", "staff", "reviewer"];
export const ROLE_LABEL: Record<Role, string> = {
  admin: "원장 (admin)",
  manager: "매니저",
  staff: "데스크 직원",
  reviewer: "리뷰어",
};

export async function getCurrentRole(): Promise<Role> {
  const jar = await cookies();
  const v = jar.get(ROLE_COOKIE)?.value;
  if (v && (ROLES as string[]).includes(v)) return v as Role;
  return "admin"; // 데모 기본값 — auth 도입 후 제거
}

// 접근 가능한 경로 정책.
// true 면 그 경로에 진입 가능. 사이드바/페이지 게이트에서 사용.
export const ACCESS: Record<Role, { canAccess: (path: string) => boolean }> = {
  admin: { canAccess: () => true },
  manager: { canAccess: (p) => !p.startsWith("/settings/integrations") },
  staff: {
    canAccess: (p) =>
      p === "/" ||
      p.startsWith("/dashboard") ||
      p.startsWith("/reservations") ||
      p.startsWith("/conversations") ||
      p.startsWith("/reviews") ||
      p.startsWith("/templates"),
  },
  reviewer: {
    canAccess: (p) =>
      p === "/" ||
      p.startsWith("/dashboard") ||
      p.startsWith("/reviews") ||
      p.startsWith("/conversations"),
  },
};

export function canAccess(role: Role, path: string): boolean {
  return ACCESS[role].canAccess(path);
}
