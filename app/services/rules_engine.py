"""
rules_engine_seed.py — v7

Primary source for child (2 months - 5 years) rules:
INTEGRATED MANAGEMENT OF NEONATAL AND CHILDHOOD ILLNESS (IMNCI),
Ministry of Health & Family Welfare / National Health Mission, 2023 Module.
https://nhm.gov.in/images/pdf/programmes/child-health/guidelines/IMNCI-Module-2023-For-health-worker/IMNCI-Participants-Module-Health-Workers-2023.pdf
https://nhm.gov.in/images/pdf/programmes/child-health/guidelines/IMNCI-Module-2023-For-health-worker/IMNCI-Chart-booklet-Health-Worker-2023.pdf

Primary source for maternal rules:
ASHA Module 6: Skills that Save Lives (NHM/MoHFW)
https://nhm.gov.in/images/pdf/communitisation/asha/book-no-6.pdf
— verified by direct text-layer extraction, pp. 29-30, 32-33, 38-39.

Guidelines for Antenatal Care and Skilled Attendance at Birth by ANMs/LHVs/SNs
(MoHFW/NHM), Module I, Box 7
https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/sba_guidelines_for_skilled_attendance_at_birth.pdf
— verified by direct text-layer extraction, pp. 13-17.

NEW in v7 — primary source for the universal adult/elderly module:
Operational Guidelines for Management of Common Emergencies, Burns and
Trauma at Primary Care Level (MoHFW/NHM)
https://nhsrcindia.org/sites/default/files/2021-07/Emergency%20OGs%20at%20HWC.pdf
— verified by direct fetch of the actual PDF text (not a search snippet),
  Annexure 4 "Triage for Emergency Conditions at the Health and Wellness
  Centre", pp. 49-53. The RED "Fast Track" table, the unstable-vitals
  footnote, the YELLOW table, and the GREEN table were all read directly
  off the extracted document text before being coded below — same
  verify-then-code discipline as the maternal rules, just via web_fetch
  instead of an uploaded PDF since Muneeswaran asked me to pull it myself.

============================================================================
v7 CHANGELOG (from v6) — universal adult/elderly danger-sign module
============================================================================

  WHY: the engine only covered IMNCI child health (2mo-5yr / young infant)
  and maternal cases. A non-pregnant adult, an elderly person, or a child
  outside the IMNCI age bands had NO rules that could ever match them on
  citizen_web or ivr — every such case silently fell through to
  NO_RULE_MATCHED -> MEDIUM, regardless of whether they were healthy or
  having a heart attack. That's an honest fallback (feature, not bug) but
  it made the platform practically unusable for most of the population it
  claims to serve.

  ADDED — is_outside_imnci_child_bands(r): age > 5 years. This is the
  gating condition for every new rule below, so the new module can never
  collide with or override the existing, already-verified pediatric rules.
  (IMNCI's young-infant/child charts already cover 0-5 years; this module
  intentionally does NOT try to also cover children 5mo-5yr with adult
  vital-sign cutoffs, since IMNCI's own age-specific cutoffs are safer and
  already implemented.)

  ADDED — has_unstable_adult_vitals(r): computed DIRECTLY from
  vitals.respiratory_rate, vitals.spo2_percent, vitals.systolic_bp,
  vitals.diastolic_bp, per Annexure 4's own "*Unstable vital signs"
  footnote (p. 51):
      RR < 10 or > 24/min
      SpO2 < 92%
      Systolic BP < 90 or > 180 mmHg
      Diastolic BP > 120 mmHg
  NOTE: the footnote ALSO includes "Pulse Rate <60 or >100/min" and
  "Unresponsive or Responding to pain only (AVPU)". Your locked Vitals
  schema (as of v6) has no pulse_rate or avpu_level field, so those two
  conditions are NOT evaluated here — has_unstable_adult_vitals() reads
  ONLY the four fields that already exist on your schema. This is the
  same "absent data -> False, never invent a positive" discipline as
  has_fast_breathing(). If you add pulse_rate/avpu_level to Vitals later,
  extend this function — don't leave two of six documented RED criteria
  silently unchecked without at least a comment flagging the gap (which
  this comment now does).

  ADDED (EMERGENCY / RED tier, Annexure 4 p.51 "Fast Track" + trauma
  columns) — symptom-key rules, each restricted to
  is_outside_imnci_child_bands(r):
    - R-ADULT-EMG-001: FAST-track medical red flags (chest pain, altered
      sensorium, stroke/FAST signs, unstable-vitals poisoning, active
      seizure, fainting/syncope history, high-grade fever with altered
      mental status, hanging/near-drowning/electrocution/heat stroke,
      snake/scorpion bite, abnormal PV bleeding, bleeding in
      vomitus/cough/urine/nose, pallor with breathlessness or foot
      swelling).
    - R-ADULT-EMG-002: major burns — >20% BSA in adults (age>5 per this
      module's gate; note the source's own pediatric cutoff is >10% BSA,
      already exclusively handled by the child module's age band, so no
      double-counting), or a burn to a special area (hands, face,
      perineum, airway/inhalation injury) at ANY age within this module's
      gate.
    - R-ADULT-EMG-003: RED-tier trauma (penetrating injury, limb injury
      with absent distal pulse, fracture with exposed bone, 2+ long-bone
      fractures, abnormal chest wall movement on breathing, subcutaneous
      crackles/seatbelt-sign, suspected neck injury, multiple injuries,
      suspected sexual assault, noisy breathing/stridor).
    - R-ADULT-EMG-004: has_unstable_adult_vitals(r) alone, even with no
      symptom reported — per the source, abnormal vitals alone define RED
      regardless of presenting complaint.

  ADDED (HIGH / YELLOW tier, Annexure 4 p.52):
    - R-ADULT-HIGH-001: YELLOW-tier medical (post-seizure, abdominal
      pain/loose motions >3 episodes, fever with headache/chest
      pain/jaundice, fever in a chemo/HIV/diabetic patient, drug overdose
      or poisoning WITH stable vitals, headache/dizziness, unable to pass
      stool or urine, painful PR bleeding, painful swelling/wound, pallor
      or known anaemia needing transfusion) AND NOT already RED (i.e. not
      matching unstable vitals — first-match-wins already guarantees this
      since EMERGENCY rules are checked first, so no extra guard needed
      here, consistent with how R-HIGH-004 handles this for children).
    - R-ADULT-HIGH-002: YELLOW-tier trauma (hand/foot fracture, isolated
      long-bone fracture, minor head injury, suspected spine injury,
      pregnancy with injury — this last one uses the EXISTING is_pregnant
      field, so a pregnant adult with injury symptoms gets this rule
      rather than falling through, without touching any maternal rule).

  ADDED (LOW / GREEN tier, Annexure 4 p.53):
    - R-ADULT-LOW-001: GREEN-tier presentations (fever <101°F i.e.
      <38.3°C computed directly from vitals.temperature_celsius when
      present, OR the pre-existing symptom key for callers that only send
      a category; minor symptoms of existing illness; low-risk cough/cold;
      simple skin rash; fresh scratches/wounds) provided
      has_unstable_adult_vitals(r) is False and no RED/YELLOW symptom key
      is also present — mirrors the defense-in-depth pattern used in
      R-LOW-001 for the pediatric cough rule.

  ON ELDERLY (Muneeswaran's question this session): deliberately did NOT
  add a separate "elderly" rule set or a blanket "lower the bar for
  everyone over 60" adjustment — that would be inventing a threshold not
  in any source document, which is exactly what this whole methodology is
  built to avoid. What the guideline DOES explicitly and verifiably say
  (p.46, Annexure 1's burn referral list) is that persons "above 60 years"
  are named, by age, in the same priority-referral bracket as pregnant
  women and people with pre-existing cardiovascular/diabetic/renal
  disease — for BURNS specifically. That's coded as part of
  R-ADULT-EMG-002's burn-percentage logic below: an elderly patient with
  a burn is NOT held to the same 20%-BSA bar as a younger adult, because
  the source itself doesn't hold them to it. For every other adult
  condition in this module, an elderly patient is evaluated by the same
  RED/YELLOW/GREEN criteria as any other adult, because that's what
  Annexure 4 actually says — I have not found a source-backed general
  "elders under-report, so relax the threshold" rule, and won't code one
  from clinical intuition alone. If you have a specific NHM elderly-care
  guideline with its own numeric criteria, send it and I'll do the same
  verify-then-code pass on it as its own module, same as this one.

  NOT changed this pass: all v6 pediatric and maternal rules are
  untouched. Rule order: EMERGENCY rules still checked first as a single
  flat list — the four new R-ADULT-EMG-* rules are inserted after
  R-EMG-015 and before the HIGH tier begins, so first-match-wins semantics
  are preserved exactly as before.

  MENTAL HEALTH: intentionally out of scope for this pass. Per the
  project's own scoping note, mental health should be narrow
  escalation-only (explicit red flags -> human review, never a severity
  score from vague input) and sourced from the separate NHM Mental,
  Neurological & Substance Use Disorders HWC guideline — that's a
  different document requiring its own verify-then-code pass, not
  something to bolt onto this Emergencies/Burns/Trauma module.
============================================================================

[... v6 changelog and earlier history retained in your existing file ...]

Rules are checked in order; the FIRST match wins. Emergency/danger-sign
rules must always come first.
"""

