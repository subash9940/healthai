import os
import sys
import urllib.parse
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Force target test database for pytest runs
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql://subash@/jeevanya_test")

# Safety assertion: Ensure test database name strictly ends with _test
db_url = os.environ.get("DATABASE_URL", "")
parsed = urllib.parse.urlparse(db_url)
db_name = parsed.path.lstrip("/")
if not db_name.endswith("_test"):
    raise RuntimeError(
        f"SAFETY ABORT: Refusing to run tests against non-test database '{db_name}'. "
        f"Database name must end with '_test'."
    )
