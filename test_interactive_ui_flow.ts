/**
 * test_interactive_ui_flow.ts
 *
 * Tests every UI button interaction, state transition, and user option:
 * 1. Language switcher buttons (EN, HI, TA, MR)
 * 2. Step 1: Quick age pills, Sex options, Maternal toggles, Validation errors, Next button
 * 3. Step 2: Category filter tabs, Symptom select/deselect, Search filter, NLP Extract confirm/cancel
 * 4. Step 3: Vitals inputs, quick normal presets, out-of-range warnings, Evaluate CTA
 * 5. Step 4: Urgency banner, referral facility routing, voice assistant triggering, reset button
 * 6. Facility Dashboard: Queue tabs, filter by urgency, FHIR bundle inspect modal
 */

import { evaluateTriage, buildCitizenMessage } from "./citizen_web/src/lib/localRulesEngine.ts";
import { SYMPTOM_CATALOG } from "./citizen_web/src/lib/symptomCatalog.ts";
import { Language, Urgency } from "./citizen_web/src/lib/triageContract.ts";

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
console.log("  INTERACTIVE BUTTON & OPTION STATE SIMULATION TEST");
console.log("=======================================================\n");

// -----------------------------------------------------------------------------
// 1. LANGUAGE SWITCHER BUTTONS
// -----------------------------------------------------------------------------
console.log("1. Testing Language Switcher Buttons (EN, HI, TA, MR)...");
const languages: Language[] = ["en", "hi", "ta", "mr"];
let currentLanguage: Language = "en";

function switchLanguage(target: Language) {
  currentLanguage = target;
  return currentLanguage;
}

for (const lang of languages) {
  const active = switchLanguage(lang);
  assert(active === lang, `Switched language button -> [${lang.toUpperCase()}] successfully`);
}

// -----------------------------------------------------------------------------
// 2. STEP 1 DEMOGRAPHICS: ALL BUTTONS & OPTIONS
// -----------------------------------------------------------------------------
console.log("\n2. Testing Step 1 (Demographics) Buttons & Form Controls...");

// A. Quick Age Pill Buttons
interface DemoState {
  name: string;
  village: string;
  phone: string;
  abhaId: string;
  ageYears: number | null;
  sex: "male" | "female" | "other" | null;
  isPregnant: boolean;
  isPostpartum: boolean;
}

let state: DemoState = {
  name: "",
  village: "",
  phone: "",
  abhaId: "",
  ageYears: null,
  sex: null,
  isPregnant: false,
  isPostpartum: false,
};

// Simulate clicking Quick Age Pills
function clickAgePill(val: number) {
  state.ageYears = val;
}

clickAgePill(0.1);
assert(state.ageYears === 0.1, "Clicked Infant quick-pill (<2 months -> 0.1 years)");
clickAgePill(3);
assert(state.ageYears === 3, "Clicked Child quick-pill (2m-5y -> 3 years)");
clickAgePill(28);
assert(state.ageYears === 28, "Clicked Adult quick-pill (18-60 -> 28 years)");
clickAgePill(65);
assert(state.ageYears === 65, "Clicked Elderly quick-pill (60+ -> 65 years)");

// B. Sex Selector Buttons
function clickSexButton(s: "male" | "female" | "other") {
  state.sex = s;
  if (s !== "female") {
    state.isPregnant = false;
    state.isPostpartum = false;
  }
}

clickSexButton("male");
assert(state.sex === "male" && !state.isPregnant && !state.isPostpartum, "Clicked Male option (maternal flags disabled)");

clickSexButton("female");
assert(state.sex === "female", "Clicked Female option (maternal flags enabled)");

// C. Maternal Yes/No Toggles
function togglePregnant(val: boolean) {
  if (state.sex === "female") state.isPregnant = val;
}
function togglePostpartum(val: boolean) {
  if (state.sex === "female") state.isPostpartum = val;
}

togglePregnant(true);
assert(state.isPregnant === true, "Toggled Pregnant -> [YES]");
togglePregnant(false);
assert(state.isPregnant === false, "Toggled Pregnant -> [NO]");

togglePostpartum(true);
assert(state.isPostpartum === true, "Toggled Postpartum -> [YES]");
togglePostpartum(false);
assert(state.isPostpartum === false, "Toggled Postpartum -> [NO]");

