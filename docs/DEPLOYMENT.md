# Mac Mini 배포 가이드

"앱은 내 Mac Mini 에 돌리고, 외부에서 접속하게 하자" 가 목표일 때의 구체 절차.
병원 데이터 서버가 **원내에** 있다는 점 자체가 PIPA/의료법 대응에 큰 장점입니다.

---

## 아키텍처 요약

```
  인터넷                 Cloudflare Tunnel (또는 Tailscale)
     │                   ↑ HTTPS (무료, 공인 IP 불필요)
     │
     ▼                                        ┌──────────────────┐
[ 외부 직원/원장 ]  ───────────────────────▶ │  Mac Mini (원내)  │
                                             │                   │
                                             │  - Next.js (3000) │
                                             │  - Postgres       │
                                             │  - Redis          │
                                             │  - (선택) Ollama  │
                                             │  - (선택) Worker  │
                                             └──────────────────┘
```

- 공인 IP / 포트 포워딩 **불필요** (Cloudflare Tunnel 이 아웃바운드 터널 사용)
- HTTPS 자동 (Let's Encrypt 개념, Cloudflare 가 처리)
- 접근 제어: Cloudflare Access (무료 50인까지) 로 Google OAuth / Email OTP 추가
- 원내 네트워크 끊겨도 인터넷만 되면 동작

---

## 1. Mac Mini 기본 세팅

### 1-1. 전원 & 절전 설정
```bash
# 자동 꺼짐 방지 (서버 용도)
sudo pmset -a sleep 0
sudo pmset -a disksleep 0
sudo pmset -a powernap 0
# 정전 후 자동 재부팅
sudo pmset -a autorestart 1
```

시스템 설정 > 로그인 옵션 > **자동 로그인 활성화** (재부팅 후 서비스 자동 실행용).

### 1-2. 툴 설치
```bash
# Homebrew (이미 있으면 skip)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js (LTS) + pnpm
brew install node pnpm

# Postgres 16
brew install postgresql@16
brew services start postgresql@16

# Redis (알림톡/워커 용, 후순위)
brew install redis
brew services start redis

# (선택) Ollama — 로컬 LLM 실험용
brew install ollama
brew services start ollama
```

### 1-3. DB 준비
```bash
createdb hospital_ops_hub
psql hospital_ops_hub -c "CREATE USER hub WITH PASSWORD '강력한비밀번호';"
psql hospital_ops_hub -c "GRANT ALL PRIVILEGES ON DATABASE hospital_ops_hub TO hub;"
```

`.env`:
```
DATABASE_URL=postgresql://hub:강력한비밀번호@localhost:5432/hospital_ops_hub
```

---

## 2. 앱 배포

### 2-1. 코드 배치
```bash
cd ~/Sites   # 또는 원하는 폴더
git clone https://github.com/hy6-netizen/CRM_MVP.git hospital-ops-hub
cd hospital-ops-hub
pnpm install
cp .env.example .env
# .env 편집 (DATABASE_URL, OPENAI_API_KEY, NEXTAUTH_SECRET 등)
```

### 2-2. 프로덕션 빌드 + 실행
```bash
pnpm --filter @hub/db prisma generate
pnpm --filter @hub/db migrate
pnpm --filter @hub/db seed

pnpm build
pnpm start   # 포트 3000
```

### 2-3. launchd 로 자동 기동 (macOS 표준)
`~/Library/LaunchAgents/com.uskmh.hospital-ops-hub.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.uskmh.hospital-ops-hub</string>
    <key>WorkingDirectory</key>
    <string>/Users/USERNAME/Sites/hospital-ops-hub</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/pnpm</string>
        <string>start</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/Library/Logs/hospital-ops-hub.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/Library/Logs/hospital-ops-hub.err.log</string>
</dict>
</plist>
```

등록:
```bash
launchctl load ~/Library/LaunchAgents/com.uskmh.hospital-ops-hub.plist
```

로그:
```bash
tail -f ~/Library/Logs/hospital-ops-hub.log
```

---

## 3. 외부 접근 — Cloudflare Tunnel (추천)

**무료**, 공인 IP 불필요, HTTPS 자동, Cloudflare Access 로 인증 추가 가능.

### 3-1. 계정 + 도메인
- Cloudflare 무료 플랜 가입
- 도메인 하나 Cloudflare DNS 로 이전 (또는 새로 구입). 예: `hospital-ops.example.com`

### 3-2. cloudflared 설치
```bash
brew install cloudflared
cloudflared tunnel login   # 브라우저 열려서 Cloudflare 로그인
```

### 3-3. 터널 생성 + 라우팅
```bash
cloudflared tunnel create hospital-ops-hub
# 생성된 ID 를 출력: e.g. 1234abcd-...

# DNS 연결
cloudflared tunnel route dns hospital-ops-hub hospital-ops.example.com
```

`~/.cloudflared/config.yml`:
```yaml
tunnel: 1234abcd-...    # 위 create 결과 ID
credentials-file: /Users/USERNAME/.cloudflared/1234abcd-....json
ingress:
  - hostname: hospital-ops.example.com
    service: http://localhost:3000
  - service: http_status:404
```

실행:
```bash
cloudflared tunnel run hospital-ops-hub
# 정상 동작 확인 후 service 로 등록:
sudo cloudflared service install
```

이제 `https://hospital-ops.example.com` 이 공개됩니다.

### 3-4. Cloudflare Access 로 접근 제한
**중요**. 그냥 열어두면 누구나 접속 가능 — 로그인 없이 URL 만 알면 환자 데이터 노출.

Cloudflare Zero Trust 대시보드:
1. Applications → Add application → Self-hosted
2. Application domain: `hospital-ops.example.com`
3. Policy 추가:
   - Action: Allow
   - Include: Emails ending in `@uskmh.kr` (또는 특정 이메일 목록)
   - (선택) Require: Country is `South Korea`
4. 저장

첫 접속 시 Cloudflare 가 Google OAuth / 이메일 OTP 로 인증 요구. 통과해야만 앱에 도달.
→ 앱 자체 NextAuth 미구현 단계에서도 **외부 노출 보안 확보**.

---

## 4. 외부 접근 — Tailscale (대안)

Cloudflare Tunnel 보다 간단하지만 **Tailscale 클라이언트 설치한 기기만 접근** 가능. 직원 수 적고 모두 업무용 기기가 있으면 이 방식이 더 간단.

### 4-1. 설치
```bash
brew install --cask tailscale
# Tailscale 앱 실행 → 로그인 (Google/Microsoft/GitHub)
```

Mac Mini + 각 직원 기기 모두 같은 Tailnet 에 연결.

### 4-2. Mac Mini IP 확인
```bash
tailscale ip -4   # e.g. 100.x.y.z
```

직원 기기에서 `http://100.x.y.z:3000` 으로 접속. 또는 MagicDNS 활성화해서 `http://hub:3000`.

### 4-3. HTTPS 가 필요하면 Tailscale Serve
```bash
tailscale serve --bg --https=443 localhost:3000
# → https://hub.your-tailnet.ts.net 로 제공
```

---

## 5. LLM: Claude / GPT API vs 로컬 Ollama

현재 프로젝트는 **OpenAI GPT** (env 로 mock/openai 스위치). Mac Mini 에 올려두면 Ollama 추가도 쉬움.

### Ollama 추가 (선택, 실험용)
```bash
# 모델 받기 (16GB RAM Mac Mini 기준)
ollama pull llama3.1:8b            # 8B, 약 5GB
ollama pull qwen2.5:14b            # 14B, 약 9GB — 한국어 조금 더 나음

# 48GB+ RAM 이면
ollama pull qwen2.5:72b            # 48GB, 한국어 최상급 로컬 모델
```

**주의: 현재 코드베이스에 Ollama provider 는 미구현**. 필요하면
`packages/ai/src/llm/ollama.ts` 만들어 `LLMProvider` 인터페이스 구현 후 dispatcher 에 분기 추가 (로드맵 단계 2-5 참고).

**권장 순서**:
1. **GPT API 먼저** (품질 베이스라인 확립)
2. 같은 리뷰에 Ollama 모델로 돌려서 품질 비교
3. 수용 가능하면 AI_PROVIDER=ollama 로 전환 (개인정보 외부 유출 제로)

---

## 6. Gmail 자동 폴링 (네이버 예약 이메일 수신)

네이버 예약 알림 이메일을 받는 Gmail 연결 후, 주기적으로 폴링해서 예약을 자동 수집.

### 6-1. Google Cloud 세팅 (최초 1회)
1. https://console.cloud.google.com → 프로젝트 생성
2. "API 및 서비스" → 라이브러리 → **Gmail API 사용 설정**
3. "OAuth 동의 화면" → 외부 → 앱 이름/지원 이메일 입력 → 테스트 사용자에 본인 Gmail 추가
4. "사용자 인증 정보" → "OAuth 클라이언트 ID" → **웹 애플리케이션**
   - 승인된 리디렉션 URI: `http://localhost:3001/api/integrations/gmail/callback`
     (프로덕션 배포 시 도메인으로 변경: `https://hospital-ops.example.com/...`)
5. `.env` 에 Client ID / Secret 입력

### 6-2. 앱에서 연결
1. `/settings/integrations/gmail` 접속 (admin 권한)
2. "Gmail 연결" → Google 로그인 → 읽기 권한 동의
3. 연결 완료 후 "지금 폴링" 버튼으로 수동 테스트

### 6-3. 자동 주기 폴링 (launchd)
5분마다 폴링 엔드포인트 호출:

```bash
# CRON_SECRET 을 .env 에 설정 + 서버 재시작
echo "CRON_SECRET=$(openssl rand -hex 24)" >> /Users/minions/CRM_MVP_repo/.env

# 템플릿을 복사해서 USERNAME / APP_URL / CRON_SECRET 치환
cp scripts/launchd/com.uskmh.gmail-poll.plist.template \
   ~/Library/LaunchAgents/com.uskmh.gmail-poll.plist

# vim / nano 로 편집:
#   USERNAME → minions
#   APP_URL  → http://localhost:3001 (또는 Cloudflare Tunnel URL)
#   REPLACE_WITH_CRON_SECRET → .env 의 CRON_SECRET 값

# 로드
launchctl load ~/Library/LaunchAgents/com.uskmh.gmail-poll.plist
launchctl list | grep com.uskmh.gmail-poll

# 로그
tail -f ~/Library/Logs/hub-gmail-poll.log
```

### 6-4. Gmail API 비용
- Gmail API 는 **무료** (하루 10억 unit 한도)
- 1분 폴링 시 하루 ~10,000 unit 사용 (한도의 0.001%)
- 실 환자 예약 100건/일 기준으로도 한도 여유 많음

---

## 7. 백업

Postgres 일일 백업 (`launchd` + cron 비슷):
`~/bin/hub-backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M)
pg_dump hospital_ops_hub | gzip > ~/backups/hub-$DATE.sql.gz
# 30일 이상된 백업 삭제
find ~/backups -name "hub-*.sql.gz" -mtime +30 -delete
```

실행 권한 + crontab (또는 launchd):
```bash
chmod +x ~/bin/hub-backup.sh
mkdir -p ~/backups
crontab -e
# 매일 새벽 3시:
# 0 3 * * * /Users/USERNAME/bin/hub-backup.sh
```

**중요: 백업 자체도 개인정보**. 별도 디스크 암호화 (`FileVault` 활성화) 필수.
가능하면 별도 외장 디스크 또는 암호화된 S3/R2 버킷에 복제.

---

## 7. 모니터링 (간단 버전)

### Uptime 체크
Cloudflare 무료 플랜에 **Health Check** 있음. 또는 UptimeRobot 무료 플랜:
- `https://hospital-ops.example.com/api/health` 5분마다 체크
- 실패 시 이메일/Slack 알림

### 로그 열람
```bash
# Next.js 실행 로그
tail -f ~/Library/Logs/hospital-ops-hub.log

# Postgres 로그
tail -f /opt/homebrew/var/log/postgresql@16.log
```

---

## 8. 프로덕션 체크리스트

`docs/SECURITY.md` 의 전체 체크리스트 참고. Mac Mini 셋업 특화 항목:

- [ ] **FileVault 활성화** (디스크 전체 암호화) — macOS 기본 옵션
- [ ] **Mac 로그인 비밀번호** 강력히 + 자동 잠금 짧게 (5분)
- [ ] **Postgres 비밀번호** 강력 + `postgresql.conf` `listen_addresses = 'localhost'` 확인 (외부 노출 금지)
- [ ] **Redis** `bind 127.0.0.1` 확인
- [ ] **Cloudflare Access** 정책 활성 — 로그인 없이 접근 불가
- [ ] `.env` 파일 권한 `chmod 600 .env`
- [ ] `~/.cloudflared/` 크레덴셜도 `chmod 600`
- [ ] `pnpm audit` 주 1회 실행
- [ ] 백업 + **백업 복구 테스트** 한 번 해보기 (진짜로 복구되는지)
- [ ] 시스템 업데이트 (macOS, Node, pnpm, Postgres) 분기별
- [ ] Mac Mini 전원선 UPS 연결 권장 (정전 시 DB 손상 방지)

---

## 9. 배포 다이어그램 정리

```
직원 브라우저
    │  https://hospital-ops.example.com
    ▼
Cloudflare (CDN + Access 로그인 검증)
    │
    ▼  아웃바운드 터널 (공인 IP 불필요)
Mac Mini (원내)
    ├─ cloudflared (tunnel)
    ├─ Next.js :3000 (pnpm start, launchd 관리)
    ├─ Postgres :5432 (localhost only)
    ├─ Redis :6379 (localhost only, 후순위)
    └─ (선택) Ollama :11434 (localhost only)
           ↑ env 에 AI_PROVIDER=ollama 로 전환 시 사용
```

이 구조면 **공인 IP 없이, 포트 개방 없이** Mac Mini 한 대가 병원 운영 허브 전체를 담당할 수 있습니다.
