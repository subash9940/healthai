import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const query = new URLSearchParams();
    if (statusParam) query.set("status", statusParam);

    const baseUrl = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, "/facility/sos-alerts")
      : "http://127.0.0.1:8001/facility/sos-alerts";

    const targetUrl = query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch SOS alerts", details: err?.message },
      { status: 500 }
    );
  }
}