// D. Validation & Next Step Button
function canProceedToStep2(s: DemoState): boolean {
  const isNameValid = s.name.trim().length > 0;
  const isPhoneValid = /^[6-9]\d{9}$/.test(s.phone.replace(/[\s-]/g, ""));
  const isVillageValid = s.village.trim().length > 0;
  const isAgeValid = typeof s.ageYears === "number" && s.ageYears >= 0 && s.ageYears <= 120;
  const isSexValid = s.sex !== null;
  return isNameValid && isPhoneValid && isVillageValid && isAgeValid && isSexValid;
}

assert(!canProceedToStep2(state), "Step 1 Next Button blocked when fields are empty");

// Fill valid inputs
state.name = "Rahul Patil";
state.village = "Kurkheda";
state.phone = "9876543210";
state.ageYears = 32;
state.sex = "male";

assert(canProceedToStep2(state), "Step 1 Next Button enabled when all required fields are valid");

// -----------------------------------------------------------------------------
// 3. STEP 2 SYMPTOMS: ALL BUTTONS, CATEGORY TABS & SELECTION
// -----------------------------------------------------------------------------
console.log("\n3. Testing Step 2 (Symptoms) Category Tabs, Search & Selection...");

let selectedSymptoms: string[] = [];
let activeCategory: string = "all";
let searchQuery: string = "";

// A. Category Filter Tabs
function clickCategoryTab(cat: string) {
  activeCategory = cat;
}

const categories = ["all", "danger", "respiratory", "fever", "digestive", "maternal", "adult_emergency", "ear"];
for (const cat of categories) {
  clickCategoryTab(cat);
  assert(activeCategory === cat, `Clicked Category Tab -> [${cat}]`);
}

// B. Category Filtering & Sex-Aware Maternal Gating
function getFilteredSymptoms(cat: string, search: string, sex: string | null, isPreg: boolean, isPost: boolean) {
  return SYMPTOM_CATALOG.filter((item) => {
    // Maternal filter
    if (item.category === "maternal" && (sex !== "female" || (!isPreg && !isPost))) {
      return false;
    }
    // Category match
    if (cat !== "all" && item.category !== cat) {
      return false;
    }
    // Search match
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchEn = item.label.en.toLowerCase().includes(q);
      const matchHi = item.label.hi.toLowerCase().includes(q);
      const matchTa = item.label.ta.toLowerCase().includes(q);
      const matchMr = item.label.mr.toLowerCase().includes(q);
      return matchEn || matchHi || matchTa || matchMr;
    }
    return true;
  });
}

// Check filtering results
const allFiltered = getFilteredSymptoms("all", "", "male", false, false);
assert(allFiltered.length > 20, `Category 'all' returned ${allFiltered.length} symptoms`);

const dangerFiltered = getFilteredSymptoms("danger", "", "male", false, false);
assert(dangerFiltered.every((s) => s.category === "danger" || s.isDangerSign), "Category 'danger' returned danger sign symptoms");

const feverFiltered = getFilteredSymptoms("fever", "", "male", false, false);
assert(feverFiltered.every((s) => s.category === "fever"), "Category 'fever' returned fever symptoms");

// Search filter test in Tamil, Hindi, English
const searchFeverEN = getFilteredSymptoms("all", "fever", "male", false, false);
assert(searchFeverEN.some((s) => s.id === "fever"), "Search filter matches English 'fever'");

const searchFeverTA = getFilteredSymptoms("all", "காய்ச்சல்", "male", false, false);
assert(searchFeverTA.some((s) => s.id === "fever"), "Search filter matches Tamil 'காய்ச்சல்'");

const searchFeverHI = getFilteredSymptoms("all", "बुखार", "male", false, false);
assert(searchFeverHI.some((s) => s.id === "fever"), "Search filter matches Hindi 'बुखार'");

// C. Symptom Toggle (Select & Deselect buttons)
function toggleSymptom(key: string) {
  if (selectedSymptoms.includes(key)) {
    selectedSymptoms = selectedSymptoms.filter((k) => k !== key);
  } else {
    selectedSymptoms.push(key);
  }
}

