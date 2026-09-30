"""Local fixture creation and explicit, independently deployable operations."""

from __future__ import annotations

import argparse
import ipaddress
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path


def trusted_proxy_allowlist(value: str | None) -> str:
    """Normalize an explicit proxy boundary without trusting arbitrary senders."""
    if value is None or value == "":
        return ""
    normalized, networks = [], []
    for entry in value.split(","):
        item = entry.strip()
        if not item or "*" in item or "%" in item:
            raise ValueError(
                "Trusted proxies must be comma-separated exact IP addresses or CIDR networks"
            )
        try:
            if "/" in item:
                network = ipaddress.ip_network(item, strict=True)
                canonical = str(network)
            else:
                address = ipaddress.ip_address(item)
                network = ipaddress.ip_network(address)
                canonical = str(address)
        except ValueError:
            raise ValueError(
                "Trusted proxies must be exact IP addresses or canonical CIDR networks; hostnames are not allowed"
            ) from None
        if network.prefixlen == 0 or network.network_address.is_unspecified:
            raise ValueError(
                "Trusted proxies cannot include unspecified addresses or unrestricted networks"
            )
        if canonical not in normalized:
            normalized.append(canonical)
            networks.append(network)
    # Reject an unrestricted family even if expressed as multiple smaller CIDRs.
    for version in (4, 6):
        collapsed = ipaddress.collapse_addresses(
            network for network in networks if network.version == version
        )
        if any(network.prefixlen == 0 for network in collapsed):
            raise ValueError(
                "Trusted proxy ranges cannot collectively trust the entire Internet"
            )
    return ",".join(normalized)


def seed_demo(path: Path) -> None:
    """Create a NEW synthetic database; never open or replace an existing file."""
    path = path.resolve()
    if not path.parent.is_dir():
        raise ValueError("Create the destination directory first")
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        from backend.database_schema import EVENT_FIELDS

        with sqlite3.connect(path) as connection:
            connection.execute(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, hashed_password TEXT, role TEXT)"
            )
            connection.execute(
                "INSERT INTO users VALUES (1, 'local-fixture@example.invalid', '!', 'user')"
            )
            # Use the application's full event schema while explicitly keeping
            # the SQLite fixture independent of inherited DATABASE_URL settings.
            fields = [
                (name, "INTEGER PRIMARY KEY" if name == "id" else ddl)
                for name, ddl in EVENT_FIELDS
            ]
            connection.execute(
                "CREATE TABLE events ("
                + ",".join(name + " " + ddl for name, ddl in fields)
                + ")"
            )
            start = (datetime.now(timezone.utc) + timedelta(days=14)).replace(
                hour=17, minute=0, second=0, microsecond=0
            )
            end = start + timedelta(hours=2)
            connection.execute(
                """INSERT INTO events (title,description,date,start_time,end_date,end_time,
                    category,address,city,state,country,lat,lng,created_by,slug,is_published,
                    start_datetime,end_datetime,host_name)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    "LOCAL TEST — Community art evening",
                    "Synthetic local fixture. This is not a real public event.",
                    start.date().isoformat(),
                    "17:00",
                    end.date().isoformat(),
                    "19:00",
                    "arts",
                    "Example Community Hall",
                    "Example City",
                    "Example Region",
                    "Example Country",
                    0.0,
                    0.0,
                    1,
                    "local-test-community-art",
                    True,
                    start.isoformat(),
                    end.isoformat(),
                    "Local test organizer",
                ),
            )
        from .auth import IdentityStore
        from .store import sqlite_store

        sqlite_store(str(path)).migrate()
        IdentityStore(lambda: sqlite3.connect(path)).migrate()
    except Exception:
        path.unlink(missing_ok=True)
        raise


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(
        description="Todo-Events plugin operator commands. No automatic account creation or publication."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    demo = commands.add_parser(
        "seed-demo", help="Create a new synthetic LOCAL SQLite fixture only"
    )
    demo.add_argument("path", type=Path)
    commands.add_parser(
        "migrate",
        help="Explicitly create plugin sidecar tables in the configured existing event database",
    )
    commands.add_parser(
        "purge-expired",
        help="Erase expired draft payloads; retain minimal retry and ownership records",
    )
    serve = commands.add_parser(
        "serve",
        help="Serve the MCP endpoint; configuration and existing schema required",
    )
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=int(os.getenv("PORT", "8787")))
    args = parser.parse_args(argv)
    if args.command == "seed-demo":
        seed_demo(args.path)
        print(
            f"Created synthetic LOCAL fixture: {args.path.resolve()}. No login, credential, or real listing created."
        )
        return

    from .server import ServerSettings, create_app, database_factory

    if args.command == "serve":
        import uvicorn

        if not 1 <= args.port <= 65535:
            parser.error("Port must be between 1 and 65535")
        try:
            trusted_proxies = trusted_proxy_allowlist(
                os.getenv("PLUGIN_TRUSTED_PROXY_IPS")
            )
        except ValueError as error:
            parser.error(str(error))
        settings = ServerSettings.from_env()
        if settings.auth.development and args.host not in {
            "127.0.0.1",
            "localhost",
            "::1",
        }:
            parser.error("Development mode must bind to loopback")
        uvicorn.run(
            create_app(settings=settings),
            host=args.host,
            port=args.port,
            access_log=False,
            proxy_headers=bool(trusted_proxies),
            forwarded_allow_ips=trusted_proxies,
        )
        return

    from .auth import IdentityStore
    from .models import iso_utc
    from .store import PluginStore

    factory, dialect = database_factory()
    store = PluginStore(factory, dialect)
    if args.command == "migrate":
        store.migrate()
        IdentityStore(factory, dialect).migrate()
        print(
            "Plugin sidecar tables ready. No identities, credentials, or events created."
        )
    elif args.command == "purge-expired":
        count = store.purge_expired(iso_utc(datetime.now(timezone.utc)))
        print(
            f"Erased expired draft contents: {count}. Public listings and minimal retry records retained."
        )
