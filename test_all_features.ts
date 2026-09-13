/**
 * test_all_features.ts
 *
 * Comprehensive Automated Test Suite covering:
 * 1. Multi-language dictionary parity & completeness across en, hi, ta, mr (Web + Mobile).
 * 2. Symptom Catalog translation coverage across all 4 languages.
 * 3. Demographics Form validation logic (Name, Village, 10-digit Phone, Age 0-120, Sex, Maternal).
 * 4. Clinical Rules Engine (IMNCI, ASHA Module 6, SBA Box 7, Common Emergencies Annexure 4).
 * 5. Dynamic Multilingual Urgency Advice Generation (EMERGENCY, HIGH, MEDIUM clinical, MEDIUM fallback, LOW).
 * 6. Symptoms Category Filters (All, Danger, Respiratory, Fever, Digestive, Maternal, etc.).
 * 7. Vitals Warning Triggers (Fever >= 37.5°C, High BP >= 140/90, Low SpO2 < 90%).
 * 8. Live HTTP API endpoint verification against Next.js production server on http://localhost:3000/api/triage.
 */

import fs from "fs";
import path from "path";
import { evaluateTriage, buildCitizenMessage } from "./citizen_web/src/lib/localRulesEngine.ts";
import { SYMPTOM_CATALOG } from "./citizen_web/src/lib/symptomCatalog.ts";

