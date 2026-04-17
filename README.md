# Hospital Ops Hub (MVP)

한국 한방병원/병원 운영팀을 위한 **예약 · 상담 · 리뷰 통합 운영 허브** MVP.
한 화면에서 네이버 예약/리뷰/톡톡 + 카카오 채널/비즈 메시지를 운영 보조하고,
반복 문의는 템플릿으로 자동화, 민감/위험 상담은 사람 검토로 라우팅합니다.

> - **사용 매뉴얼**: [`docs/USER_MANUAL.md`](./docs/USER_MANUAL.md)
> - **실 API 연동 로드맵**: [`docs/INTEGRATION_ROADMAP.md`](./docs/INTEGRATION_ROADMAP.md)
> - **Mac Mini 배포 가이드**: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
> - **보안 가이드 (배포 전 필독)**: [`docs/SECURITY.md`](./docs/SECURITY.md)
> - **제품/운영 설계**: [`docs_PRODUCT_AND_OPERATIONS.md`](./docs_PRODUCT_AND_OPERATIONS.md)

---

## 빠른 시작

```bash
pnpm install
cp .env.example .env

# (선택) Postgres + Prisma client 사용 시
pnpm --filter @hub/db prisma generate
pnpm --filter @hub/db migrate     # DB 마이그레이션
pnpm --filter @hub/db seed        # 초기 사용자/템플릿

pnpm dev                          # http://localhost:3000
pnpm test                         # node:test 기반 smoke + AI 엔진 테스트
```

> **DB 없이도 동작합니다.** UI 와 모든 API 는 `apps/web/src/lib/mockStore.ts` 의
> in-memory 데이터를 사용하므로 `pnpm install && pnpm dev` 만으로 데모가 켜집니다.
> Postgres 는 실 운영 단계에서 mockStore → Prisma client 로 교체할 때 필요합니다.

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| Monorepo | pnpm workspace |
| Web | Next.js 15 (App Router) + React 19 + Tailwind CSS |
| Validation | Zod |
| DB (production) | PostgreSQL + Prisma |
| Queue (production) | Redis + BullMQ (스키마/타입만 정의, worker 미구현) |
| AI | provider abstraction + 결정형 베이스라인 (LLM 미사용 동작) |
| Tests | node:test |

---

## 주요 화면

| 경로 | 내용 |
|---|---|
| `/dashboard` | 8 개 핵심 카드 (오늘 예약/미확정/30분+/신규 상담/미응답/신규 리뷰/답글대기/민감) + 긴급 리뷰·대기 예약·신규 상담 패널 |
| `/reservations` | 상태별 칸반 보드 + 인라인 status 변경 |
| `/conversations` | 상담 통합 인박스 + 자동 분류 + 에스컬레이션 |
| `/reviews` | 리뷰 인박스 + **초안 생성 → 컴플라이언스 → 승인 → 등록 완료** 흐름 |
| `/templates` | 템플릿 CRUD + 컴플라이언스 등급(strict/standard) |
| `/settings/compliance` | BLOCKED/CAUTION 규칙 + 자동 수정 매핑 + 즉시 검사 도구 |
| `/settings/integrations` | 채널별 capability 매트릭스 (네이버 예약/톡톡/리뷰 / 카카오 채널/비즈) |
| `/logs` | 감사 로그 (승인/상태변경/템플릿수정/에스컬레이션) |

---

## 주요 API

```
GET  /api/health
GET  /api/dashboard/summary

GET  /api/reviews?status=&minRating=
POST /api/reviews                              # 리뷰 수집
GET  /api/reviews/:id
PATCH /api/reviews/:id
POST /api/reviews/:id/generate-draft           # 결정형 초안 생성 + 컴플 검사
POST /api/reviews/:id/compliance-check         # 임의 draft 검사
POST /api/reviews/:id/approve                  # 승인 (BLOCKED 시 422)
POST /api/reviews/:id/post                     # 등록 완료 처리

GET  /api/conversations?status=&channel=
GET  /api/conversations/:id
PATCH /api/conversations/:id
POST /api/conversations/:id/classify           # 11 카테고리 자동 분류

GET  /api/reservations?status=
PATCH /api/reservations/:id

GET  /api/templates
POST /api/templates
PATCH /api/templates/:id
DELETE /api/templates/:id

GET  /api/audit-logs?entityType=

GET  /api/compliance/test                      # 규칙 북 조회
POST /api/compliance/test                      # 임의 draft 검사
```

---

## AI · 컴플라이언스 엔진

- **`packages/ai/src/reviewReplyEngine.ts`** — 의성한방병원 운영 규칙 적용
  - 고정 인사 `안녕하세요~ 의성한방병원입니다.` / 고정 마무리 `감사합니다~^^`
  - 다짐 문구 11개 중 콘텐츠 해시 기반 결정형 선택 (반복 회피)
  - sentiment / category / riskLevel / needsHumanReview 자동 판정
  - 1~3점, 부작용/환불/분쟁/악화 키워드 → high risk + 사람 검토 강제
- **`packages/ai/src/complianceChecker.ts`** — 의료광고법 위반 표현 검사
  - BLOCKED 22개 / CAUTION 9개 / 자동 수정 매핑 8개
  - blocked 1건이라도 있으면 `rejected`, caution 만 있으면 `revision_required`
- **`packages/ai/src/conversationClassifier.ts`** — 11개 상담 카테고리 + 라우팅 규칙
  - 정보형(진료시간/위치/주차/비용/준비물/서류) → 자동응답 후보
  - 증상/불만/환불/분쟁 → 사람 검토 강제

LLM provider 가 붙으면 위 함수의 출력 자리에 wrapping 하면 됩니다 (인터페이스 동일).

---

## 폴더 구조

```
apps/
  web/                       Next.js App Router
    app/                       페이지 + API routes
    src/components/            UI 컴포넌트
    src/lib/                   mockStore, format helper
packages/
  ai/                        review reply engine, compliance checker, conversation classifier
  db/                        Prisma schema + seed
  domain/                    공통 타입
  providers/                 채널 어댑터 인터페이스 + mock provider
  queue/                     job type + retry policy 정의
tests/                       node:test 기반 smoke / AI 엔진 검증
```

---

## 운영 원칙 (요약)

1. **공식 연동이 명확한 채널은 공식 방식 우선**
2. 불명확한 영역은 **adapter interface + 수동 승인** 흐름
3. AI 는 **분류 / 요약 / 초안** 생성 우선, **자동 발송은 보수적**
4. 의료광고법 위반 가능 표현은 출력 직전 **반드시 검수**
5. 모든 민감 작업은 **감사 로그** 기록
6. “오늘 처리해야 할 일”이 첫 화면

자세한 운영/금지 사항은 `compliance_rules.md`, `review-reply-agent.md` 참조.

---

## 다음 단계 (MVP 이후)

- NextAuth + RBAC (admin/manager/staff/reviewer 권한 분기)
- BullMQ worker 프로세스 (현재는 type/policy 만)
- 이미지 OCR / 멀티모달 추출 (extractor interface 추가 필요)
- 실 LLM provider wiring (OpenAI/Anthropic abstraction)
- 채널별 실제 어댑터 구현 (Naver/Kakao 정식 SDK 확보 후)
