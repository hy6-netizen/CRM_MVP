# 실 API 연동 로드맵

MVP 는 mock store + 결정형 엔진만으로 동작합니다.
여기서는 **로컬 개발 환경부터 단계별로 실 API 를 붙이는 순서**를 정리합니다.

각 단계는 **독립적**으로 추가 가능. 한 단계 하고 며칠 써보고 다음 단계로 가는 흐름을 권장합니다.

---

## 단계 표 (우선순위 순)

| # | 단계 | 필요 시간 | 필요 계정/키 | 로컬 테스트 가능? |
|---|---|---|---|---|
| 1 | Postgres + Prisma 붙이기 | 1~2시간 | Docker 또는 Postgres.app | ✅ |
| 2 | LLM 엔진 연결 (OpenAI/Anthropic) | 2~3시간 | OpenAI 또는 Anthropic API key | ✅ |
| 3 | NextAuth + 로그인 | 2~3시간 | (선택) Google OAuth | ✅ |
| 4 | 카카오 알림톡 발송 | 4~6시간 | 비즈메시지 발송대행사 계약 | ⚠️ sandbox |
| 5 | BullMQ worker (배치/리마인드) | 3~4시간 | Redis (Docker) | ✅ |
| 6 | 이미지 OCR (리뷰 캡처) | 3~4시간 | OpenAI Vision 또는 Google Vision | ✅ |
| 7 | 네이버 예약 CSV 임포트 | 2시간 | 네이버 스마트플레이스 export | ✅ |
| 8 | 카카오 채널 챗봇 웹훅 | 6~8시간 | 카카오 i 오픈빌더 | ⚠️ ngrok 필요 |
| 9 | 네이버 리뷰 자동 등록 | 확인 후 | 공식 API 확인 필요 | ❌ 공식 미확인 |

---

## 단계 1 · Postgres + Prisma

**목표:** mock store 대신 실제 DB 에서 데이터를 읽고 쓴다.

### 1-1. Postgres 로컬 띄우기
```bash
# 옵션 A: Docker
docker run -d --name hub-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hospital_ops_hub \
  postgres:16

# 옵션 B: Postgres.app (macOS 네이티브)
brew install --cask postgres-app
# 앱 실행 후 localhost:5432 로 자동 사용 가능
```

### 1-2. 환경변수
`.env` 를 `.env.example` 에서 복사 후 `DATABASE_URL` 확인:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospital_ops_hub
```

### 1-3. 마이그레이션 + seed
```bash
pnpm --filter @hub/db prisma generate   # @prisma/client 생성
pnpm --filter @hub/db migrate           # DB 스키마 생성
pnpm --filter @hub/db seed              # 초기 사용자/템플릿
```

### 1-4. mockStore → Prisma 교체
각 API route 에서 한 엔티티씩 단계적으로 교체. 예시:

**before (mockStore):**
```ts
// apps/web/app/api/reviews/route.ts
import { reviews } from "../../../src/lib/mockStore";
export async function GET() {
  return NextResponse.json({ items: reviews });
}
```

**after (Prisma):**
```ts
import { prisma } from "../../../src/lib/db";
export async function GET() {
  const items = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: { drafts: true },
  });
  return NextResponse.json({ items });
}
```

필요 파일: `apps/web/src/lib/db.ts`
```ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

**교체 순서 추천:** Template → Review → Conversation → Reservation → AuditLog → Dashboard summary.
한 엔티티씩 바꾸고 UI 가 멀쩡한지 확인하면서 진행.

---

## 단계 2 · LLM 엔진 연결 (OpenAI 또는 Anthropic)

**목표:** 지금의 결정형 engine 을 **진짜 LLM 호출**로 업그레이드.
기존 결정형 로직은 **fallback** 으로 남김.

### 2-1. SDK 설치
```bash
pnpm --filter @hub/ai add @anthropic-ai/sdk   # 또는 openai
```

### 2-2. provider abstraction 추가
`packages/ai/src/llm/types.ts`:
```ts
export interface LLMProvider {
  name: "openai" | "anthropic" | "mock";
  generateReviewReply(input: ReviewEngineInput): Promise<ReviewEngineOutput>;
  classifyConversation(text: string): Promise<ConversationClassification>;
}
```

`packages/ai/src/llm/anthropic.ts` — Claude 호출. 기존 `reviewReplyEngine.ts` 의 규칙(고정 인사/마무리/다짐 문구 11개)을 **system prompt** 로 넣고, 결과 JSON 을 받아서 파싱.

