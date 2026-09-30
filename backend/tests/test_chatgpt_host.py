"""Real MCP sidecar dispatch without changing legacy middleware or startup."""

import asyncio
import os
import sqlite3
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from backend.chatgpt_plugin.auth import AuthenticationError, AuthSettings, OAuthVerifier
from backend.chatgpt_plugin.cli import seed_demo
from backend.chatgpt_plugin.server import database_factory
from backend.plugin_host import CombinedApp, create_host

PUBLIC_NAMES = {"list_search_areas", "search_events", "get_event", "search_venues"}


@pytest.fixture
def config(monkeypatch, tmp_path):
    for name in (
        "PLUGIN_MODE",
        "PLUGIN_OAUTH_ISSUER",
        "PLUGIN_OAUTH_AUDIENCE",
        "PLUGIN_OAUTH_JWKS_URL",
        "PLUGIN_UI_DOMAIN",
        "PLUGIN_UI_PATH",
        "PLUGIN_DATABASE_URL",
        "DATABASE_URL",
        "PLUGIN_TRUSTED_PROXY_IPS",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("PLUGIN_ENV", "production")
    monkeypatch.setenv("PLUGIN_RESOURCE_URL", "https://backend.example.test/mcp")
    path = tmp_path / "fixture.sqlite3"
    seed_demo(path)
    monkeypatch.setenv("PLUGIN_SQLITE_PATH", str(path))
    return path


def legacy(events):
    @asynccontextmanager
    async def lifespan(app):
        events.append("legacy-start")
        yield {"legacy_marker": "available"}
        events.append("legacy-stop")

    async def health(request):
        return JSONResponse({"legacy": True, "state": request.state.legacy_marker})

    class LegacyCors(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            if request.method == "OPTIONS":
                return JSONResponse(
                    {"legacy_preflight": True},
                    headers={"Access-Control-Allow-Origin": "*"},
                )
            response = await call_next(request)
            response.headers["X-Legacy-Middleware"] = "yes"
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response

    app = Starlette(
        routes=[Route("/health", health), Route("/events", health)], lifespan=lifespan
    )
    app.add_middleware(LegacyCors)
    return app


def rpc(client, method, params=None, headers=None):
    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
        headers={"Accept": "application/json, text/event-stream", **(headers or {})},
    )
    assert response.status_code == 200, response.text
    return response.json()["result"]


def test_default_off_preserves_legacy_and_runs_only_its_lifespan(config):
    events = []
    app = create_host(legacy(events))
    with TestClient(app, base_url="https://backend.example.test") as client:
        assert client.get("/health").json() == {"legacy": True, "state": "available"}
        assert client.get("/events").headers["X-Legacy-Middleware"] == "yes"
        assert client.post("/mcp").json()["reason"] == "disabled"
        assert client.get("/mcp/health").status_code == 503
        assert events == ["legacy-start"]
    assert events == ["legacy-start", "legacy-stop"]


def test_public_mode_real_transport_exposes_only_four_anonymous_tools(config):
    app = create_host(legacy([]), mode="public")
    with TestClient(app, base_url="https://backend.example.test") as client:
        health = client.get("/mcp/health")
        assert health.json()["mode"] == "public"
        assert health.json()["organizer_auth_configured"] is False
        assert client.get("/health").json()["legacy"]
        initialized = rpc(
            client,
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "host-test", "version": "1"},
            },
        )
        assert initialized["serverInfo"]["name"] == "Todo-Events"
        tools = rpc(client, "tools/list")["tools"]
        assert {tool["name"] for tool in tools} == PUBLIC_NAMES
        assert all(tool["securitySchemes"] == [{"type": "noauth"}] for tool in tools)
        result = rpc(
            client,
            "tools/call",
            {"name": "search_events", "arguments": {}},
            headers={"Authorization": "Bearer irrelevant"},
        )
        assert result["structuredContent"]["events"][0]["title"].startswith(
            "LOCAL TEST"
        )
        assert not result["isError"]
        assert (
            client.get("/.well-known/oauth-protected-resource/mcp").status_code == 503
        )
    assert not app.ready


