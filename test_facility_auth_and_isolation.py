import asyncio
import os
import uuid
import httpx
import asyncpg
from dotenv import load_dotenv

load_dotenv()

from app.main import app
from app.db import init_pool, close_pool

async def run_tests():
    print("==================================================================")
    print("TEST SUITE: Facility Staff Auth, State Transitions & Isolation")
    print("==================================================================")

    pool = await init_pool()

    try:
        # Fetch staff and referral IDs from DB
        async with pool.acquire() as conn:
            staff_a_row = await conn.fetchrow("SELECT id, facility_id FROM facility_staff WHERE phone_or_username = '9876543201'")
            staff_b_row = await conn.fetchrow("SELECT id, facility_id FROM facility_staff WHERE phone_or_username = '9876543202'")
            ref_a_row = await conn.fetchrow("SELECT id, state FROM referrals WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 1", staff_a_row["facility_id"])
            ref_b_row = await conn.fetchrow("SELECT id, state FROM referrals WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 1", staff_b_row["facility_id"])

        staff_a_id = str(staff_a_row["id"])
        staff_b_id = str(staff_b_row["id"])
        ref_a_id = str(ref_a_row["id"])
        ref_b_id = str(ref_b_row["id"])

        print(f"Staff A (PHC): ID={staff_a_id}, Facility={staff_a_row['facility_id']}")
        print(f"Staff B (CHC): ID={staff_b_id}, Facility={staff_b_row['facility_id']}")
        print(f"Referral A: ID={ref_a_id}, State={ref_a_row['state']}")
        print(f"Referral B: ID={ref_b_id}, State={ref_b_row['state']}")

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:

            # -------------------------------------------------------------
            # TEST 1: Bad login (wrong MPIN)
            # -------------------------------------------------------------
            print("\n[TEST 1] Login with incorrect MPIN...")
            bad_login = await client.post("/facility/login", json={"phone_or_username": "9876543201", "mpin": "9999"})
            assert bad_login.status_code == 401, f"Expected 401, got {bad_login.status_code}"
            print(f"  ✓ Rejected with 401: {bad_login.json()['detail']}")

            # -------------------------------------------------------------
            # TEST 2: Successful Staff A & Staff B Login
            # -------------------------------------------------------------
            print("\n[TEST 2] Successful login for Staff A and Staff B...")
            res_a = await client.post("/facility/login", json={"phone_or_username": "9876543201", "mpin": "1234"})
            assert res_a.status_code == 200, f"Login A failed: {res_a.text}"
            token_a = res_a.json()["access_token"]
            staff_info_a = res_a.json()["staff"]
            print(f"  ✓ Staff A logged in: {staff_info_a['name']} ({staff_info_a['facility_name']})")

            res_b = await client.post("/facility/login", json={"phone_or_username": "9876543202", "mpin": "1234"})
            assert res_b.status_code == 200, f"Login B failed: {res_b.text}"
            token_b = res_b.json()["access_token"]
            staff_info_b = res_b.json()["staff"]
            print(f"  ✓ Staff B logged in: {staff_info_b['name']} ({staff_info_b['facility_name']})")

            # -------------------------------------------------------------
            # TEST 3: Server-side Query Isolation (GET /facility/referrals)
            # -------------------------------------------------------------
            print("\n[TEST 3] Server-side Referral Query Isolation...")
            refs_a = await client.get("/facility/referrals", headers={"Authorization": f"Bearer {token_a}"})
            assert refs_a.status_code == 200
            data_a = refs_a.json()
            ref_ids_for_a = [r["id"] for r in data_a]
            assert ref_a_id in ref_ids_for_a, f"Referral A should be in Staff A queue"
            assert ref_b_id not in ref_ids_for_a, f"SECURITY BREACH: Referral B leaked into Staff A queue!"
            print(f"  ✓ Staff A queue contains ONLY Facility A referrals ({len(data_a)} found, Referral B correctly omitted)")

            refs_b = await client.get("/facility/referrals", headers={"Authorization": f"Bearer {token_b}"})
            assert refs_b.status_code == 200
            data_b = refs_b.json()
            ref_ids_for_b = [r["id"] for r in data_b]
            assert ref_b_id in ref_ids_for_b, f"Referral B should be in Staff B queue"
            assert ref_a_id not in ref_ids_for_b, f"SECURITY BREACH: Referral A leaked into Staff B queue!"
            print(f"  ✓ Staff B queue contains ONLY Facility B referrals ({len(data_b)} found, Referral A correctly omitted)")

            # -------------------------------------------------------------
            # TEST 4: Cross-Facility Mutation Block (Staff A -> Referral B)
            # -------------------------------------------------------------
            print("\n[TEST 4] Direct Cross-Facility Mutation Attempt (Staff A tries to mutate Referral B)...")
            cross_attack = await client.post(
                f"/facility/referrals/{ref_b_id}/receive",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"notes": "Malicious cross-facility modification attempt"}
            )
            print(f"  -> Cross-facility response status: {cross_attack.status_code}")
            print(f"  -> Response body: {cross_attack.json()}")
            assert cross_attack.status_code == 403, f"Expected 403 Forbidden, got {cross_attack.status_code}"
            print("  ✓ PASS: Cross-facility mutation strictly rejected with 403 Forbidden!")

            # -------------------------------------------------------------
            # TEST 5: Illegal State Transition Check
            # -------------------------------------------------------------
            print("\n[TEST 5] Illegal Transition Check (in_transit -> closed skipping received)...")
            illegal_skip = await client.post(
                f"/facility/referrals/{ref_a_id}/close",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"notes": "Attempting illegal state skip"}
            )
            print(f"  -> Illegal transition response status: {illegal_skip.status_code}")
            print(f"  -> Response body: {illegal_skip.json()}")
            assert illegal_skip.status_code == 400, f"Expected 400 Bad Request, got {illegal_skip.status_code}"
            print("  ✓ PASS: Illegal state transition properly rejected with 400 Bad Request!")

            # -------------------------------------------------------------
            # TEST 6: Legitimate State Progression (in_transit -> received -> closed)
            # -------------------------------------------------------------
            print("\n[TEST 6] Legal State Progression for Referral A...")
            # Step 1: in_transit -> received_at_facility
            recv_res = await client.post(
                f"/facility/referrals/{ref_a_id}/receive",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"notes": "Patient arrived via 108 ambulance, admitted to triage bay"}
            )
            assert recv_res.status_code == 200, f"Receive failed: {recv_res.text}"
            recv_data = recv_res.json()
            assert recv_data["new_state"] == "received_at_facility"
            assert recv_data["updated_by_staff_id"] == staff_a_id
            print(f"  ✓ Step 1 Success: State is now 'received_at_facility' (updated_by: {recv_data['updated_by_staff_id']})")

            # Step 2: received_at_facility -> closed
            close_res = await client.post(
                f"/facility/referrals/{ref_a_id}/close",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"notes": "Treatment completed, antibiotic course prescribed, discharged"}
            )
            assert close_res.status_code == 200, f"Close failed: {close_res.text}"
            close_data = close_res.json()
            assert close_data["new_state"] == "closed"
            assert close_data["updated_by_staff_id"] == staff_a_id
            print(f"  ✓ Step 2 Success: State is now 'closed' (updated_by: {close_data['updated_by_staff_id']})")

            # -------------------------------------------------------------
            # TEST 7: Terminal State Check (cannot transition after closed)
            # -------------------------------------------------------------
            print("\n[TEST 7] Terminal State Check (mutating closed referral)...")
            after_close = await client.post(
                f"/facility/referrals/{ref_a_id}/receive",
                headers={"Authorization": f"Bearer {token_a}"},
            )
            assert after_close.status_code == 400
            print(f"  ✓ PASS: Cannot transition closed referral (rejected with 400)")

        # -------------------------------------------------------------
        # TEST 8: Database Audit Trail Verification
        # -------------------------------------------------------------
        print("\n[TEST 8] Database Audit Trail Verification in referral_state_transitions...")
        async with pool.acquire() as conn:
            transitions = await conn.fetch(
                """
                SELECT
                    rst.id,
                    rst.from_state,
                    rst.to_state,
                    rst.updated_by_staff_id,
                    fs.name AS staff_name,
                    rst.changed_at,
                    rst.notes
                FROM referral_state_transitions rst
                LEFT JOIN facility_staff fs ON rst.updated_by_staff_id = fs.id
                WHERE rst.referral_id = $1
                ORDER BY rst.changed_at ASC
                """,
                uuid.UUID(ref_a_id)
            )

            print(f"Audit rows for Referral {ref_a_id}:")
            for idx, tr in enumerate(transitions, 1):
                print(f"  [{idx}] {tr['from_state']} -> {tr['to_state']} | Staff: {tr['staff_name']} ({tr['updated_by_staff_id']}) | Notes: {tr['notes']}")

            # Verify the last two rows have updated_by_staff_id = staff_a_id
            staff_transitions = [t for t in transitions if t["updated_by_staff_id"] is not None]
            assert len(staff_transitions) >= 2, "Expected at least 2 staff transitions recorded"
            assert str(staff_transitions[-2]["updated_by_staff_id"]) == staff_a_id
            assert staff_transitions[-2]["to_state"] == "received_at_facility"
            assert str(staff_transitions[-1]["updated_by_staff_id"]) == staff_a_id
            assert staff_transitions[-1]["to_state"] == "closed"
            print("  ✓ PASS: Audit trail contains correct updated_by_staff_id and timestamps!")

        print("\n==================================================================")
        print("ALL TESTS PASSED WITH 100% SUCCESS!")
        print("==================================================================")

    finally:
        await close_pool()

if __name__ == "__main__":
    asyncio.run(run_tests())
