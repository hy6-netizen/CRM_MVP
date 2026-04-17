import { NextResponse } from "next/server";
import { openNotifications, runNoShowSweep } from "../../../src/lib/noShowSweep";

export async function GET() {
  await runNoShowSweep();
  return NextResponse.json({ items: openNotifications() });
}
