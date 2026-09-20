import asyncio
import os
import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from dotenv import load_dotenv

load_dotenv("/home/subash/healthai-sos/.env")

from app.main import app
from app.db import init_pool, close_pool, get_pool
from app.services.auth import create_access_token


@pytest.mark.asyncio
async def test_full_sos_flow():
    await init_pool()
    pool = await get_pool()

    # Clean test alerts
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM sos_alerts WHERE patient_phone LIKE '98000%' OR client_alert_id LIKE 'flood-%'")

    # Seed demo subcentre
    from seed_demo_subcentre import seed_demo_subcentre
    await seed_demo_subcentre()

    # Get sample facilities for checking
    async with pool.acquire() as conn:
        subcentre = await conn.fetchrow("SELECT id, name, lat, lng FROM facilities WHERE level = 'sub_centre' LIMIT 1")
        phc = await conn.fetchrow("SELECT id, name, lat, lng FROM facilities WHERE level = 'phc' LIMIT 1")
        staff_subcentre = await conn.fetchrow("SELECT id, name, phone_or_username, facility_id FROM facility_staff WHERE facility_id = $1 LIMIT 1", subcentre["id"])
        staff_phc = await conn.fetchrow("SELECT id, name, phone_or_username, facility_id FROM facility_staff WHERE facility_id = $1 LIMIT 1", phc["id"])

    token_subcentre = create_access_token(data={"sub": str(staff_subcentre["id"]), "facility_id": str(subcentre["id"])})
    token_phc = create_access_token(data={"sub": str(staff_phc["id"]), "facility_id": str(phc["id"])})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Public Intake & Nearest-Facility Routing (lat/lng close to subcentre)
        alert_id_1 = str(uuid.uuid4())
        res1 = await client.post("/sos", json={
            "client_alert_id": alert_id_1,
            "patient_name": "Ramesh Patil",
            "patient_phone": "9800000001",
            "patient_village": "Mandavgan",
            "symptoms": ["chest_pain", "difficult_breathing"],
            "lat": subcentre["lat"] + 0.001,
            "lng": subcentre["lng"] + 0.001,
            "accuracy": 15.0,
            "channel": "citizen_web"
        })
        assert res1.status_code == 200, res1.text
        data1 = res1.json()
        assert data1["client_alert_id"] == alert_id_1
        assert data1["facility_id"] == str(subcentre["id"])
        assert data1["repeat_count"] == 1
        assert not data1["unrouted"]
        print("PASS: 1. Public intake & Nearest-facility routing to sub-centre")

        # 2. Idempotency test with same client_alert_id
        res1_dup = await client.post("/sos", json={
            "client_alert_id": alert_id_1,
            "patient_name": "Ramesh Patil",
            "patient_phone": "9800000001",
            "lat": subcentre["lat"] + 0.001,
            "lng": subcentre["lng"] + 0.001,
        })
        assert res1_dup.status_code == 200
        data1_dup = res1_dup.json()
        assert data1_dup["alert_id"] == data1["alert_id"]
        assert data1_dup["repeat_count"] == 1
        print("PASS: 2. Idempotency on duplicate client_alert_id")

        # 3. Repeat Collapse test (< 2 min, same phone number, new client_alert_id)
        alert_id_repeat = str(uuid.uuid4())
        res_repeat = await client.post("/sos", json={
            "client_alert_id": alert_id_repeat,
            "patient_name": "Ramesh Patil",
            "patient_phone": "9800000001",
            "lat": subcentre["lat"] + 0.005,
            "lng": subcentre["lng"] + 0.005,
        })
        assert res_repeat.status_code == 200
        data_repeat = res_repeat.json()
        assert data_repeat["alert_id"] == data1["alert_id"]
        assert data_repeat["repeat_count"] == 2
        print("PASS: 3. Repeat alert collapse (<2 min same phone, increment repeat_count)")

        # 4. Unrouted Alert test (missing lat/lng)
        alert_id_unrouted = str(uuid.uuid4())
        res_unrouted = await client.post("/sos", json={
            "client_alert_id": alert_id_unrouted,
            "patient_name": "Unknown Person",
            "patient_phone": "9800000099",
            "symptoms": ["severe_headache"],
            "channel": "citizen_web"
        })
        assert res_unrouted.status_code == 200
        data_unrouted = res_unrouted.json()
        assert data_unrouted["unrouted"] is True
        assert data_unrouted["facility_id"] is None
        print("PASS: 4. Unrouted alert creation (missing coordinates)")

        # 5. Facility Alert Queue Listing & Filtering
        # Subcentre staff listing should include alert1 AND unrouted alert
        res_queue_sub = await client.get("/facility/sos", headers={"Authorization": f"Bearer {token_subcentre}"})
        assert res_queue_sub.status_code == 200
        queue_sub = res_queue_sub.json()
        alert_ids_sub = [item["id"] for item in queue_sub]
        assert data1["alert_id"] in alert_ids_sub
        assert data_unrouted["alert_id"] in alert_ids_sub

        # PHC staff listing should include unrouted alert, but NOT alert1 (which is assigned to subcentre)
        res_queue_phc = await client.get("/facility/sos", headers={"Authorization": f"Bearer {token_phc}"})
        assert res_queue_phc.status_code == 200
        queue_phc = res_queue_phc.json()
        alert_ids_phc = [item["id"] for item in queue_phc]
        assert data1["alert_id"] not in alert_ids_phc
        assert data_unrouted["alert_id"] in alert_ids_phc
        print("PASS: 5. Facility queue listing and isolation (assigned + unrouted)")

        # 6. Unrouted Alert Claim & Acknowledge
        res_ack = await client.post(
            f"/facility/sos/{data_unrouted['alert_id']}/acknowledge",
            headers={"Authorization": f"Bearer {token_phc}"}
        )
        assert res_ack.status_code == 200
        data_ack = res_ack.json()
        assert data_ack["status"] == "acknowledged"
        assert data_ack["facility_id"] == str(phc["id"])
        print("PASS: 6. Unrouted alert takeover and acknowledgement")

        # 7. Resolve Alert
        res_res = await client.post(
            f"/facility/sos/{data_ack['alert_id']}/resolve",
            json={"notes": "Ambulance dispatched and reached patient."},
            headers={"Authorization": f"Bearer {token_phc}"}
        )
        assert res_res.status_code == 200
        data_res = res_res.json()
        assert data_res["status"] == "resolved"
        print("PASS: 7. Alert resolution with notes")

        # 8. Rate Limiting Test (30 req/min per IP)
        from app.sos_routes import _ip_request_timestamps
        os.environ["TRUST_PROXY"] = "1"
        _ip_request_timestamps.clear()
        ip = "192.168.1.100"
        for i in range(30):
            r = await client.post("/sos", json={"client_alert_id": f"flood-{i}"}, headers={"X-Forwarded-For": ip})
            assert r.status_code == 200
        # 31st request should be 429
        r_exceed = await client.post("/sos", json={"client_alert_id": "flood-31"}, headers={"X-Forwarded-For": ip})
        assert r_exceed.status_code == 429
        assert "Rate limit exceeded" in r_exceed.json()["detail"]
        print("PASS: 8. Rate limiting (429 Too Many Requests after 30 req/min)")

        # 9. GET /facility/list enrichment
        res_fac_list = await client.get("/facility/list")
        assert res_fac_list.status_code == 200
        fac_list = res_fac_list.json()
        assert any(f.get("contact_phone") is not None for f in fac_list)
        assert any(f.get("lat") is not None for f in fac_list)
        print("PASS: 9. GET /facility/list enrichment with contact_phone, lat, lng")

    await close_pool()
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_full_sos_flow())
