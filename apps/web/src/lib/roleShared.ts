// 클라이언트/서버 공용 — `next/headers` 등 서버 전용 API 를 포함하지 않는다.
// RoleSwitcher (client) 와 role.ts (server) 가 둘 다 이 파일을 import.

import type { Role } from "@hub/domain/src/types";

export const ROLE_COOKIE = "hub_role";
export const ROLES: Role[] = ["admin", "manager", "staff", "reviewer"];
export const ROLE_LABEL: Record<Role, string> = {
  admin: "원장 (admin)",
  manager: "매니저",
  staff: "데스크 직원",
  reviewer: "리뷰어",
};

// 접근 가능한 경로 정책. true 면 그 경로에 진입 가능.
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
