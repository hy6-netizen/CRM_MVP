import { NextResponse } from "next/server";
import { parseNaverBookingEmail } from "../../../../src/lib/parsers/naverBookingEmail";
import { applyNaverBookingEvent } from "../../../../src/lib/naverBookingApply";

// 네이버 예약 알림 이메일을 받아 Reservation 을 upsert.
//
// 두 입력 방식 지원:
//   1) multipart: field "file" 로 .eml 파일 업로드 — headers + body 자동 파싱
//   2) JSON: { subject, from, body } — 파서에 바로 전달 (테스트/수동 forward 용)
//
// 재실행 안전: externalReservationId 로 upsert.
// 파싱 실패 시 200 에 error 상세 반환 (webhook 운영자가 재시도 판단).

export const runtime = "nodejs";

async function parseEml(rawBytes: Buffer): Promise<{ subject?: string; from?: string; body: string }> {
  // 단순 파서: Subject/From 헤더 + text/plain 또는 text/html 본문.
  const raw = rawBytes.toString("utf8");
  const headerEnd = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") : raw.indexOf("\n\n");
  // RFC 2822 folded headers: "\r\n " 또는 "\r\n\t" 는 연속된 헤더. 한 줄로 결합.
  const headerText = (headerEnd > 0 ? raw.slice(0, headerEnd) : raw).replace(/\r?\n[ \t]+/g, " ");
  const subject = /^Subject:\s*(.+?)$/im.exec(headerText)?.[1]?.trim();
  const from = /^From:\s*(.+?)$/im.exec(headerText)?.[1]?.trim();

  // RFC2047 인코딩 디코드 (간이): =?UTF-8?B?...?= 또는 =?UTF-8?Q?...?=
  function decodeHeader(s?: string): string | undefined {
    if (!s) return s;
    return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g, (_all, charset: string, enc: string, data: string) => {
      try {
        if (enc.toLowerCase() === "b") {
          return Buffer.from(data, "base64").toString(charset as BufferEncoding);
        }
        // Q-encoding: = 뒤 2hex + _ → space
        const q = data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
        return Buffer.from(q, "binary").toString(charset as BufferEncoding);
      } catch {
        return data;
      }
    });
  }

  const decodedSubject = decodeHeader(subject);
  const decodedFrom = decodeHeader(from);

  // body: multipart/alternative 의 text/plain 을 우선 추출.
  // 간이 구현: "text/plain" 블록 하나 집어서 Content-Transfer-Encoding 해석.
  const body = extractTextBody(raw);

  return { subject: decodedSubject, from: decodedFrom, body };
}

function extractTextBody(raw: string): string {
  // Content-Type: text/plain ... Content-Transfer-Encoding: base64|quoted-printable
  // 단일 또는 multipart 모두 처리.
  const boundaryMatch = /boundary="?([^"\r\n;]+)"?/i.exec(raw);
  const boundary = boundaryMatch?.[1];

  if (boundary) {
    const parts = raw.split(`--${boundary}`);
    // text/plain 우선
    for (const part of parts) {
      if (/content-type:\s*text\/plain/i.test(part)) {
        return decodePart(part);
      }
    }
    // fallback: text/html
    for (const part of parts) {
      if (/content-type:\s*text\/html/i.test(part)) {
        return decodePart(part);
      }
    }
  }
  // 비-multipart
  const headerEnd = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") + 2;
  return decodePart(raw.slice(headerEnd));
}

function decodePart(part: string): string {
  const sep = part.indexOf("\r\n\r\n") !== -1 ? part.indexOf("\r\n\r\n") + 4 : part.indexOf("\n\n") + 2;
  const headers = part.slice(0, sep);
  let body = part.slice(sep);
  const cte = /Content-Transfer-Encoding:\s*(\S+)/i.exec(headers)?.[1]?.toLowerCase();
  if (cte === "base64") {
    try {
      body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {}
  } else if (cte === "quoted-printable") {
    body = body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
    try {
      body = Buffer.from(body, "binary").toString("utf8");
    } catch {}
  }
  return body;
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let subject: string | undefined;
  let from: string | undefined;
  let body: string;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseEml(bytes);
    subject = parsed.subject;
    from = parsed.from;
    body = parsed.body;
  } else {
    const json = await req.json().catch(() => ({}));
    subject = typeof json.subject === "string" ? json.subject : undefined;
    from = typeof json.from === "string" ? json.from : undefined;
    body = typeof json.body === "string" ? json.body : "";
  }

  if (!body || body.length < 30) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  const parsed = parseNaverBookingEmail({ subject, from, body });
  if (!parsed) {
    return NextResponse.json({
      error: "parse_failed",
      detail: "이메일 제목/본문에서 이벤트 타입 또는 필수 필드 추출 실패",
      subjectDetected: subject,
      fromDetected: from,
      bodyExcerpt: body.slice(0, 400),
    }, { status: 422 });
  }

  const applied = await applyNaverBookingEvent(parsed, { source: "email" });

  return NextResponse.json({
    ok: true,
    eventType: parsed.eventType,
    parsed,
    applied,
  });
}
