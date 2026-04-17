// 서버 전용 — `next/headers` 를 쓰므로 client component 에서 import 금지.
// 상수/권한 함수가 필요하면 `./roleShared` 에서 가져다 쓰세요.

import { cookies } from "next/headers";
import type { Role } from "@hub/domain/src/types";
import { ROLES, ROLE_COOKIE } from "./roleShared";

export async function getCurrentRole(): Promise<Role> {
  const jar = await cookies();
  const v = jar.get(ROLE_COOKIE)?.value;
  if (v && (ROLES as string[]).includes(v)) return v as Role;
  return "admin"; // 데모 기본값 — auth 도입 후 제거
}

// 편의상 서버 코드에서도 공용 상수를 바로 사용할 수 있게 re-export.
export { ROLES, ROLE_LABEL, ROLE_COOKIE, ACCESS, canAccess } from "./roleShared";