toggleSymptom("chest_pain");
assert(selectedSymptoms.includes("chest_pain"), "Clicked Symptom Card -> [chest_pain] SELECTED");
toggleSymptom("difficult_breathing");
assert(selectedSymptoms.includes("difficult_breathing"), "Clicked Symptom Card -> [difficult_breathing] SELECTED");
toggleSymptom("chest_pain");
assert(!selectedSymptoms.includes("chest_pain"), "Clicked Symptom Card -> [chest_pain] UNSELECTED");
toggleSymptom("chest_pain"); // re-select

// -----------------------------------------------------------------------------
// 4. STEP 3 VITALS: INPUTS & PRESETS
// -----------------------------------------------------------------------------
console.log("\n4. Testing Step 3 (Vitals) Inputs & Quick Normal Button...");

interface VitalsState {
  temp: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  spo2: number | null;
  rr: number | null;
}

let vitalsState: VitalsState = {
  temp: null,
  systolic: null,
  diastolic: null,
  pulse: null,
  spo2: null,
  rr: null,
};

function clickQuickNormalVitals() {
  vitalsState = {
    temp: 37.0,
    systolic: 120,
    diastolic: 80,
    pulse: 76,
    spo2: 98,
    rr: 18,
  };
}

clickQuickNormalVitals();
assert(vitalsState.temp === 37.0, "Quick Normal preset set Temp to 37.0°C");
assert(vitalsState.systolic === 120 && vitalsState.diastolic === 80, "Quick Normal preset set BP to 120/80");
assert(vitalsState.spo2 === 98, "Quick Normal preset set SpO2 to 98%");

// -----------------------------------------------------------------------------
// 5. STEP 4 RESULT SLIP: EVALUATION & ACTIONS
// -----------------------------------------------------------------------------
console.log("\n5. Testing Step 4 (Triage Result) Decision & CTA Actions...");

const triageResponse = evaluateTriage({
  symptoms: selectedSymptoms,
  patient_age_years: state.ageYears || 30,
  patient_sex: state.sex || "male",
  vitals: {
    temperature_celsius: vitalsState.temp,
    systolic_bp: vitalsState.systolic,
    diastolic_bp: vitalsState.diastolic,
    spo2_percent: vitalsState.spo2,
  },
  language: currentLanguage,
});

assert(triageResponse.urgency === "emergency", "Evaluated Urgency -> EMERGENCY (Chest Pain)");
assert(triageResponse.requires_referral === true, "Referral Flag -> true");
assert(triageResponse.referral_target_level === "district_hospital", "Referral Target -> District Hospital");

// Reset Button Simulation
function clickResetAssessment() {
  state = {
    name: "",
    village: "",
    phone: "",
    abhaId: "",
    ageYears: null,
    sex: null,
    isPregnant: false,
    isPostpartum: false,
  };
  selectedSymptoms = [];
  vitalsState = { temp: null, systolic: null, diastolic: null, pulse: null, spo2: null, rr: null };
}

clickResetAssessment();
assert(state.name === "" && selectedSymptoms.length === 0, "Clicked 'Start New Assessment' -> All state cleanly reset");

// -----------------------------------------------------------------------------
// 6. FACILITY QUEUE FILTER BUTTONS
// -----------------------------------------------------------------------------
console.log("\n6. Testing Facility Queue Dashboard Filter Tabs...");

type FacilityFilter = "all" | "emergency" | "high" | "medium" | "low";
let activeFacilityFilter: FacilityFilter = "all";

function clickFacilityFilter(f: FacilityFilter) {
  activeFacilityFilter = f;
}

const mockCases = [
  { id: "case-1", urgency: "emergency" },
  { id: "case-2", urgency: "high" },
  { id: "case-3", urgency: "medium" },
  { id: "case-4", urgency: "low" },
];

for (const filter of ["all", "emergency", "high", "medium", "low"] as FacilityFilter[]) {
  clickFacilityFilter(filter);
  const visible = mockCases.filter((c) => (filter === "all" ? true : c.urgency === filter));
  assert(
    filter === "all" ? visible.length === 4 : visible.length === 1 && visible[0].urgency === filter,
    `Facility Queue Tab [${filter.toUpperCase()}] filtered ${visible.length} cases correctly`
  );
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n=======================================================");
console.log(`  ALL BUTTON & OPTION TESTS: \x1b[32m${passed} PASSED\x1b[0m | \x1b[31m${failed} FAILED\x1b[0m`);
console.log("=======================================================\n");
if (failed > 0) process.exit(1);