`packages/ai/src/llm/index.ts` — `AI_PROVIDER` env 에 따라 선택:
```ts
export function getLLM(): LLMProvider {
  if (process.env.AI_PROVIDER === "anthropic") return anthropicProvider;
  if (process.env.AI_PROVIDER === "openai") return openaiProvider;
  return mockProvider;   // 지금의 결정형 엔진
}
```

### 2-3. API route 수정
`app/api/reviews/[id]/generate-draft/route.ts`:
```ts
const llm = getLLM();
const engine = await llm.generateReviewReply({...});
const compliance = runComplianceCheck(engine.draft);  // 컴플라이언스는 항상 통과해야 함
```

**중요:** LLM 결과라도 **컴플라이언스 검사는 그대로 필수**. LLM 이 "완치" 같은 단어 내보낼 수 있으니까.

### 2-4. 환경변수
`.env`:
```
AI_PROVIDER=anthropic    # 또는 openai, mock
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 단계 3 · NextAuth + RBAC

**목표:** 로그인 필수. admin/manager/staff/reviewer 권한 분기.

### 3-1. 설치
```bash
pnpm --filter @hub/web add next-auth@beta
```

### 3-2. 간단 옵션: Email + Magic Link 또는 Credentials
개발 단계에선 Credentials provider + bcrypt 로 간단히. 운영 단계 전에 Google OAuth 로 교체 권장.

### 3-3. middleware 로 보호
`apps/web/middleware.ts`:
```ts
export { auth as middleware } from "./auth";
export const config = { matcher: ["/((?!api/health|login).*)"] };
```

### 3-4. 권한 헬퍼
```ts
export function requireRole(session, roles: Role[]) {
  if (!session?.user || !roles.includes(session.user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
}
```
각 API route 에 적용. 예: `/api/reviews/:id/approve` 는 `manager`, `reviewer`, `admin` 만.

---

## 단계 4 · 카카오 알림톡 발송 (예약 확정/리마인드)

**목표:** 예약 status=confirmed 로 바뀌면 자동으로 알림톡 발송.

### 4-1. 발송대행사 선택
공식 카카오 알림톡은 발송대행사를 통해서만 가능:
- **Aligo** (저렴, sandbox 있음)
- **Nurigo** (개발자 친화적)
- **Bizppurio** (엔터프라이즈)

계약 → 채널 승인 → 템플릿 심사 승인 후 발송 가능 (템플릿 심사 2~5일).

### 4-2. 템플릿 등록
`/templates` 의 `RESERVATION_CONFIRM` 본문을 대행사 콘솔에 등록 → 승인 대기.
**승인 받은 템플릿 문구와 시스템의 템플릿 본문이 100% 일치해야** 발송 가능.

### 4-3. provider 구현
`packages/providers/src/kakao/alimtalkProvider.ts`:
```ts
export class AligoAlimtalkProvider implements MessageProvider {
  channel = "kakao_biz";
  capability = { canSendBizMessage: true, ...base };
  async sendMessage(phone: string, templateCode: string, variables: Record<string,string>) {
    // Aligo API 호출
  }
}
```

### 4-4. 트리거
`/api/reservations/:id` PATCH 에서 status가 `confirmed` 로 바뀌면 Job 큐에 `reservation_reminder` 추가 (단계 5 와 결합).

---

## 단계 5 · BullMQ worker (배치 작업)

**목표:** 예약 리마인드, 미응답 상담 알림, 주기적 sync 같은 **시간 기반 작업**.

### 5-1. Redis 띄우기
```bash
docker run -d --name hub-redis -p 6379:6379 redis:7
```

### 5-2. worker 프로세스 분리
`apps/worker/` 새 앱 추가:
```
apps/worker/
  src/index.ts           # Worker + Queue 정의
  src/jobs/reservationReminder.ts
  src/jobs/notifyUnanswered.ts
  package.json
```

기존 `packages/queue/src/jobTypes.ts` 의 타입 + retry policy 그대로 사용.

### 5-3. 스케줄
```ts
// 매일 오전 9시: 내일 예약 리마인드 enqueue
queue.add("reservation_reminder", {}, { repeat: { cron: "0 9 * * *" } });
// 5분마다: 30분 이상 미응답 상담 체크
queue.add("notify_staff_unanswered", {}, { repeat: { every: 5 * 60_000 } });
```

### 5-4. 실행
```bash
pnpm --filter @hub/worker dev    # 별도 터미널
```

---

## 단계 6 · 이미지 OCR (리뷰 캡처 자동 추출)

**목표:** 운영자가 네이버 리뷰 캡처 이미지를 업로드하면 텍스트/별점/작성자를 자동 추출.

### 6-1. extractor 인터페이스
`packages/ai/src/extractor/types.ts`:
```ts
export interface ReviewExtractor {
  extract(image: Buffer | string): Promise<{
    content: string;
    rating?: number;
    reviewerNameMasked?: string;
    confidence: number;
    rawResponse: unknown;
  }>;
}
```

### 6-2. 구현: OpenAI Vision 또는 Anthropic Claude (multimodal)
system prompt: "한국 네이버 리뷰 캡처입니다. 별점, 작성자, 본문을 JSON 으로 추출하세요."

### 6-3. 업로드 UI
`/reviews` 상단에 "이미지로 리뷰 추가" 드롭존 추가.
- 업로드 → `/api/reviews/from-image` → extractor 호출 → confidence 낮으면 수동 확인 UI

### 6-4. 저장소
로컬 파일 (`STORAGE_DRIVER=local`) 또는 S3/R2. `.env` 의 STORAGE_* 변수 이미 준비됨.

---

## 단계 7 · 네이버 예약 CSV 임포트

**목표:** 네이버 스마트플레이스에서 주 1회 예약 목록 CSV export → 업로드 → 일괄 생성.

### 7-1. UI
`/reservations` 상단에 "CSV 임포트" 버튼 + file input.

### 7-2. 파서
네이버 CSV 컬럼 (변동 가능):
```
예약번호, 예약자명, 전화번호, 예약일시, 상태, 메모
```
→ `Reservation` 레코드로 매핑. 중복은 `externalReservationId` 로 upsert.

### 7-3. 주의
전화번호는 저장 시 **반드시 마스킹** (`010-1234-5678` → `010-****-5678`).

---

## 단계 8 · 카카오 채널 챗봇 웹훅

**목표:** 카카오 채널로 오는 메시지를 자동으로 `/conversations` 에 수신.

### 8-1. 카카오 i 오픈빌더 설정
- 채널 연결
- 시나리오: "default" → 웹훅 skill 호출
- 웹훅 URL: `https://your-domain/api/webhooks/kakao`

### 8-2. 로컬 개발
카카오는 HTTPS public URL 이 필요하므로:
```bash
ngrok http 3000    # → https://xxx.ngrok.io
```
웹훅 URL 에 ngrok 주소 등록.

### 8-3. route 구현
`apps/web/app/api/webhooks/kakao/route.ts`:
```ts
export async function POST(req: Request) {
  const body = await req.json();
  // body.userRequest.utterance = 사용자 메시지
  // 1) Conversation upsert
  // 2) Message insert
  // 3) classifyConversation 호출
  // 4) 정보형이면 템플릿 응답 반환, 아니면 "담당자가 확인 후 연락드립니다" 응답
  return NextResponse.json({ version: "2.0", template: { outputs: [...] } });
}
```

### 8-4. 자동응답 제한
- 민감 카테고리(증상/환불/분쟁)는 템플릿 자동응답 금지 → "담당자 확인 후 연락드립니다" 고정 문구.
- 운영자가 사후에 `/conversations` 에서 직접 응대.

---

## 단계 9 · 네이버 리뷰 자동 등록

**⚠️ 공식 API 존재 여부 불명확**. MVP 단계에선:
- 운영자가 직접 네이버 플레이스에서 답글 등록
- 등록 후 `/reviews` 에서 "등록 완료 처리" 버튼 클릭
- 이 버튼이 실제로 하는 일은 상태를 `posted` 로 바꾸는 것뿐

공식 Partner API 가 확인되면 `packages/providers/src/naver/reviewProvider.ts` 구현해서 교체.
그 전까진 **절대 비공식 크롤링/자동화 시도하지 않음** (MVP 원칙).

---

## 우리가 지금 당장 할 수 있는 것

**가장 빠르게 "AI 가 진짜로 답글 쓴다" 경험하고 싶으면** → 단계 2 먼저.
**데이터 재시작해도 유지되게 하고 싶으면** → 단계 1 먼저.
**실제 환자한테 알림톡 보내기 시작하고 싶으면** → 단계 4 (계약 시간이 드니 빨리 시작).

제가 추천하는 순서:
1. **단계 1 (Postgres + Prisma)** — 데이터 영구화 (1~2시간)
2. **단계 2 (LLM)** — 답글 품질이 체감됨 (2~3시간)
3. **단계 3 (NextAuth)** — 로그인 생기면 배포 준비 시작 가능
4. **단계 5 (BullMQ)** — 리마인더 자동화
5. 나머지는 운영하면서 필요한 순서대로

각 단계 시작할 때 이 문서의 해당 절 + 관련 코드 위치를 묶어서 작업 지시하면 됩니다.
