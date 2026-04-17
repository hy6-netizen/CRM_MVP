# 보안 가이드

Hospital Ops Hub 는 **환자 개인정보와 의료 관련 기록**을 다룹니다.
한국의 **개인정보보호법(PIPA)** + **의료법** 준수가 기본이고,
일반 웹서비스보다 한 단계 더 엄격하게 운영해야 합니다.

이 문서는 MVP → 배포 단계로 갈 때 **반드시 지켜야 할 기준선**을 정리합니다.

---

## 0. 위협 모델 (뭐가 무섭나)

1. **환자 개인정보 유출** — 이름, 전화번호, 방문 이력, 증상 상담 내용.
   외부 유출 시 PIPA 제39조 손해배상 + 과징금, 의료법상 비밀누설죄(3년 이하 징역 또는 3천만원 이하 벌금).
2. **의료광고법 위반** — 자동 생성된 답글/메시지에 완치/최고 등 금지 표현이 실제 발송되는 경우.
3. **계정 탈취** — 약한 비밀번호/피싱으로 관리자 계정 탈취 → 전체 환자 데이터 유출.
4. **내부 직원 오남용** — staff 가 친인척 정보를 검색해 유출하는 케이스.
5. **백업/스크린샷** — 리뷰 캡처 이미지, CSV 임포트 파일이 로컬 폴더에 남아 백업 서비스로 새어나감.
6. **공급망/의존성** — npm 패키지 취약점, LLM provider 에 의료 데이터 전송.

---

## 1. 개인정보 최소 원칙 (Data Minimization)

### 1-1. 저장하지 않는 것을 선택
- **주민등록번호**: 절대 저장 안 함. 식별에 필요하면 진료기록 시스템(EMR) 에서만.
- **정확한 전화번호**: UI·DB 저장용과 알림톡 발송용을 분리.
  - UI/로그 표시: `010-****-5678` (이미 mockStore 에 마스킹 함수 있음)
  - 발송 대행사로 넘길 때만 잠깐 평문, 즉시 폐기.
- **주소**: 예약 시스템에서 필요 없음. 저장 안 함.
- **진단명/증상 상세**: Conversation/Message 에는 “증상상담 — 허리 디스크 관련” 정도만. 구체 진단은 EMR 참조.

### 1-2. 저장하는 것에는 **보호 수준 태깅**
```ts
// 예시: 필드별 보호 등급
type Sensitivity = "public" | "internal" | "pii" | "sensitive_pii" | "health";
// - patientName: pii
// - phoneMasked: internal  (마스킹된 버전은 내부 노출 허용)
// - phone (평문): sensitive_pii
// - 진단명/증상: health  → 접근 로그 필수
```

DB 레벨 컬럼 암호화가 필요한 필드:
- `PatientContact.phone` (평문이 필요한 경우)
- `Message.content` (민감 상담 내용이 들어감)
- `Review.content` (개인 정보 포함 가능)

Postgres 에서는 `pgcrypto` 의 `pgp_sym_encrypt` 사용 또는 애플리케이션 레이어에서 KMS(AWS KMS, GCP KMS) 로 암호화.

### 1-3. 로그에 PII 넣지 말 것
- `console.log(user)` 금지. 구조화 로거(pino, winston) 에서 **PII 필터** 설정.
- 에러 리포터(Sentry 등)에 request body 전송 시 전화번호/이름 자동 마스킹.

---

## 2. 인증 · 인가

### 2-1. 인증 (로그인)
- **NextAuth + OAuth (Google Workspace)** 권장. 병원 직원 Google 계정에 바인딩.
- 또는 이메일 + 비밀번호 사용 시:
  - 비밀번호 **bcrypt** (cost ≥ 12) 저장.
  - 비밀번호 최소 길이 12자 + 복잡도.
  - 로그인 실패 5회 → 15분 잠금.
- **관리자(admin) 계정은 2FA 필수**. TOTP (Google Authenticator) 또는 WebAuthn.
- 세션 쿠키: `HttpOnly`, `Secure`, `SameSite=Strict`, 만료 12시간 (병원 업무시간 고려).

### 2-2. 인가 (권한)
- RBAC: admin / manager / staff / reviewer. 이미 `packages/domain/src/types.ts` 에 정의됨.
- **매 API route 에서 role 체크**. middleware 에서 일괄 처리.
- 민감 엔드포인트(`/api/reviews/:id/approve`, `/api/templates`) 는 manager+ 만.
- **Row-level authorization**: staff 는 본인에게 배정된 건만 수정 가능. manager 는 전체.

### 2-3. 세션 관리
- 로그아웃 시 서버 세션 무효화 (DB 세션 또는 JWT revocation list).
- 비밀번호 변경 시 모든 기존 세션 무효화.

