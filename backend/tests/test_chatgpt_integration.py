"""Full MCP -> OAuth verification -> domain -> legacy-schema integration.

Signing keys are ephemeral in-memory test fixtures. JWKS uses MockTransport;
every database is pytest-owned temporary storage and no external API is called.
"""

import json
import sqlite3
import time
from datetime import datetime, timezone

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
