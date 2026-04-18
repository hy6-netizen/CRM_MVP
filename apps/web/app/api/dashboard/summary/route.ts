import { NextResponse } from "next/server";
import { buildDashboardSummary } from "../../../../src/lib/dashboard";

export async function GET() {
  return NextResponse.json(await buildDashboardSummary());
}
