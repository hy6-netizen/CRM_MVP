// 관리자 카카오 알림톡 발송 **stub**.
//
// 실제 알림톡 발송은 비즈메시지 발송대행사(Aligo/Nurigo/Bizppurio) 와 계약 + 템플릿 심사 승인 후 가능.
// 로드맵 단계 4 에서 이 함수의 본문을 실 API 호출로 교체.
// 지금은 콘솔 로그 + 호출자가 audit log 남기는 용도로만 사용.

export interface ManagerAlertPayload {
  reason: "no_show_20m" | "sensitive_escalation" | "custom";
  managerName: string;
  managerPhoneMasked: string;
  title: string;
  body: string;
  relatedEntity?: { type: string; id: string };
}

export interface AlertProviderResult {
  delivered: boolean;
  provider: "stub" | "aligo" | "nurigo" | "bizppurio";
  messageId?: string;
  rawError?: string;
}

export async function sendManagerAlert(payload: ManagerAlertPayload): Promise<AlertProviderResult> {
  // TODO(alimtalk): Aligo/Nurigo/Bizppurio SDK 호출로 교체.
  // 필수 조건:
  //  - 승인된 템플릿 코드 사용
  //  - 발신 프로필 (채널) 일치
  //  - 개인정보 최소 원칙: managerPhoneMasked 사용
  console.info(
    `[alimtalk:stub] 관리자 ${payload.managerName}(${payload.managerPhoneMasked}) → ${payload.title}\n${payload.body}`,
  );
  return { delivered: false, provider: "stub", rawError: "provider_not_configured" };
}
