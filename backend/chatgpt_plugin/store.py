"""Explicit sidecar migration and short DB-API transactions; no legacy app import."""

from __future__ import annotations

import hashlib
import sqlite3
from contextlib import contextmanager

from .models import DomainError


class Session:
    def __init__(self, connection, dialect):
        self.connection = connection
        self.dialect = dialect

    def sql(self, query):
        return query.replace("?", "%s") if self.dialect == "postgres" else query

    def all(self, query, args=()):
        cursor = self.connection.cursor()
        try:
            cursor.execute(self.sql(query), args)
            names = [part[0] for part in cursor.description]
            return [
                dict(zip(names, row)) if not isinstance(row, dict) else dict(row)
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()

    def one(self, query, args=()):
        rows = self.all(query, args)
        return rows[0] if rows else None

    def execute(self, query, args=()):
        cursor = self.connection.cursor()
        try:
            cursor.execute(self.sql(query), args)
            return cursor.rowcount
        finally:
            cursor.close()

    def insert_event(self, values):
        fields = tuple(values)
        # All field names originate in the service, never tool inputs.
        query = (
            "INSERT INTO events ("
            + ",".join(fields)
            + ") VALUES ("
            + ",".join("?" for _ in fields)
            + ")"
        )
        cursor = self.connection.cursor()
        try:
            cursor.execute(
                self.sql(
                    query + (" RETURNING id" if self.dialect == "postgres" else "")
                ),
                tuple(values.values()),
            )
            if self.dialect == "postgres":
                row = cursor.fetchone()
                return row["id"] if isinstance(row, dict) else row[0]
            return cursor.lastrowid
        finally:
            cursor.close()

    def lock_idempotency(self, user_id, key):
        if self.dialect == "postgres":
            lock = int.from_bytes(
                hashlib.sha256(f"{user_id}:{key}".encode()).digest()[:8],
                "big",
                signed=True,
            )
            self.one("SELECT pg_advisory_xact_lock(?)", (lock,))

    @property
    def for_update(self):
        return " FOR UPDATE" if self.dialect == "postgres" else ""


class PluginStore:
    """connection_factory must return a NEW, non-autocommit DB-API connection.

    SQLite's BEGIN IMMEDIATE and PostgreSQL row/advisory locks serialize writes.
    Call migrate explicitly during an operator-controlled migration, not import.
    """

    def __init__(self, connection_factory, dialect="sqlite"):
        if dialect not in ("sqlite", "postgres"):
            raise ValueError("dialect must be sqlite or postgres")
        self.connection_factory = connection_factory
        self.dialect = dialect

    @contextmanager
    def transaction(self, write=False):
        connection = self.connection_factory()
        try:
            if self.dialect == "sqlite":
                connection.execute("PRAGMA foreign_keys = ON")
                connection.execute("PRAGMA busy_timeout = 10000")
                connection.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            elif getattr(connection, "autocommit", False):
                connection.autocommit = False
            yield Session(connection, self.dialect)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def migrate(self):
        with self.transaction(write=True) as tx:
            if self.dialect == "sqlite":
                columns = {row["name"] for row in tx.all("PRAGMA table_info(events)")}
            else:
                columns = {
                    row["column_name"]
                    for row in tx.all(
                        "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='events'"
                    )
                }
            required = {
                "id",
                "title",
                "description",
                "short_description",
                "date",
                "start_time",
                "end_time",
                "end_date",
                "category",
                "address",
                "city",
                "state",
                "country",
                "lat",
                "lng",
                "created_by",
                "slug",
                "is_published",
                "start_datetime",
                "end_datetime",
                "host_name",
                "event_url",
                "price",
                "currency",
                "fee_required",
                "updated_at",
            }
            if required - columns:
                raise DomainError(
                    "schema_not_ready",
                    "Legacy event migrations must run first; missing columns: "
                    + ", ".join(sorted(required - columns)),
                    503,
                )
            tx.execute("""CREATE TABLE IF NOT EXISTS plugin_drafts (
                id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                payload TEXT, version INTEGER NOT NULL, review_hash TEXT NOT NULL,
                status TEXT NOT NULL, event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL
            )""")
            tx.execute("""CREATE TABLE IF NOT EXISTS plugin_publications (
                event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                draft_id TEXT UNIQUE REFERENCES plugin_drafts(id) ON DELETE SET NULL, status TEXT NOT NULL,
                starts_at TEXT, ends_at TEXT, timezone TEXT, updated_at TEXT NOT NULL
            )""")
            tx.execute("""CREATE TABLE IF NOT EXISTS plugin_idempotency (
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL,
                request_hash TEXT NOT NULL, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL, PRIMARY KEY (owner_id, key)
            )""")
            tx.execute(
                "CREATE INDEX IF NOT EXISTS plugin_drafts_owner_status ON plugin_drafts(owner_id, status, expires_at)"
            )

    def purge_expired(self, now_iso):
        """Erase draft contents; retain minimal retry/ownership tombstones.

        This must be scheduled by the operator. Reads enforce expiry immediately,
        independently of cleanup. Published events have their own retention policy.
        """
        with self.transaction(write=True) as tx:
            if self.dialect == "postgres":
                # Bound lock waits and execution so optional cleanup cannot hang
                # the combined application's startup or scheduler indefinitely.
                tx.execute("SET LOCAL statement_timeout = '5000ms'")
            return tx.execute(
                "UPDATE plugin_drafts SET payload=NULL, status=CASE WHEN status='draft' THEN 'expired' ELSE status END WHERE expires_at<=? AND payload IS NOT NULL",
                (now_iso,),
            )


def sqlite_store(path):
    return PluginStore(lambda: sqlite3.connect(path, timeout=10), "sqlite")
