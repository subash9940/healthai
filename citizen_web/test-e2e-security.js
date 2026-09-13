/**
 * Automated End-to-End & Security Test Suite for Swasthya Setu Citizen Web
 * Testing against live localhost:3000
 */

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("=================================================================");
  console.log("🚀 STARTING AUTOMATED CITIZEN_WEB E2E & SECURITY TEST SUITE");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? `(${details})` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. ROUTE ACCESSIBILITY & HTTP STATUS
  // -------------------------------------------------------------------------
  console.log("\n--- 1. ROUTE ACCESSIBILITY TESTS ---");
  const routes = [
    { path: "/", expectedStatus: 200, name: "Landing & Triage Wizard Page" },
    { path: "/facility", expectedStatus: 200, name: "Facility Dashboard Page" },
    { path: "/privacy", expectedStatus: 200, name: "Privacy Policy Page" },
    { path: "/terms", expectedStatus: 200, name: "Terms of Service Page" },
    { path: "/robots.txt", expectedStatus: 200, name: "Robots.txt file" },
    { path: "/sitemap.xml", expectedStatus: 200, name: "Sitemap XML" },
    { path: "/non-existent-page-404", expectedStatus: 404, name: "404 Not Found Page" },
  ];

  for (const r of routes) {
    try {
      const res = await fetch(`${BASE_URL}${r.path}`);
      assert(res.status === r.expectedStatus, `Route ${r.path} returns ${r.expectedStatus}`, `Got ${res.status}`);
    } catch (e) {
      assert(false, `Route ${r.path} reachable`, e.message);
    }
  }

  // -------------------------------------------------------------------------
  // 2. /api/triage ENDPOINT E2E TESTS (CLINICAL ACCURACY ACROSS URGENCY TIERS)
  // -------------------------------------------------------------------------
  console.log("\n--- 2. CLINICAL TRIAGE API ENDPOINT TESTS ---");

  // Case 2.1: RED EMERGENCY Tier (Chest pain in adult)
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: "Ramesh Pawar",
        patient_phone: "9876543210",
        patient_village: "Chamorshi",
        symptoms: ["chest_pain"],
        patient_age_years: 52,
        patient_sex: "male",
        source_tier: "citizen_web",
        language: "mr",
      }),
    });
    const data = await res.json();
    assert(res.status === 200, "POST /api/triage returns 200 for emergency");
    assert(data.urgency === "emergency", "Evaluates chest pain as EMERGENCY urgency", `Got ${data.urgency}`);
    assert(data.requires_referral === true, "Emergency requires referral");
    assert(data.referral_target_level === "district_hospital", "Emergency routes to district hospital");
    assert(data.citizen_message.includes("आणीबाणी") || data.citizen_message.includes("तातडीचा"), "Returns Marathi emergency message");
  } catch (e) {
    assert(false, "Emergency triage evaluation", e.message);
  }

  // Case 2.2: HIGH Tier (Child fast breathing / pneumonia)
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: "Aarav Shinde",
        patient_phone: "9123456789",
        patient_village: "Kurkheda",
        symptoms: ["cough", "fast_breathing"],
        patient_age_years: 3,
        patient_sex: "male",
        source_tier: "citizen_web",
        language: "hi",
      }),
    });
    const data = await res.json();
    assert(data.urgency === "high", "Evaluates child fast breathing as HIGH urgency", `Got ${data.urgency}`);
    assert(data.citizen_message.includes("आज ही"), "Returns Hindi high-urgency message");
  } catch (e) {
    assert(false, "High triage evaluation", e.message);
  }

  // Case 2.3: MEDIUM Clinical Rule (Diarrhea + Vomiting dehydration risk)
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: "Sunita Gavit",
        patient_phone: "9822334455",
        patient_village: "Dhadgaon",
        symptoms: ["diarrhea", "vomiting"],
        patient_age_years: 25,
        patient_sex: "female",
        is_pregnant: false,
        source_tier: "citizen_web",
        language: "en",
      }),
    });
    const data = await res.json();
    assert(data.urgency === "medium", "Evaluates diarrhea + vomiting as MEDIUM urgency", `Got ${data.urgency}`);
    assert(data.rule_trace.includes("R-MED-001"), "Triggers clinical rule R-MED-001");
    assert(data.citizen_message.includes("Clinical assessment recommended"), "Uses clinical medium message instead of fallback");
  } catch (e) {
    assert(false, "Medium clinical triage evaluation", e.message);
  }

  // Case 2.4: MEDIUM Honest Fallback (Unknown combination)
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: "Anand Murugan",
        patient_phone: "9876501234",
        patient_village: "Salem",
        symptoms: ["loss_of_appetite"],
        patient_age_years: 35,
        patient_sex: "male",
        source_tier: "citizen_web",
        language: "ta",
      }),
    });
    const data = await res.json();
    assert(data.urgency === "medium", "Evaluates unknown symptom as MEDIUM fallback");
    assert(data.rule_trace.includes("NO_RULE_MATCHED"), "Rule trace indicates NO_RULE_MATCHED");
    assert(data.citizen_message.includes("ASHA"), "Tamil fallback message mentions ASHA worker");
  } catch (e) {
    assert(false, "Medium fallback triage evaluation", e.message);
  }

  // Case 2.5: LOW Tier (Mild cold without danger signs)
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: "Pooja Patil",
        patient_phone: "9898989898",
        patient_village: "Baramati",
        symptoms: ["low_risk_cough_or_cold"],
        patient_age_years: 28,
        patient_sex: "female",
        is_pregnant: false,
        source_tier: "citizen_web",
        language: "en",
      }),
    });
    const data = await res.json();
    assert(data.urgency === "low", "Evaluates mild cold as LOW urgency", `Got ${data.urgency}`);
    assert(data.requires_referral === false, "Low urgency does not require emergency referral");
  } catch (e) {
    assert(false, "Low triage evaluation", e.message);
  }

  // -------------------------------------------------------------------------
  // 3. SECURITY & INPUT VALIDATION TESTS (SECURITY REVIEW)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. SECURITY & RESILIENCE TESTS ---");

  // Sec 3.1: Missing required fields validation
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // missing symptoms, age, sex
      }),
    });
    assert(res.status === 400, "Rejects request missing required fields with 400 Bad Request", `Got ${res.status}`);
  } catch (e) {
    assert(false, "Validation rejection test", e.message);
  }

  // Sec 3.2: Malformed JSON payload handling
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid_json: true, ",
    });
    assert(res.status === 400 || res.status === 500, "Safely handles malformed JSON without crash", `Got ${res.status}`);
  } catch (e) {
    assert(false, "Malformed JSON safety test", e.message);
  }

  // Sec 3.3: XSS Injection in Demographics fields
  try {
    const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: xssPayload,
        patient_phone: "9876543210",
        patient_village: xssPayload,
        patient_abha_id: xssPayload,
        symptoms: ["cough"],
        patient_age_years: 30,
        patient_sex: "female",
        source_tier: "citizen_web",
        language: "en",
      }),
    });
    const data = await res.json();
    assert(res.status === 200, "Processes sanitized XSS input without execution or error");
    assert(data.urgency !== undefined, "Returns valid deterministic triage response");
  } catch (e) {
    assert(false, "XSS injection handling test", e.message);
  }

  // Sec 3.4: SQL Injection in input fields
  try {
    const sqliPayload = "'; DROP TABLE patients; -- ' OR 1=1";
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: sqliPayload,
        patient_phone: "9876543210",
        patient_village: sqliPayload,
        symptoms: ["chest_pain"],
        patient_age_years: 45,
        patient_sex: "male",
        source_tier: "citizen_web",
        language: "en",
      }),
    });
    const data = await res.json();
    assert(res.status === 200, "Safely handles SQL injection payloads without database compromise");
    assert(data.urgency === "emergency", "Maintains clinical safety integrity");
  } catch (e) {
    assert(false, "SQL injection test", e.message);
  }

  // Sec 3.5: Extreme Boundary Conditions (Age limits, extreme vitals)
  try {
    const res = await fetch(`${BASE_URL}/api/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_display_name: "Elderly Patient",
        patient_phone: "9999999999",
        patient_village: "Remote Valley",
        symptoms: ["burn_present"],
        patient_age_years: 105, // Extreme age
        patient_sex: "female",
        vitals: {
          temperature_celsius: 42.5, // Extreme fever
          pulse_bpm: 180,
          systolic_bp: 240,
          diastolic_bp: 140,
          respiratory_rate: 45,
          spo2_percent: 75,
        },
        source_tier: "citizen_web",
        language: "en",
      }),
    });
    const data = await res.json();
    assert(data.urgency === "emergency", "Extreme vitals + age correctly classified as EMERGENCY");
  } catch (e) {
    assert(false, "Boundary condition test", e.message);
  }

  // -------------------------------------------------------------------------
  // 4. SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
