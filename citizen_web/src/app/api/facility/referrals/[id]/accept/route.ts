import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }

    let body = {};
    try {
      const raw = await req.text();
      if (raw && raw.trim()) {
        body = JSON.parse(raw);
      }
    } catch {
      // Body optional
    }

    const baseUrl = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, `/facility/referrals/${id}/accept`)
      : `http://127.0.0.1:8001/facility/referrals/${id}/accept`;

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to accept referral", details: err?.message },
      { status: 500 }
    );
  }
}
