import { NextResponse } from "next/server";
import { COMPLIANCE_RULE_BOOK, runComplianceCheck as keywordCompliance } from "@hub/ai/src/complianceChecker";
import { getLLM } from "@hub/ai/src/llm";
import type { ComplianceResult } from "@hub/domain/src/types";

export async function GET() {
  return NextResponse.json(COMPLIANCE_RULE_BOOK);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const draft = typeof body.draft === "string" ? body.draft : "";
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
      console.error("[compliance/test] 의도 검사 실패", e);
    }
  }

  return NextResponse.json({ ...compliance, meta: { checker, usage } });
}
