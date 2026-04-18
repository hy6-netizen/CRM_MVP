import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { recordAudit } from "../../../../src/lib/audit";

// 네이버 스마트플레이스 예약 CSV export 임포트.
//
// 네이버는 공식 예약 export CSV 컬럼을 공개하지 않고 계정/기간에 따라 조금씩
// 다릅니다. 따라서 아래의 유연한 컬럼 매핑 전략을 씁니다:
//   · patientName:   이름 | 고객명 | 예약자 | 예약자명 | 성명
//   · phone:         연락처 | 전화 | 전화번호 | 휴대폰 | 휴대전화
//   · reservationAt: 예약일시 | 방문일시 | 일시 | 예약시간 | 예약날짜 (+ 예약시각 결합)
//   · status:        상태 | 예약상태 | 진행상태
//   · notes:         메모 | 요청사항 | 비고
//   · externalId:    예약번호 | 주문번호 | 접수번호
//
// 행별 에러는 수집해서 응답 — 일부 성공도 허용.
// dedupe: externalReservationId (있으면) 로 upsert, 없으면 sha1(name+phone+at) 로 생성.

import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

type Row = Record<string, string>;

const NAME_KEYS = ["이름", "고객명", "예약자", "예약자명", "성명"];
const PHONE_KEYS = ["연락처", "전화", "전화번호", "휴대폰", "휴대전화"];
const AT_KEYS = ["예약일시", "방문일시", "일시", "예약시간"];
const DATE_KEYS = ["예약날짜", "날짜"];
const TIME_KEYS = ["예약시각", "시각", "시간"];
const STATUS_KEYS = ["상태", "예약상태", "진행상태"];
const NOTES_KEYS = ["메모", "요청사항", "비고", "특이사항"];
const EXT_ID_KEYS = ["예약번호", "주문번호", "접수번호"];

const STATUS_MAP: Record<string, string> = {
  "확정 대기": "pending_confirmation",
  "확정대기": "pending_confirmation",
  "확정완료": "confirmed",
  "확정 완료": "confirmed",
  확정: "confirmed",
  "변경요청": "change_requested",
  "변경 요청": "change_requested",
  취소: "canceled",
  완료: "completed",
  노쇼: "no_show_risk",
};

function pick(row: Row, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k] ?? row[k.trim()];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
  return raw;
}

function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  // BOM 제거
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuote = false;
        } else {
          cur += c;
        }
      } else {
        if (c === ",") {
          out.push(cur);
          cur = "";
        } else if (c === '"') {
          inQuote = true;
        } else {
          cur += c;
        }
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  const headers = splitLine(lines[0]!);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]!);
    const row: Row = {};
    headers.forEach((h, idx) => (row[h] = cols[idx] ?? ""));
    rows.push(row);
  }
  return { headers, rows };
}

function parseReservationAt(row: Row): Date | null {
  // 1) 통합 컬럼 ("2025-06-14 14:30")
  const at = pick(row, AT_KEYS);
  if (at) {
    const d = new Date(at.replace(/\./g, "-"));
    if (!isNaN(d.getTime())) return d;
  }
  // 2) 날짜 + 시각 분리 컬럼
  const date = pick(row, DATE_KEYS);
  const time = pick(row, TIME_KEYS);
  if (date) {
    const iso = `${date.replace(/\./g, "-").trim()}${time ? " " + time.trim() : " 09:00"}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function externalIdFor(name: string, phone: string, atIso: string): string {
  return "naver_rsv_" + crypto.createHash("sha1").update(`${name}|${phone}|${atIso}`).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let text: string;
  try {
    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
      text = await file.text();
    } else {
      const body = await req.json();
      text = typeof body.csv === "string" ? body.csv : "";
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!text || text.length < 10) return NextResponse.json({ error: "empty_csv" }, { status: 400 });

  const { headers, rows } = parseCSV(text);
  if (rows.length === 0) return NextResponse.json({ error: "no_rows", headers }, { status: 400 });

  let created = 0;
  let updated = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = pick(row, NAME_KEYS);
    const phoneRaw = pick(row, PHONE_KEYS);
    const at = parseReservationAt(row);
    if (!name) {
      errors.push({ row: i + 2, reason: "이름 컬럼 미식별" });
      continue;
    }
    if (!at) {
      errors.push({ row: i + 2, reason: "예약일시 파싱 실패" });
      continue;
    }
    const phoneMasked = phoneRaw ? maskPhone(phoneRaw) : "-";
    const statusRaw = pick(row, STATUS_KEYS);
    const status = statusRaw ? STATUS_MAP[statusRaw] ?? "pending_confirmation" : "pending_confirmation";
    const notes = pick(row, NOTES_KEYS);
    const extId = pick(row, EXT_ID_KEYS) || externalIdFor(name, phoneMasked, at.toISOString());

    const existing = await prisma.reservation.findFirst({ where: { externalReservationId: extId } });
    if (existing) {
      await prisma.reservation.update({
        where: { id: existing.id },
        data: {
          status: status as never,
          reservationAt: at,
          notes: notes ?? existing.notes,
        },
      });
      updated++;
    } else {
      await prisma.reservation.create({
        data: {
          sourceChannel: "naver_reservation",
          externalReservationId: extId,
          patientName: name,
          phoneMasked,
          reservationAt: at,
          status: status as never,
          notes,
        },
      });
      created++;
    }
  }

  await recordAudit({
    actorName: "operator",
    entityType: "ReservationImport",
    entityId: new Date().toISOString().slice(0, 10),
    action: "reservation.csv_imported",
    after: { created, updated, errors: errors.length, total: rows.length },
  });

  return NextResponse.json({
    ok: true,
    headers,
    total: rows.length,
    created,
    updated,
    errors,
  });
}
