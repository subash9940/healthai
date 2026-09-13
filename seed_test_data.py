import asyncio
import os
import sys
import uuid
import bcrypt
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and "postgresql+asyncpg://" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

def hash_mpin(mpin: str) -> str:
    return bcrypt.hashpw(mpin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

async def seed_facilities_and_staff():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        print("Connected to PostgreSQL database:", conn)

        # 1. Insert or get Facility A (PHC Shirur)
        fac_a = await conn.fetchrow("SELECT id FROM facilities WHERE name = $1", "PHC Shirur")
        if not fac_a:
            fac_a = await conn.fetchrow(
                """
                INSERT INTO facilities (name, level, contact_phone)
                VALUES ($1, 'phc', $2)
                RETURNING id
                """,
                "PHC Shirur",
                "020-2712345"
            )
        fac_a_id = fac_a["id"]
        print(f"Facility A (PHC Shirur): {fac_a_id}")

        # 2. Insert or get Facility B (CHC Haveli)
        fac_b = await conn.fetchrow("SELECT id FROM facilities WHERE name = $1", "CHC Haveli")
        if not fac_b:
            fac_b = await conn.fetchrow(
                """
                INSERT INTO facilities (name, level, contact_phone)
                VALUES ($1, 'chc', $2)
                RETURNING id
                """,
                "CHC Haveli",
                "020-2765432"
            )
        fac_b_id = fac_b["id"]
        print(f"Facility B (CHC Haveli): {fac_b_id}")

        # 3. Insert or update Staff A (Dr. Amit Shirur) -> Facility A, MPIN '1234'
        mpin_hash_1234 = hash_mpin("1234")
        staff_a = await conn.fetchrow(
            """
            INSERT INTO facility_staff (name, phone_or_username, mpin_hash, role, facility_id, active)
            VALUES ($1, $2, $3, 'phc_staff', $4, true)
            ON CONFLICT (phone_or_username) DO UPDATE
            SET name = EXCLUDED.name,
                mpin_hash = EXCLUDED.mpin_hash,
                facility_id = EXCLUDED.facility_id,
                active = true
            RETURNING id, name, phone_or_username, facility_id
            """,
            "Dr. Amit Shirur",
            "9876543201",
            mpin_hash_1234,
            fac_a_id,
        )
        print(f"Staff A: {staff_a['name']} ({staff_a['phone_or_username']}) -> Facility {staff_a['facility_id']}")

        # 4. Insert or update Staff B (Dr. Priya Haveli) -> Facility B, MPIN '1234'
        staff_b = await conn.fetchrow(
            """
            INSERT INTO facility_staff (name, phone_or_username, mpin_hash, role, facility_id, active)
            VALUES ($1, $2, $3, 'phc_staff', $4, true)
            ON CONFLICT (phone_or_username) DO UPDATE
            SET name = EXCLUDED.name,
                mpin_hash = EXCLUDED.mpin_hash,
                facility_id = EXCLUDED.facility_id,
                active = true
            RETURNING id, name, phone_or_username, facility_id
            """,
            "Dr. Priya Haveli",
            "9876543202",
            mpin_hash_1234,
            fac_b_id,
        )
        print(f"Staff B: {staff_b['name']} ({staff_b['phone_or_username']}) -> Facility {staff_b['facility_id']}")

        # 5. Insert test patients and triage records for Facility A and B
        pat_a = await conn.fetchrow(
            """
            INSERT INTO patients (display_name, age_years, sex, village, phone)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            "Savita Shinde",
            28,
            "female",
            "Shirur Rural",
            "9822110011",
        )
        triage_a = await conn.fetchrow(
            """
            INSERT INTO triage_records (
                patient_id, source_tier, language, symptoms, vitals,
                urgency, recommended_action, citizen_message, rule_trace,
                requires_referral, referral_target_level
            )
            VALUES (
                $1, 'asha_app', 'mr', '["severe_abdominal_pain", "fever"]'::jsonb,
                '{"temperature_celsius": 39.2}'::jsonb, 'high',
                'Refer immediately to PHC', 'तात्काळ प्राथमिक आरोग्य केंद्रात जा',
                '["R-ADULT-HIGH-002"]'::jsonb, true, 'phc'
            )
            RETURNING id
            """,
            pat_a["id"]
        )
        ref_a = await conn.fetchrow(
            """
            INSERT INTO referrals (triage_record_id, facility_id, created_by_role, state)
            VALUES ($1, $2, 'asha', 'in_transit')
            RETURNING id
            """,
            triage_a["id"],
            fac_a_id,
        )
        await conn.execute(
            """
            INSERT INTO referral_state_transitions (referral_id, from_state, to_state, notes)
            VALUES ($1, 'created', 'in_transit', 'Patient departed for PHC Shirur')
            """,
            ref_a["id"],
        )
        print(f"Referral A (for Facility A): {ref_a['id']} (state: in_transit)")

        # Patient & Referral for Facility B
        pat_b = await conn.fetchrow(
            """
            INSERT INTO patients (display_name, age_years, sex, village, phone)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            "Ganesh Jadhav",
            45,
            "male",
            "Haveli Town",
            "9833220022",
        )
        triage_b = await conn.fetchrow(
            """
            INSERT INTO triage_records (
                patient_id, source_tier, language, symptoms, vitals,
                urgency, recommended_action, citizen_message, rule_trace,
                requires_referral, referral_target_level
            )
            VALUES (
                $1, 'citizen_web', 'en', '["chest_pain", "shortness_of_breath"]'::jsonb,
                '{"systolic_bp": 170, "diastolic_bp": 105}'::jsonb, 'emergency',
                'Emergency transfer to CHC', 'Immediate emergency attention required',
                '["R-ADULT-EMG-001"]'::jsonb, true, 'chc'
            )
            RETURNING id
            """,
            pat_b["id"]
        )
        ref_b = await conn.fetchrow(
            """
            INSERT INTO referrals (triage_record_id, facility_id, created_by_role, state)
            VALUES ($1, $2, 'phc_staff', 'in_transit')
            RETURNING id
            """,
            triage_b["id"],
            fac_b_id,
        )
        await conn.execute(
            """
            INSERT INTO referral_state_transitions (referral_id, from_state, to_state, notes)
            VALUES ($1, 'created', 'in_transit', 'Patient in transit to CHC Haveli')
            """,
            ref_b["id"],
        )
        print(f"Referral B (for Facility B): {ref_b['id']} (state: in_transit)")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed_facilities_and_staff())
