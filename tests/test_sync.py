"""
tests/test_sync.py

Integration tests for /health and /sync endpoints against jeevanya_test DB.
Verifies all backend sync requirements (B1–B6):
1. test_health_ok & test_health_db_down (B1: active DB probe returning 200 / 503)
2. test_sync_missing_record_id (B2: reject missing record_id, 0 rows, 1 error)
3. test_sync_batch_limit_101 (B3: max_length=100 returning 422)
4. test_sync_unconfirmed_referral (B4: standalone referral not in DB -> unconfirmed_referrals)
5. test_sync_patient_dedup_different_names (B5: same phone, different names -> 2 rows)
6. test_sync_patient_dedup_same_name_sex (B5: same phone, same name & sex -> 1 row)
7. test_sync_single_record (Full triage evaluation & insertion)
8. test_sync_idempotency (Duplicate submission idempotency)
9. test_sync_urgency_mismatch (Client vs server urgency mismatch tracking)
10. test_sync_partial_failure (Resilience on corrupted records)
11. test_sync_demo_referral_ignored (Ignore demo referrals)
"""

import os
import urllib.parse
import uuid
from unittest.mock import patch, MagicMock
import pytest
import httpx
import asyncpg
from dotenv import load_dotenv

# Ensure test DB is targeted before importing app modules
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql://subash@/jeevanya_test")
load_dotenv()

# Safety assertion (B6): Target database name MUST end with _test
db_url = os.environ.get("DATABASE_URL", "")
parsed = urllib.parse.urlparse(db_url)
db_name = parsed.path.lstrip("/")
assert db_name.endswith("_test"), f"Safety assertion failed: Database '{db_name}' does not end with '_test'"

from app.main import app
from app.db import init_pool, close_pool, get_pool
from app.schemas.triage import Urgency


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Fixture to initialize and tear down connection pool for jeevanya_test."""
    pool = await init_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM referral_state_transitions WHERE 1=1;")
        await conn.execute("DELETE FROM referrals WHERE 1=1;")
        await conn.execute("DELETE FROM triage_records WHERE 1=1;")
        await conn.execute("DELETE FROM patients WHERE 1=1;")
    yield pool
    await close_pool()


@pytest.mark.asyncio
async def test_health_ok():
    """B1. GET /health returns 200 {'status': 'ok', 'db': 'ok'} when DB probe succeeds."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "db": "ok"}


@pytest.mark.asyncio
async def test_health_db_down():
    """B1. GET /health returns 503 {'status': 'degraded', 'db': 'down'} when DB probe fails."""
    mock_pool = MagicMock()
    mock_pool.acquire.side_effect = Exception("Connection refused")
    app.dependency_overrides[get_pool] = lambda: mock_pool
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 503
            assert response.json() == {"status": "degraded", "db": "down"}
    finally:
        app.dependency_overrides.pop(get_pool, None)


@pytest.mark.asyncio
async def test_sync_missing_record_id():
    """B2. Missing/null/empty record_id is rejected with 0 rows inserted and 1 error returned."""
    client_pat_id = str(uuid.uuid4())
    payload = {
        "patients": [
            {
                "record_id": None,  # Missing record_id
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "No Record ID Patient",
                    "patient_age_years": 25.0,
                    "patient_sex": "female",
                    "mobile": "9876543210",
                },
                "symptoms": ["cough"],
                "triage": {
                    "urgency": "low",
                },
            }
        ],
        "referrals": [],
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/sync", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["total_synced"] == 0
        assert data["total_errors"] == 1
        assert len(data["errors"]) == 1
        assert data["errors"][0]["error"] == "missing record_id"
        assert data["errors"][0]["client_patient_id"] == client_pat_id

        # Verify 0 rows in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            pat_count = await conn.fetchval("SELECT count(*) FROM patients WHERE client_patient_id = $1", client_pat_id)
            assert pat_count == 0
            triage_count = await conn.fetchval("SELECT count(*) FROM triage_records")
            assert triage_count == 0


