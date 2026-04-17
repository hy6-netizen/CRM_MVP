import { NextResponse } from "next/server";
import { kakaoChatbotProvider } from "@hub/providers/src/mock/mockProvider";

// 카카오 i 오픈빌더 스킬 엔드포인트 stub.
// 카카오 웹훅은 짧은 시간 안에 2xx 응답이 필요하므로 무거운 처리는 절대 금지.
// 구체 연동 시:
//   1. 오픈빌더 콘솔에서 이 URL 등록 (Cloudflare Tunnel HTTPS 필수)
//   2. 본 앱의 provider 내부에서 템플릿 DB 를 조회해 buildResponse 대체
//   3. signature/botId 검증 (카카오는 botId 헤더 제공)
//
// 현재는 매우 단순한 키워드 기반 응답. 챗봇 오픈빌더 시나리오가 잡히면 교체.

interface KakaoUserRequest {
  utterance?: string;
}
interface KakaoSkillPayload {
  userRequest?: KakaoUserRequest;
}

function buildSkillResponse(text: string) {
  // 카카오 오픈빌더 Skill v2 응답 포맷
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }],
    },
  };
}

export async function POST(req: Request) {
  // 1) (향후) 시그니처/botId 검증
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    // 본문이 없어도 2xx 로 응답해야 오픈빌더가 재시도하지 않음
    return NextResponse.json(buildSkillResponse("요청을 받지 못했습니다."));
  }

  const ok = await kakaoChatbotProvider.verifyWebhook(headers, rawBody);
  if (!ok) {
    return NextResponse.json(buildSkillResponse("요청을 확인할 수 없습니다."));
  }

  let payload: KakaoSkillPayload = {};
  try {
    payload = JSON.parse(rawBody) as KakaoSkillPayload;
  } catch {
    // 무효 JSON 이어도 2xx
  }

  const utterance = payload.userRequest?.utterance ?? "";

  const { text } = await kakaoChatbotProvider.buildResponse(utterance);

  // 의도치 않은 민감 키워드면 운영자 인계 안내 (상담톡으로 유도)
  const sensitive = ["환불", "분쟁", "부작용", "의료사고", "신고"];
  const needsHuman = sensitive.some((k) => utterance.includes(k));
  const finalText = needsHuman
    ? "남겨주신 내용은 담당자가 직접 확인해 연락드리도록 하겠습니다. 시급한 경우 원내로 전화 주세요."
    : text;

  return NextResponse.json(buildSkillResponse(finalText));
}

export async function GET() {
  // 오픈빌더는 GET 을 사용하지 않지만, health check 용으로 2xx 반환.
  return NextResponse.json({ ok: true, endpoint: "kakao-chatbot-skill" });
}