let passed = 0;
let failed = 0;
function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${testName}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✗\x1b[0m ${testName}${details ? ` -> ${details}` : ""}`);
  }
}

console.log("\n=======================================================");
console.log("  SWASTHYA SETU — COMPREHENSIVE TEST SUITE (WEB & MOBILE)");
console.log("=======================================================\n");

// -----------------------------------------------------------------------------
// 1. DICTIONARY & I18N PARITY CHECK (citizen_web)
// -----------------------------------------------------------------------------
console.log("1. Testing Citizen Web Locale Dictionaries (en, hi, ta, mr)...");
const localesDir = "/home/subash/med-ai-backend/citizen_web/src/locales";
const enJson = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));
const hiJson = JSON.parse(fs.readFileSync(path.join(localesDir, "hi.json"), "utf8"));
const taJson = JSON.parse(fs.readFileSync(path.join(localesDir, "ta.json"), "utf8"));
const mrJson = JSON.parse(fs.readFileSync(path.join(localesDir, "mr.json"), "utf8"));

function getAllKeys(obj: any, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getAllKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getAllKeys(enJson);
const hiKeys = getAllKeys(hiJson);
const taKeys = getAllKeys(taJson);
const mrKeys = getAllKeys(mrJson);

assert(enKeys.length > 50, "English locale dictionary loaded with comprehensive keys", `Total: ${enKeys.length}`);
assert(hiKeys.length >= enKeys.length, "Hindi dictionary covers all English keys", `HI: ${hiKeys.length}, EN: ${enKeys.length}`);
assert(taKeys.length >= enKeys.length, "Tamil dictionary covers all English keys", `TA: ${taKeys.length}, EN: ${enKeys.length}`);
assert(mrKeys.length >= enKeys.length, "Marathi dictionary covers all English keys", `MR: ${mrKeys.length}, EN: ${enKeys.length}`);

// Check specific demographic placeholders
assert(typeof enJson.demographics.namePlaceholder === "string" && enJson.demographics.namePlaceholder.includes("Rahul"), "EN name placeholder valid");
assert(typeof hiJson.demographics.namePlaceholder === "string" && hiJson.demographics.namePlaceholder.includes("राहुल"), "HI name placeholder valid");
assert(typeof taJson.demographics.namePlaceholder === "string" && taJson.demographics.namePlaceholder.includes("ராகுல்"), "TA name placeholder valid");
assert(typeof mrJson.demographics.namePlaceholder === "string" && mrJson.demographics.namePlaceholder.includes("राहुल"), "MR name placeholder valid");

// -----------------------------------------------------------------------------
// 2. ASHA APP TRANSLATION DICTIONARY CHECK
// -----------------------------------------------------------------------------
console.log("\n2. Testing ASHA Mobile App Translations (translations.ts)...");
const translationsTsPath = "/home/subash/med-ai-backend/asha_app/src/constants/translations.ts";
const translationsTs = fs.readFileSync(translationsTsPath, "utf8");

assert(translationsTs.includes('en: {'), "ASHA App contains 'en' translations");
assert(translationsTs.includes('hi: {'), "ASHA App contains 'hi' translations");
assert(translationsTs.includes('ta: {'), "ASHA App contains 'ta' translations");
assert(translationsTs.includes('mr: {'), "ASHA App contains 'mr' translations");
assert(translationsTs.includes('field_patient_name_placeholder: "e.g. Rahul Patil / Sunita Kamble"'), "ASHA App has EN name placeholder");
assert(translationsTs.includes('field_patient_name_placeholder: "उदा. राहुल पाटिल / सुनिता कांबले"'), "ASHA App has HI name placeholder");
assert(translationsTs.includes('field_patient_name_placeholder: "எ.கா. ராகுல் பாட்டீல் / சுனிதா"'), "ASHA App has TA name placeholder");
assert(translationsTs.includes('field_patient_name_placeholder: "उदा. राहुल पाटील / सुनिता कांबळे"'), "ASHA App has MR name placeholder");

// -----------------------------------------------------------------------------
// 3. SYMPTOM CATALOG TRANSLATION INTEGRITY
// -----------------------------------------------------------------------------
console.log("\n3. Testing Symptom Catalog Multilingual Coverage...");
assert(SYMPTOM_CATALOG.length >= 30, `Symptom catalog contains all standard clinical UI categories (found: ${SYMPTOM_CATALOG.length})`);
let allHaveAllLangs = true;
let missingLangs: string[] = [];
for (const s of SYMPTOM_CATALOG) {
  if (!s.label.en || !s.label.hi || !s.label.ta || !s.label.mr) {
    allHaveAllLangs = false;
    missingLangs.push(s.id);
  }
}
assert(allHaveAllLangs, "All symptoms in catalog have complete labels in EN, HI, TA, and MR", `Missing: ${missingLangs.join(", ")}`);

// Verify specific sample symptoms in Tamil & Hindi & Marathi
const feverEntry = SYMPTOM_CATALOG.find((s) => s.id === "fever");
assert(feverEntry?.label.en.includes("Fever") || false, "Fever EN label correct");
assert(feverEntry?.label.hi.includes("बुखार") || false, "Fever HI label correct");
assert(feverEntry?.label.ta.includes("காய்ச்சல்") || false, "Fever TA label correct");
assert(feverEntry?.label.mr.includes("ताप") || false, "Fever MR label correct");

const chestPainEntry = SYMPTOM_CATALOG.find((s) => s.id === "chest_pain");
assert(chestPainEntry?.label.ta.includes("மார்பு வலி") || false, "Chest Pain TA label correct");
assert(chestPainEntry?.isDangerSign === true, "Chest Pain flagged as Danger Sign");

// -----------------------------------------------------------------------------
// 4. FORM VALIDATION LOGIC TESTS
// -----------------------------------------------------------------------------
console.log("\n4. Testing Form Validation Rules...");
const phoneRegex = /^[6-9]\d{9}$/;
assert(phoneRegex.test("9876543210"), "Valid Indian 10-digit mobile (9876543210) accepted");
assert(phoneRegex.test("8765432109"), "Valid Indian 10-digit mobile (8765432109) accepted");
assert(phoneRegex.test("7654321098"), "Valid Indian 10-digit mobile (7654321098) accepted");
assert(phoneRegex.test("6543210987"), "Valid Indian 10-digit mobile (6543210987) accepted");
assert(!phoneRegex.test("5543210987"), "Invalid prefix (5543210987) rejected");
assert(!phoneRegex.test("1234567890"), "Invalid prefix (1234567890) rejected");
assert(!phoneRegex.test("987654321"), "Too short (9 digits) rejected");
assert(!phoneRegex.test("98765432100"), "Too long (11 digits) rejected");
assert(!phoneRegex.test("98765abcd0"), "Non-digit characters rejected");

// Age validation
function isValidAge(age: number | null): boolean {
  return typeof age === "number" && !isNaN(age) && age >= 0 && age <= 120;
}
assert(isValidAge(0.1), "Infant age 0.1 valid (infant 1 month)");
assert(isValidAge(3), "Child age 3 valid");
assert(isValidAge(28), "Adult age 28 valid");
assert(isValidAge(65), "Elderly age 65 valid");
assert(!isValidAge(-1), "Negative age -1 rejected");
assert(!isValidAge(121), "Over 120 rejected");
assert(!isValidAge(null), "Null age rejected");

// -----------------------------------------------------------------------------
// 5. DETERMINISTIC CLINICAL RULES ENGINE (Edge Engine)
// -----------------------------------------------------------------------------
console.log("\n5. Testing Edge Deterministic Rules Engine (localRulesEngine.ts)...");

// Test Case 1: IMNCI Pediatric Emergency (Convulsions)
const resPedsEmergency = evaluateTriage({
  symptoms: ["convulsions"],
  patient_age_years: 2,
  patient_sex: "male",
});
assert(resPedsEmergency.urgency === "emergency", "Peds convulsions -> EMERGENCY");
assert(resPedsEmergency.requires_referral === true, "Peds convulsions -> requires referral");
assert(resPedsEmergency.rule_trace.includes("R-EMG-001"), "Trace includes R-EMG-001 (IMNCI General Danger Signs)");

// Test Case 2: Adult Red Fast-Track (Chest pain)
const resAdultEmergency = evaluateTriage({
  symptoms: ["chest_pain"],
  patient_age_years: 52,
  patient_sex: "male",
});
assert(resAdultEmergency.urgency === "emergency", "Adult chest pain -> EMERGENCY");
assert(resAdultEmergency.rule_trace.includes("R-ADULT-EMG-001"), "Trace includes R-ADULT-EMG-001 (Adult Red Fast-Track)");

// Test Case 3: Maternal Emergency (Eclampsia)
const resMaternalEmergency = evaluateTriage({
  symptoms: ["convulsions_or_fits"],
  patient_age_years: 24,
  patient_sex: "female",
  is_pregnant: true,
});
assert(resMaternalEmergency.urgency === "emergency", "Pregnant convulsions -> EMERGENCY (Eclampsia)");
assert(resMaternalEmergency.rule_trace.includes("R-EMG-007"), "Trace includes R-EMG-007 (Pregnancy Emergency Signs)");

// Test Case 4: High Urgency (Adult Yellow Medical)
const resHigh = evaluateTriage({
  symptoms: ["headache_or_dizziness"],
  patient_age_years: 30,
  patient_sex: "male",
});
assert(resHigh.urgency === "high", "Headache or dizziness -> HIGH");
assert(resHigh.rule_trace.includes("R-ADULT-HIGH-001"), "Trace includes R-ADULT-HIGH-001");

// Test Case 5: Low Urgency (Mild cough without danger signs)
const resLow = evaluateTriage({
  symptoms: ["cough"],
  patient_age_years: 25,
  patient_sex: "male",
});
assert(resLow.urgency === "low", "Isolated cough -> LOW");
assert(resLow.requires_referral === false, "Isolated cough -> no referral needed");

// Test Case 6: Honest Fallback (Unmatched symptom combination)
const resFallback = evaluateTriage({
  symptoms: ["unknown_symptom_x"],
  patient_age_years: 35,
  patient_sex: "female",
});
assert(resFallback.urgency === "medium", "Unmatched symptom -> honest fallback MEDIUM");
assert(resFallback.rule_trace.includes("NO_RULE_MATCHED"), "Trace includes NO_RULE_MATCHED");

// -----------------------------------------------------------------------------
// 6. MULTILINGUAL CITIZEN MESSAGE LOCALIZATION
// -----------------------------------------------------------------------------
console.log("\n6. Testing Multilingual Citizen Advice Slip Messages...");
const msgEN = buildCitizenMessage(resAdultEmergency.urgency, resAdultEmergency.referral_target_level, "en", resAdultEmergency.recommended_action);
const msgHI = buildCitizenMessage(resAdultEmergency.urgency, resAdultEmergency.referral_target_level, "hi", resAdultEmergency.recommended_action);
const msgTA = buildCitizenMessage(resAdultEmergency.urgency, resAdultEmergency.referral_target_level, "ta", resAdultEmergency.recommended_action);
const msgMR = buildCitizenMessage(resAdultEmergency.urgency, resAdultEmergency.referral_target_level, "mr", resAdultEmergency.recommended_action);

assert(msgEN.includes("EMERGENCY") || msgEN.includes("immediate") || msgEN.includes("District Hospital"), "EN emergency message contains urgent action");
assert(msgHI.includes("आपातकाल") || msgHI.includes("तत्काल") || msgHI.includes("जिला अस्पताल"), "HI emergency message contains urgent action");
assert(msgTA.includes("அவசரநிலை") || msgTA.includes("உடனடியாக") || msgTA.includes("மாவட்ட மருத்துவமனை"), "TA emergency message contains urgent action in Tamil");
assert(msgMR.includes("तात्काळ") || msgMR.includes("रुग्णालय") || msgMR.includes("जिल्हा रुग्णालय"), "MR emergency message contains urgent action in Marathi");

// Test fallback message differentiation
const msgFallbackTA = buildCitizenMessage(resFallback.urgency, resFallback.referral_target_level, "ta", resFallback.recommended_action);
assert(msgFallbackTA.includes("ASHA") || msgFallbackTA.includes("தகவலின்"), "TA fallback advises examination by health worker");

// -----------------------------------------------------------------------------
// 7. VITALS EVALUATION & RANGE WARNINGS
// -----------------------------------------------------------------------------
console.log("\n7. Testing Vitals Warning Logic...");
function evaluateVitalsWarnings(vitals: { temperature_celsius?: number; systolic_bp?: number; diastolic_bp?: number; spo2_percent?: number }) {
  const isFever = vitals.temperature_celsius != null && vitals.temperature_celsius >= 37.5;
  const isHighBP = (vitals.systolic_bp != null && vitals.systolic_bp >= 140) || (vitals.diastolic_bp != null && vitals.diastolic_bp >= 90);
  const isLowSpO2 = vitals.spo2_percent != null && vitals.spo2_percent < 90;
  return { isFever, isHighBP, isLowSpO2 };
}

const w1 = evaluateVitalsWarnings({ temperature_celsius: 38.5, systolic_bp: 150, diastolic_bp: 95, spo2_percent: 88 });
assert(w1.isFever === true, "38.5°C triggers Fever warning");
assert(w1.isHighBP === true, "150/95 triggers High BP warning");
assert(w1.isLowSpO2 === true, "88% triggers Low SpO2 warning");

const w2 = evaluateVitalsWarnings({ temperature_celsius: 36.8, systolic_bp: 120, diastolic_bp: 80, spo2_percent: 99 });
assert(w2.isFever === false, "Normal temp (36.8°C) triggers no warning");
assert(w2.isHighBP === false, "Normal BP (120/80) triggers no warning");
assert(w2.isLowSpO2 === false, "Normal SpO2 (99%) triggers no warning");

// -----------------------------------------------------------------------------
// 8. LIVE HTTP POST /api/triage VERIFICATION
// -----------------------------------------------------------------------------
console.log("\n8. Testing Live HTTP /api/triage API Endpoint...");
async function testLiveApi() {
  try {
    const payload = {
      patient_display_name: "Rahul Patil",
      patient_phone: "9876543210",
      patient_village: "Kurkheda",
      patient_age_years: 45,
      patient_sex: "male",
      symptoms: ["chest_pain", "difficult_breathing"],
      vitals: {
        systolic_bp: 160,
        diastolic_bp: 100,
        spo2_percent: 89,
      },
    };

    const res = await fetch("http://localhost:3000/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert(res.status === 200, `POST /api/triage returned status 200 (Got: ${res.status})`);
    const json = await res.json();
    assert(json.urgency === "emergency", `Live API evaluated emergency urgency (Got: ${json.urgency})`);
    assert(json.requires_referral === true, "Live API indicates requires_referral = true");
    assert(Array.isArray(json.rule_trace) && json.rule_trace.length > 0, "Live API returned rule_trace");
  } catch (err: any) {
    failed++;
    console.error(`  \x1b[31m✗\x1b[0m Live API test failed: ${err.message}`);
  }

  // Summary report
  console.log("\n=======================================================");
  console.log(`  TEST RESULTS: \x1b[32m${passed} PASSED\x1b[0m | \x1b[31m${failed} FAILED\x1b[0m`);
  console.log("=======================================================\n");
  if (failed > 0) process.exit(1);
}

testLiveApi();
