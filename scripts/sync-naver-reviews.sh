#!/usr/bin/env bash
# 네이버 리뷰 수집 + CRM_MVP DB 반영 원샷 스크립트.
#
# 1) ai-system 의 review_crawler.py 로 리뷰 JSON 생성
# 2) CRM_MVP 의 import:naver-reviews 로 DB upsert
#
# 환경변수:
#   AI_SYSTEM_DIR    ai-system 리포 경로 (기본: /Users/minions/dev/ai-system)
#   NAVER_PLACE_ID   (기본: 579416346 — 의성한방병원)
#   REVIEW_COUNT     (기본: 30)

set -euo pipefail

AI_SYS="${AI_SYSTEM_DIR:-/Users/minions/dev/ai-system}"
PLACE_ID="${NAVER_PLACE_ID:-579416346}"
COUNT="${REVIEW_COUNT:-30}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[sync-naver] 1/2 크롤러 실행 (place_id=$PLACE_ID, count=$COUNT)"
if [ ! -d "$AI_SYS" ]; then
  echo "[sync-naver] ai-system 경로를 찾을 수 없습니다: $AI_SYS"
  echo "  AI_SYSTEM_DIR 환경변수로 경로 지정 가능"
  exit 1
fi

(
  cd "$AI_SYS"
  python3 src/domains/marketing/tools/review_crawler.py --place-id "$PLACE_ID" --count "$COUNT"
)

echo "[sync-naver] 2/2 CRM DB 로 import"
(
  cd "$REPO_ROOT"
  pnpm --filter @hub/db import:naver-reviews -- --dir "$AI_SYS/data/reviews"
)

echo "[sync-naver] 완료. /reviews 페이지에서 확인 가능"
