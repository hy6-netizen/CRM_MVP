// Prisma client 싱글톤. dev 중 HMR 로 매번 새 client 생성되는 것 방지.
// 실행 전: `pnpm --filter @hub/db prisma generate` 한번 필요.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