@pytest.mark.parametrize(
    "name",
    [
        "prepare_event",
        "get_draft",
        "list_organizer_events",
        "publish_event",
        "cancel_draft",
        "cancel_event",
    ],
)
def test_public_mode_direct_organizer_calls_are_rejected_without_mutation(config, name):
    with TestClient(
        create_host(legacy([]), mode="public"), base_url="https://backend.example.test"
    ) as client:
        result = rpc(
            client,
            "tools/call",
            {"name": name, "arguments": {"confirmed": True}},
            headers={"Authorization": "Bearer legacy-or-oauth-token"},
        )
        assert result["isError"]
        assert result["structuredContent"]["error"]["code"] == "unknown_tool"
    with sqlite3.connect(config) as connection:
        assert (
            connection.execute("SELECT count(*) FROM plugin_drafts").fetchone()[0] == 0
        )
        assert connection.execute("SELECT count(*) FROM events").fetchone()[0] == 1


def test_plugin_cors_and_host_checks_bypass_legacy_permissive_middleware(config):
    with TestClient(
        create_host(legacy([]), mode="public"), base_url="https://backend.example.test"
    ) as client:
        response = client.options(
            "/mcp",
            headers={
                "Origin": "https://chatgpt.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "mcp-protocol-version,authorization",
            },
        )
        assert response.status_code == 200
        assert response.headers["Access-Control-Allow-Origin"] == "https://chatgpt.com"
        assert "X-Legacy-Middleware" not in response.headers
        assert (
            client.options(
                "/mcp",
                headers={
                    "Origin": "https://evil.example",
                    "Access-Control-Request-Method": "POST",
                },
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/mcp",
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
                headers={
                    "Host": "evil.example",
                    "Accept": "application/json, text/event-stream",
                },
            ).status_code
            == 421
        )
        assert client.options(
            "/events", headers={"Origin": "https://evil.example"}
        ).json()["legacy_preflight"]


@pytest.mark.parametrize(
    "mode,patch",
    [
        ("full", {}),
        ("not-a-mode", {}),
        ("public", {"PLUGIN_RESOURCE_URL": "https://backend.example.test/other"}),
        ("public", {"PLUGIN_RESOURCE_URL": "http://backend.example.test/mcp"}),
        ("public", {"PLUGIN_OAUTH_ISSUER": "https://issuer.example.test"}),
        ("public", {"PLUGIN_TRUSTED_PROXY_IPS": "*"}),
    ],
)
def test_invalid_plugin_configuration_does_not_break_legacy(
    config, monkeypatch, mode, patch
):
    for name, value in patch.items():
        monkeypatch.setenv(name, value)
    with TestClient(
        create_host(legacy([]), mode=mode), base_url="https://backend.example.test"
    ) as client:
        assert client.get("/health").status_code == 200
        response = client.post("/mcp")
        assert response.status_code == 503
        assert response.json()["reason"] == "configuration_unavailable"
        assert "issuer.example" not in response.text


def test_full_mode_preserves_oauth_challenge(config, monkeypatch):
    monkeypatch.setenv("PLUGIN_OAUTH_ISSUER", "https://issuer.example.test")
    monkeypatch.setenv("PLUGIN_OAUTH_AUDIENCE", "https://backend.example.test/mcp")
    monkeypatch.setenv("PLUGIN_OAUTH_JWKS_URL", "https://issuer.example.test/keys")
    with TestClient(
        create_host(legacy([]), mode="full"), base_url="https://backend.example.test"
    ) as client:
        assert len(rpc(client, "tools/list")["tools"]) == 10
        result = rpc(
            client, "tools/call", {"name": "list_organizer_events", "arguments": {}}
        )
        assert result["isError"]
        assert result["_meta"]["mcp/www_authenticate"]
        assert (
            client.get("/.well-known/oauth-protected-resource").json()["resource"]
            == "https://backend.example.test/mcp"
        )


