import { evaluateTriage as evaluateWebTriage } from './citizen_web/src/lib/localRulesEngine';
import { evaluateOfflineTriage } from './asha_app/src/rules/offlineRulesEngine';
import { SYMPTOM_DEFINITIONS } from './citizen_web/src/lib/symptomTranslations';

console.log('======================================================================');
console.log('  TESTING COMPLETE SYMPTOM CATALOG MATCHING: WEB & ASHA APP PARITY');
console.log('======================================================================\n');

let totalWebPassed = 0;
let totalWebFailed = 0;
let totalAshaPassed = 0;
let totalAshaFailed = 0;

for (const sym of SYMPTOM_DEFINITIONS) {
  // 1. Test Citizen Web localRulesEngine
  const webReq = {
    patient_name: 'Test Citizen',
    patient_age: 32,
    patient_sex: 'female',
    is_pregnant: false,
    symptoms: [sym.key],
    language: 'en' as const,
  };

  const webRes = evaluateWebTriage(webReq);
  const webMatched = !webRes.rule_trace.includes('NO_RULE_MATCHED');

  if (webMatched) {
    totalWebPassed++;
  } else {
    console.error(`\x1b[31m[WEB FAILED]\x1b[0m Symptom '${sym.key}' fell through to NO_RULE_MATCHED`);
    totalWebFailed++;
  }

  // 2. Test ASHA Mobile App offlineRulesEngine
  const ashaReq = {
    patient_id: 'p_123',
    patient_name: 'Test Citizen',
    patient_age_years: 32,
    patient_sex: 'female' as const,
    is_pregnant: false,
    is_postpartum: false,
    symptoms: [sym.key],
    language: 'en' as const,
  };

  const ashaRes = evaluateOfflineTriage(ashaReq);
  const ashaMatched = !ashaRes.rule_trace.includes('NO_RULE_MATCHED');

  if (ashaMatched) {
    totalAshaPassed++;
  } else {
    console.error(`\x1b[31m[ASHA APP FAILED]\x1b[0m Symptom '${sym.key}' fell through to NO_RULE_MATCHED`);
    totalAshaFailed++;
  }

  console.log(`\x1b[32m✓\x1b[0m [${sym.key}] -> Web: ${webRes.rule_trace.join(',')} (${webRes.urgency.toUpperCase()}) | ASHA: ${ashaRes.rule_trace.join(',')} (${ashaRes.urgency.toUpperCase()})`);
}

console.log('\n======================================================================');
console.log(`  WEB RESULTS:  ${totalWebPassed} PASSED | ${totalWebFailed} FAILED (Total: ${SYMPTOM_DEFINITIONS.length})`);
console.log(`  ASHA RESULTS: ${totalAshaPassed} PASSED | ${totalAshaFailed} FAILED (Total: ${SYMPTOM_DEFINITIONS.length})`);
console.log('======================================================================');

if (totalWebFailed > 0 || totalAshaFailed > 0) {
  process.exit(1);
}