from app.schemas.triage import TriageRequest, TriageResponse, Urgency, Sex


# ============================================================================
# Shared constants — single source of truth, referenced by multiple rules.
# ============================================================================

GENERAL_DANGER_SIGNS = [
    "not_able_to_drink_or_feed",
    "vomits_everything",
    "convulsions",
    "lethargic_or_unconscious",
]

DAYS_PER_YEAR = 365.25


def age_in_days(r: TriageRequest) -> float:
    return r.patient_age_years * DAYS_PER_YEAR


def is_young_infant(r: TriageRequest) -> bool:
    return age_in_days(r) < 60


def is_child_2mo_to_5yr(r: TriageRequest) -> bool:
    days = age_in_days(r)
    return 60 <= days <= 5 * DAYS_PER_YEAR


def has_fast_breathing(r: TriageRequest) -> bool:
    if not r.vitals or r.vitals.respiratory_rate is None:
        return False
    rr = r.vitals.respiratory_rate
    days = age_in_days(r)
    if days < 60:
        return rr >= 60
    elif days <= 365:
        return rr >= 50
    else:
        return rr >= 40


def has_high_bp(r: TriageRequest) -> bool:
    if (
        r.vitals
        and r.vitals.systolic_bp is not None
        and r.vitals.diastolic_bp is not None
        and (r.vitals.systolic_bp >= 140 or r.vitals.diastolic_bp >= 90)
    ):
        return True
    return "high_bp_gt_140_90_with_or_without_proteinuria" in r.symptoms


# ============================================================================
# NEW v7 — universal adult/elderly module helpers
# Source: Annexure 4, "Triage for Emergency Conditions at the Health and
# Wellness Centre", Common Emergencies/Burns/Trauma OGs, pp. 49-53.
# ============================================================================

IMNCI_CHILD_UPPER_AGE_YEARS = 5


def is_child_5_to_9yr(r: TriageRequest) -> bool:
    return 5.0 < r.patient_age_years < 10.0


def is_adolescent_10_to_19yr(r: TriageRequest) -> bool:
    return 10.0 <= r.patient_age_years <= 19.0


def is_outside_imnci_child_bands(r: TriageRequest) -> bool:
    """True for anyone the existing IMNCI pediatric rules do NOT cover —
    i.e. older children, adolescents, adults, and the elderly. Gate every
    rule in this module with this so it can never collide with or
    override the already-verified pediatric rules above."""
    return r.patient_age_years > IMNCI_CHILD_UPPER_AGE_YEARS


def has_unstable_adult_vitals(r: TriageRequest) -> bool:
    """Annexure 4 p.51 unstable-vitals footnote, evaluated on the five
    vitals fields that exist on triage_contract.py v2
    (respiratory_rate, spo2_percent, systolic_bp, diastolic_bp,
    pulse_bpm — CORRECTED from an earlier draft of this comment, which
    wrongly said pulse wasn't on the schema; it is, as pulse_bpm).

    STILL NOT evaluated here (schema genuinely has no field for it):
      - Unresponsive or Responding to pain only (AVPU)
    If an avpu_level field is added to Vitals, extend this function.
    Absent data returns False for that specific criterion — never invent
    a positive from a field that wasn't submitted."""
    v = r.vitals
    if not v:
        return False

    if v.respiratory_rate is not None and (v.respiratory_rate < 10 or v.respiratory_rate > 24):
        return True
    if v.spo2_percent is not None and v.spo2_percent < 92:
        return True
    if v.systolic_bp is not None and (v.systolic_bp < 90 or v.systolic_bp > 180):
        return True
    if v.diastolic_bp is not None and v.diastolic_bp > 120:
        return True
    if v.pulse_bpm is not None and (v.pulse_bpm < 60 or v.pulse_bpm > 100):
        return True
    return False


ADULT_RED_FAST_TRACK_SYMPTOMS = [
    "chest_pain",
    "severe_chest_pain_radiating_to_arm_or_jaw",
    "altered_sensorium",
    "stroke_fast_signs",
    "sudden_weakness_face_arm_speech_slurred",
    "suspected_poisoning_with_unstable_vitals",
    "active_seizure",
    "history_of_fainting_or_syncope",
    "high_grade_fever_with_altered_mental_status",
    "hanging_or_near_drowning_or_electrocution_or_heat_stroke",
    "snake_or_scorpion_bite",
    "abnormal_bleeding_per_vagina",
    "ongoing_bleeding_vomitus_cough_urine_or_nose",
    "pallor_with_breathlessness_or_foot_swelling",
    "severe_allergic_reaction_lip_throat_swelling",
    "severe_breathlessness",
    "burn_special_area_hands_face_perineum_or_airway",
    "heavy_bleeding_postpartum",
    "eclampsia_seizures",
]

ADULT_RED_TRAUMA_SYMPTOMS = [
    "stab_or_penetrating_injury",
    "limb_injury_with_absent_distal_pulse",
    "fracture_with_exposed_bone",
    "two_or_more_long_bone_fractures",
    "abnormal_chest_wall_movement_on_breathing",
    "subcutaneous_crackles_or_seatbelt_mark",
    "suspected_neck_injury",
    "multiple_injuries",
    "suspected_sexual_assault",
    "noisy_breathing_or_stridor",
    "uncontrolled_bleeding_or_deep_wound",
]

ADULT_YELLOW_MEDICAL_SYMPTOMS = [
    "post_seizure_stage",
    "abdominal_pain_or_loose_motions_gt_3_episodes",
    "fever_with_headache_or_chest_pain_or_jaundice",
    "fever_in_chemo_or_hiv_or_diabetic_patient",
    "drug_overdose_or_poisoning_with_stable_vitals",
    "unable_to_pass_stool",
    "unable_to_pass_urine",
    "painful_bleeding_per_rectum",
    "painful_swelling_or_wound",
    "pallor_or_known_anaemia_needing_transfusion",
    "breathlessness",
    "persistent_vomiting",
    "restlessness_or_sudden_behavioral_change",
    "not_able_to_drink_or_feed",
]

ADULT_YELLOW_TRAUMA_SYMPTOMS = [
    "fracture_of_hand_or_feet",
    "isolated_long_bone_fracture",
    "minor_head_injury",
    "suspected_spine_injury",
]

ADULT_GREEN_SYMPTOMS = [
    "minor_symptoms_of_existing_illness",
    "low_risk_cough_or_cold",
    "simple_skin_rash",
    "fresh_scratches_or_wounds",
    "fever_under_101f",  # fallback key for callers that only send a category
    "cough",
    "headache",
    "dizziness",
    "fatigue",
    "body_pain_weakness",
]


def has_low_fever_under_101f(r: TriageRequest) -> bool:
    """101F = 38.3C. Computed directly from vitals when available (same
    pattern as R-EMG-014's >38C check), falling back to the symptom key
    for callers that only send a precomputed category."""
    if r.vitals and r.vitals.temperature_celsius is not None:
        return r.vitals.temperature_celsius < 38.3
    return "fever_under_101f" in r.symptoms


def has_major_adult_burn(r: TriageRequest) -> bool:
    """>20% BSA in adults per Annexure 4 p.51. Elderly patients (>60 yr)
    are NOT held to this 20% bar — Annexure 1 (p.46) names persons above
    60 years, alongside pregnant women and those with cardiovascular/
    diabetic/renal disease, as needing priority referral for burns
    regardless of size. This is the one place in this module where age
    genuinely changes the threshold, because the source document itself
    says so — not a general "elders get a lower bar for everything"
    rule."""
    if "burn_special_area_hands_face_perineum_or_airway" in r.symptoms:
        return True  # special-area burns are RED at any %BSA, any age
    if r.patient_age_years > 60 and "burn_present" in r.symptoms:
        return True
    if "burn_percent_bsa_gt_20" in r.symptoms:
        return True
    return False


