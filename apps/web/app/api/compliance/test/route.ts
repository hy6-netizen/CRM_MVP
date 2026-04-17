import { NextResponse } from "next/server";
import { runComplianceCheck, COMPLIANCE_RULE_BOOK } from "@hub/ai/src/complianceChecker";

export async function GET() {
  return NextResponse.json(COMPLIANCE_RULE_BOOK);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const draft = typeof body.draft === "string" ? body.draft : "";
  if (!draft) return NextResponse.json({ error: "no_draft" }, { status: 400 });
  return NextResponse.json(runComplianceCheck(draft));
}
