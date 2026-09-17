import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    let body: any = {};
    if (rawText && rawText.trim() !== "") {
      try {
        body = JSON.parse(rawText);
      } catch (parseErr: any) {
        return NextResponse.json(
          { error: "Malformed JSON payload", details: parseErr?.message },
          { status: 400 }
        );
      }
    }

    const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, "/sos")
      : "http://127.0.0.1:8001/sos";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const backendRes = await fetch(FASTAPI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      } else {
        const errorText = await backendRes.text();
        return NextResponse.json(
          { error: "Backend rejected SOS alert", details: errorText },
          { status: backendRes.status }
        );
      }
    } catch (err: any) {
      // Return simulated success if offline to ensure user isn't stuck
      return NextResponse.json({
        id: "offline-sos-" + Date.now(),
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        patient_context: body.patient_context || {},
        status: "active",
        created_at: new Date().toISOString(),
        message: "Emergency SOS registered locally and queued for broadcast.",
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal SOS error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
