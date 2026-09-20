import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    if (!rawText || rawText.trim() === "") {
      return NextResponse.json(
        { error: "Empty request body. JSON payload is required." },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: "Malformed JSON payload", details: parseErr?.message },
        { status: 400 }
      );
    }

    const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, "/sos")
      : "http://127.0.0.1:8001/sos";

    try {
      const backendRes = await fetch(FASTAPI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resText = await backendRes.text();
      let responseData: any;
      try {
        responseData = resText ? JSON.parse(resText) : {};
      } catch {
        responseData = { message: resText };
      }

      return NextResponse.json(responseData, { status: backendRes.status });
    } catch (netErr: any) {
      return NextResponse.json(
        { error: "SOS backend service unavailable", details: netErr?.message || String(netErr) },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal error processing SOS", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