def test_public_verifier_rejects_even_if_provider_is_configured():
    settings = AuthSettings(
        "https://backend.example.test/mcp",
        issuer="https://issuer.example.test",
        audience="https://backend.example.test/mcp",
        jwks_url="https://issuer.example.test/keys",
        public_only=True,
    )
    with pytest.raises(AuthenticationError, match="disabled"):
        asyncio.run(
            OAuthVerifier(settings, None).verify(
                "Bearer anything", frozenset({"events:publish"})
            )
        )


def test_lifespans_start_and_stop_in_correct_order_and_failure_is_isolated(config):
    events = []

    @asynccontextmanager
    async def lifecycle(app):
        events.append("plugin-start")
        yield
        events.append("plugin-stop")

    plugin = Starlette(lifespan=lifecycle)
    with TestClient(CombinedApp(legacy(events), plugin)):
        assert events == ["legacy-start", "plugin-start"]
    assert events == ["legacy-start", "plugin-start", "plugin-stop", "legacy-stop"]

    @asynccontextmanager
    async def failed(app):
        raise RuntimeError("credentials must never leak")
        yield

    with TestClient(CombinedApp(legacy([]), Starlette(lifespan=failed))) as client:
        assert client.get("/health").status_code == 200
        response = client.get("/mcp/health")
        assert response.status_code == 503
        assert response.json()["reason"] == "startup_unavailable"
        assert "credentials" not in response.text


def test_host_construction_does_not_migrate_database(config, monkeypatch):
    empty = config.parent / "existing-empty.sqlite3"
    sqlite3.connect(empty).close()
    monkeypatch.setenv("PLUGIN_SQLITE_PATH", str(empty))
    app = create_host(legacy([]), mode="public")
    with TestClient(app, base_url="https://backend.example.test") as client:
        assert client.get("/health").status_code == 200
        result = rpc(client, "tools/call", {"name": "search_events", "arguments": {}})
        assert result["structuredContent"]["error"]["code"] == "temporarily_unavailable"
    with sqlite3.connect(empty) as connection:
        assert (
            connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
            == []
        )


def test_legacy_database_fallback_is_explicit_and_not_copied_into_environment(
    config, monkeypatch
):
    monkeypatch.setenv("DATABASE_URL", "postgresql://fixture-only.invalid/test")
    calls = []
    monkeypatch.setattr(
        "psycopg2.connect", lambda *args, **kwargs: calls.append((args, kwargs))
    )
    _, dialect = database_factory()
    assert dialect == "sqlite"
    factory, dialect = database_factory(use_legacy_environment=True)
    assert dialect == "postgres"
    factory()
    assert calls[0][0] == ("postgresql://fixture-only.invalid/test",)


def test_backend_root_can_import_entrypoint_and_run_migration_help_without_legacy_startup():
    backend = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import plugin_host; import sys; print('backend' in sys.modules)",
        ],
        cwd=backend,
        capture_output=True,
        text=True,
        check=True,
    )
    assert result.stdout.strip() == "False"
    help_result = subprocess.run(
        [sys.executable, "-m", "chatgpt_plugin", "migrate", "--help"],
        cwd=backend,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "migrate" in help_result.stdout


def test_actual_backend_root_entrypoint_serves_web_and_public_mcp(config):
    backend = Path(__file__).resolve().parents[1]
    environment = {
        **os.environ,
        "TODOEVENTS_SKIP_STARTUP": "1",
        "TODOEVENTS_DB_FILE": str(config),
        "PLUGIN_MODE": "public",
    }
    environment.pop("RENDER", None)
    environment.pop("RAILWAY_ENVIRONMENT", None)
    script = """
from starlette.testclient import TestClient
from plugin_host import create_app
with TestClient(create_app(), base_url='https://backend.example.test') as client:
    assert client.get('/health').json()['status'] == 'healthy'
    assert client.get('/').json()['message'] == 'EventFinder API is running'
    response = client.post('/mcp', headers={'Accept': 'application/json, text/event-stream'}, json={'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list', 'params': {}})
    assert {tool['name'] for tool in response.json()['result']['tools']} == {'search_events', 'get_event', 'search_venues', 'list_search_areas'}
    assert client.get('/mcp/health').json()['mode'] == 'public'
print('combined-backend-ok')
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend,
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr[-3000:]
    assert result.stdout.strip().endswith("combined-backend-ok")
