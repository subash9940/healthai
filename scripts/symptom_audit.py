#!/usr/bin/env python3
"""
scripts/symptom_audit.py

Audit snake_case keys in app/services/rules_engine.py against
asha_app/src/constants/symptoms.ts and citizen_web/src/lib/symptomTranslations.ts.
"""

import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def run_audit():
    engine_file = BASE_DIR / "app" / "services" / "rules_engine.py"
    asha_file = BASE_DIR / "asha_app" / "src" / "constants" / "symptoms.ts"
    citizen_file = BASE_DIR / "citizen_web" / "src" / "lib" / "symptomTranslations.ts"

    with open(engine_file, "r", encoding="utf-8") as f:
        engine_text = f.read()

    with open(asha_file, "r", encoding="utf-8") as f:
        asha_text = f.read()

    with open(citizen_file, "r", encoding="utf-8") as f:
        citizen_text = f.read()

    key_pattern = r"[a-z][a-z0-9]*(?:_[a-z0-9]+)+"

    engine_keys = set(re.findall(r"[\"\x27](" + key_pattern + r")[\"\x27]", engine_text))
    asha_keys = set(re.findall(r"[\"\x27](" + key_pattern + r")[\"\x27]", asha_text))
    derived = set(re.findall(r"s\.add\([\"\x27](" + key_pattern + r")[\"\x27]\)", engine_text))

    orphans = sorted(list(engine_keys - asha_keys - derived))

    citizen_keys = set(re.findall(r"[\"\x27](" + key_pattern + r")[\"\x27]", citizen_text)) | set(
        re.findall(r"\b(" + key_pattern + r")\s*:", citizen_text)
    )
    noise_set = {
        "asha_app",
        "citizen_web",
        "district_hospital",
        "is_postpartum",
        "patient_sex",
        "referral_target",
        "symptom_duration_days",
    }

    print(f"Orphan keys count: {len(orphans)}")
    print("=" * 60)
    for o in orphans:
        marks = []
        if o in citizen_keys:
            marks.append("[CITIZEN-HAS-LABELS]")
        if o in noise_set:
            marks.append("[NOISE]")
        mark_str = " ".join(marks)
        print(f"{o} {mark_str}".rstrip())

if __name__ == "__main__":
    run_audit()
