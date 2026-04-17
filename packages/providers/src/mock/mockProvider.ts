// 기본 mock provider — 개발/데모용.
// 실 연동이 생기면 같은 인터페이스로 교체.

import {
  BizMessageProvider,
  ChatbotProvider,
  ConsultProvider,
  ReservationProvider,
  ReviewProvider,
  SyncProviderResult,
  cap,
  defaultCapability,
} from "../types";

export const unsupportedPost: SyncProviderResult = {
  success: false,
  message: "자동 등록 미지원. 운영자 수동 등록 + 등록 완료 처리를 사용하세요.",
};

// ─────────────────────────────────────────────
// Naver: 예약 / 리뷰 / 톡톡
// ─────────────────────────────────────────────

export const naverReservationProvider: ReservationProvider = {
  name: "naver.reservation.manual",
  channel: "naver_reservation",
  capability: {
    ...defaultCapability,
    canSyncReservations: cap(
      "manual",
      "네이버 예약 공식 공개 API 미확인. 수동 입력 + CSV 임포트로 운영.",
      "제휴 제안을 통한 공식 API 접근 또는 CSV export 자동화",
    ),
    canAutoConfirmReservations: cap(
      "unavailable",
      "닥터스 차팅프로그램은 네이버 공식 연동 목록에 없음. '즉시 확정' 설정 또는 네이버 화면에서 수동 확정.",
    ),
  },
  async fetchReservations() {
    return [];
  },
  async confirmReservation() {
    return {
      success: false,
      message: "자동 확정 미지원. 네이버 예약 설정을 '즉시 확정'으로 두거나, 네이버 관리자 화면에서 수동 확정.",
    };
  },
};

export const naverReviewProvider: ReviewProvider = {
  name: "naver.review.manual",
  channel: "naver_review",
  capability: {
    ...defaultCapability,
    canImportReviews: cap(
      "manual",
      "공개 API 미확인. 텍스트 붙여넣기 / 이미지 OCR / CSV 배치 3 경로 제공.",
    ),
    canPostReviewReplies: cap(
      "manual",
      "운영자가 네이버 플레이스에서 직접 등록 후 '등록 완료 처리' 버튼 클릭.",
      "네이버 공식 Partner API 확인 시 자동 등록 활성화",
    ),
  },
  async fetchReviews() {
    return [];
  },
  async postReply() {
    return unsupportedPost;
  },
};

export const naverTalkProvider: ConsultProvider = {
  name: "naver.talk.manual",
  channel: "naver_talk",
  capability: {
    ...defaultCapability,
    canReceiveMessages: cap(
      "unknown",
      "네이버 톡톡 외부 양방향 공개 API 미확인. 운영 보조형으로 사용.",
    ),
    canSendMessages: cap(
      "unavailable",
      "실답변은 네이버 톡톡 앱/파트너센터에서 진행. 앱은 분류·초안·상태관리만.",
    ),
  },
  async fetchMessages() {
    return [];
  },
  async sendMessage() {
    return {
      success: false,
      message: "네이버 톡톡 직접 송신 미구현. 초안 복사 후 네이버 톡톡에서 붙여넣기 응대.",
    };
  },
};

// ─────────────────────────────────────────────
// Kakao: 상담톡 / 챗봇 / 비즈메시지 (3분할)
// ─────────────────────────────────────────────

/**
 * 상담톡: 공식 상담톡 상품 + 딜러사 경유해야 양방향 상담 가능.
 * 현재는 unavailable — UI 에 표시만, 실제 동작 없음.
 */
export const kakaoConsultProvider: ConsultProvider = {
  name: "kakao.consult.pending",
  channel: "kakao_channel",
  capability: {
    ...defaultCapability,
    canReceiveMessages: cap(
      "unavailable",
      "공식 상담톡(카카오 비즈니스) 상품 + 딜러사 연동 필요.",
      "상담톡 대행사 계약 (NHN 커뮤니케이션즈, 인포뱅크 등)",
    ),
    canSendMessages: cap(
      "unavailable",
      "상담톡 계약 전에는 카카오 채널 관리자센터에서 직접 응대.",
      "상담톡 대행사 계약",
    ),
  },
  async fetchMessages() {
    return [];
  },
  async sendMessage() {
    return {
      success: false,
      message: "상담톡 연동 전. 카카오 채널 관리자센터에서 직접 응대하세요.",
    };
  },
};

/**
 * 챗봇: 카카오 i 오픈빌더 + 웹훅. 진료시간/위치/주차 등 FAQ 자동응답.
 * 현재는 manual — 카카오 i 오픈빌더 설정 + 웹훅 URL 등록 후 활성화.
 */
export const kakaoChatbotProvider: ChatbotProvider = {
  name: "kakao.chatbot.openbuilder",
  channel: "kakao_channel",
  capability: {
    ...defaultCapability,
    canAutoRespondFaq: cap(
      "manual",
      "카카오 i 오픈빌더 시나리오 + 본 앱 /api/webhooks/kakao/chatbot 웹훅 URL 등록 필요.",
      "카카오 i 오픈빌더 계정 + HTTPS 공개 엔드포인트 (Cloudflare Tunnel)",
    ),
  },
  async verifyWebhook() {
    // 추후 signature/botId 검증 구현
    return true;
  },
  async buildResponse(utterance: string) {
    const lower = utterance.trim();
    // 지극히 단순한 키워드 fallback (실 배포 전 템플릿 DB 조회로 교체)
    if (lower.includes("시간") || lower.includes("몇 시")) {
      return {
        matched: true,
        text: "안녕하세요~ 의성한방병원입니다. 진료시간은 평일 09:00~18:00, 토요일 09:00~13:00입니다. 공휴일은 휴진입니다.",
      };
    }
    if (lower.includes("주차") || lower.includes("위치") || lower.includes("어디")) {
      return {
        matched: true,
        text: "안녕하세요~ 의성한방병원입니다. 건물 지하 주차장 이용 가능하며 진료 환자분께 1시간 무료 주차권을 드립니다.",
      };
    }
    return {
      matched: false,
      text: "문의 주신 내용은 담당자가 확인 후 연락드리겠습니다.",
    };
  },
};

/** 비즈메시지: 알림톡/친구톡. 발송대행사 필요. */
export const kakaoBizMessageProvider: BizMessageProvider = {
  name: "kakao.biz.pending",
  channel: "kakao_biz",
  capability: {
    ...defaultCapability,
    canSendBizMessage: cap(
      "unavailable",
      "발송대행사(Aligo/Nurigo/Bizppurio 등) 계약 + 템플릿 심사 승인 필요.",
      "발송대행사 계약 + 템플릿 승인 (2~5일 소요)",
    ),
  },
  async sendTemplateMessage() {
    return {
      success: false,
      message: "비즈메시지 발송 sandbox 미연결. 발송대행사 계약 후 활성화.",
    };
  },
};

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

export const providerRegistry = {
  naverReservation: naverReservationProvider,
  naverReview: naverReviewProvider,
  naverTalk: naverTalkProvider,
  kakaoConsult: kakaoConsultProvider,
  kakaoChatbot: kakaoChatbotProvider,
  kakaoBizMessage: kakaoBizMessageProvider,
};
