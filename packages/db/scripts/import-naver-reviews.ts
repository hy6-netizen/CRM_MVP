// ai-system 의 review_crawler.py 가 생성한 JSON 파일을 읽어 Prisma 에 upsert.
//
// 사용법:
//   pnpm --filter @hub/db import:naver-reviews
//   → AI_SYSTEM_DIR 환경변수 또는 /Users/minions/dev/ai-system 기본
//
//   pnpm --filter @hub/db import:naver-reviews -- --dir /custom/path
//   pnpm --filter @hub/db import:naver-reviews -- --file /path/to/single.json
//
// dedupe: externalReviewId = sha1(content + reviewerName).
// 이미 존재하면 skip (content 업데이트 X — 수동 편집 보존).

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

interface RawReview {
  text?: string;
  content?: string;
  rating?: number | null;
  date?: string;
  reviewer?: string;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out: { dir?: string; file?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) out.dir = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) out.file = argv[++i];
  }
  return out;
}

function externalIdFor(content: string, reviewer: string): string {
  const h = crypto.createHash("sha1").update(`${reviewer}::${content}`).digest("hex");
  return `naver_rv_${h.slice(0, 16)}`;
}

function parseDate(s: string | undefined): Date {
  if (!s) return new Date();
  // "2024.03.15" / "2일 전" / "어제" 등 다양
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const relM = s.match(/^(\d+)일 전/);
  if (relM) return new Date(Date.now() - Number(relM[1]) * 86400000);
  if (s.includes("어제")) return new Date(Date.now() - 86400000);
  if (s.includes("오늘")) return new Date();
  return new Date();
}

async function loadFiles(opts: { dir?: string; file?: string }): Promise<string[]> {
  if (opts.file) return [opts.file];
  const dir = opts.dir ?? process.env.AI_SYSTEM_DIR
    ? path.join(process.env.AI_SYSTEM_DIR ?? "", "data/reviews")
    : "/Users/minions/dev/ai-system/data/reviews";
  const entries = await fs.readdir(dir);
  return entries
    .filter((f) => f.startsWith("naver_place_") && f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

async function main() {
  const opts = parseArgs();
  const files = await loadFiles(opts);
  if (files.length === 0) {
    console.log("[import] 대상 JSON 파일 없음");
    return;
  }

  let created = 0;
  let skipped = 0;
  let invalid = 0;

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    let data: RawReview[];
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn(`[import] ${path.basename(file)}: JSON parse 실패 skip`);
      continue;
    }
    if (!Array.isArray(data)) {
      console.warn(`[import] ${path.basename(file)}: array 아님 skip`);
      continue;
    }

    console.log(`[import] ${path.basename(file)}: ${data.length}건`);
    for (const r of data) {
      const content = (r.content ?? r.text ?? "").trim();
      const reviewer = (r.reviewer ?? "anonymous").trim();
      if (!content) {
        invalid++;
        continue;
      }
      const externalReviewId = externalIdFor(content, reviewer);
      const existing = await prisma.review.findFirst({ where: { externalReviewId } });
      if (existing) {
        skipped++;
        continue;
      }

      const rating = typeof r.rating === "number" ? Math.max(1, Math.min(5, Math.round(r.rating))) : 5;
      const reviewerMasked = reviewer === "anonymous"
        ? "익명"
        : reviewer.length === 0
          ? "익명"
          : `${reviewer.slice(0, 1)}**`;

      await prisma.review.create({
        data: {
          sourceChannel: "naver_review",
          externalReviewId,
          reviewerNameMasked: reviewerMasked,
          rating,
          content,
          status: "new",
          riskLevel: rating <= 3 ? "high" : "low",
          createdAt: parseDate(r.date),
          rawPayloadJson: r as object,
        },
      });
      created++;
    }
  }

  console.log(`[import] 완료 — 생성 ${created}, 중복 스킵 ${skipped}, 비정상 ${invalid}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
