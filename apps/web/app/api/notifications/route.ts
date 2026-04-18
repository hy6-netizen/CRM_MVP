import { NextResponse } from "next/server";
import { openNotifications, runAllSweeps } from "../../../src/lib/noShowSweep";

export async function GET() {
  await runAllSweeps();
  const items = await openNotifications();
  return NextResponse.json({ items });
}