def build_fever_action(r: TriageRequest) -> str:
    """Duration-staged guidance per ICMR Treatment Guidelines for
    Antimicrobial Use in Common Syndromes 2019, Chapter 2, p.9
    ('Protocol for the management of adult patients with acute
    undifferentiated fever'). This maps ONLY to what investigations the
    guideline says become appropriate at each stage -- it does NOT
    change urgency tier, because the source does not state that fever
    duration changes referral urgency, only what workup is appropriate.
    Urgency for this rule stays MEDIUM regardless of duration; only the
    recommended_action text changes."""
    base = (
        "Acute febrile illness per ICMR Treatment Guidelines (Ch.2, "
        "Management of Acute Fever). Administer paracetamol, provide "
        "plenty of fluids."
    )
    days = getattr(r, "symptom_duration_days", None)
    if days is None:
        return base + (
            " Duration not reported -- visit PHC for diagnostic "
            "evaluation (blood smear/RDT)."
        )
    if days <= 2:
        return base + (
            " Day 1-2 of fever: per ICMR protocol, no investigations "
            "are required yet unless danger signs appear -- monitor "
            "at home and recheck if fever continues."
        )
    if days <= 4:
        return base + (
            " Day 3-4 of fever: per ICMR protocol, visit PHC for "
            "blood count and malaria smear/RDT (dengue test if "
            "suspected)."
        )
    if days <= 7:
        return base + (
            " Fever more than 5 days: per ICMR protocol, visit "
            "PHC/CHC for blood cultures in addition to malaria/dengue "
            "testing, and chikungunya/scrub typhus/leptospirosis "
            "testing if suspected in your area."
        )
    return base + (
        " Fever more than 7 days: per ICMR protocol, visit PHC/CHC "
        "for the above plus chest X-ray and abdominal ultrasound to "
        "look for a hidden source."
    )


