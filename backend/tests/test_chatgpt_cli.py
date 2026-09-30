"""Operator commands must never overwrite a real database or create credentials."""

import sqlite3
from types import SimpleNamespace

import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from backend.chatgpt_plugin.cli import main, seed_demo, trusted_proxy_allowlist


def test_seed_demo_is_synthetic_and_contains_no_auth_authority(tmp_path):
    path = tmp_path / "local.sqlite3"
    seed_demo(path)
    with sqlite3.connect(path) as connection:
        assert (
            connection.execute(
                "SELECT count(*) FROM plugin_oauth_identities"
            ).fetchone()[0]
            == 0
        )
        assert (
            connection.execute("SELECT hashed_password FROM users").fetchone()[0] == "!"
        )
        assert (
            connection.execute("SELECT description FROM events")
            .fetchone()[0]
            .startswith("Synthetic local fixture")
        )
    assert path.stat().st_mode & 0o777 == 0o600


def test_seed_demo_refuses_existing_database(tmp_path):
    path = tmp_path / "existing.sqlite3"
    original = b"existing content must survive"
    path.write_bytes(original)
    with pytest.raises(FileExistsError):
        seed_demo(path)
    assert path.read_bytes() == original


@pytest.mark.parametrize("value", [None, ""])
def test_proxy_trust_is_disabled_by_default(value):
    assert trusted_proxy_allowlist(value) == ""


def test_explicit_proxy_ips_and_networks_are_normalized_and_deduplicated():
    assert (
        trusted_proxy_allowlist(
            " 10.20.0.2,10.20.1.0/24,2001:0db8::1,2001:db8:1::/48,10.20.0.2 "
        )
        == "10.20.0.2,10.20.1.0/24,2001:db8::1,2001:db8:1::/48"
    )


@pytest.mark.parametrize(
    "value",
    [
        "*",
        "0.0.0.0/0",
        "::/0",
        "0.0.0.0",
        "::",
        "proxy.example.com",
        "localhost",
        "10.0.0.1,*",
        "10.0.0.1,",
        " , ",
        "10.0.0.1/24",
        "10.0.0.0/33",
        "2001:db8::/129",
        "127.0.0.1:8000",
        "fe80::1%eth0",
        "0.0.0.0/1,128.0.0.0/1",
    ],
)
def test_invalid_or_unrestricted_proxy_trust_never_falls_back(value):
    with pytest.raises(ValueError):
        trusted_proxy_allowlist(value)


@pytest.mark.parametrize(
    "allowlist,enabled,normalized",
    [
        (None, False, ""),
        ("10.20.0.2, 2001:0db8::1", True, "10.20.0.2,2001:db8::1"),
    ],
)
def test_serve_passes_only_explicit_proxy_trust_to_uvicorn(
    monkeypatch, allowlist, enabled, normalized
):
    from backend.chatgpt_plugin import server

    if allowlist is None:
        monkeypatch.delenv("PLUGIN_TRUSTED_PROXY_IPS", raising=False)
    else:
        monkeypatch.setenv("PLUGIN_TRUSTED_PROXY_IPS", allowlist)
    # Uvicorn's ambient fallback must never enable trust accidentally.
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "*")
    configuration = SimpleNamespace(auth=SimpleNamespace(development=False))
    app = object()
    monkeypatch.setattr(server.ServerSettings, "from_env", lambda: configuration)
    monkeypatch.setattr(server, "create_app", lambda **kwargs: app)
    calls = []
    monkeypatch.setattr(
        "uvicorn.run", lambda *args, **kwargs: calls.append((args, kwargs))
    )
    main(["serve", "--port", "8787"])
    assert calls[0][0] == (app,)
    assert calls[0][1]["proxy_headers"] is enabled
    assert calls[0][1]["forwarded_allow_ips"] == normalized


def test_invalid_proxy_config_stops_before_app_creation(monkeypatch):
    from backend.chatgpt_plugin import server

    monkeypatch.setenv("PLUGIN_TRUSTED_PROXY_IPS", "*")
    monkeypatch.setattr(
        server,
        "create_app",
        lambda **kwargs: pytest.fail("Invalid trust must not create an app"),
    )
    monkeypatch.setattr(
        "uvicorn.run",
        lambda *args, **kwargs: pytest.fail("Invalid trust must not start a server"),
    )
    with pytest.raises(SystemExit) as caught:
        main(["serve"])
    assert caught.value.code == 2


def test_only_approved_proxy_can_supply_client_addresses():
    async def peer(request):
        return JSONResponse({"client": request.client.host})

    app = ProxyHeadersMiddleware(
        Starlette(routes=[Route("/peer", peer)]),
        trusted_hosts=trusted_proxy_allowlist("10.20.0.0/24"),
    )
    with TestClient(app, client=("10.20.0.2", 12345)) as client:
        assert (
            client.get("/peer", headers={"X-Forwarded-For": "198.51.100.1"}).json()[
                "client"
            ]
            == "198.51.100.1"
        )
        assert (
            client.get("/peer", headers={"X-Forwarded-For": "198.51.100.2"}).json()[
                "client"
            ]
            == "198.51.100.2"
        )
        # A trusted edge appends the real peer. A forged leftmost entry cannot win.
        assert (
            client.get(
                "/peer", headers={"X-Forwarded-For": "203.0.113.99, 198.51.100.2"}
            ).json()["client"]
            == "198.51.100.2"
        )
    with TestClient(app, client=("198.51.100.3", 12345)) as client:
        assert (
            client.get("/peer", headers={"X-Forwarded-For": "203.0.113.99"}).json()[
                "client"
            ]
            == "198.51.100.3"
        )


def test_trusted_proxy_clients_get_separate_limits_and_direct_spoofing_cannot_bypass():
    from backend.chatgpt_plugin.auth import AuthSettings
    from backend.chatgpt_plugin.server import RequestLimits, ServerSettings

    async def ok(request):
        return JSONResponse({"ok": True})

    limits = RequestLimits(
        Starlette(routes=[Route("/", ok)]),
        ServerSettings(
            auth=AuthSettings("http://localhost:8787/mcp", development=True),
            requests_per_minute=1,
        ),
    )
    app = ProxyHeadersMiddleware(
        limits, trusted_hosts=trusted_proxy_allowlist("10.20.0.0/24")
    )
    with TestClient(app, client=("10.20.0.2", 12345)) as client:
        assert (
            client.get("/", headers={"X-Forwarded-For": "198.51.100.1"}).status_code
            == 200
        )
        assert (
            client.get("/", headers={"X-Forwarded-For": "198.51.100.2"}).status_code
            == 200
        )
        assert (
            client.get("/", headers={"X-Forwarded-For": "198.51.100.1"}).status_code
            == 429
        )
    with TestClient(app, client=("198.51.100.3", 12345)) as client:
        assert (
            client.get("/", headers={"X-Forwarded-For": "203.0.113.1"}).status_code
            == 200
        )
        assert (
            client.get("/", headers={"X-Forwarded-For": "203.0.113.2"}).status_code
            == 429
        )
