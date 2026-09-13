import { NextRequest, NextResponse } from "next/server";
import { extractSymptomsLocal } from "@/lib/localExtractor";

const FASTAPI_URL =
  process.env.FASTAPI_BACKEND_URL?.replace(/\/triage$/, "") ||
  "http://127.0.0.1:8001";

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = body.transcript || "";
  const language = body.language || "en";

  // Try live backend with short timeout; on error/timeout, fall back to edge extractor
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s fast attempt

    const backendRes = await fetch(`${FASTAPI_URL}/extract-symptoms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend unreachable / offline — fallback gracefully to deterministic local matcher
  }

  // Edge / browser fallback: 100% offline uptime
  const localResult = extractSymptomsLocal(transcript, language);
  return NextResponse.json(localResult);
}
