import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const strict = searchParams.get("strict") === "1";

  try {
    const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, "/facility/list")
      : "http://127.0.0.1:8001/facility/list";

    const res = await fetch(FASTAPI_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }

    if (strict) {
      return NextResponse.json(
        { error: "Facility list unavailable offline" },
        { status: 503 }
      );
    }

    // Fallback public list if backend is momentarily unreachable (non-strict only)
    return NextResponse.json(
      [
        { id: "e0a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4", name: "PHC Shirur (प्राथमिक आरोग्य केंद्र शिरूर)", level: "phc", district: "Pune" },
        { id: "f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", name: "CHC Haveli (सामुदायिक आरोग्य केंद्र हवेली)", level: "chc", district: "Pune" },
        { id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", name: "Sub-District Hospital Baramati", level: "sdh", district: "Pune" },
        { id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e", name: "District Hospital Aundh (पुणे जिल्हा रुग्णालय)", level: "dh", district: "Pune" }
      ],
      { status: 200 }
    );
  } catch (err: any) {
    if (strict) {
      return NextResponse.json(
        { error: "Facility list unavailable offline" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      [
        { id: "e0a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4", name: "PHC Shirur (प्राथमिक आरोग्य केंद्र शिरूर)", level: "phc", district: "Pune" },
        { id: "f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", name: "CHC Haveli (सामुदायिक आरोग्य केंद्र हवेली)", level: "chc", district: "Pune" },
        { id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", name: "Sub-District Hospital Baramati", level: "sdh", district: "Pune" },
        { id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e", name: "District Hospital Aundh (पुणे जिल्हा रुग्णालय)", level: "dh", district: "Pune" }
      ],
      { status: 200 }
    );
  }
}
