// Gmail 연결된 계정별로 네이버 예약 알림 메일을 증분 조회 → 이벤트 적용.
// 호출 경로: /api/cron/gmail-poll (외부 cron/launchd 에서 주기 실행)

import { prisma } from "./db";
import { fetchMessageRaw, getAuthedGmail, listNaverBookingMessageIds } from "./gmail";
import { parseNaverBookingEmail } from "./parsers/naverBookingEmail";
import { applyNaverBookingEvent } from "./naverBookingApply";

export interface PollResult {
  account: string;
  scanned: number;
  parsed: number;
  created: number;
  updated: number;
  canceled: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function pollAllGmailAccounts(): Promise<PollResult[]> {
  const accounts = await prisma.gmailAccount.findMany({ where: { enabled: true } });
  const results: PollResult[] = [];
  for (const acct of accounts) {
    results.push(await pollOne(acct.id));
  }
  return results;
}

export async function pollOne(accountId: string): Promise<PollResult> {
  const acct = await prisma.gmailAccount.findUnique({ where: { id: accountId } });
  if (!acct) throw new Error(`GmailAccount ${accountId} not found`);

  const result: PollResult = {
    account: acct.email,
    scanned: 0,
    parsed: 0,
    created: 0,
    updated: 0,
    canceled: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    const { gmail } = await getAuthedGmail(accountId);
    const since = acct.lastPolledAt
      ? Math.floor(acct.lastPolledAt.getTime() / 1000)
      : Math.floor((Date.now() - 7 * 86400_000) / 1000);

    const ids = await listNaverBookingMessageIds(gmail, since);
    result.scanned = ids.length;

    for (const id of ids) {
      try {
        const { subject, from, body } = await fetchMessageRaw(gmail, id);
        if (!body) continue;
        const parsed = parseNaverBookingEmail({ subject, from, body });
        if (!parsed) {
          result.failed++;
          continue;
        }
        result.parsed++;
        const applied = await applyNaverBookingEvent(parsed, { source: "gmail-poll", actorName: "gmail-poll" });
        result.created += applied.created;
        result.updated += applied.updated;
        result.canceled += applied.canceled;
        result.skipped += applied.skipped;
      } catch (e) {
        result.failed++;
        result.errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: { lastPolledAt: new Date() },
    });
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
}