@pytest.mark.asyncio
async def test_sync_batch_limit_101():
    """B3. Payload with 101 records exceeds max_length=100 and returns HTTP 422."""
    records = []
    for _ in range(101):
        records.append({
            "record_id": str(uuid.uuid4()),
            "patient": {
                "patient_id": str(uuid.uuid4()),
                "patient_display_name": "Batch Patient",
                "patient_age_years": 30.0,
                "patient_sex": "male",
            },
            "symptoms": ["fever"],
            "triage": {"urgency": "medium"},
        })

    payload = {"patients": records}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/sync", json=payload)
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_sync_unconfirmed_referral():
    """B4. Standalone referral not found in DB is placed into unconfirmed_referrals."""
    missing_ref_id = str(uuid.uuid4())
    payload = {
        "patients": [],
        "referrals": [
            {
                "referral_id": missing_ref_id,
                "patient_id": str(uuid.uuid4()),
                "status": "in_transit",
                "is_demo": False,
            }
        ],
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/sync", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["unconfirmed_referrals"]) == 1
        assert data["unconfirmed_referrals"][0]["client_ref_id"] == missing_ref_id
        assert "not found in database" in data["unconfirmed_referrals"][0]["reason"]
        assert len(data["errors"]) == 0


@pytest.mark.asyncio
async def test_sync_patient_dedup_different_names():
    """B5. Same phone number with different patient names creates 2 distinct patient rows in DB."""
    phone = "9876500010"
    rec1_id = str(uuid.uuid4())
    pat1_id = str(uuid.uuid4())
    rec2_id = str(uuid.uuid4())
    pat2_id = str(uuid.uuid4())

    payload1 = {
        "patients": [
            {
                "record_id": rec1_id,
                "patient": {
                    "patient_id": pat1_id,
                    "patient_display_name": "Aarav Sharma",
                    "patient_village": "Village A",
                    "mobile": phone,
                    "patient_age_years": 25.0,
                    "patient_sex": "male",
                },
                "symptoms": ["fever"],
                "triage": {"urgency": "medium"},
            }
        ]
    }

    payload2 = {
        "patients": [
            {
                "record_id": rec2_id,
                "patient": {
                    "patient_id": pat2_id,
                    "patient_display_name": "Sunita Sharma",  # Different family member on same phone
                    "patient_village": "Village A",
                    "mobile": phone,
                    "patient_age_years": 22.0,
                    "patient_sex": "female",
                },
                "symptoms": ["cough"],
                "triage": {"urgency": "low"},
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res1 = await client.post("/sync", json=payload1)
        assert res1.status_code == 200
        db_pat_id_1 = res1.json()["synced_patients"][0]["patient_id"]

        res2 = await client.post("/sync", json=payload2)
        assert res2.status_code == 200
        db_pat_id_2 = res2.json()["synced_patients"][0]["patient_id"]

        # Distinct patient IDs for different family members sharing the phone
        assert db_pat_id_1 != db_pat_id_2

        # Verify DB has 2 distinct rows
        pool = get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT count(*) FROM patients WHERE phone = $1", phone)
            assert count == 2


@pytest.mark.asyncio
async def test_sync_patient_dedup_same_name_sex():
    """B5. Same phone number with matching normalized name and sex links to 1 patient row in DB."""
    phone = "9876500020"
    rec1_id = str(uuid.uuid4())
    pat1_id = str(uuid.uuid4())
    rec2_id = str(uuid.uuid4())
    pat2_id = str(uuid.uuid4())  # Different client patient ID for same patient

    payload1 = {
        "patients": [
            {
                "record_id": rec1_id,
                "patient": {
                    "patient_id": pat1_id,
                    "patient_display_name": "  Geeta Bai  ",
                    "patient_village": "Village B",
                    "mobile": phone,
                    "patient_age_years": 45.0,
                    "patient_sex": "female",
                },
                "symptoms": ["fever"],
                "triage": {"urgency": "medium"},
            }
        ]
    }

    payload2 = {
        "patients": [
            {
                "record_id": rec2_id,
                "patient": {
                    "patient_id": pat2_id,
                    "patient_display_name": "geeta bai",  # Normalized match
                    "patient_village": "Village B",
                    "mobile": phone,
                    "patient_age_years": 45.0,
                    "patient_sex": "female",
                },
                "symptoms": ["cough"],
                "triage": {"urgency": "low"},
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res1 = await client.post("/sync", json=payload1)
        assert res1.status_code == 200
        db_pat_id_1 = res1.json()["synced_patients"][0]["patient_id"]

        res2 = await client.post("/sync", json=payload2)
        assert res2.status_code == 200
        db_pat_id_2 = res2.json()["synced_patients"][0]["patient_id"]

        # Same patient row reused
        assert db_pat_id_1 == db_pat_id_2

        # Verify DB has exactly 1 patient row
        pool = get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT count(*) FROM patients WHERE phone = $1", phone)
            assert count == 1


@pytest.mark.asyncio
async def test_sync_single_record():
    """Full triage evaluation & insertion."""
    client_rec_id = str(uuid.uuid4())
    client_pat_id = str(uuid.uuid4())

    payload = {
        "patients": [
            {
                "record_id": client_rec_id,
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "Ramesh Kumar",
                    "patient_village": "Ralegan Siddhi",
                    "mobile": "9876543210",
                    "patient_age_years": 35.0,
                    "patient_sex": "male",
                    "is_pregnant": False,
                    "is_postpartum": False,
                },
                "symptoms": ["chest_pain"],
                "symptom_duration_days": 1,
                "triage": {
                    "urgency": "emergency",
                    "recommended_action": "Refer to emergency",
                    "citizen_message": "Immediate care required",
                    "requires_referral": True,
                    "is_offline_evaluation": True,
                },
                "language": "en",
            }
        ],
        "referrals": [],
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/sync", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total_synced"] >= 1
        assert data["total_errors"] == 0
        assert len(data["synced_patients"]) == 1

        synced_pat = data["synced_patients"][0]
        assert synced_pat["client_record_id"] == client_rec_id
        assert synced_pat["client_patient_id"] == client_pat_id
        assert synced_pat["server_urgency"] == "emergency"
        assert synced_pat["urgency_mismatch"] is False

        # Verify in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            pat_count = await conn.fetchval("SELECT count(*) FROM patients WHERE client_patient_id = $1", client_pat_id)
            assert pat_count == 1

            triage_row = await conn.fetchrow("SELECT * FROM triage_records WHERE client_record_id = $1", client_rec_id)
            assert triage_row is not None
            assert triage_row["urgency"] == "emergency"
            assert triage_row["urgency_mismatch"] is False


@pytest.mark.asyncio
async def test_sync_idempotency():
    """POST the same payload twice returns same IDs and does not duplicate DB rows."""
    client_rec_id = str(uuid.uuid4())
    client_pat_id = str(uuid.uuid4())

    payload = {
        "patients": [
            {
                "record_id": client_rec_id,
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "Sita Devi",
                    "patient_village": "Hingoli",
                    "mobile": "9876543211",
                    "patient_age_years": 28.0,
                    "patient_sex": "female",
                    "is_pregnant": False,
                    "is_postpartum": False,
                },
                "symptoms": ["cough"],
                "symptom_duration_days": 2,
                "triage": {
                    "urgency": "low",
                    "recommended_action": "Home care",
                    "requires_referral": False,
                },
            }
        ],
        "referrals": [],
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # First POST
        res1 = await client.post("/sync", json=payload)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["success"] is True
        triage_id_1 = data1["synced_patients"][0]["triage_record_id"]
        patient_id_1 = data1["synced_patients"][0]["patient_id"]

        # Second POST (exact duplicate)
        res2 = await client.post("/sync", json=payload)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["success"] is True
        triage_id_2 = data2["synced_patients"][0]["triage_record_id"]
        patient_id_2 = data2["synced_patients"][0]["patient_id"]

        # Assert returned IDs match
        assert triage_id_1 == triage_id_2
        assert patient_id_1 == patient_id_2

        # Assert no duplicate rows in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            pat_count = await conn.fetchval("SELECT count(*) FROM patients WHERE client_patient_id = $1", client_pat_id)
            assert pat_count == 1
            triage_count = await conn.fetchval("SELECT count(*) FROM triage_records WHERE client_record_id = $1", client_rec_id)
            assert triage_count == 1


@pytest.mark.asyncio
async def test_sync_urgency_mismatch():
    """Detect and record urgency mismatch when client claimed urgency differs from server evaluated urgency."""
    client_rec_id = str(uuid.uuid4())
    client_pat_id = str(uuid.uuid4())

    payload = {
        "patients": [
            {
                "record_id": client_rec_id,
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "Anil Deshmukh",
                    "patient_village": "Satara",
                    "mobile": "9876543212",
                    "patient_age_years": 45.0,
                    "patient_sex": "male",
                },
                "symptoms": ["chest_pain"],
                "symptom_duration_days": 1,
                "triage": {
                    "urgency": "low",  # Under-triaged by client
                    "recommended_action": "Rest",
                    "requires_referral": False,
                },
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/sync", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["mismatches_count"] == 1
        synced_pat = data["synced_patients"][0]
        assert synced_pat["client_urgency"] == "low"
        assert synced_pat["server_urgency"] == "emergency"
        assert synced_pat["urgency_mismatch"] is True

        # Verify in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT urgency, client_claimed_urgency, urgency_mismatch FROM triage_records WHERE client_record_id = $1", client_rec_id)
            assert row["urgency"] == "emergency"
            assert row["client_claimed_urgency"] == "low"
            assert row["urgency_mismatch"] is True


@pytest.mark.asyncio
async def test_sync_partial_failure():
    """Verify partial batch failure resilience: valid record succeeds while failing record is logged."""
    valid_rec_id = str(uuid.uuid4())
    valid_pat_id = str(uuid.uuid4())

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        from app.services.rules_engine import evaluate as orig_evaluate

        def mock_evaluate(req):
            if req.patient_display_name == "Faulty Patient":
                raise ValueError("Simulated clinical engine failure on corrupted patient record")
            return orig_evaluate(req)

        with patch("app.sync_routes.evaluate", side_effect=mock_evaluate):
            batch_payload = {
                "patients": [
                    {
                        "record_id": valid_rec_id,
                        "patient": {
                            "patient_id": valid_pat_id,
                            "patient_display_name": "Valid Batch Patient",
                            "patient_age_years": 22.0,
                            "patient_sex": "male",
                        },
                        "symptoms": ["fever"],
                        "triage": {"urgency": "medium"},
                    },
                    {
                        "record_id": str(uuid.uuid4()),
                        "patient": {
                            "patient_id": str(uuid.uuid4()),
                            "patient_display_name": "Faulty Patient",
                            "patient_age_years": 22.0,
                            "patient_sex": "female",
                        },
                        "symptoms": ["fever"],
                        "triage": {"urgency": "medium"},
                    }
                ]
            }
            batch_res = await client.post("/sync", json=batch_payload)
            assert batch_res.status_code == 200
            bdata = batch_res.json()
            assert bdata["success"] is False
            assert bdata["total_synced"] == 1
            assert bdata["total_errors"] == 1
            assert len(bdata["synced_patients"]) == 1
            assert len(bdata["errors"]) == 1
            assert "Simulated clinical engine failure" in bdata["errors"][0]["error"]


@pytest.mark.asyncio
async def test_sync_demo_referral_ignored():
    """Standalone referrals with is_demo: true or REF-DEMO- prefix are ignored."""
    payload = {
        "patients": [],
        "referrals": [
            {
                "referral_id": "REF-DEMO-12345",
                "patient_id": str(uuid.uuid4()),
                "status": "created",
                "is_demo": True,
            },
            {
                "referral_id": "REF-DEMO-99999",
                "patient_id": str(uuid.uuid4()),
                "status": "created",
                "is_demo": False,
            },
            {
                "referral_id": "REF-REGULAR-12345",
                "patient_id": str(uuid.uuid4()),
                "status": "created",
                "is_demo": True,
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/sync", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["synced_referrals"]) == 0

        # Verify DB has 0 referrals inserted
        pool = get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT count(*) FROM referrals WHERE client_ref_id LIKE 'REF-DEMO%'")
            assert count == 0
