# Hospital Ops Hub — 제품 & 운영 설계

가칭 “Hospital Ops Hub”는 한국 한방병원/병원의 **예약·상담·리뷰**를 한 화면에서 운영하는 보조 시스템입니다.
챗봇이 아니라, 운영자의 의사결정과 응대 품질을 보조하는 **운영 콘솔**입니다.

---

## 1. 풀려는 문제

- 네이버 예약 누락 / 확정 지연
- 네이버 톡톡 + 카카오 채널/비즈 메시지가 분산되어 응대 비효율
- 네이버 리뷰 답글을 캡처 → 프롬프트 → 복붙으로 작성하는 시간 손실
- 의료광고법 위반 표현(완치/100%/유일/후기 혜택 등)이 자동 답변에 섞일 위험
- 반복 문의(시간/위치/주차/비용 범위/준비물)는 템플릿화 가능
- 민감 문의(증상 악화/분쟁/환불/부작용)는 무조건 사람 검토로

---

## 2. 페르소나

| 역할 | 주요 행동 |
|---|---|
| 원장 (admin) | 권한·템플릿·컴플라이언스 정책 결정, 감사로그 열람 |
| 매니저 (manager) | 승인, 담당자 배정, 에스컬레이션 처리 |
| 데스크 직원 (staff) | 예약 확정, 상담 응대, 초안 작성 |
| 리뷰어 (reviewer) | 리뷰 답글 승인/수정/등록 처리 중심 |

---

## 3. 핵심 화면 & 흐름

1. **`/dashboard` 오늘 보드** — 8개 카드(오늘 예약/미확정/30분+/신규 상담/미응답/신규 리뷰/답글 대기/민감)
2. **`/reservations` 예약 보드** — 상태 칸반 + 인라인 변경
3. **`/conversations` 상담 인박스** — 채널 통합 + 자동 분류 + 에스컬레이션
4. **`/reviews` 리뷰 인박스** — 초안 생성 → 컴플라이언스 → 승인 → 등록 처리
5. **`/templates` 템플릿 관리**
6. **`/settings/compliance` / `/settings/integrations`**
7. **`/logs` 감사로그**

---

## 4. 데이터 모델 (요약)

`packages/db/prisma/schema.prisma` 가 단일 진실의 근원.
주요 엔티티: User, PatientContact, Conversation, Message, Reservation, Review, ReviewReplyDraft, Template, AuditLog, Job + 관련 Enum (Channel/ReservationStatus/ConversationStatus/ConversationCategory/ReviewStatus/RiskLevel/Sentiment/ReviewCategory/Role/MessageDirection/ComplianceStatus/JobStatus).

---

## 5. AI / 컴플라이언스 계층

| 모듈 | 역할 |
|---|---|
| `reviewReplyEngine` | 의성한방병원 톤 고정(인사/마무리), 다짐 문구 11개 결정형 선택, sentiment/category/risk 판정 |
| `complianceChecker` | BLOCKED 22개 / CAUTION 9개 검사, blocked 1건이면 reject, caution 만이면 자동 수정 제안 |
| `conversationClassifier` | 11 카테고리 + 정보형/사람검토형 라우팅, 민감 키워드 감지 시 high risk |

운영 원칙:

- 모든 답글은 출력 직전 컴플라이언스 통과 필수.
- 1~3점 리뷰, 민감 키워드 매칭 시 **needsHumanReview = true**.
- BLOCKED 거절 → 1회 재생성 후 사람 검토 (queue retry policy 와 동기화).

---

## 6. 채널 연동 전략

| 채널 | 전략 |
|---|---|
| 네이버 예약 | 공식 API 미확인 → manual / CSV / future adapter 교체 가능. 자동 확정은 capability flag 기반. |
| 네이버 톡톡 | 외부 채널 카드 + 분류/요약/템플릿 제안 중심. |
| 네이버 리뷰 | 텍스트 직접 입력 / 이미지 OCR / CSV 임포트 3-trio. 답글 자동 등록은 capability 확인 후. |
| 카카오 알림톡 | 정보성 메시지 (예약 확정/리마인드). |
| 카카오 친구톡/브랜드 | 채널 마케팅 - 후순위. |
| 카카오 채널 | 상담 유입 + 챗봇/웹훅 라우팅. |

`apps/web/app/settings/integrations/page.tsx` 의 capability 매트릭스가 사용자에게 노출됩니다.

---

## 7. Job & Retry

`packages/queue/src/jobTypes.ts` 에 10개 job + per-type retry policy 가 정의됨:

- 외부 연동 실패 → exponential backoff
- AI 생성 실패 → 최대 2회 (fixed)
- compliance rejected → 재생성 1회 → 사람 검토
- escalate_sensitive_case → 즉시 1회 (재시도 없음)

MVP 단계에선 BullMQ worker 자체는 미구현. type/policy 만 정의.

---

## 8. 권한 & 감사

- admin: 전체 설정/권한/템플릿/감사로그
- manager: 승인, 담당자 배정, 통계
- staff: 초안 생성, 상태 변경, 메모
- reviewer: 리뷰 답글 승인 중심

민감 작업은 `auditLogs` 에 before/after 와 함께 기록:

- 리뷰 답글 승인 / 등록 완료
- 예약 상태 강제 변경
- 템플릿 수정
- 자동 발송 rule 활성화 (TBD)

---

## 9. 절대 하지 않는 것

- 비공식 API 를 공식인 척 구현
- 크롤링/브라우저 자동화를 핵심 구조로 둠
- 의료광고법 위반 표현 자동 발송
- 리뷰 답글/상담을 사람 검토 없이 자동 발송
- “완치/100%/유일/국내 1위/후기 작성 시 혜택” 류 문구 생성
