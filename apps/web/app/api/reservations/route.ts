import { NextResponse } from "next/server";
import { reservations } from "../../../src/lib/mockStore";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let list = [...reservations];
  if (status) list = list.filter((r) => r.status === status);
  list.sort((a, b) => +new Date(a.reservationAt) - +new Date(b.reservationAt));
  return NextResponse.json({ items: list, count: list.length });
}