RULES = [
    # =====================================================================
    # EMERGENCY TIER
    # =====================================================================

    {
        "id": "R-EMG-001",
        "source": "NHM IMNCI 2023 Module, Sec 5.1 — General Danger Signs",
        "condition": lambda r: (
            is_child_2mo_to_5yr(r)
            and any(s in r.symptoms for s in GENERAL_DANGER_SIGNS)
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "General danger sign present (IMNCI). Complete assessment and give any pre-referral treatment immediately — refer URGENTLY to hospital.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-002",
        "source": "NHM IMNCI 2023 Module — Severe Pneumonia / Very Severe Disease",
        "condition": lambda r: (
            "breathlessness" in r.symptoms or "difficult_breathing" in r.symptoms
        ) and (
            "chest_indrawing" in r.symptoms
            or (r.vitals and r.vitals.spo2_percent is not None and r.vitals.spo2_percent < 90)
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Chest indrawing or SpO2 < 90% with breathing difficulty — classify as Severe Pneumonia/Very Severe Disease per IMNCI. Refer urgently.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-003",
        "source": "NHM IMNCI 2023 Chart Booklet — Severe Dehydration (child)",
        "condition": lambda r: (
            is_child_2mo_to_5yr(r)
            and sum(s in r.symptoms for s in [
                "lethargic_or_unconscious",
                "sunken_eyes",
                "not_able_to_drink_or_drinking_poorly",
                "skin_pinch_goes_back_very_slowly",
            ]) >= 2
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "SEVERE DEHYDRATION (2+ signs) per IMNCI. Refer urgently. Give ORS sips en route if able to drink — do not delay referral to attempt rehydration at home.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-004",
        "source": "NHM IMNCI 2023 Module — Severe Dehydration (young infant)",
        "condition": lambda r: (
            is_young_infant(r)
            and sum(s in r.symptoms for s in [
                "movement_only_when_stimulated_or_none",
                "sunken_eyes",
                "skin_pinch_goes_back_very_slowly",
            ]) >= 2
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "SEVERE DEHYDRATION (young infant, 2+ signs) per IMNCI. Refer urgently.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-005",
        "source": "NHM IMNCI 2023 Chart Booklet — Very Severe Febrile Disease",
        "condition": lambda r: (
            "fever" in r.symptoms
            and any(s in r.symptoms for s in GENERAL_DANGER_SIGNS + ["stiff_neck"])
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "VERY SEVERE FEBRILE DISEASE (danger sign or stiff neck + fever) per IMNCI. Give first dose of appropriate antimalarial and antibiotic before urgent referral.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-006",
        "source": "NHM IMNCI 2023 Chart Booklet — Mastoiditis",
        "condition": lambda r: "tender_swelling_behind_ear" in r.symptoms,
        "urgency": Urgency.EMERGENCY,
        "action": "MASTOIDITIS per IMNCI. Give first dose of antibiotic and paracetamol for pain before urgent referral.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-007",
        "source": "ASHA Module 6 (NHM/MoHFW), Part B Sec 4 — Pregnancy Danger Signs",
        "condition": lambda r: (
            r.is_pregnant is True
            and any(s in r.symptoms for s in [
                "bleeding_from_vagina_any_amount",
                "loss_of_foetal_movement_or_severe_abdominal_pain",
                "severe_headache_with_blurred_vision_or_spots",
                "swollen_face_or_hands_pitting_oedema",
                "convulsions_or_fits",
            ])
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Antenatal danger sign per ASHA Module 6 — facilitate IMMEDIATE referral to a facility equipped for obstetric complications (surgery/blood transfusion capability).",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-008",
        "source": "ASHA Module 6 (NHM/MoHFW), Part B Sec 4 — Labour & Delivery Danger Signs",
        # NARROWED: removed bare "fever" and "fits" from this list. The schema
        # has no in_labour field, so is_pregnant=True alone can't distinguish
        # "16 weeks pregnant with a viral fever" from "in active labour" --
        # every pregnant citizen reporting plain fever was being classified as
        # an intrapartum emergency. Fever during pregnancy is already handled
        # correctly by R-EMG-014 (measured temp >38C, EMERGENCY) and
        # R-MED-FEVER-001 (general fever, MEDIUM) with proper thresholds.
        # "fits"/convulsions during pregnancy is already covered by R-EMG-007
        # ("convulsions_or_fits") and R-EMG-010 (postpartum). The remaining
        # symptom keys below (malpresentation, ROM, prolonged pushing, retained
        # placenta, fresh bleeding, facial/hand swelling) are genuinely
        # labour/delivery-specific and safe to keep gated on is_pregnant alone.
        # TODO: add an in_labour field to TriageRequest so this rule can be
        # gated properly instead of relying on symptom-list narrowing -- flag
        # for a future schema version, not a same-day fix.
        "condition": lambda r: any(s in r.symptoms for s in [
            "bleeding_fresh_blood",
            "swollen_face_or_hands",
            "baby_lying_sideways_malpresentation",
            "water_broke_no_labour_within_24h",
            "liquor_colour_green_or_brown",
            "prolonged_labour_pushing_gt_12h_or_gt_8h_multipara",
            "retained_placenta",
        ]) and (r.is_pregnant is True),
        "urgency": Urgency.EMERGENCY,
        "action": "Intrapartum danger sign per ASHA Module 6 — shift mother immediately to a facility able to manage obstetric emergencies.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-009",
        "source": "ASHA Module 6 (NHM/MoHFW), Part B Sec 6 — Postpartum Excessive Bleeding",
        "condition": lambda r: (
            getattr(r, "is_postpartum", False) is True
            and "more_than_5_pads_per_day_or_1_thick_cloth_per_day" in r.symptoms
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "POSTPARTUM HAEMORRHAGE — most urgent per ASHA Module 6. Refer immediately; advise mother to begin breastfeeding immediately while arranging transport (helps reduce bleeding). Even a few minutes' delay can matter.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-010",
        "source": "ASHA Module 6 (NHM/MoHFW), Part B Sec 6 — Postpartum Convulsions",
        "condition": lambda r: (
            getattr(r, "is_postpartum", False) is True
            and any(s in r.symptoms for s in [
                "convulsions", "fits",
                "swelling_face_or_hands",
                "severe_headache",
                "blurred_vision",
            ])
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Postpartum convulsions / pre-eclampsia sign per ASHA Module 6. Immediate referral — if ANM reachable within 15 minutes, she may stabilise before referral.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-011",
        "source": "SBA Guidelines (MoHFW/NHM), Module I Box 7 — FRU-tier danger signs",
        "condition": lambda r: (
            r.is_pregnant is True
            and any(s in r.symptoms for s in [
                "malpresentation",
                "multiple_pregnancy",
                "bleeding_pad_soaked_lt_5_min",
                "haemoglobin_lt_7",
                "convulsions_or_loss_of_consciousness",
                "decreased_or_absent_foetal_movements",
                "severe_headache_with_blurred_vision_or_spots",
            ])
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Refer to FRU (First Referral Unit) — facility with blood transfusion and surgical capability, per SBA Guidelines Box 7.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-013",
        "source": "SBA Guidelines (MoHFW/NHM), Module I Box 7 — Premature Rupture of Membranes",
        "condition": lambda r: (
            r.is_pregnant is True
            and "premature_rupture_of_membranes_before_37_weeks" in r.symptoms
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Premature Rupture of Membranes before 37 weeks — Visit FRU per SBA Guidelines Box 7. Refer immediately.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-014",
        "source": "SBA Guidelines (MoHFW/NHM), Module I Box 7 — Temperature more than 38°C",
        "condition": lambda r: (
            r.is_pregnant is True
            and r.vitals and r.vitals.temperature_celsius is not None
            and r.vitals.temperature_celsius > 38.0
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Temperature above 38°C during pregnancy/labour — Visit FRU per SBA Guidelines Box 7. Refer immediately.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-015",
        "source": "SBA Guidelines (MoHFW/NHM), Module I Box 7 — Ruptured membranes for more than 18 hours",
        "condition": lambda r: (
            r.is_pregnant is True
            and "ruptured_membranes_more_than_18h" in r.symptoms
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Ruptured membranes for more than 18 hours — Visit FRU per SBA Guidelines Box 7. Refer immediately (higher infection risk than the 24h no-labour-onset threshold).",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-EMG-012",
        "source": "NHM IMNCI 2023 Module — Young Infant: fast breathing (>=60/min) treated as severe",
        "condition": lambda r: is_young_infant(r) and has_fast_breathing(r),
        "urgency": Urgency.EMERGENCY,
        "action": "Young infant (<2 months) with fast breathing (RR>=60/min) — classify as Severe Pneumonia or Very Severe Disease per IMNCI. Give first dose of antibiotic, keep warm, refer urgently.",
        "referral_target": "district_hospital",
    },

    # --- NEW v7: Universal adult/elderly RED tier (Annexure 4, p.51) ---
    {
        "id": "R-ADULT-EMG-001",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.51 — Fast Track / RED medical",
        "condition": lambda r: (
            is_outside_imnci_child_bands(r)
            and any(s in r.symptoms for s in ADULT_RED_FAST_TRACK_SYMPTOMS)
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "RED / Fast Track per Annexure 4. Do urgent resuscitation and basic management, refer to higher centre at the earliest — highest priority.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-ADULT-EMG-002",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.51 + Annexure 1 p.46 — Major burns",
        "condition": lambda r: is_outside_imnci_child_bands(r) and has_major_adult_burn(r),
        "urgency": Urgency.EMERGENCY,
        "action": "RED — major burn (>20% BSA, special area, or age >60y) per Annexure 4/Annexure 1. Do not remove anything stuck to the skin. Refer to higher centre urgently.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-ADULT-EMG-003",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.51 — RED trauma",
        "condition": lambda r: (
            is_outside_imnci_child_bands(r)
            and any(s in r.symptoms for s in ADULT_RED_TRAUMA_SYMPTOMS)
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "RED trauma per Annexure 4. Control bleeding, immobilise as appropriate, refer to higher centre at the earliest.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-ADULT-EMG-004",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.51 — Unstable vitals",
        "condition": lambda r: is_outside_imnci_child_bands(r) and has_unstable_adult_vitals(r),
        "urgency": Urgency.EMERGENCY,
        "action": "RED — unstable vital signs per Annexure 4, regardless of presenting complaint. Secure IV line, start oxygen, monitor vitals, refer urgently.",
        "referral_target": "district_hospital",
    },

    # --- v8: Malaria (NVBDCP 2009/2013) EMERGENCY ---
    {
        "id": "R-MAL-EMG-001",
        "source": "NVBDCP 2009 / Guidelines for Diagnosis and Management of Malaria 2013 — Hyperpyrexia",
        "condition": lambda r: (
            "high_fever_gt_104f_or_40c" in r.symptoms
            or (
                ("fever" in r.symptoms or "high_fever" in r.symptoms)
                and r.vitals is not None
                and r.vitals.temperature_celsius is not None
                and r.vitals.temperature_celsius >= 40.0
            )
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Hyperpyrexia (temp ≥ 40°C / 104°F) — severe malaria danger sign per NVBDCP. Cold sponging, give paracetamol, urgent referral to CHC/District Hospital for parenteral therapy and RDT/microscopy.",
        "referral_target": "district_hospital",
    },
    {
        "id": "R-MAL-EMG-002",
        "source": "NVBDCP 2009 / Guidelines for Diagnosis and Management of Malaria 2013 — Haemoglobinuria",
        "condition": lambda r: "dark_or_cola_coloured_urine" in r.symptoms,
        "urgency": Urgency.EMERGENCY,
        "action": "Dark/cola-coloured urine (haemoglobinuria / blackwater fever) — severe malaria manifestation per NVBDCP. High risk of acute renal failure. Refer immediately to District Hospital.",
        "referral_target": "district_hospital",
    },

    # --- v11: Anemia Mukt Bharat EMERGENCY ---
    {
        "id": "R-ANE-EMG-001",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW), Table 2.1 — Severe Anemia in Pregnancy",
        "condition": lambda r: (
            r.is_pregnant is True
            and r.vitals is not None
            and r.vitals.hemoglobin_g_dl is not None
            and r.vitals.hemoglobin_g_dl < 5.0
        ),
        "urgency": Urgency.EMERGENCY,
        "action": "Severe anaemia in pregnancy (Hb < 5.0 g/dL) per Anemia Mukt Bharat. High risk of congestive heart failure. Refer urgently to District Hospital/FRU for blood transfusion and parenteral therapy.",
        "referral_target": "district_hospital",
    },

    # =====================================================================
    # HIGH TIER
    # =====================================================================

    {
        "id": "R-HIGH-001",
        "source": "NHM IMNCI 2023 Chart Booklet — Possible Serious Bacterial Infection",
        "condition": lambda r: (
            is_young_infant(r)
            and r.vitals and r.vitals.temperature_celsius is not None
            and r.vitals.temperature_celsius >= 37.5
        ),
        "urgency": Urgency.HIGH,
        "action": "Young infant (<2 months) with axillary temperature ≥37.5°C — possible serious bacterial infection per IMNCI. Refer urgently to hospital.",
        "referral_target": "chc",
    },
    {
        "id": "R-HIGH-002",
        "source": "SBA Guidelines (MoHFW/NHM), Module I Box 7 — 24-hour-PHC-tier danger signs",
        "condition": lambda r: (
            r.is_pregnant is True
            and (
                has_high_bp(r)
                or any(s in r.symptoms for s in [
                    "high_fever_with_or_without_abdominal_pain_too_weak_to_get_out_of_bed",
                    "fast_or_difficult_breathing",
                    "haemoglobin_7_to_11_despite_30_days_ifa",
                    "excessive_vomiting_unable_to_take_orally",
                    "breathlessness_at_rest",
                    "reduced_urinary_output_with_high_bp",
                ])
            )
        ),
        "urgency": Urgency.HIGH,
        "action": "Refer to nearest 24-hour PHC with emergency obstetric care, per SBA Guidelines Box 7.",
        "referral_target": "phc",
    },
    {
        "id": "R-HIGH-003",
        "source": "ASHA Module 6 (NHM/MoHFW), Part B Sec 6 — Puerperal Sepsis",
        "condition": lambda r: (
            getattr(r, "is_postpartum", False) is True
            and "foul_smelling_discharge" in r.symptoms
        ),
        "urgency": Urgency.HIGH,
        "action": "Suspected puerperal sepsis per ASHA Module 6. Measure temperature to confirm fever. Refer same day — mother needs antibiotics.",
        "referral_target": "chc",
    },
    {
        "id": "R-HIGH-004",
        "source": "NHM IMNCI 2023 Chart Booklet — Pneumonia (fast breathing, no danger sign)",
        "condition": lambda r: (
            is_child_2mo_to_5yr(r)
            and has_fast_breathing(r)
            and "chest_indrawing" not in r.symptoms
            and not any(s in r.symptoms for s in GENERAL_DANGER_SIGNS)
            and not (r.vitals and r.vitals.spo2_percent is not None and r.vitals.spo2_percent < 90)
        ),
        "urgency": Urgency.HIGH,
        "action": "PNEUMONIA (fast breathing, no danger sign) per IMNCI. Give first dose of oral antibiotic, advise home care and soothe throat/cough remedy, follow up in 2 days or sooner if worsening.",
        "referral_target": "phc",
    },
    {
        "id": "R-HIGH-005",
        "source": "SBA Guidelines (MoHFW/NHM), Module I Box 7 — Continuous severe abdominal pain",
        "condition": lambda r: (
            r.is_pregnant is True
            and "continuous_severe_abdominal_pain" in r.symptoms
        ),
        "urgency": Urgency.HIGH,
        "action": "Continuous severe abdominal pain during pregnancy — Visit 24-hour PHC per SBA Guidelines Box 7.",
        "referral_target": "phc",
    },

    # --- NEW v7: Universal adult/elderly YELLOW tier (Annexure 4, p.52) ---
    {
        "id": "R-ADULT-HIGH-001",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.52 — YELLOW medical",
        "condition": lambda r: (
            is_outside_imnci_child_bands(r)
            and any(s in r.symptoms for s in ADULT_YELLOW_MEDICAL_SYMPTOMS)
        ),
        "urgency": Urgency.HIGH,
        "action": "YELLOW per Annexure 4 — do not let the patient deteriorate, resuscitate appropriately, plan timely referral if required.",
        "referral_target": "phc",
    },
    {
        "id": "R-ADULT-HIGH-002",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.52 — YELLOW trauma",
        "condition": lambda r: (
            is_outside_imnci_child_bands(r)
            and (
                any(s in r.symptoms for s in ADULT_YELLOW_TRAUMA_SYMPTOMS)
                or (r.is_pregnant is True and "injury" in r.symptoms)
            )
        ),
        "urgency": Urgency.HIGH,
        "action": "YELLOW trauma per Annexure 4 — stabilise, monitor, refer to higher centre if required.",
        "referral_target": "phc",
    },

    # --- v9: Dengue (NCVBDC 2023) HIGH ---
    {
        "id": "R-DEN-HIGH-001",
        "source": "NCVBDC Guidelines for Clinical Management of Dengue Fever 2023, Section 4.2 — Warning Signs",
        "condition": lambda r: (
            ("fever" in r.symptoms or "high_fever" in r.symptoms)
            and any(s in r.symptoms for s in [
                "persistent_vomiting",
                "persistent_or_severe_abdominal_pain_or_tenderness",
                "restlessness_or_sudden_behavioral_change",
                "abdominal_distension_or_swelling",
            ])
        ),
        "urgency": Urgency.HIGH,
        "action": "Fever with Dengue Warning Signs per NCVBDC 2023. Risk of severe dengue / plasma leakage. Refer to CHC/PHC for haematocrit and platelet monitoring and IV fluid therapy.",
        "referral_target": "chc",
    },

    # --- v11: Anemia Mukt Bharat HIGH (Severe Anemia by population band) ---
    {
        "id": "R-ANE-HIGH-001",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW), Table 2.1 — Severe Anemia in Pregnancy",
        "condition": lambda r: (
            r.is_pregnant is True
            and r.vitals is not None
            and r.vitals.hemoglobin_g_dl is not None
            and 5.0 <= r.vitals.hemoglobin_g_dl < 7.0
        ),
        "urgency": Urgency.HIGH,
        "action": "Severe anaemia in pregnancy (Hb 5.0–6.9 g/dL) per Anemia Mukt Bharat. Refer to CHC/FRU for parenteral iron therapy / blood arrangement.",
        "referral_target": "chc",
    },
    {
        "id": "R-ANE-HIGH-002",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW), Table 2.1 — Severe Anemia in Children 6-59m",
        "condition": lambda r: (
            is_child_2mo_to_5yr(r)
            and r.vitals is not None
            and r.vitals.hemoglobin_g_dl is not None
            and r.vitals.hemoglobin_g_dl < 7.0
        ),
        "urgency": Urgency.HIGH,
        "action": "Severe anaemia in child 6–59 months (Hb < 7.0 g/dL) per Anemia Mukt Bharat. Refer to PHC/CHC for clinical evaluation and therapeutic iron supplementation.",
        "referral_target": "phc",
    },
    {
        "id": "R-ANE-HIGH-003",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW), Table 2.1 — Severe Anemia in Children 5-9y",
        "condition": lambda r: (
            is_child_5_to_9yr(r)
            and r.vitals is not None
            and r.vitals.hemoglobin_g_dl is not None
            and r.vitals.hemoglobin_g_dl < 8.0
        ),
        "urgency": Urgency.HIGH,
        "action": "Severe anaemia in child 5–9 years (Hb < 8.0 g/dL) per Anemia Mukt Bharat. Refer to PHC for therapeutic IFA supplementation and investigation.",
        "referral_target": "phc",
    },
    {
        "id": "R-ANE-HIGH-004",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW), Table 2.1 — Severe Anemia in Adolescents 10-19y",
        "condition": lambda r: (
            is_adolescent_10_to_19yr(r)
            and r.vitals is not None
            and r.vitals.hemoglobin_g_dl is not None
            and r.vitals.hemoglobin_g_dl < 8.0
        ),
        "urgency": Urgency.HIGH,
        "action": "Severe anaemia in adolescent 10–19 years (Hb < 8.0 g/dL) per Anemia Mukt Bharat. Refer to PHC for clinical workup and weekly IFA + deworming.",
        "referral_target": "phc",
    },
    {
        "id": "R-ANE-HIGH-005",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW), Table 2.1 — Severe Anemia in Non-Pregnant Women",
        "condition": lambda r: (
            (r.patient_sex == Sex.FEMALE or getattr(r, "patient_sex", None) == "female")
            and r.patient_age_years >= 15.0
            and r.is_pregnant is not True
            and r.vitals is not None
            and r.vitals.hemoglobin_g_dl is not None
            and r.vitals.hemoglobin_g_dl < 8.0
        ),
        "urgency": Urgency.HIGH,
        "action": "Severe anaemia in woman of reproductive age (Hb < 8.0 g/dL) per Anemia Mukt Bharat. Refer to PHC for evaluation and therapeutic iron administration.",
        "referral_target": "phc",
    },

    # =====================================================================
    # MEDIUM TIER
    # =====================================================================

    # --- v8: Malaria (NVBDCP 2009/2013) MEDIUM ---
    {
        "id": "R-MAL-MED-001",
        "source": "NVBDCP 2009 / Guidelines for Diagnosis and Management of Malaria 2013 — Fever with Chills/Rigors",
        "condition": lambda r: (
            ("fever" in r.symptoms or "high_fever" in r.symptoms)
            and ("chills_and_rigors" in r.symptoms or "fever_with_chills" in r.symptoms)
        ),
        "urgency": Urgency.MEDIUM,
        "action": "Fever with chills and rigors — suspected uncomplicated malaria per NVBDCP. Perform RDT / prepare blood smear, manage with antipyretic, refer to PHC/Health Sub-Centre for diagnosis and species-specific treatment.",
        "referral_target": "phc",
    },

    # --- v10: TB (NTEP/MoHFW) MEDIUM ---
    {
        "id": "R-TB-MED-001",
        "source": "National Tuberculosis Elimination Program (NTEP) / MoHFW Diagnostic Algorithm",
        "condition": lambda r: any(s in r.symptoms for s in [
            "cough_more_than_2_weeks",
            "fever_more_than_2_weeks",
            "significant_weight_loss",
            "contact_with_known_tb_patient",
        ]),
        "urgency": Urgency.MEDIUM,
        "action": "Presumptive Pulmonary TB per NTEP guidelines (cough/fever > 2 weeks, weight loss, or TB contact). Refer to nearest PHC/DMC (Designated Microscopy Centre) or NAAT facility for sputum examination and chest X-ray.",
        "referral_target": "phc",
    },

    # --- v11: Anemia Mukt Bharat MEDIUM (Visible Pallor fallback without Hb value) ---
    {
        "id": "R-ANE-MED-001",
        "source": "Anemia Mukt Bharat Operational Guidelines (MoHFW) — Visible Pallor",
        "condition": lambda r: (
            ("pallor_or_pale_skin_or_conjunctiva" in r.symptoms or "pallor" in r.symptoms)
            and (r.vitals is None or r.vitals.hemoglobin_g_dl is None)
        ),
        "urgency": Urgency.MEDIUM,
        "action": "Visible clinical pallor (pale skin, conjunctiva, or nail beds) without laboratory Hb measurement. Refer to PHC for Point-of-Care hemoglobin test (digital hemoglobinometer) and IFA supplementation.",
        "referral_target": "phc",
    },

    {
        "id": "R-MED-001",
        "source": "NHM IMNCI 2023 Module / MoHFW — Diarrhoea & Gastroenteritis",
        "condition": lambda r: any(s in r.symptoms for s in ["diarrhea", "loose_motions", "vomiting_diarrhea"]),
        "urgency": Urgency.MEDIUM,
        "action": "Acute diarrhoea / Gastroenteritis per IMNCI / MoHFW guidelines. Start ORS and extra fluids, administer Zinc (for children), monitor for danger signs, refer to PHC if not resolving.",
        "referral_target": "phc",
    },
    {
        "id": "R-MED-UTI-001",
        "source": "MoHFW Standard Treatment Guidelines — Dysuria / Urinary Tract Infection",
        "condition": lambda r: any(s in r.symptoms for s in ["burning_micturition", "painful_urination", "dysuria"]),
        "urgency": Urgency.MEDIUM,
        "action": "Dysuria / Suspected Urinary Tract Infection per clinical protocols. Encourage fluid intake, refer to PHC for urine examination and antibiotic treatment.",
        "referral_target": "phc",
    },
    {
        "id": "R-MED-GI-001",
        "source": "MoHFW Common Medical Emergencies — Acute Abdominal Presentation",
        "condition": lambda r: any(s in r.symptoms for s in [
            "persistent_or_severe_abdominal_pain_or_tenderness",
            "abdominal_distension_or_swelling",
            "abdominal_pain",
        ]),
        "urgency": Urgency.MEDIUM,
        "action": "Acute abdominal pain / distension. Maintain fasting, avoid analgesics before clinical review, refer to PHC/CHC for surgical/medical evaluation.",
        "referral_target": "phc",
    },
    {
        "id": "R-MED-FEVER-001",
        "source": (
            "ICMR Treatment Guidelines for Antimicrobial Use in Common "
            "Syndromes, 2nd Edition (2019), Ch.2 'Management of Acute "
            "Fever', Sec 2.1.3 (Case Definition, p.5-6) and p.9 protocol. "
            "Case definition source population is adults 19-64y; see v12 "
            "changelog note on scope."
        ),
        # GUARD (unchanged from v8): when a malaria test result is already
        # known, the more specific NVBDCP-cited rules (R-MED-002 confirmed /
        # R-LOW-002 unlikely) must be allowed to fire instead of this
        # generic catch-all.
        #
        # v12 FIX: this rule previously fired on bare presence of "fever"/
        # "high_fever" with NO temperature threshold and NO duration check,
        # which made R-ADULT-LOW-001's GREEN carve-out (has_low_fever_
        # under_101f, Annexure 4 p.53, <101F/38.3C) permanently unreachable
        # for every fever case regardless of severity. ICMR's own AUFI case
        # definition (p.5-6) independently confirms 38.3C/101F as the
        # concerning-fever threshold. A MEASURED temperature below that,
        # with no other red/yellow-flag symptom present, is not in this
        # guideline's target population and should fall through to GREEN.
        # An UNMEASURED fever still routes to MEDIUM here -- absent data
        # is never treated as "mild", per this project's existing
        # honest-uncertainty discipline (see has_unstable_adult_vitals).
        "condition": lambda r: (
            any(s in r.symptoms for s in ["fever", "high_fever"])
            and "malaria_test_positive" not in r.symptoms
            and "malaria_test_negative" not in r.symptoms
            and not (
                r.vitals is not None
                and r.vitals.temperature_celsius is not None
                and r.vitals.temperature_celsius < 38.3
            )
        ),
        "urgency": Urgency.MEDIUM,
        "action": build_fever_action,  # callable -- see evaluate() change below
        "referral_target": "phc",
    },
    {
        "id": "R-MED-002",
        "source": "NHM IMNCI 2023 Chart Booklet — Malaria (uncomplicated)",
        "condition": lambda r: (
            "fever" in r.symptoms
            and "malaria_test_positive" in r.symptoms
            and not any(s in r.symptoms for s in GENERAL_DANGER_SIGNS + ["stiff_neck"])
        ),
        "urgency": Urgency.MEDIUM,
        "action": "MALARIA (uncomplicated) per IMNCI. Give oral antimalarial. Refer if not improving or new danger signs develop.",
        "referral_target": "phc",
    },
    {
        "id": "R-MED-003",
        "source": "NHM IMNCI 2023 Chart Booklet — Acute Ear Infection",
        "condition": lambda r: (
            "pus_draining_less_than_14_days" in r.symptoms
            or "ear_pain" in r.symptoms
        ) and "pus_draining_14_days_or_more" not in r.symptoms,
        "urgency": Urgency.MEDIUM,
        "action": "ACUTE EAR INFECTION per IMNCI. Give antibiotic course, paracetamol for pain, dry the ear by wicking. Follow up in 5 days.",
        "referral_target": "phc",
    },
    {
        "id": "R-MED-004",
        "source": "NHM IMNCI 2023 Chart Booklet — Chronic Ear Infection",
        "condition": lambda r: "pus_draining_14_days_or_more" in r.symptoms,
        "urgency": Urgency.MEDIUM,
        "action": "CHRONIC EAR INFECTION per IMNCI. Dry the ear by wicking. Refer to facility for further evaluation — do not give oral antibiotics per chronic-infection protocol.",
        "referral_target": "phc",
    },

    # =====================================================================
    # LOW TIER
    # =====================================================================

    {
        "id": "R-LOW-001",
        "source": "NHM IMNCI 2023 Module — No Pneumonia: Cough or Cold",
        "condition": lambda r: (
            "cough" in r.symptoms
            and "chest_indrawing" not in r.symptoms
            and not any(s in r.symptoms for s in GENERAL_DANGER_SIGNS)
            and not has_fast_breathing(r)
            and "fever" not in r.symptoms
        ),
        "urgency": Urgency.LOW,
        "action": "No general danger sign, no fast breathing or chest indrawing present. Mild symptoms — home care advice (soothe throat, keep warm, clear blocked nose), follow up if persists beyond 3 days or breathing worsens.",
        "referral_target": None,
    },
    {
        "id": "R-LOW-002",
        "source": "NHM IMNCI 2023 Chart Booklet — Fever, Malaria Unlikely",
        "condition": lambda r: (
            "fever" in r.symptoms
            and "malaria_test_negative" in r.symptoms
            and not any(s in r.symptoms for s in GENERAL_DANGER_SIGNS + ["stiff_neck"])
        ),
        "urgency": Urgency.LOW,
        "action": "Fever, malaria unlikely per IMNCI. Treat visible cause of fever if any. Advise return if fever persists beyond 7 days or danger signs develop.",
        "referral_target": None,
    },
    {
        "id": "R-LOW-003",
        "source": "NHM IMNCI 2023 Chart Booklet — No Ear Infection",
        "condition": lambda r: (
            "ear_problem_reported" in r.symptoms
            and "ear_pain" not in r.symptoms
            and "tender_swelling_behind_ear" not in r.symptoms
            and "pus_draining_less_than_14_days" not in r.symptoms
            and "pus_draining_14_days_or_more" not in r.symptoms
        ),
        "urgency": Urgency.LOW,
        "action": "No ear infection per IMNCI. No treatment needed for ear.",
        "referral_target": None,
    },

    # --- NEW v7: Universal adult/elderly GREEN tier (Annexure 4, p.53) ---
    {
        "id": "R-ADULT-LOW-001",
        "source": "Common Emergencies/Burns/Trauma OGs (MoHFW/NHM), Annexure 4 p.53 — GREEN",
        "condition": lambda r: (
            is_outside_imnci_child_bands(r)
            and not has_unstable_adult_vitals(r)
            and not any(s in r.symptoms for s in (
                ADULT_RED_FAST_TRACK_SYMPTOMS
                + ADULT_RED_TRAUMA_SYMPTOMS
                + ADULT_YELLOW_MEDICAL_SYMPTOMS
                + ADULT_YELLOW_TRAUMA_SYMPTOMS
            ))
            and (
                has_low_fever_under_101f(r)
                or any(s in r.symptoms for s in ADULT_GREEN_SYMPTOMS)
            )
        ),
        "urgency": Urgency.LOW,
        "action": "GREEN per Annexure 4 — manage appropriately, no observation or investigation needed. Advise follow-up in OPD if symptoms persist.",
        "referral_target": None,
    },
]

DEFAULT_ACTION = "No rule matched — flag for ASHA/doctor manual review, do not auto-clear."


FACILITY_NAMES = {
    "phc": {
        "mr": "तुमच्या जवळच्या प्राथमिक आरोग्य केंद्रात (PHC)",
        "hi": "अपने नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC)",
        "ta": "உங்கள் அருகிலுள்ள முதன்மை சுகாதார மையத்திற்கு (PHC)",
        "en": "your nearest Primary Health Centre (PHC)",
    },
    "chc": {
        "mr": "तुमच्या जवळच्या ग्रामीण/सामुदायिक रुग्णालयात (CHC)",
        "hi": "अपने नजदीकी सामुदायिक स्वास्थ्य केंद्र (CHC)",
        "ta": "உங்கள் அருகிலுள்ள சமூக சுகாதார மையத்திற்கு (CHC)",
        "en": "your nearest Community Health Centre (CHC)",
    },
    "district_hospital": {
        "mr": "जिल्हा रुग्णालय किंवा उपजिल्हा रुग्णालयात (FRU)",
        "hi": "जिला अस्पताल या नजदीकी आपातकालीन केंद्र (FRU)",
        "ta": "அருகிலுள்ள மாவட்ட மருத்துவமனை அல்லது முதல் பரிந்துரை பிரிவுக்கு (FRU)",
        "en": "the nearest District Hospital or First Referral Unit (FRU)",
    },
}


def build_citizen_message(
    urgency: Urgency,
    referral_target_level,
    source_tier: str,
    action: str,
    lang: str = "en",
) -> str:
    target_key = referral_target_level or "phc"
    lang_key = lang if lang in ("mr", "hi", "ta", "en") else "en"
    facility = FACILITY_NAMES.get(target_key, {}).get(lang_key, "your nearest Primary Health Centre (PHC)")
    is_asha = source_tier == "asha_app"

    if urgency == Urgency.EMERGENCY:
        if is_asha:
            return f"EMERGENCY — {action} Arrange transport to {facility} immediately; do not wait."
        if lang == "mr":
            return f"तातडीचा वैद्यकीय धोका (आणीबाणी). कृपया विलंब न करता ताबडतोब {facility} जा. जाण्यासाठी मदत हवी असल्यास आपल्या आशा ताईंशी संपर्क साधा किंवा १०८ रुग्णवाहिकेला फोन करा."
        if lang == "hi":
            return f"यह एक गंभीर आपातकालीन स्थिति लग रही है। कृपया तुरंत {facility} जाएं। पहुंचने के लिए सहायता चाहिए तो अपनी आशा कार्यकर्ता से संपर्क करें या 108 एम्बुलेंस को कॉल करें।"
        if lang == "ta":
            return f"இது ஒரு மருத்துவ அவசரநிலையாகத் தெரிகிறது. தயவுசெய்து உடனடியாக {facility} செல்லுங்கள். அங்கு செல்ல உதவி தேவைப்பட்டால், உங்கள் ASHA ஊழியரைத் தொடர்புகொள்ளவும் அல்லது 108 ஆம்புலன்ஸை அழைக்கவும்."
        return (
            f"This looks like a medical emergency. Please go to {facility} right now. "
            f"If you need help getting there, contact your ASHA worker or call 108."
        )

    if urgency == Urgency.HIGH:
        if is_asha:
            return f"HIGH URGENCY — {action} Refer to {facility} today."
        if lang == "mr":
            return f"कृपया आजच {facility} भेट द्या. हे काही दिवस पुढे ढकलणे धोक्याचे ठरू शकते, परंतु घाबरून जाण्याचे कारण नाही."
        if lang == "hi":
            return f"कृपया आज ही {facility} जाएं। इसे कई दिनों तक टालना ठीक नहीं है, हालांकि अभी घबराने की आवश्यकता नहीं है।"
        if lang == "ta":
            return f"தயவுசெய்து இன்றே {facility} செல்லுங்கள். இதை பல நாட்கள் தள்ளிப்போடக் கூடாது, ஆனால் இது உடனடியாக மருத்துவமனை அவசரநிலை அல்ல."
        return (
            f"Please visit {facility} today. This should not wait several days, "
            f"but it is not a hospital emergency right now."
        )

    if urgency == Urgency.MEDIUM:
        if is_asha:
            return f"{action} Flag this case for doctor review — do not clear it as low risk."
        is_fallback = "no rule matched" in action.lower() or "flag for asha" in action.lower()
        if is_fallback:
            if lang == "mr":
                return f"आपण दिलेल्या माहितीवरून अचूक निष्कर्ष काढणे शक्य नाही आणि आम्ही कोणताही खोटा अंदाज बांधू इच्छित नाही. कृपया आपल्या आशा ताईंशी संपर्क साधा किंवा {facility} भेट द्या, जेणेकरून आरोग्य कर्मचारी आपली समक्ष तपासणी करू शकतील."
            if lang == "hi":
                return f"आपकी दी गई जानकारी के आधार पर हम कोई गलत अनुमान नहीं लगाना चाहते। कृपया अपनी आशा कार्यकर्ता से संपर्क करें या {facility} जाएं ताकि स्वास्थ्य कर्मी प्रत्यक्ष जांच कर सकें।"
            if lang == "ta":
                return f"நீங்கள் வழங்கிய தகவலின் அடிப்படையில் எங்களால் முழுமையாகக் கணிக்க முடியாது, மேலும் தவறான கணிப்புகளைச் செய்ய விரும்பவில்லை. தயவுசெய்து உங்கள் ASHA ஊழியரைத் தொடர்புகொள்ளவும் அல்லது {facility} செல்லவும்."
            return (
                f"We can't fully assess this from what you've told us, so we don't want to "
                f"guess. Please contact your ASHA worker or visit {facility} so a health "
                f"worker can check you in person."
            )
        if lang == "mr":
            return f"वैद्यकीय तपासणी आवश्यक आहे. कृपया प्रत्यक्ष तपासणी आणि पुढील उपचारांसाठी {facility} भेट द्या."
        if lang == "hi":
            return f"चिकित्सीय जांच आवश्यक है। कृपया प्रत्यक्ष जांच और उचित उपचार के लिए {facility} जाएं।"
        if lang == "ta":
            return f"மருத்துவ பரிசோதனை பரிந்துரைக்கப்படுகிறது. நேரில் பரிசோதனை மற்றும் தகுந்த சிகிச்சைக்காக {facility} செல்லவும்."
        return (
            f"Clinical assessment recommended. Please visit {facility} for an in-person examination and prescribed treatment."
        )

    if is_asha:
        return action
    if lang == "mr":
        return f"लक्षणे सौम्य आहेत. घरगुती काळजी घ्या आणि विश्रांती घ्या. ३ दिवसांत आराम न पडल्यास किंवा लक्षणे वाढल्यास आपल्या आशा ताईंशी संपर्क साधा किंवा प्राथमिक आरोग्य केंद्रात जा."
    if lang == "hi":
        return f"लक्षण हल्के हैं। घरेलू देखभाल करें व आराम करें। यदि 3 दिनों में सुधार न हो या स्थिति बिगड़े, तो अपनी आशा कार्यकर्ता से संपर्क करें या स्वास्थ्य केंद्र जाएं।"
    if lang == "ta":
        return f"லேசான அறிகுறிகள் காணப்படுகின்றன. வீட்டில் கவனிப்பு, போதுமான நீர்ச்சத்து மற்றும் ஓய்வு எடுக்கவும். சில நாட்களில் குணமாகவில்லை என்றாலோ அல்லது மோசமடைந்தாலோ, உங்கள் ASHA ஊழியரைத் தொடர்புகொள்ளவும் அல்லது {facility} செல்லவும்."
    return (
        f"Mild symptoms observed. Continue home care, hydration, and rest. If it doesn't improve in a few days, or gets worse, contact your "
        f"ASHA worker or visit your nearest PHC."
    )


def expand_symptom_aliases(symptoms: list[str]) -> list[str]:
    s = set(symptoms)
    if any(k in s for k in ("loose_stools_diarrhea", "loose_motions", "diarrhea", "watery_stool", "loose_stools")):
        s.add("diarrhea")
        s.add("loose_motions")
        s.add("abdominal_pain_or_loose_motions_gt_3_episodes")
    if any(k in s for k in ("vomiting_nausea", "nausea", "vomiting", "persistent_vomiting")):
        s.add("vomiting")
        s.add("persistent_vomiting")
        s.add("abdominal_pain_or_loose_motions_gt_3_episodes")
    if "vomiting_diarrhea" in s:
        s.add("diarrhea")
        s.add("vomiting")
        s.add("persistent_vomiting")
        s.add("loose_motions")
        s.add("abdominal_pain_or_loose_motions_gt_3_episodes")
    if any(k in s for k in ("abdominal_pain", "persistent_or_severe_abdominal_pain_or_tenderness", "continuous_severe_abdominal_pain", "stomach_pain", "abdominal_distension_or_swelling")):
        s.add("abdominal_pain")
        s.add("abdominal_pain_or_loose_motions_gt_3_episodes")
        s.add("persistent_or_severe_abdominal_pain_or_tenderness")
    if any(k in s for k in ("severe_headache", "headache", "dizziness", "giddiness")):
        s.add("headache_or_dizziness")
    if any(k in s for k in ("cold_runny_nose", "runny_nose", "mild_cough", "cough", "sore_throat")):
        s.add("cough")
        s.add("low_risk_cough_or_cold")
    if any(k in s for k in ("severe_breathlessness", "breathlessness_at_rest")):
        s.add("breathlessness")
        s.add("breathlessness_at_rest")
        s.add("difficult_breathing")
    if any(k in s for k in ("breathlessness", "shortness_of_breath")):
        s.add("breathlessness")
        s.add("difficult_breathing")
    if any(k in s for k in ("body_pain_weakness", "weakness", "fatigue", "body_ache", "tiredness")):
        s.add("minor_symptoms_of_existing_illness")
        s.add("fatigue")
    if "high_fever" in s:
        s.add("fever")
        s.add("high_fever")
        # NOTE: do NOT add "fever_with_headache_or_chest_pain_or_jaundice" here.
        # That key means fever WITH headache/chest pain/jaundice specifically
        # (Annexure 4 YELLOW criterion) -- high_fever alone does not imply those
        # companion symptoms. Synthesizing it here was silently upgrading every
        # bare high-fever adult case to HIGH and masking the malaria MEDIUM
        # pathway below. If the caller also sends headache/chest_pain/jaundice
        # as separate symptom keys, R-ADULT-HIGH-001 will still match on those.
    if any(k in s for k in ("fever_with_chills", "chills_and_rigors")):
        s.add("fever")
        s.add("chills_and_rigors")
        # Same fix: fever+chills is the NVBDCP malaria-suspect symptom
        # (R-MAL-MED-001, MEDIUM) -- it is not, by itself, the Annexure 4
        # YELLOW "fever with headache/chest pain/jaundice" criterion. Removed
        # the incorrect alias so the malaria rule is reachable for adults.
    if "fever_more_than_2_weeks" in s:
        s.add("fever")
        s.add("fever_lasting_more_than_7_days")
    if "severe_chest_pain_radiating_to_arm_or_jaw" in s:
        s.add("chest_pain")
    if any(k in s for k in ("stridor_in_children", "stridor")):
        s.add("noisy_breathing_or_stridor")
    if any(k in s for k in ("not_able_to_drink_or_feed", "not_able_to_feed")):
        s.add("not_able_to_drink_or_drinking_poorly")
        s.add("unable_to_drink_or_breastfeed")
    if any(k in s for k in ("lethargic_or_unconscious", "unconscious", "confusion")):
        s.add("altered_sensorium")
        s.add("lethargic_or_unconscious")
    if any(k in s for k in ("convulsions", "fits", "seizures")):
        s.add("active_seizure")
        s.add("convulsions")
    if any(k in s for k in ("severe_headache_pregnancy", "blurred_vision_pregnancy")):
        s.add("severe_headache_with_blurred_vision_or_spots")
        s.add("headache_or_dizziness")
        s.add("headache")
        s.add("dizziness")
    if "heavy_bleeding_postpartum" in s:
        s.add("heavy_bleeding_after_delivery")
        s.add("abnormal_bleeding_per_vagina")
        s.add("severe_bleeding_after_delivery")
        s.add("severe_bleeding_pads_soaked_quickly")
    if "eclampsia_seizures" in s:
        s.add("active_seizure")
        s.add("convulsions")
        s.add("convulsions_or_fits")
        s.add("convulsions_after_delivery")
    if any(k in s for k in ("burn_special_area_hands_face_perineum_or_airway", "major_burn", "burns")):
        s.add("burn_special_area_hands_face_perineum_or_airway")
        s.add("major_burn")
    if "fracture_with_exposed_bone" in s:
        s.add("fracture_with_exposed_bone")
        s.add("uncontrolled_bleeding_or_deep_wound")
    if any(k in s for k in ("snake_or_scorpion_bite", "snake_bite", "scorpion_bite")):
        s.add("snake_or_scorpion_bite")
    if any(k in s for k in ("restlessness_or_sudden_behavioral_change", "restlessness", "agitated")):
        s.add("restlessness_or_sudden_behavioral_change")
    if any(k in s for k in ("persistent_vomiting", "vomiting")):
        s.add("persistent_vomiting")
        s.add("vomiting")
    if any(k in s for k in ("burning_micturition", "painful_urination", "dysuria")):
        s.add("burning_micturition")
        s.add("unable_to_pass_urine")
    if any(k in s for k in ("skin_rash", "rash")):
        s.add("simple_skin_rash")
    if any(k in s for k in ("pallor_or_pale_skin_or_conjunctiva", "pallor")):
        s.add("pallor")
        s.add("pallor_or_known_anaemia_needing_transfusion")
    if "significant_weight_loss" in s:
        s.add("weight_loss")
        s.add("minor_symptoms_of_existing_illness")
    return list(s)


def evaluate(request: TriageRequest) -> TriageResponse:
    expanded_symptoms = expand_symptom_aliases(request.symptoms)
    eval_req = request.model_copy(update={"symptoms": expanded_symptoms})
    lang = getattr(request, "language", None) or "en"
    for rule in RULES:
        if rule["condition"](eval_req):
            # v12: "action" may now be a callable (e.g. build_fever_action)
            # that needs the request to produce duration-staged text, or a
            # plain string as before. Resolve it once, use everywhere.
            action_text = (
                rule["action"](eval_req) if callable(rule["action"]) else rule["action"]
            )
            return TriageResponse(
                urgency=rule["urgency"],
                recommended_action=action_text,
                citizen_message=build_citizen_message(
                    rule["urgency"], rule["referral_target"], request.source_tier, action_text, lang=lang
                ),
                rule_trace=[rule["id"]],
                requires_referral=rule["referral_target"] is not None,
                referral_target_level=rule["referral_target"],
            )

    return TriageResponse(
        urgency=Urgency.MEDIUM,
        recommended_action=DEFAULT_ACTION,
        citizen_message=build_citizen_message(Urgency.MEDIUM, "phc", request.source_tier, DEFAULT_ACTION, lang=lang),
        rule_trace=["NO_RULE_MATCHED"],
        requires_referral=True,
        referral_target_level="phc",
    )


# ============================================================================
# Smoke tests — run with `python -m app.services.rules_engine` from inside your .venv.
# v6 cases retained, plus new v7 cases for the adult/elderly module.
# ============================================================================

if __name__ == "__main__":
    from app.schemas.triage import Vitals, Sex

    cases = [
        (
            "Danger sign buried in mild symptoms (child)",
            TriageRequest(
                symptoms=["mild_cough", "runny_nose", "convulsions"],
                patient_age_years=1.5,
                patient_sex=Sex.FEMALE,
                vitals=Vitals(temperature_celsius=37.2),
                source_tier="asha_app",
            ),
            "R-EMG-001",
        ),
        (
            "Adult chest pain, no other symptoms — should be RED, not NO_RULE_MATCHED",
            TriageRequest(
                symptoms=["chest_pain"],
                patient_age_years=45,
                patient_sex=Sex.MALE,
                source_tier="citizen_web",
            ),
            "R-ADULT-EMG-001",
        ),
        (
            "Adult, unstable vitals only, no symptoms reported",
            TriageRequest(
                symptoms=[],
                patient_age_years=52,
                patient_sex=Sex.MALE,
                vitals=Vitals(systolic_bp=82),
                source_tier="citizen_web",
            ),
            "R-ADULT-EMG-004",
        ),
        (
            "Elderly (65y) small burn — should escalate to RED per Annexure 1 age rule, "
            "even though it wouldn't meet the >20% BSA bar for a younger adult",
            TriageRequest(
                symptoms=["burn_present"],
                patient_age_years=65,
                patient_sex=Sex.FEMALE,
                source_tier="asha_app",
            ),
            "R-ADULT-EMG-002",
        ),
        (
            "Adult isolated long-bone fracture, stable — YELLOW not RED",
            TriageRequest(
                symptoms=["isolated_long_bone_fracture"],
                patient_age_years=30,
                patient_sex=Sex.MALE,
                vitals=Vitals(systolic_bp=118, respiratory_rate=16, spo2_percent=97),
                source_tier="citizen_web",
            ),
            "R-ADULT-HIGH-002",
        ),
        (
            "Adult, minor cough/cold, normal vitals — GREEN",
            TriageRequest(
                symptoms=["low_risk_cough_or_cold"],
                patient_age_years=34,
                patient_sex=Sex.FEMALE,
                vitals=Vitals(respiratory_rate=16, spo2_percent=98),
                source_tier="citizen_web",
            ),
            "R-ADULT-LOW-001",
        ),
        (
            "6-year-old (outside IMNCI child band) with chest pain — should now be caught "
            "by the adult module instead of falling through to NO_RULE_MATCHED",
            TriageRequest(
                symptoms=["chest_pain"],
                patient_age_years=6,
                patient_sex=Sex.MALE,
                source_tier="citizen_web",
            ),
            "R-ADULT-EMG-001",
        ),
        (
            "Empty symptoms, no vitals, adult — still honest NO_RULE_MATCHED (feature not bug)",
            TriageRequest(
                symptoms=[],
                patient_age_years=40,
                patient_sex=Sex.MALE,
                source_tier="asha_app",
            ),
            "NO_RULE_MATCHED",
        ),
        (
            "Pregnant, BP 150/95 via raw vitals — existing maternal rule still wins, unaffected by v7",
            TriageRequest(
                symptoms=[],
                patient_age_years=28,
                patient_sex=Sex.FEMALE,
                is_pregnant=True,
                vitals=Vitals(systolic_bp=150, diastolic_bp=95),
                source_tier="citizen_web",
            ),
            "R-HIGH-002",
        ),
        (
            "Adult, measured fever 37.9C (below 101F/38.3C threshold), "
            "no other symptoms -- should fall through to GREEN, not MEDIUM",
            TriageRequest(
                symptoms=["fever"],
                patient_age_years=28,
                patient_sex=Sex.MALE,
                vitals=Vitals(temperature_celsius=37.9, respiratory_rate=16, spo2_percent=98),
                source_tier="citizen_web",
            ),
            "R-ADULT-LOW-001",
        ),
        (
            "Adult, measured fever 38.6C (above threshold), day 1 -- MEDIUM, "
            "action text should say 'no investigations required yet'",
            TriageRequest(
                symptoms=["fever"],
                patient_age_years=20,
                patient_sex=Sex.MALE,
                vitals=Vitals(temperature_celsius=38.6),
                symptom_duration_days=1,
                source_tier="citizen_web",
            ),
            "R-MED-FEVER-001",
        ),
        (
            "Adult, unmeasured fever (no vitals submitted at all), day 6 -- "
            "still MEDIUM even though duration is known, since temp is unknown",
            TriageRequest(
                symptoms=["fever", "cough"],
                patient_age_years=20,
                patient_sex=Sex.MALE,
                symptom_duration_days=6,
                source_tier="citizen_web",
            ),
            "R-MED-FEVER-001",
        ),
    ]

    passed = 0
    for label, req, expected_rule_id in cases:
        result = evaluate(req)
        got = result.rule_trace[0]
        ok = got == expected_rule_id
        passed += ok
        print(f"[{'PASS' if ok else 'FAIL'}] {label}")
        print(f"    expected: {expected_rule_id}  got: {got}  urgency: {result.urgency}")
        print(f"    citizen_message: {result.citizen_message}")

    print(f"\n{passed}/{len(cases)} passed")