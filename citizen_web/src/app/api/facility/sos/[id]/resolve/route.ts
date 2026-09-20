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

    let body: any = {};
    try {
      const raw = await req.text();
      if (raw && raw.trim()) {
        body = JSON.parse(raw);
      }
    } catch {
      // Body optional or empty
    }

    const baseUrl = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, `/facility/sos/${id}/resolve`)
      : `http://127.0.0.1:8001/facility/sos/${id}/resolve`;

    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
        { error: "Facility SOS resolve service unavailable", details: netErr?.message || String(netErr) },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal error resolving facility SOS alert", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
