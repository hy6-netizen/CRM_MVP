import { NextResponse } from "next/server";
import { getLLM } from "@hub/ai/src/llm";

// 이미지 업로드 → Vision 모델로 리뷰 구조화 추출.
// - multipart/form-data ('file') 또는 JSON {imageDataUrl:"data:image/..."}
// - 이 엔드포인트는 Review 를 생성하지 않음. 추출만. 사용자 확인 후 /api/reviews POST 으로 생성.
// - 이미지는 서버에 저장하지 않음 (프라이버시).

export const runtime = "nodejs";
export const maxDuration = 60;

async function toDataUrl(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let imageDataUrl: string | null = null;

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "file_too_large", max: "10MB" }, { status: 413 });
    }
    imageDataUrl = await toDataUrl(file);
  } else {
    const body = await req.json().catch(() => ({}));
    if (typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image/")) {
      imageDataUrl = body.imageDataUrl;
    }
  }

  if (!imageDataUrl) {
    return NextResponse.json({ error: "no_image" }, { status: 400 });
  }

  const llm = getLLM();
  if (llm.name === "mock") {
    return NextResponse.json(
      {
        error: "provider_unavailable",
        message: "이미지 추출은 AI_PROVIDER=openai 일 때만 동작합니다. .env 에서 AI_PROVIDER 설정 후 재시작하세요.",
      },
      { status: 503 },
    );
  }

  try {
    const resp = await llm.extractReviewFromImage(imageDataUrl);
    return NextResponse.json({ ...resp.result, meta: { provider: resp.provider, usage: resp.usage } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[extract-image] failed", msg);
    return NextResponse.json({ error: "extract_failed", message: msg }, { status: 500 });
  }
}
