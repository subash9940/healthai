"""
Seed demo Sub-Centre facility and optional staff for SOS routing and testing.
Strictly reads contact phone from environment variable DEMO_SUBCENTRE_PHONE.
NEVER hardcode phone numbers.
"""

import asyncio
import os
import sys
import bcrypt
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and "postgresql+asyncpg://" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


def hash_mpin(mpin: str) -> str:
    return bcrypt.hashpw(mpin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def seed_demo_subcentre():
    if not DATABASE_URL:
        print("DATABASE_URL not set in environment.")
        sys.exit(1)

    phone = os.getenv("DEMO_SUBCENTRE_PHONE")
    if not phone:
        print("WARNING: DEMO_SUBCENTRE_PHONE not set. Using None for contact_phone.")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # 1. Upsert Sub-Centre Mandavgan Pharata
        # Coordinates in rural Pune district (Shirur taluka)
        subcentre_name = "Sub-Centre Mandavgan Pharata"
        lat = 18.7230
        lng = 74.4560

        fac = await conn.fetchrow("SELECT id FROM facilities WHERE name = $1", subcentre_name)
        if not fac:
            fac = await conn.fetchrow(
                """
                INSERT INTO facilities (name, level, lat, lng, contact_phone, available_beds, operational_status)
                VALUES ($1, 'sub_centre', $2, $3, $4, 2, 'AVAILABLE')
                RETURNING id
                """,
                subcentre_name,
                lat,
                lng,
                phone,
            )
            print(f"Created Sub-Centre ({subcentre_name}): {fac['id']}")
        else:
            await conn.execute(
                """
                UPDATE facilities
                SET level = 'sub_centre',
                    lat = $2,
                    lng = $3,
                    contact_phone = COALESCE($4, contact_phone)
                WHERE id = $1
                """,
                fac["id"],
                lat,
                lng,
                phone,
            )
            print(f"Updated Sub-Centre ({subcentre_name}): {fac['id']}")

        subcentre_id = fac["id"]

        # 2. Upsert Staff for Sub-Centre if DEMO_SUBCENTRE_STAFF_PHONE is provided or use username 'anm_mandavgan'
        staff_username = os.getenv("DEMO_SUBCENTRE_STAFF_PHONE", "anm_mandavgan")
        mpin_hash_1234 = hash_mpin("1234")

        staff = await conn.fetchrow(
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
            "ANM Sunita Mandavgan",
            staff_username,
            mpin_hash_1234,
            subcentre_id,
        )
        print(f"Seeded Staff: {staff['name']} ({staff['phone_or_username']}) -> Sub-Centre {staff['facility_id']}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_demo_subcentre())
