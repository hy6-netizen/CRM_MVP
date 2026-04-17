import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("workspace yaml 존재", async () => {
  const c = await fs.readFile("pnpm-workspace.yaml", "utf8");
  assert.ok(c.includes("packages"));
});

test("8 개 핵심 페이지 라우트 존재", async () => {
  for (const p of [
    "apps/web/app/dashboard/page.tsx",
    "apps/web/app/reservations/page.tsx",
    "apps/web/app/conversations/page.tsx",
    "apps/web/app/reviews/page.tsx",
    "apps/web/app/templates/page.tsx",
    "apps/web/app/settings/integrations/page.tsx",
    "apps/web/app/settings/compliance/page.tsx",
    "apps/web/app/logs/page.tsx",
  ]) {
    await fs.access(p);
  }
});

test("리뷰 핵심 API 라우트 존재", async () => {
  for (const p of [
    "apps/web/app/api/reviews/route.ts",
    "apps/web/app/api/reviews/[id]/generate-draft/route.ts",
    "apps/web/app/api/reviews/[id]/compliance-check/route.ts",
    "apps/web/app/api/reviews/[id]/approve/route.ts",
    "apps/web/app/api/reviews/[id]/post/route.ts",
    "apps/web/app/api/templates/route.ts",
    "apps/web/app/api/conversations/route.ts",
    "apps/web/app/api/reservations/route.ts",
    "apps/web/app/api/audit-logs/route.ts",
    "apps/web/app/api/compliance/test/route.ts",
  ]) {
    await fs.access(p);
  }
});

test("Tailwind 설정 존재", async () => {
  await fs.access("apps/web/tailwind.config.ts");
  await fs.access("apps/web/postcss.config.cjs");
  const css = await fs.readFile("apps/web/app/globals.css", "utf8");
  assert.ok(css.includes("@tailwind base"));
});
