import { NextResponse } from "next/server";
import { runComplianceCheck as keywordCompliance } from "@hub/ai/src/complianceChecker";
import { getLLM } from "@hub/ai/src/llm";
import type { ComplianceResult } from "@hub/domain/src/types";
import { prisma } from "../../../../../src/lib/db";
import { recordAudit } from "../../../../../src/lib/audit";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const draft = typeof body.draft === "string" && body.draft.length > 0 ? body.draft : review.draft;
  if (!draft) return NextResponse.json({ error: "no_draft" }, { status: 400 });

  const keyword = keywordCompliance(draft);
  let compliance: ComplianceResult = keyword;
  let checker = "keyword";
  let usage: unknown;

  const llm = getLLM();
  if (keyword.status === "approved" && llm.name !== "mock") {
    try {
      const intent = await llm.runIntentComplianceCheck(draft);
      compliance = intent.result;
      checker = intent.provider;
      usage = intent.usage;
    } catch (e) {
      console.error("[compliance-check] 의도 검사 실패", e);
    }
  }

  const updated = await prisma.review.update({
    where: { id },
    data: {
      complianceStatus: compliance.status,
      approvedDraft: compliance.approvedDraft || draft,
    },
  });
  await recordAudit({
    actorName: "system",
    entityType: "Review",
    entityId: id,
    action: "review.compliance_checked",
    after: { status: compliance.status, issues: compliance.issues.length, checker, usage },
  });

  return NextResponse.json({ compliance, review: updated, meta: { checker, usage } });
}
