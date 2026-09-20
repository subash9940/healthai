import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const query = new URLSearchParams();
    if (status) query.set("status_filter", status);

    const baseUrl = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, "/facility/sos")
      : "http://127.0.0.1:8001/facility/sos";

    const targetUrl = query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl;

    try {
      const res = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      });

      const resText = await res.text();
      let data: any;
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        data = { message: resText };
      }

      return NextResponse.json(data, { status: res.status });
    } catch (netErr: any) {
      return NextResponse.json(
        { error: "Facility SOS service unavailable", details: netErr?.message || String(netErr) },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal error fetching facility SOS alerts", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
