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

    const baseUrl = process.env.FASTAPI_BACKEND_URL
      ? process.env.FASTAPI_BACKEND_URL.replace(/\/triage$/, `/facility/sos/${id}/acknowledge`)
      : `http://127.0.0.1:8001/facility/sos/${id}/acknowledge`;

    try {
      const res = await fetch(baseUrl, {
        method: "POST",
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
        { error: "Facility SOS acknowledge service unavailable", details: netErr?.message || String(netErr) },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal error acknowledging facility SOS alert", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
