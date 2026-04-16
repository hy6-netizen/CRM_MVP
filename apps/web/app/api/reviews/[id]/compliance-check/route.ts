import { NextResponse } from "next/server";
import { runComplianceCheck } from "@hub/ai/src/complianceChecker";

export async function POST(request: Request) {
  const body = (await request.json()) as { draft?: string };
  if (!body.draft) {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }
  const result = runComplianceCheck(body.draft);
  return NextResponse.json(result);
}
