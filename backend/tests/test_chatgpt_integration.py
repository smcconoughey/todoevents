"""Full MCP -> OAuth verification -> domain -> legacy-schema integration.

Signing keys are ephemeral in-memory test fixtures. JWKS uses MockTransport;
every database is pytest-owned temporary storage and no external API is called.
"""

import importlib.util
import json
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from starlette.testclient import TestClient

from backend.chatgpt_plugin.auth import (
    AuthSettings,
    IdentityStore,
    JWKSCache,
    OAuthVerifier,
)
from backend.chatgpt_plugin.domain import EventService
from backend.chatgpt_plugin.server import ServerSettings, create_app
from backend.chatgpt_plugin.store import sqlite_store
from backend.database_schema import EVENT_FIELDS

RESOURCE = "http://localhost:8123/mcp"
ISSUER = "https://issuer.example.test"
SCOPES = "events:read events:write events:publish"
BACKEND = Path(__file__).resolve().parents[1]
PROJECT = BACKEND.parent


@pytest.fixture
def integrated(tmp_path):
    database = tmp_path / "integration.sqlite3"
    with sqlite3.connect(database) as connection:
        connection.execute("""CREATE TABLE users
            (id INTEGER PRIMARY KEY, email TEXT, hashed_password TEXT, role TEXT)""")
        connection.execute("""INSERT INTO users VALUES
            (1, 'owner@example.test', '!', 'user'), (2, 'other@example.test', '!', 'user')""")
        fields = [
            (name, "INTEGER PRIMARY KEY" if name == "id" else kind)
            for name, kind in EVENT_FIELDS
        ]
        fields.extend(
            [
                ("secondary_category", "TEXT"),
                ("is_premium_event", "BOOLEAN DEFAULT FALSE"),
                ("banner_image", "TEXT"),
                ("logo_image", "TEXT"),
            ]
        )
        connection.execute(
            "CREATE TABLE events ("
            + ",".join(f"{name} {kind}" for name, kind in fields)
            + ")"
        )
        connection.execute("""INSERT INTO events
            (id,title,description,date,start_time,end_time,category,address,city,state,country,
             lat,lng,created_by,slug,is_published)
            VALUES (1,'Public venue event','Public details','2026-11-01','18:00','20:00',
                    'community','Public Hall','Test City','NY','USA',40,-74,1,'public-venue',TRUE),
                   (2,'Secret draft','PRIVATE CONTENT','2026-11-01','18:00','20:00',
                    'community','Private Hall','Hidden City','NY','USA',41,-74,2,'secret-draft',FALSE)""")
    store = sqlite_store(database)
    store.migrate()
    identities = IdentityStore(lambda: sqlite3.connect(database))
    identities.migrate()
    with sqlite3.connect(database) as connection:
        connection.executemany(
            """INSERT INTO plugin_oauth_identities
            (issuer, subject, user_id, scopes) VALUES (?, ?, ?, ?)""",
            [(ISSUER, "owner", 1, SCOPES), (ISSUER, "other", 2, SCOPES)],
        )

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid="ephemeral-test-key", alg="RS256", use="sig")
    settings = AuthSettings(
        resource_url=RESOURCE,
        issuer=ISSUER,
        audience=RESOURCE,
        jwks_url=ISSUER + "/jwks",
        development=True,
        clock_leeway_seconds=0,
    )
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json={"keys": [jwk]})
    )
    verifier = OAuthVerifier(
        settings, identities, jwks=JWKSCache(settings.jwks_url, transport=transport)
    )
    service = EventService(
        store, now=lambda: datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
    )
    app = create_app(
        service=service,
        verifier=verifier,
        settings=ServerSettings(auth=settings),
        testing=True,
    )

    def token(**changes):
        now = int(time.time())
        claims = {
            "iss": ISSUER,
            "aud": RESOURCE,
            "sub": "owner",
            "scope": SCOPES,
            "iat": now,
            "exp": now + 300,
        }
        claims.update(changes)
        return jwt.encode(claims, key, algorithm="RS256", headers={"kid": jwk["kid"]})

    with TestClient(app, base_url="http://localhost:8123") as client:
        yield client, token, database