---

## 3. 네트워크 · 배포

### 3-1. HTTPS 강제
- 프로덕션은 **TLS 1.2+ 필수**. HTTP 요청은 301 리다이렉트.
- HSTS 헤더: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `next.config.mjs` 에 보안 헤더 블록 추가:
  ```js
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'" },
      ],
    }];
  }
  ```
- CSP 의 `'unsafe-inline'` 은 단기적으로만. 장기적으로 nonce 기반으로 전환.

### 3-2. IP 화이트리스트 / 지리적 제한
- 관리자 `/settings/*` 은 병원 IP 대역으로 제한하거나 VPN 경유.
- 한국 외 IP 에서 로그인 시도 → 경고 메일 + 2FA 재요구.

### 3-3. 환경변수 / 시크릿
- `.env` 는 절대 git 커밋 금지 (`.gitignore` 확인됨).
- 프로덕션 시크릿은 **Vercel/Fly/AWS Secrets Manager** 등 시크릿 매니저에서만.
- LLM API key, 알림톡 발송대행사 key, DB 비밀번호 → 별도 로테이션 주기 (분기별).

### 3-4. 데이터베이스 접근
- Postgres 는 **프라이빗 네트워크**에서만 접근 가능하게. public egress 차단.
- 백업 암호화 필수. 백업 보관 위치도 접근 제어.
- 읽기 전용 replica 를 분석/통계용으로 분리 (PII 접근 최소화).

---

## 4. 감사 · 접근 로그

### 4-1. 기록해야 할 이벤트
이미 `AuditLog` 에 기록되는 것:
- 리뷰 답글 승인/등록
- 예약 상태 변경
- 템플릿 수정
- 상담 분류/에스컬레이션
- 노쇼 자동 감지

**추가해야 할 것 (배포 단계에서)**:
- 로그인 성공/실패 (IP, user-agent 포함)
- 권한 실패 (403)
- CSV 임포트 (파일 해시, 행 수)
- 환자 정보 조회 횟수 (staff 가 하루에 몇 번 이름/전화 본 건지)
- 비밀번호 변경, 2FA 등록/해제
- 데이터 export (매니저가 통계 CSV 다운로드 등)

### 4-2. 로그 보존
- 민감 작업 감사 로그: **3년 이상 보관** (의료법 기준).
- 접근 로그는 개인정보보호법상 **6개월~1년** 권장.
- 로그 자체도 개인정보이므로 암호화된 버킷에 저장.

### 4-3. 이상 탐지
- 하루 10건 이상 환자 정보 조회 (staff) → 매니저에게 자동 알림.
- 영업시간 외 로그인 → 관리자에게 알림.
- 같은 계정이 서로 다른 지역/IP 에서 동시 로그인 → 세션 강제 종료.

---

## 5. LLM / 외부 API 에 데이터 보낼 때

### 5-1. 원칙
- LLM 은 **학습 데이터로 사용 안 되는 경로** 만 사용.
  - OpenAI: Enterprise/Organization API + opt-out (zero data retention).
  - Anthropic: `claude.ai` 가 아닌 API. workspace 설정에서 retention 0.
- LLM 에 보내는 payload 에 **환자 실명/전화번호 포함 금지**.
  - 예: 리뷰 답글 생성 시 reviewer 이름은 마스킹 버전만 전송.
- LLM 호출 자체를 **감사 로그**에 남김 (누가, 언제, 어떤 엔티티에 대해).

### 5-2. 이미지 OCR
- 네이버 리뷰 캡처 이미지에 작성자 실명/프로필 사진이 있을 수 있음.
- 업로드 전 **원본 로컬 저장 없이** multimodal API → JSON 추출 → 이미지 즉시 폐기 옵션.
- 저장해야 한다면 S3/R2 SSE-KMS + signed URL (짧은 만료) 로만 접근.

### 5-3. 발송 대행사
- 카카오 알림톡 대행사는 **발송 단계**에서만 전화번호 평문 접근 가능.
- 전송 후 우리 쪽 로그엔 `deliveryId` 만 남기고 전화번호는 다시 마스킹.

---

## 6. 코드/의존성 관리

### 6-1. 의존성 취약점
- `pnpm audit` 주 1회.
- Dependabot (GitHub) 또는 Renovate 활성화.
- 메이저 업그레이드는 별도 브랜치에서 테스트.

### 6-2. 시크릿 스캐닝
- git 훅(`husky` + `gitleaks`) 로 커밋 전 시크릿 검출.
- GitHub secret scanning 활성화 (이미 활성).

