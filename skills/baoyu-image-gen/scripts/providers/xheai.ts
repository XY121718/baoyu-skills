import type { CliArgs } from "../types";

export function getDefaultModel(): string {
  return process.env.OPENAI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
}

type XheaiImageResponse = { data: Array<{ url?: string; b64_json?: string }> };

function parseAspectRatio(ar: string): string {
  // 直接返回宽高比字符串，如 "16:9"
  return ar;
}

function getImageSize(quality: CliArgs["quality"]): string {
  // 根据 quality 返回 image_size
  if (quality === "2k") return "2k";
  return "1k";
}

export async function generateImage(
  prompt: string,
  model: string,
  args: CliArgs
): Promise<Uint8Array> {
  const baseURL = (process.env.OPENAI_BASE_URL || "https://api.xheai.cc").replace(/\/v1$/, "");
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const endpoint = `${baseURL}/v1/images/generations`;

  // 使用 xheai 的自定义格式
  const aspectRatio = args.aspectRatio || "1:1";
  const imageSize = getImageSize(args.quality);

  const payload = {
    model: model,
    prompt: prompt,
    aspect_ratio: aspectRatio,
    image_size: imageSize,
    response_format: "url",
  };

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xheai API error: ${err}`);
  }

  const result = (await res.json()) as XheaiImageResponse;
  return extractImageFromResponse(result);
}

async function extractImageFromResponse(result: XheaiImageResponse): Promise<Uint8Array> {
  const img = result.data[0];

  if (img?.b64_json) {
    return Uint8Array.from(Buffer.from(img.b64_json, "base64"));
  }

  if (img?.url) {
    const imgRes = await fetch(img.url);
    if (!imgRes.ok) throw new Error("Failed to download image");
    const buf = await imgRes.arrayBuffer();
    return new Uint8Array(buf);
  }

  throw new Error("No image in response");
}
