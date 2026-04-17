// Hospital Ops Hub seed
// 실 DB 연동 시 prisma seed 로 사용. mockStore 와 별개로 “실 DB 초기 데이터”용.
// MVP 에선 실행만 되도록 가벼운 noop + 안내 로그 + (선택) PrismaClient 생성 후 upsert.
//
// 실행: pnpm --filter @hub/db seed
//
// PrismaClient 가 아직 생성되지 않았다면 (npx prisma generate 미실행) 안내만 출력하고 종료.

async function main() {
  let PrismaClient: typeof import("@prisma/client")["PrismaClient"] | undefined;
  try {
    ({ PrismaClient } = await import("@prisma/client"));
  } catch {
    console.warn(
      "[seed] @prisma/client not generated yet. Run `pnpm --filter @hub/db prisma generate` first.",
    );
    return;
  }

  const prisma = new PrismaClient!();
  try {
    const admin = await prisma.user.upsert({
      where: { email: "admin@uskmh.kr" },
      update: { name: "원장", role: "admin" },
      create: { name: "원장", email: "admin@uskmh.kr", role: "admin" },
    });
    const reviewer = await prisma.user.upsert({
      where: { email: "rev@uskmh.kr" },
      update: { name: "최리뷰", role: "reviewer" },
      create: { name: "최리뷰", email: "rev@uskmh.kr", role: "reviewer" },
    });
    const staff = await prisma.user.upsert({
      where: { email: "staff1@uskmh.kr" },
      update: { name: "박상담", role: "staff" },
      create: { name: "박상담", email: "staff1@uskmh.kr", role: "staff" },
    });

    await prisma.template.upsert({
      where: { code: "TALK_HOURS" },
      update: {},
      create: {
        code: "TALK_HOURS",
        channel: "kakao_channel",
        intent: "진료시간",
        title: "진료시간 안내",
        body: "안녕하세요. 의성한방병원입니다.\n진료시간은 평일 09:00~18:00, 토요일 09:00~13:00입니다.",
        complianceLevel: "standard",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.template.upsert({
      where: { code: "REVIEW_NEGATIVE_FIRST_RESPONSE" },
      update: {},
      create: {
        code: "REVIEW_NEGATIVE_FIRST_RESPONSE",
        channel: "naver_review",
        intent: "부정-1차응대",
        title: "리뷰 답글(부정·1차)",
        body: "안녕하세요~ 의성한방병원입니다. 불편을 드린 점에 대해 죄송한 마음입니다. 남겨주신 말씀을 원내에서 신중히 확인하고, 별도 연락드리도록 하겠습니다. 감사합니다~^^",
        complianceLevel: "strict",
        requiresHumanReview: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    console.log("[seed] users:", { admin: admin.id, reviewer: reviewer.id, staff: staff.id });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
