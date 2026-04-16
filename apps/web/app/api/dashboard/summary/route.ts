import { NextResponse } from "next/server";
import { dashboardSummary } from "../../../../src/lib/mockStore";

export async function GET() {
  return NextResponse.json(dashboardSummary);
}