### 6-3. PR 리뷰
- 환자 데이터를 다루는 PR 은 **반드시 2명 이상 승인**.
- `.env.example` 에만 키 추가하고 실제 값은 PR 에 포함 금지.

---

## 7. 사건 대응 (Incident Response)

### 7-1. 준비
- 데이터 유출 시 연락 대상 목록 (원장, IT 담당, 법무, 개인정보보호책임자) 문서화.
- 핵심 키 로테이션 절차 문서화 (1시간 이내 교체 가능한 상태).

### 7-2. 72시간 룰
- PIPA 는 개인정보 유출 인지 후 **72시간 이내** 개인정보보호위원회 신고.
- 동시에 정보주체(환자) 에게 개별 통지.

### 7-3. 포스트모템
- 모든 보안 사건은 원인/대응/재발방지 문서화 후 `docs/incidents/` 보관.

---

## 8. MVP → 프로덕션 체크리스트

배포 전에 이 항목들을 **전부 ✅ 처리 후** 프로덕션 오픈.

### 인증/인가
- [ ] NextAuth 로그인 전체 라우트 보호 (`/api/health` 제외)
- [ ] admin/manager/staff/reviewer 권한이 서버 사이드에서 강제
- [ ] 관리자 계정 2FA 필수
- [ ] 세션 쿠키 HttpOnly+Secure+SameSite=Strict
- [ ] 로그인 실패 계정 잠금

### 데이터 보호
- [ ] 환자 이름/전화 DB 컬럼 암호화 (pgcrypto 또는 KMS)
- [ ] 전화번호는 저장 시점에 마스킹 버전과 평문을 분리
- [ ] 진료/증상 필드 접근 로그 기록
- [ ] 백업 암호화 + 접근 제어
- [ ] 로그에 PII 출력 안 됨 (필터 설정)

### 네트워크
- [ ] HTTPS only + HSTS
- [ ] CSP/X-Frame-Options 등 보안 헤더 전체 설정
- [ ] DB 퍼블릭 접근 차단
- [ ] 시크릿 매니저 사용 (.env 파일 아님)
- [ ] 관리자 페이지 IP 제한 또는 VPN

### LLM / 외부 연동
- [ ] LLM provider zero data retention 확인
- [ ] LLM payload 에 실명/전화 미포함
- [ ] 발송 대행사 DPA(Data Processing Agreement) 계약
- [ ] 네이버/카카오 공식 가이드라인 준수

### 감사/모니터링
- [ ] 로그인/권한실패/민감조회 감사 로그
- [ ] 이상 탐지 알림 (영업시간 외 로그인, 대량 조회)
- [ ] 3년+ 감사 로그 보관 정책 적용
- [ ] 보안 알림 채널(Slack/이메일) 설정

### 운영
- [ ] 의존성 자동 업데이트(Dependabot) 활성화
- [ ] PR 최소 2명 리뷰 정책
- [ ] `.gitignore` 에 `.env*` 포함 확인
- [ ] 사건 대응 문서 + 연락망 준비

### 규정
- [ ] 개인정보처리방침 페이지 작성
- [ ] 개인정보보호책임자 지정 (PIPA 제31조)
- [ ] 이용자(환자) 에게 수집 동의 절차 명시
- [ ] 의료광고법상 금지 표현 차단 (현재 complianceChecker 가 기본 처리, LLM 이중검사 추가 예정)

---

## 9. MVP 단계에서 이미 잘 되어 있는 것

- 🟢 UI/로그 전반에 마스킹된 전화번호(`010-****-1234`) 사용
- 🟢 모든 민감 작업에 감사 로그 자동 기록
- 🟢 의료광고법 금지 표현 키워드 검사 (22개 BLOCKED)
- 🟢 1~3점 리뷰 / 민감 상담 자동 사람 검토 강제
- 🟢 .env 는 .env.example 로만 커밋
- 🟢 자동 답글 등록 금지 (현재는 운영자 수동 등록만)

## 10. 우선 개선 순서

배포 전에 이 순서로 고치면 큰 리스크는 커버됩니다:

1. NextAuth + RBAC middleware (로그인 없이는 아무것도 못 함)
2. DB 컬럼 암호화 (최소 `phone`, `Message.content`)
3. 보안 헤더 + HSTS (`next.config.mjs`)
4. 감사 로그에 **로그인/접근** 이벤트 추가
5. LLM provider zero-retention 확인 + payload PII 마스킹
6. 시크릿 매니저 + `.env` 최종 점검
7. 관리자 2FA
8. DPA 계약 (알림톡 대행사, 클라우드)
9. 개인정보처리방침 페이지
10. 이상 탐지 알림

각 단계는 코드 변경량 크지 않으니 배포 전 2~3주 스프린트로 한 번에 처리 가능합니다.
