// 서버 전용 — NextAuth session 에서 현재 역할을 꺼낸다.
// 상수/권한 함수는 `./roleShared` (client 공용).

import { auth } from "./auth";
import type { Role } from "@hub/domain/src/types";

export async function getCurrentRole(): Promise<Role> {
  const session = await auth();
  return (session?.user?.role as Role | undefined) ?? "staff";
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export { ROLES, ROLE_LABEL, ROLE_COOKIE, ACCESS, canAccess } from "./roleShared";
