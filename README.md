# Hospital Ops Hub (MVP)

한국 한방병원/병원 운영팀을 위한 **예약·상담·리뷰 통합 운영 허브** MVP입니다.

## 이번 개선 사항
- Next.js 앱 실행 골격(`apps/web`) 추가
- 기본 API 엔드포인트 4개 구현
  - `GET /api/health`
  - `GET /api/dashboard/summary`
  - `POST /api/reviews/:id/generate-draft`
  - `POST /api/reviews/:id/compliance-check`
- 로컬 mock store 기반으로 대시보드/리뷰 파이프라인 테스트 가능
- Node 내장 테스트 러너 기반 smoke/AI 테스트 추가

## 빠른 시작
```bash
pnpm install
cp .env.example .env
pnpm dev
```

## 테스트
```bash
pnpm test
pnpm test:ai
```

## 주의
- 외부 연동은 공식 capability 확인 전 자동 발송/자동 등록을 활성화하지 않습니다.
- 네이버/카카오 미확정 API는 fake endpoint로 구현하지 않습니다.
