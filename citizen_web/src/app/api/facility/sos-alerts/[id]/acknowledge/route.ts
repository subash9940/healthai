import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }

    const { id } = await params;

    const baseUrl = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, `/facility/sos-alerts/${id}/acknowledge`)
      : `http://127.0.0.1:8001/facility/sos-alerts/${id}/acknowledge`;

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to acknowledge SOS alert", details: err?.message },
      { status: 500 }
    );
  }
}
