# Hospital Ops Hub (MVP)

한국 한방병원/병원 운영팀을 위한 예약·상담·리뷰 통합 운영 허브 MVP입니다.

## 빠른 시작
```bash
pnpm install
cp .env.example .env
pnpm dev
API
GET /api/health

GET /api/dashboard/summary

POST /api/reviews/:id/generate-draft

POST /api/reviews/:id/compliance-check