def rpc(client, method, params=None, token=None):
    headers = {
        "Accept": "application/json, text/event-stream",
        "Mcp-Protocol-Version": "2025-11-25",
    }
    if token is not None:
        headers["Authorization"] = "Bearer " + token
    response = client.post(
        "/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "error" not in payload, payload
    return payload["result"]


def call(client, name, arguments=None, token=None):
    return rpc(
        client, "tools/call", {"name": name, "arguments": arguments or {}}, token
    )


def public_event():
    return {
        "title": "Public workshop",
        "description": "Everyone is welcome.",
        "category": "education",
        "starts_at": "2026-11-20T17:00:00-05:00",
        "ends_at": "2026-11-20T18:00:00-05:00",
        "timezone": "America/New_York",
        "venue_id": "event:1",
        "host_name": "Workshop organizer",
        "visibility": "public",
    }


def test_mcp_anonymous_search_dates_and_detail_use_real_domain(integrated):
    client, _, _ = integrated
    tools = rpc(client, "tools/list")["tools"]
    search = next(tool for tool in tools if tool["name"] == "search_events")
    assert search["securitySchemes"] == [{"type": "noauth"}]
    assert (
        not {"lat", "lng", "latitude", "longitude", "address"}
        & search["inputSchema"]["properties"].keys()
    )
    result = call(
        client, "search_events", {"date_from": "2026-11-01", "date_to": "2026-11-01"}
    )
    assert not result.get("isError")
    assert [event["id"] for event in result["structuredContent"]["events"]] == [1]
    assert "PRIVATE CONTENT" not in json.dumps(result)
    assert result["content"][0]["text"]
    assert call(client, "get_event", {"event_id": 2})["isError"]
    assert (
        call(client, "get_event", {"event_id": 1})["structuredContent"]["event"]["url"]
        == "https://todo-events.com/e/public-venue"
    )


def test_mcp_real_oauth_review_publish_retry_cancel_and_plain_output(integrated):
    client, token, database = integrated
    access = token()
    preview = call(client, "prepare_event", {"event": public_event()}, access)
    assert not preview.get("isError"), preview
    draft = preview["structuredContent"]
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 2
    arguments = {
        "draft_id": draft["draft_id"],
        "review_hash": draft["review_hash"],
        "confirmed": False,
        "idempotency_key": "transport-integration-retry",
    }
    denied = call(client, "publish_event", arguments, access)
    assert denied["structuredContent"]["error"]["code"] == "confirmation_required"
    arguments["confirmed"] = True
    published = call(client, "publish_event", arguments, access)
    assert not published.get("isError"), published
    event = published["structuredContent"]["event"]
    assert event["starts_at"] == "2026-11-20T22:00:00Z"
    assert event["timezone"] == "America/New_York"
    assert event["url"] in published["content"][0]["text"]
    assert call(client, "publish_event", arguments, access)["structuredContent"][
        "replayed"
    ]
    cross_owner = call(
        client,
        "cancel_event",
        {"event_id": event["id"], "confirmed": True},
        token(sub="other"),
    )
    assert cross_owner["structuredContent"]["error"]["code"] == "not_found"
    cancelled = call(
        client, "cancel_event", {"event_id": event["id"], "confirmed": True}, access
    )
    assert cancelled["structuredContent"]["status"] == "cancelled"
    assert call(client, "get_event", {"event_id": event["id"]})["isError"]
    assert (
        call(client, "publish_event", arguments, access)["structuredContent"]["status"]
        == "cancelled"
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"iss": "https://wrong-issuer.example.test"},
        {"aud": "https://wrong-resource.example.test/mcp"},
        {"exp": 1},
        {"scope": "events:read"},
        {"sub": "unknown"},
    ],
)
def test_mcp_oauth_failures_provide_recoverable_challenge_without_mutation(
    integrated, changes
):
    client, token, database = integrated
    result = call(client, "prepare_event", {"event": public_event()}, token(**changes))
    assert result["isError"]
    assert result["_meta"]["mcp/www_authenticate"]
    assert "resource_metadata=" in result["_meta"]["mcp/www_authenticate"][0]
    with sqlite3.connect(database) as connection:
        assert (
            connection.execute("SELECT COUNT(*) FROM plugin_drafts").fetchone()[0] == 0
        )


