"""
scripts/seed_demo_staff.py

Seeds the 3 demo facility staff accounts referenced by citizen_web quick-login presets:
1. Dr. Sharma (MO)      -> Phone: 9876543210, MPIN: 1234, Role: phc_staff  (PHC Shirur)
2. Sister Anita (Staff)  -> Phone: 9876543211, MPIN: 1234, Role: phc_staff  (PHC Shirur)
3. Admin Patil (Super)   -> Phone: 9876543212, MPIN: 1234, Role: supervisor (PHC Shirur)

Includes automatic verification that each staff member can authenticate
via POST /facility/login with MPIN 1234 and receive a valid JWT session token.
"""

import asyncio
import os
import sys
import uuid
import asyncpg
import bcrypt
import httpx
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv()

from app.main import app
from app.db import init_pool, close_pool
from app.services.auth import hash_mpin

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and "postgresql+asyncpg://" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

DEMO_STAFF_PRESETS = [
    {
        "name": "Dr. Sharma",
        "phone_or_username": "9876543210",
        "role": "phc_staff",
        "mpin": "1234",
        "facility_name": "PHC Shirur",
        "facility_level": "phc",
        "facility_phone": "020-2712345",
    },
    {
        "name": "Sister Anita",
        "phone_or_username": "9876543211",
        "role": "phc_staff",
        "mpin": "1234",
        "facility_name": "PHC Shirur",
        "facility_level": "phc",
        "facility_phone": "020-2712345",
    },
    {
        "name": "Admin Patil",
        "phone_or_username": "9876543212",
        "role": "supervisor",
        "mpin": "1234",
        "facility_name": "PHC Shirur",
        "facility_level": "phc",
        "facility_phone": "020-2712345",
    },
]


async def seed_demo_staff():
    print("=" * 70)
    print("SEEDING DEMO FACILITY STAFF ACCOUNTS")
    print("=" * 70)

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        for staff_data in DEMO_STAFF_PRESETS:
            # 1. Ensure facility exists
            fac_row = await conn.fetchrow(
                "SELECT id, name, level FROM facilities WHERE name = $1",
                staff_data["facility_name"],
            )
            if not fac_row:
                fac_row = await conn.fetchrow(
                    """
                    INSERT INTO facilities (name, level, contact_phone)
                    VALUES ($1, $2, $3)
                    RETURNING id, name, level
                    """,
                    staff_data["facility_name"],
                    staff_data["facility_level"],
                    staff_data["facility_phone"],
                )
                print(f"[+] Created facility: {fac_row['name']} ({fac_row['id']})")
            facility_id = fac_row["id"]

            # 2. Hash MPIN and upsert staff record
            hashed_pin = hash_mpin(staff_data["mpin"])
            staff_row = await conn.fetchrow(
                """
                INSERT INTO facility_staff (name, phone_or_username, mpin_hash, role, facility_id, active)
                VALUES ($1, $2, $3, $4, $5, true)
                ON CONFLICT (phone_or_username) DO UPDATE
                SET name = EXCLUDED.name,
                    mpin_hash = EXCLUDED.mpin_hash,
                    role = EXCLUDED.role,
                    facility_id = EXCLUDED.facility_id,
                    active = true
                RETURNING id, name, phone_or_username, role, facility_id
                """,
                staff_data["name"],
                staff_data["phone_or_username"],
                hashed_pin,
                staff_data["role"],
                facility_id,
            )
            print(
                f"[✓] Seeded Staff: {staff_row['name']} | "
                f"Phone: {staff_row['phone_or_username']} | "
                f"Role: {staff_row['role']} | "
                f"Facility: {staff_data['facility_name']} ({facility_id})"
            )
    finally:
        await conn.close()


async def verify_demo_staff_logins():
    print("\n" + "=" * 70)
    print("VERIFYING DEMO STAFF AUTHENTICATION (POST /facility/login)")
    print("=" * 70)

    pool = await init_pool()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            for preset in DEMO_STAFF_PRESETS:
                payload = {
                    "phone_or_username": preset["phone_or_username"],
                    "mpin": preset["mpin"],
                }
                res = await client.post("/facility/login", json=payload)
                assert res.status_code == 200, (
                    f"Login failed for {preset['name']}: {res.status_code} - {res.text}"
                )
                data = res.json()
                token = data.get("access_token")
                staff = data.get("staff")

                assert token is not None and len(token) > 20, "Missing or invalid access_token"
                assert staff["name"] == preset["name"], f"Name mismatch: {staff['name']}"
                assert (
                    staff["phone_or_username"] == preset["phone_or_username"]
                ), f"Phone mismatch: {staff['phone_or_username']}"
                assert staff["role"] == preset["role"], f"Role mismatch: {staff['role']}"

                print(
                    f"  ✓ {preset['name']} ({preset['role']}) login OK -> "
                    f"Token Prefix: {token[:20]}... | "
                    f"Facility: {staff['facility_name']} ({staff['facility_level']})"
                )
    finally:
        await close_pool()


async def main():
    await seed_demo_staff()
    await verify_demo_staff_logins()
    print("\n[SUCCESS] All demo staff accounts seeded and verified successfully.")


if __name__ == "__main__":
    asyncio.run(main())
