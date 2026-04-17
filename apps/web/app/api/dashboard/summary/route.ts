import { NextResponse } from "next/server";
import { buildDashboardSummary } from "../../../../src/lib/mockStore";

export async function GET() {
  return NextResponse.json(buildDashboardSummary());
}