def test_mcp_missing_auth_challenges_but_anonymous_search_still_works(integrated):
    client, _, _ = integrated
    result = call(client, "prepare_event", {"event": public_event()})
    assert result["structuredContent"]["error"]["code"] == "authentication_required"
    assert result["_meta"]["mcp/www_authenticate"]
    assert not call(client, "search_events", token="invalid-token").get("isError")


@pytest.fixture(scope="module")
def legacy_web():
    """Import the real web app with its database/scheduler startup disabled."""
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("TODOEVENTS_SKIP_STARTUP", "1")
        patch.setenv("RENDER", "")
        patch.setenv("RAILWAY_ENVIRONMENT", "")
        patch.setattr(sys, "path", [*sys.path, str(BACKEND)])
        spec = importlib.util.spec_from_file_location(
            "plugin_loop_web", BACKEND / "backend.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


@pytest.fixture
def shared_web(integrated, legacy_web, monkeypatch):
    """Both real applications point to the SAME pytest-owned event database."""
    _, _, database = integrated

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            instant = datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

        @classmethod
        def utcnow(cls):
            return cls.now()

    monkeypatch.setattr(legacy_web, "DB_FILE", str(database))
    monkeypatch.setattr(legacy_web, "IS_PRODUCTION", False)
    monkeypatch.setattr(legacy_web, "DB_URL", None)
    monkeypatch.setattr(legacy_web, "datetime", FixedDatetime)
    monkeypatch.setattr(legacy_web, "log_activity", lambda *args, **kwargs: None)
    legacy_web.event_cache.clear()
    with TestClient(legacy_web.app) as client:
        yield client


def canonical_web_resource(canonical_url):
    """Assert the actual frontend route delegates its slug to this real API.

    This is a source-contract check, not a claim of installed-browser QA. The
    response below is then executed through the actual legacy FastAPI route.
    """
    path = urlsplit(canonical_url).path
    app_source = (PROJECT / "frontend/src/App.jsx").read_text()
    map_source = (PROJECT / "frontend/src/components/EventMap/index.jsx").read_text()
    route = re.search(r'<Route\s+path="(/e/:slug)"[^\n]+eventSlug=\{true\}', app_source)
    assert route, (
        "Canonical event links must resolve to the real frontend EventMap slug route"
    )
    match = re.fullmatch(route.group(1).replace(":slug", r"(?P<slug>[^/]+)"), path)
    assert match, canonical_url
    assert "`${API_URL}/api/seo/events/by-slug/${eventSlug}`" in map_source
    return "/api/seo/events/by-slug/" + match.group("slug")


def assert_discovery_agrees(client, web, event, title):
    discovery = call(client, "search_events", {"query": title})
    assert not discovery.get("isError"), discovery
    assert [row["id"] for row in discovery["structuredContent"]["events"]] == [
        event["id"]
    ]
    assert discovery["structuredContent"]["events"][0]["title"] == title
    slug_response = web.get(canonical_web_resource(event["url"]))
    assert slug_response.status_code == 200, slug_response.text
    assert slug_response.json()["id"] == event["id"]
    assert slug_response.json()["title"] == title
    detail = web.get(f"/events/{event['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["title"] == title
    web_discovery = web.get(
        "/api/v1/local-events",
        params={"date_from": "2026-11-20", "date_to": "2026-11-20"},
    )
    assert web_discovery.status_code == 200, web_discovery.text
    same_event = next(
        row for row in web_discovery.json()["events"] if row["id"] == event["id"]
    )
    assert same_event["title"] == title
    assert same_event["url"] == event["url"]
    for response in (
        discovery,
        slug_response.json(),
        detail.json(),
        web_discovery.json(),
    ):
        assert "PRIVATE CONTENT" not in json.dumps(response)


def test_complete_publication_update_discovery_and_cancellation_loop(
    integrated, shared_web
):
    """One real record flows between MCP, existing web API and canonical route."""
    client, token, database = integrated
    web = shared_web
    access = token()
    event_input = {**public_event(), "price": 15.50, "currency": "USD"}
    preview = call(client, "prepare_event", {"event": event_input}, access)
    assert not preview.get("isError"), preview
    draft = preview["structuredContent"]
    assert (
        call(client, "search_events", {"query": event_input["title"]})[
            "structuredContent"
        ]["events"]
        == []
    )
    assert event_input["title"] not in web.get("/events").text
    assert web.get("/api/seo/events/by-slug/secret-draft").status_code == 404

    publication = {
        "draft_id": draft["draft_id"],
        "review_hash": draft["review_hash"],
        "confirmed": True,
        "idempotency_key": "complete-loop-create",
    }
    published = call(client, "publish_event", publication, access)
    assert not published.get("isError"), published
    event = published["structuredContent"]["event"]
    assert_discovery_agrees(client, web, event, event_input["title"])
    created_web = web.get(canonical_web_resource(event["url"])).json()
    assert created_web["price"] == 15.50
    assert created_web["fee_required"] and "15.50" in created_web["fee_required"]

    updated_input = {
        **event_input,
        "title": "Updated public workshop",
        "description": "The agenda now includes a public question session.",
        "price": 20,
    }
    rejected_owner = call(
        client,
        "prepare_event",
        {"event_id": event["id"], "event": updated_input},
        token(sub="other"),
    )
    assert rejected_owner["isError"]
    assert_discovery_agrees(client, web, event, event_input["title"])
    update_preview = call(
        client,
        "prepare_event",
        {"event_id": event["id"], "event": updated_input},
        access,
    )
    assert not update_preview.get("isError"), update_preview
    update = update_preview["structuredContent"]
    assert update["action"] == "update"
    assert update["target_event_id"] == event["id"]
    assert any(
        change["field"] == "title" and change["after"] == updated_input["title"]
        for change in update["changes"]
    )
    # Preview is private and cannot change the public listing before consent.
    assert_discovery_agrees(client, web, event, event_input["title"])
    update_args = {
        "draft_id": update["draft_id"],
        "review_hash": update["review_hash"],
        "confirmed": False,
        "idempotency_key": "complete-loop-update",
    }
    assert call(client, "publish_event", update_args, access)["isError"]
    assert_discovery_agrees(client, web, event, event_input["title"])
    update_args["confirmed"] = True
    result = call(client, "publish_event", update_args, access)
    assert not result.get("isError"), result
    assert result["structuredContent"]["event"]["id"] == event["id"]
    assert result["structuredContent"]["event"]["url"] == event["url"]
    assert_discovery_agrees(client, web, event, updated_input["title"])
    assert (
        web.get(canonical_web_resource(event["url"])).json()["description"]
        == updated_input["description"]
    )
    updated_web = web.get(canonical_web_resource(event["url"])).json()
    assert updated_web["price"] == 20
    assert updated_web["fee_required"] and "20" in updated_web["fee_required"]
    replayed = call(client, "publish_event", update_args, access)
    assert replayed["structuredContent"]["replayed"]
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 3

    denied_cancel = call(
        client,
        "cancel_event",
        {"event_id": event["id"], "confirmed": True},
        token(sub="other"),
    )
    assert denied_cancel["isError"]
    assert_discovery_agrees(client, web, event, updated_input["title"])
    cancelled = call(
        client, "cancel_event", {"event_id": event["id"], "confirmed": True}, access
    )
    assert cancelled["structuredContent"]["status"] == "cancelled"
    assert (
        call(client, "search_events", {"query": updated_input["title"]})[
            "structuredContent"
        ]["events"]
        == []
    )
    assert call(client, "get_event", {"event_id": event["id"]})["isError"]
    assert web.get(canonical_web_resource(event["url"])).status_code == 404
    assert web.get(f"/events/{event['id']}").status_code == 404
    for path in ("/events", "/api/v1/local-events"):
        response = web.get(path)
        assert response.status_code == 200
        assert updated_input["title"] not in response.text
        assert "PRIVATE CONTENT" not in response.text
    # Retries of both old creation and update cannot resurrect cancellation.
    assert (
        call(client, "publish_event", publication, access)["structuredContent"][
            "status"
        ]
        == "cancelled"
    )
    assert (
        call(client, "publish_event", update_args, access)["structuredContent"][
            "status"
        ]
        == "cancelled"
    )


def test_real_web_unpublish_invalidates_mcp_update_review(
    integrated, shared_web, legacy_web
):
    client, token, _ = integrated
    access = token()
    created = call(client, "prepare_event", {"event": public_event()}, access)[
        "structuredContent"
    ]
    create_args = {
        "draft_id": created["draft_id"],
        "review_hash": created["review_hash"],
        "confirmed": True,
        "idempotency_key": "web-unpublish-create",
    }
    event = call(client, "publish_event", create_args, access)["structuredContent"][
        "event"
    ]
    preview = call(
        client,
        "prepare_event",
        {
            "event_id": event["id"],
            "event": {**public_event(), "title": "Never overwrite a web change"},
        },
        access,
    )
    assert not preview.get("isError"), preview
    review = preview["structuredContent"]
    current = shared_web.get(canonical_web_resource(event["url"])).json()
    legacy_web.app.dependency_overrides[legacy_web.get_current_user] = lambda: {
        "id": 1,
        "role": "user",
    }
    try:
        changed = shared_web.put(
            f"/events/{event['id']}", json={**current, "is_published": False}
        )
        assert changed.status_code == 200, changed.text
    finally:
        legacy_web.app.dependency_overrides.clear()
    rejected = call(
        client,
        "publish_event",
        {
            "draft_id": review["draft_id"],
            "review_hash": review["review_hash"],
            "confirmed": True,
            "idempotency_key": "stale-web-update",
        },
        access,
    )
    assert rejected["isError"]
    assert rejected["structuredContent"]["error"]["code"] in {
        "stale_event",
        "event_unavailable",
    }
    assert shared_web.get(canonical_web_resource(event["url"])).status_code == 404
    assert call(client, "get_event", {"event_id": event["id"]})["isError"]
    assert (
        call(client, "publish_event", create_args, access)["structuredContent"][
            "status"
        ]
        == "unpublished"
    )


def test_real_web_account_delete_removes_plugin_authority_and_private_data(
    integrated, shared_web, legacy_web
):
    client, token, database = integrated
    access = token()
    review = call(client, "prepare_event", {"event": public_event()}, access)[
        "structuredContent"
    ]
    publication = {
        "draft_id": review["draft_id"],
        "review_hash": review["review_hash"],
        "confirmed": True,
        "idempotency_key": "account-delete-publication",
    }
    published = call(client, "publish_event", publication, access)
    assert not published.get("isError"), published
    private = call(
        client,
        "prepare_event",
        {"event": {**public_event(), "description": "Private pending preview"}},
        access,
    )
    assert not private.get("isError"), private
    legacy_web.app.dependency_overrides[legacy_web.get_current_user] = lambda: {
        "id": 2,
        "role": "admin",
    }
    try:
        deleted = shared_web.delete("/admin/users/1")
        assert deleted.status_code == 200, deleted.text
    finally:
        legacy_web.app.dependency_overrides.clear()
    with sqlite3.connect(database) as connection:
        for table in ("plugin_drafts", "plugin_publications", "plugin_idempotency"):
            assert (
                connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
            )
        assert connection.execute(
            "SELECT subject FROM plugin_oauth_identities"
        ).fetchall() == [("other",)]
        # The other owner's event and identity survive this account-specific action.
        assert connection.execute("SELECT id FROM events").fetchall() == [(2,)]
    rejected = call(client, "list_organizer_events", token=access)
    assert rejected["isError"]
    assert rejected["structuredContent"]["error"]["code"] == "invalid_token"
    assert rejected["_meta"]["mcp/www_authenticate"]
    assert not call(client, "list_organizer_events", token=token(sub="other")).get(
        "isError"
    )
