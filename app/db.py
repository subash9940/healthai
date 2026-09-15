"""
db.py — asyncpg connection pool for Jeevanya.

Matches the connection pattern already proven in verify_db.py.
Wire this into FastAPI via lifespan (see wiring_example.py).
"""

import os
import asyncpg
from typing import Optional

# Expected in your .env, already wired per your last session:
#   DATABASE_URL=postgresql://subash:<password>@localhost:5432/jeevanya
DATABASE_URL = os.environ.get("DATABASE_URL")

# asyncpg needs plain postgresql://, not postgresql+asyncpg://
if DATABASE_URL and "postgresql+asyncpg://" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

_pool: Optional[asyncpg.Pool] = None


async def init_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    """Call once on app startup (FastAPI lifespan)."""
    global _pool, DATABASE_URL
    if not DATABASE_URL:
        DATABASE_URL = os.environ.get("DATABASE_URL")
        if DATABASE_URL and "postgresql+asyncpg://" in DATABASE_URL:
            DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    if DATABASE_URL is None:
        raise RuntimeError(
            "DATABASE_URL not set. Check .env is loaded before init_pool() runs "
            "(e.g. via python-dotenv's load_dotenv() at the top of main.py)."
        )
    _pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=min_size,
        max_size=max_size,
    )
    return _pool


async def close_pool() -> None:
    """Call once on app shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """
    FastAPI dependency. Use as:

        async def triage_endpoint(pool: asyncpg.Pool = Depends(get_pool)):
            ...

    Raises if init_pool() hasn't run yet — that means lifespan isn't wired
    correctly, so failing loud here is intentional.
    """
    if _pool is None:
        raise RuntimeError(
            "Connection pool not initialized. Did you wire init_pool() into "
            "the FastAPI lifespan?"
        )
    return _pool
