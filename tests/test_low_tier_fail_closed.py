import pytest
from app.services.rules_engine import evaluate
from app.schemas.triage import TriageRequest, Urgency, Sex


def create_adult_request(symptoms: list[str], sex: str = "male") -> TriageRequest:
    return TriageRequest(
        patient_id="test_patient",
        patient_display_name="Test Adult",
        patient_village="Test Village",
        patient_phone="9876543210",
        symptoms=symptoms,
        patient_age_years=30.0,
        patient_sex=Sex.MALE if sex == "male" else Sex.FEMALE,
        source_tier="citizen_web",
    )


@pytest.mark.parametrize(
    "symptoms,sex,expected_rule",
    [
        (["headache"], "male", "R-ADULT-LOW-001"),
        (["dizziness"], "female", "R-ADULT-LOW-001"),
        (["cough", "headache"], "male", "R-ADULT-LOW-001"),
        (["fatigue"], "female", "R-ADULT-LOW-001"),
    ],
)
def test_low_tier_fail_closed_low_cases(symptoms, sex, expected_rule):
    req = create_adult_request(symptoms, sex)
    res = evaluate(req)
    assert res.urgency == Urgency.LOW, f"Expected LOW for {symptoms}, got {res.urgency}"
    assert res.rule_trace and res.rule_trace[0] == expected_rule


@pytest.mark.parametrize(
    "symptoms,sex",
    [
        (["cough", "weight_loss"], "male"),
        (["dizziness_vertigo", "fatigue"], "female"),
        (["significant_weight_loss", "cough"], "male"),
        (["cough", "convulsions_or_loss_of_consciousness"], "female"),
        (["vomits_everything", "cough"], "male"),
        (["burn_present", "cough"], "female"),
        (["difficult_breathing", "cough"], "male"),
        (["headache", "burn_present"], "female"),
    ],
)
def test_low_tier_fail_closed_not_low_cases(symptoms, sex):
    req = create_adult_request(symptoms, sex)
    res = evaluate(req)
    assert res.urgency in (
        Urgency.MEDIUM,
        Urgency.HIGH,
        Urgency.EMERGENCY,
    ), f"Expected NOT LOW for {symptoms}, got {res.urgency}"
    if res.rule_trace:
        assert not res.rule_trace[0].startswith("R-ADULT-LOW"), f"Should not match adult low rule for {symptoms}"
