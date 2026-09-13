import { NextRequest, NextResponse } from "next/server";
import { TriageRequest, TriageResponse } from "@/lib/triageContract";
import { evaluateTriage } from "@/lib/localRulesEngine";

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    if (!rawText || rawText.trim() === "") {
      return NextResponse.json(
        { error: "Empty request body. JSON payload is required." },
        { status: 400 }
      );
    }

    let body: TriageRequest;
    try {
      body = JSON.parse(rawText);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: "Malformed JSON payload", details: parseErr?.message },
        { status: 400 }
      );
    }

    // Validate minimal required fields
    if (!body.symptoms || !Array.isArray(body.symptoms) || body.patient_age_years == null || !body.patient_sex) {
      return NextResponse.json(
        { error: "Invalid request payload: symptoms array, patient_age_years, and patient_sex are required." },
        { status: 400 }
      );
    }

    body.source_tier = "citizen_web";
    body.language = body.language || "en";

    // Attempt to hit live FastAPI backend for evaluation and Postgres DB persistence
    const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL || "http://127.0.0.1:8001/triage";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const backendRes = await fetch(FASTAPI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (backendRes.ok) {
        const resText = await backendRes.text();
        if (resText && resText.trim()) {
          const backendData = JSON.parse(resText) as TriageResponse;
          return NextResponse.json({
            ...backendData,
            _backend_source: "fastapi_db_persisted",
          });
        }
      }
    } catch (backendErr) {
      // If FastAPI is restarting or offline, fall back directly to deterministic local rules engine
    }

    // Evaluate deterministically using local engine matching rules_engine.py v11
    const localResult = evaluateTriage(body);
    return NextResponse.json({
      ...localResult,
      _backend_source: "deterministic_edge_engine",
    });
  } catch (err: any) {
    console.error("Triage evaluation error:", err);
    return NextResponse.json(
      { error: "Internal triage error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
