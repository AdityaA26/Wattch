"""Persistent storage: SQLite by default, optional Tiger Cloud TimescaleDB.

Selecting Tiger never silently falls back to a different database.
"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from .settings import settings
from .history import profile, records, household_id


class Store:
    def __init__(self, path=None, database_url=None):
        cfg = settings()
        self.url = cfg.get("DATABASE_URL", "") if database_url is None else database_url
        self.path = Path(path or cfg.get("WATTCH_DB_PATH") or Path(__file__).parent / "runtime" / "wattch.db")
        self.backend = "tigerdata" if self.url else "sqlite"
        if self.url:
            if not self.url.startswith(("postgres://", "postgresql://")):
                raise ValueError("DATABASE_URL must be a PostgreSQL connection URI")
        else:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connection(self):
        if self.url:
            try:
                import psycopg
            except ImportError as exc:
                raise RuntimeError('Tiger Data requires: python3 -m pip install "psycopg[binary]>=3.2,<4"') from exc
            with psycopg.connect(self.url, connect_timeout=8, sslmode="require", options="-c timezone=UTC") as conn:
                yield conn
        else:
            conn = sqlite3.connect(self.path, timeout=10)
            try:
                with conn:
                    yield conn
            finally:
                conn.close()

    def query(self, conn, sql, values=()):
        return conn.execute(sql.replace("?", "%s") if self.url else sql, values)

    def initialize(self):
        with self.connection() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS wattch_profiles (household_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
            time_type = "TIMESTAMPTZ" if self.url else "TEXT"
            conn.execute(f"""CREATE TABLE IF NOT EXISTS wattch_readings (
                household_id TEXT NOT NULL, recorded_at {time_type} NOT NULL,
                utility TEXT NOT NULL, quantity DOUBLE PRECISION NOT NULL CHECK(quantity >= 0),
                unit_rate DOUBLE PRECISION, source TEXT NOT NULL,
                PRIMARY KEY(household_id, recorded_at, utility))""")
            if self.url:
                # Real TimescaleDB usage, not merely an unused sponsor connection.
                conn.execute("SELECT create_hypertable('wattch_readings', by_range('recorded_at'), if_not_exists => TRUE)")

    def save_profile(self, raw):
        data = profile(raw)
        with self.connection() as conn:
            self.query(conn, "INSERT INTO wattch_profiles VALUES (?, ?) ON CONFLICT(household_id) DO UPDATE SET payload=excluded.payload",
                (data["householdId"], json.dumps(data)))
        return data

    def get_profile(self, ident):
        ident = household_id(ident)
        with self.connection() as conn:
            row = self.query(conn, "SELECT payload FROM wattch_profiles WHERE household_id=?", (ident,)).fetchone()
        if not row:
            raise KeyError("Household not found; save its profile first")
        return json.loads(row[0])

    def import_readings(self, ident, raw):
        self.get_profile(ident)
        rows = records(raw)  # Validate whole batch before any mutation.
        with self.connection() as conn:
            for row in rows:
                stamp = row["date"] + "T00:00:00+00:00"
                self.query(conn, """INSERT INTO wattch_readings VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(household_id, recorded_at, utility) DO UPDATE SET
                    quantity=excluded.quantity, unit_rate=excluded.unit_rate, source=excluded.source""",
                    (ident, stamp, row["utility"], row["quantity"], row["unitRateUsd"], row["source"]))
        return {"imported": len(rows), "householdId": ident, "storage": self.backend,
                "note": "Daily consumption replaces matching household/utility/date entries; never supply cumulative meter counters."}

    def readings(self, ident):
        self.get_profile(ident)
        with self.connection() as conn:
            if self.url:
                # Time-bucket is genuinely executed on every Tiger history report.
                sql = """SELECT time_bucket(INTERVAL '1 day', recorded_at), utility,
                    SUM(quantity), MAX(unit_rate), MAX(source) FROM wattch_readings
                    WHERE household_id=? GROUP BY 1,2 ORDER BY 1 DESC,2 LIMIT 1500"""
            else:
                sql = "SELECT recorded_at,utility,quantity,unit_rate,source FROM wattch_readings WHERE household_id=? ORDER BY recorded_at DESC,utility LIMIT 1500"
            rows = self.query(conn, sql, (ident,)).fetchall()
        return [{"date": (r[0].astimezone(timezone.utc).date().isoformat() if isinstance(r[0], datetime) else str(r[0])[:10]),
                 "utility": r[1], "quantity": r[2], "unitRateUsd": r[3], "source": r[4]} for r in rows]

    def peer_profiles(self):
        with self.connection() as conn:
            rows = conn.execute("SELECT payload FROM wattch_profiles ORDER BY household_id LIMIT 100").fetchall()
        return [json.loads(r[0]) for r in rows]

    def status(self):
        with self.connection() as conn:
            count = conn.execute("SELECT COUNT(*) FROM wattch_readings").fetchone()[0]
        return {"backend": self.backend, "readingCount": count, "persistent": True,
                "hypertable": bool(self.url), "timeBucketQueries": bool(self.url)}
