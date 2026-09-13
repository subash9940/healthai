import sys
sys.path.insert(0, ".")
from app.schemas.triage import TriageRequest, Vitals, Sex
from app.services.rules_engine import evaluate

def run(label, expected, **kwargs):
    req = TriageRequest(**kwargs)
    result = evaluate(req)
    ok = result.rule_trace[0] == expected if hasattr(result, "rule_trace") and result.rule_trace else (result["rule_id"] == expected if isinstance(result, dict) else False)
    rule_id = result.rule_trace[0] if hasattr(result, "rule_trace") and result.rule_trace else (result["rule_id"] if isinstance(result, dict) else str(result))
    urgency = result.urgency if hasattr(result, "urgency") else (result["urgency"] if isinstance(result, dict) else "")
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    print(f"    expected={expected}  got={rule_id}  urgency={urgency}")
    return ok

all_ok = True
all_ok = run("Adult, fever + malaria_test_positive", "R-MED-002",
    symptoms=["fever", "malaria_test_positive"], patient_age_years=30, patient_sex=Sex.MALE, source_tier="citizen_web") and all_ok

all_ok = run("Child, fever + malaria_test_negative", "R-LOW-002",
    symptoms=["fever", "malaria_test_negative"], patient_age_years=3, patient_sex=Sex.FEMALE, source_tier="citizen_web") and all_ok

all_ok = run("Adult, fever_with_chills only -> NVBDCP malaria MEDIUM", "R-MAL-MED-001",
    symptoms=["fever_with_chills"], patient_age_years=35, patient_sex=Sex.MALE, source_tier="citizen_web") and all_ok

all_ok = run("Adult, high_fever alone, no other symptom -> generic MEDIUM", "R-MED-FEVER-001",
    symptoms=["high_fever"], patient_age_years=40, patient_sex=Sex.MALE, source_tier="citizen_web") and all_ok

all_ok = run("Pregnant adult, plain fever only, no labour signs -> not intrapartum emergency", "R-EMG-014",
    symptoms=["fever"], patient_age_years=24, patient_sex=Sex.FEMALE, is_pregnant=True,
    vitals=Vitals(temperature_celsius=38.5), source_tier="citizen_web") and all_ok

# regression checks: make sure genuinely emergency/high cases still fire correctly
all_ok = run("REGRESSION: adult chest pain still RED", "R-ADULT-EMG-001",
    symptoms=["chest_pain"], patient_age_years=45, patient_sex=Sex.MALE, source_tier="citizen_web") and all_ok

all_ok = run("REGRESSION: fever + headache (real YELLOW criterion) still HIGH", "R-ADULT-HIGH-001",
    symptoms=["fever", "headache_or_dizziness"], patient_age_years=40, patient_sex=Sex.MALE, source_tier="citizen_web") and all_ok

all_ok = run("REGRESSION: pregnant, malpresentation still EMERGENCY", "R-EMG-008",
    symptoms=["baby_lying_sideways_malpresentation"], patient_age_years=26, patient_sex=Sex.FEMALE,
    is_pregnant=True, source_tier="asha_app") and all_ok

all_ok = run("REGRESSION: pregnant, convulsions still EMERGENCY via EMG-007", "R-EMG-007",
    symptoms=["convulsions_or_fits"], patient_age_years=26, patient_sex=Sex.FEMALE,
    is_pregnant=True, source_tier="asha_app") and all_ok

all_ok = run("REGRESSION: hyperpyrexia >=40C still EMERGENCY (malaria patch untouched)", "R-MAL-EMG-001",
    symptoms=["fever"], patient_age_years=30, patient_sex=Sex.MALE,
    vitals=Vitals(temperature_celsius=40.2), source_tier="citizen_web") and all_ok

if not all_ok:
    sys.exit(1)
print("\nALL PYTHON TESTS PASSED!")
