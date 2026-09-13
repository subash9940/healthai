import { generateProblemSummary } from './citizen_web/src/lib/problemSummary';
import { evaluateTriage } from './citizen_web/src/lib/localRulesEngine';
import { extractSymptomsFromSpeech, getSymptomName } from './citizen_web/src/lib/symptomTranslations';

console.log('=======================================================');
console.log('  TESTING NARRATIVE PROBLEM SUMMARY & MULTILINGUAL TTS');
console.log('=======================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`\x1b[32m✓\x1b[0m ${msg}`);
    passed++;
  } else {
    console.error(`\x1b[31m✗\x1b[0m FAIL: ${msg}`);
    failed++;
  }
}

// 1. Tamil Narrative & Voice Summary
console.log('1. Testing Tamil Clinical Problem Summary Generation...');
const tamilSummary = generateProblemSummary({
  language: 'ta',
  symptoms: ['high_fever_gt_104f_or_40c', 'chills_and_rigors', 'dark_or_cola_coloured_urine'],
  voiceTranscript: 'எனக்கு 3 நாட்களாக நடுக்கத்துடன் கடுமையான காய்ச்சல் உள்ளது மற்றும் சிறுநீர் கருப்பாக வருகிறது',
  patientName: 'முருகன்',
  ageYears: 35,
  sex: 'male',
  vitals: {
    temperature_f: 104.5,
    systolic_bp: 145,
    diastolic_bp: 95,
  },
});

assert(tamilSummary.includes('முருகன்'), 'Tamil summary includes patient name');
assert(tamilSummary.includes('35 வயது ஆண்'), 'Tamil summary includes age and sex');
assert(tamilSummary.includes('கடுமையான காய்ச்சல்'), 'Tamil summary includes high fever symptom label');
assert(tamilSummary.includes('உயிராதார அளவுகள்'), 'Tamil summary includes vitals section');
assert(tamilSummary.includes('104.5°F'), 'Tamil summary includes temperature');
assert(tamilSummary.includes('எச்சரிக்கை'), 'Tamil summary includes danger alert warning');

// 2. Hindi Narrative Summary
console.log('\n2. Testing Hindi Clinical Problem Summary Generation...');
const hindiSummary = generateProblemSummary({
  language: 'hi',
  symptoms: ['chest_pain', 'difficult_breathing'],
  voiceTranscript: 'सीने में बहुत तेज दर्द हो रहा है और सांस फूल रही है',
  patientName: 'राजेश',
  ageYears: 48,
  sex: 'male',
  vitals: {
    spo2_percent: 89,
  },
});

assert(hindiSummary.includes('राजेश'), 'Hindi summary includes patient name');
assert(hindiSummary.includes('48 वर्षीय पुरुष'), 'Hindi summary includes age and sex');
assert(hindiSummary.includes('सीने में तेज दर्द'), 'Hindi summary includes chest pain label');
assert(hindiSummary.includes('कम ऑक्सीजन'), 'Hindi summary includes low SpO2 warning');

// 3. Marathi Narrative Summary
console.log('\n3. Testing Marathi Clinical Problem Summary Generation...');
const marathiSummary = generateProblemSummary({
  language: 'mr',
  symptoms: ['fever_with_chills', 'vomiting'],
  voiceTranscript: 'मला दोन दिवसांपासून ताप आणि उलट्या होत आहेत',
  patientName: 'सुनीता',
  ageYears: 26,
  sex: 'female',
  isPregnant: true,
  vitals: {
    hemoglobin_g_dl: 7.2,
  },
});

assert(marathiSummary.includes('सुनीता'), 'Marathi summary includes patient name');
assert(marathiSummary.includes('गरोदर महिला'), 'Marathi summary includes pregnant female status');
assert(marathiSummary.includes('कमी हिमोग्लोबिन'), 'Marathi summary includes low hemoglobin warning');

// 4. English Narrative Summary
console.log('\n4. Testing English Clinical Problem Summary Generation...');
const enSummary = generateProblemSummary({
  language: 'en',
  symptoms: ['cough_more_than_2_weeks', 'significant_weight_loss'],
  patientName: 'David',
  ageYears: 52,
  sex: 'male',
});

assert(enSummary.includes('David (52-year-old male)'), 'English summary includes formatted demographics');
assert(enSummary.includes('Active symptoms:'), 'English summary includes active symptoms');

// 5. Dual Engine Sub-Language Output Check
console.log('\n5. Testing Sub-Language Citizen Guidance in Local Rules Engine...');
const taTriage = evaluateTriage({
  patient_age_years: 30,
  patient_sex: 'male',
  symptoms: ['high_fever_gt_104f_or_40c'],
  language: 'ta',
  source_tier: 'citizen_web',
});

assert(taTriage.urgency === 'emergency', 'Malaria hyperpyrexia evaluated as emergency');
assert(taTriage.citizen_message.includes('மருத்துவ அவசரநிலை'), 'Tamil citizen message is completely in Tamil');
assert(!taTriage.citizen_message.includes('This looks like'), 'Tamil citizen message contains zero English leakage');

const hiTriage = evaluateTriage({
  patient_age_years: 25,
  patient_sex: 'female',
  is_pregnant: true,
  symptoms: ['bleeding_from_vagina_any_amount'],
  language: 'hi',
  source_tier: 'citizen_web',
});

assert(hiTriage.urgency === 'emergency', 'Obstetric hemorrhage evaluated as emergency');
assert(hiTriage.citizen_message.includes('आपातकालीन स्थिति'), 'Hindi citizen message is completely in Hindi');
assert(!hiTriage.citizen_message.includes('Please go to'), 'Hindi citizen message contains zero English leakage');

console.log('\n=======================================================');
console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('=======================================================');

if (failed > 0) process.exit(1);
