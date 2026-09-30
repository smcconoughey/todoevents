"""Exercise the real MCP SDK ASGI lifecycle and JSON-RPC transport."""

import json

import pytest
from starlette.testclient import TestClient

from backend.chatgpt_plugin.auth import AuthenticationError, AuthSettings
from backend.chatgpt_plugin.models import DomainError, Principal
from backend.chatgpt_plugin.server import ServerSettings, create_app, load_area_centers


class RecordingService:
    def __init__(self):
        self.calls = []

    def search_events(self, filters):
        self.calls.append(("search_events", filters))
        return {"events": [], "filters": filters, "message": "No published events match. Try different dates or a listed area."}

    def get_event(self, event_id):
        raise DomainError("not_found", "The public event is unavailable.", 404)

    def list_search_areas(self):
        return {"areas": []}

    def prepare_event(self, principal, **arguments):
        self.calls.append(("prepare_event", principal, arguments))
        return {"draft_id": "test-draft", "status": "draft", "event": arguments["event"]}

    def publish_event(self, principal, **arguments):
        self.calls.append(("publish_event", principal, arguments))
        raise DomainError("confirmation_required", "Review and explicitly confirm publication.", 409)

    def list_organizer_events(self, principal):
        self.calls.append(("list_organizer_events", principal))
        return {"drafts": [], "events": []}


class RecordingVerifier:
    def __init__(self):
        self.calls = []

    async def verify(self, authorization, required):
        self.calls.append((authorization, required))
        if authorization != "Bearer local-test-only":
            raise AuthenticationError("authentication_required", "Connect your organizer account.")
        return Principal(7, issuer="https://issuer.example.test", subject="test-subject", scopes=required)


def settings(**overrides):
    return ServerSettings(auth=AuthSettings(
        "http://localhost:8001/mcp", issuer="https://issuer.example.test",
        audience="http://localhost:8001/mcp", jwks_url="https://issuer.example.test/keys", development=True,
    ), **overrides)


@pytest.fixture
def client():
    service, verifier = RecordingService(), RecordingVerifier()
    with TestClient(create_app(service=service, verifier=verifier, settings=settings(), testing=True), base_url="http://localhost:8001") as test_client:
        yield test_client, service, verifier


def rpc(client, method, params=None, **kwargs):
    headers = {"Accept": "application/json, text/event-stream", **kwargs.pop("headers", {})}
    return client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}, headers=headers, **kwargs)


def call(client, name, arguments=None, **kwargs):
    response = rpc(client, "tools/call", {"name": name, "arguments": arguments or {}}, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()["result"]


def test_sdk_initialize_and_anonymous_discovery_require_no_account(client):
    browser, service, verifier = client
    response = rpc(browser, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}})
    assert response.json()["result"]["serverInfo"]["name"] == "Todo-Events"
    result = call(browser, "search_events", {"query": "jazz", "date_from": "2026-10-01", "date_to": "2026-10-04"})
    assert result["structuredContent"]["events"] == []
    assert result["content"][0]["text"]
    assert not result["isError"]
    assert not verifier.calls
    assert service.calls


def test_all_tools_have_explicit_annotations_and_no_raw_attendee_location(client):
    browser, _, _ = client
    tools = rpc(browser, "tools/list").json()["result"]["tools"]
    assert len(tools) == 10
    for tool in tools:
        annotations = tool["annotations"]
        assert all(isinstance(annotations[name], bool) for name in ["readOnlyHint", "destructiveHint", "openWorldHint", "idempotentHint"])
        assert tool["securitySchemes"] == tool["_meta"]["securitySchemes"]
        assert tool["inputSchema"]["additionalProperties"] is False
        assert not {"city", "state", "country", "lat", "lng", "latitude", "longitude", "location"} & tool["inputSchema"]["properties"].keys()
    publish = next(tool for tool in tools if tool["name"] == "publish_event")
    assert publish["annotations"]["destructiveHint"]
    assert publish["securitySchemes"] == [{"type": "oauth2", "scopes": ["events:publish"]}]


def test_per_invocation_auth_uses_http_header_and_returns_recoverable_challenge(client):
    browser, service, verifier = client
    failed = call(browser, "list_organizer_events")
    assert failed["isError"]
    challenge = failed["_meta"]["mcp/www_authenticate"][0]
    assert "resource_metadata=" in challenge and "error_description=" in challenge
    assert not service.calls
    passed = call(browser, "list_organizer_events", headers={"Authorization": "Bearer local-test-only"})
    assert not passed["isError"]
    failed_again = call(browser, "list_organizer_events")
    assert failed_again["isError"]
    assert verifier.calls == [(None, frozenset({"events:read"})), ("Bearer local-test-only", frozenset({"events:read"})), (None, frozenset({"events:read"}))]


def test_auth_metadata_matches_exact_resource_and_issuer(client):
    browser, _, _ = client
    for path in ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]:
        response = browser.get(path)
        assert response.status_code == 200
        assert response.json()["resource"] == "http://localhost:8001/mcp"
        assert response.json()["authorization_servers"] == ["https://issuer.example.test"]
        assert response.json()["bearer_methods_supported"] == ["header"]
        assert "no-store" in response.headers["cache-control"]


@pytest.mark.parametrize("arguments", [{"city": "Paris"}, {"lat": 40, "lng": -75}, {"limit": 100000}, {"radius_km": 251}, {"date_from": "2026-10-01T01:00:00Z"}])
def test_invalid_or_location_soliciting_schema_fields_never_reach_service(client, arguments):
    browser, service, _ = client
    assert call(browser, "search_events", arguments)["isError"]
    assert not service.calls


def test_domain_error_remains_safe_and_structured(client):
    browser, _, _ = client
    result = call(browser, "get_event", {"event_id": 999})
    assert result["structuredContent"]["error"]["code"] == "not_found"
    assert result["isError"]


def test_confirmation_false_is_preserved_and_never_inferred(client):
    browser, service, verifier = client
    result = call(browser, "publish_event", {"draft_id": "test", "review_hash": "a" * 64, "confirmed": False, "idempotency_key": "test-retry-001"}, headers={"Authorization": "Bearer local-test-only"})
    assert result["structuredContent"]["error"]["code"] == "confirmation_required"
    assert verifier.calls[0][1] == frozenset({"events:publish"})
    assert service.calls[0][2]["confirmed"] is False


def test_existing_listing_update_target_reaches_service_with_write_scope(client):
    browser, service, verifier = client
    event = {
        "title": "Updated public event", "description": "Reviewed changed details", "category": "music",
        "starts_at": "2026-12-05T18:00:00-05:00", "ends_at": "2026-12-05T20:00:00-05:00",
        "timezone": "America/New_York", "venue_id": "event:1", "host_name": "Organizer", "visibility": "public",
    }
    result = call(browser, "prepare_event", {"event": event, "event_id": 123}, headers={"Authorization": "Bearer local-test-only"})
    assert not result["isError"]
    assert verifier.calls == [("Bearer local-test-only", frozenset({"events:write"}))]
    assert service.calls[0][2]["event_id"] == 123
    assert service.calls[0][2]["event"] == event


def test_dns_rebinding_and_unapproved_origin_are_blocked(client):
    browser, service, _ = client
    assert rpc(browser, "tools/list", headers={"Host": "evil.example"}).status_code == 421
    assert rpc(browser, "tools/list", headers={"Origin": "https://evil.example"}).status_code == 403
    assert not service.calls


def test_request_body_is_bounded_including_streamed_body(client):
    browser, service, _ = client
    response = browser.post("/mcp", content=b"x" * 65537, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    assert response.status_code == 413
    response = browser.post("/mcp", content=iter([b"x" * 40000, b"y" * 40000]), headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    assert response.status_code == 413
    assert not service.calls


def test_rate_limit_has_retry_after_and_cannot_be_bypassed_with_forwarded_header():
    app = create_app(service=RecordingService(), verifier=RecordingVerifier(), settings=settings(requests_per_minute=2), testing=True)
    with TestClient(app, base_url="http://localhost:8001") as browser:
        assert browser.get("/health").status_code == 200
        assert browser.get("/health").status_code == 200
        response = browser.get("/health", headers={"X-Forwarded-For": "198.51.100.22"})
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) > 0


def test_ui_resource_has_unique_domain_and_explicit_empty_network_csp(tmp_path):
    ui = tmp_path / "events.html"
    ui.write_text("<!doctype html><html><body>Public events</body></html>")
    app = create_app(service=RecordingService(), verifier=RecordingVerifier(), settings=settings(ui_domain="https://unique-ui.example.test", ui_path=str(ui)), testing=True)
    with TestClient(app, base_url="http://localhost:8001") as browser:
        result = rpc(browser, "resources/read", {"uri": "ui://todoevents/events.html"}).json()["result"]
        resource = result["contents"][0]
        assert resource["mimeType"] == "text/html;profile=mcp-app"
        assert resource["_meta"]["ui"]["domain"] == "https://unique-ui.example.test"
        assert resource["_meta"]["ui"]["csp"] == {"connectDomains": [], "resourceDomains": []}
        tools = rpc(browser, "tools/list").json()["result"]["tools"]
        assert all(tool["_meta"]["ui"]["resourceUri"] == "ui://todoevents/events.html" for tool in tools)


def test_mock_auth_cannot_be_injected_into_production():
    with pytest.raises(ValueError, match="explicit local tests"):
        create_app(service=RecordingService(), verifier=RecordingVerifier(), settings=settings())
    with pytest.raises(ValueError, match="development"):
        create_app(service=RecordingService(), verifier=RecordingVerifier(), settings=ServerSettings(auth=AuthSettings("https://prod.example.test/mcp")), testing=True)


def test_unexpected_domain_errors_are_sanitized(client):
    browser, service, _ = client

    def fail(filters):
        raise RuntimeError("password=secret SQL private draft content")

    service.search_events = fail
    result = call(browser, "search_events")
    assert result["structuredContent"]["error"]["code"] == "temporarily_unavailable"
    assert "secret" not in json.dumps(result)
    assert "SQL" not in json.dumps(result)


def test_operator_public_area_centers_are_normalized(tmp_path):
    source = tmp_path / "centers.json"
    source.write_text(json.dumps([{"city": " Boston ", "state": "MA", "country": "USA", "lat": 42.3601, "lng": -71.0589}]))
    assert load_area_centers(source) == {("boston", "ma", "usa"): (42.3601, -71.0589)}
    assert load_area_centers("") == {}


@pytest.mark.parametrize("records", [
    {}, [{"city": "Boston"}],
    [{"city": "Boston", "state": "MA", "country": "USA", "lat": 91, "lng": 0}],
    [{"city": "Boston", "state": "MA", "country": "USA", "lat": float("nan"), "lng": 0}],
    [{"city": "Boston", "state": "MA", "country": "USA", "lat": True, "lng": 0}],
    [{"city": "Boston", "state": "MA", "country": "USA", "lat": 0, "lng": 0}, {"city": " boston ", "state": "ma", "country": "usa", "lat": 1, "lng": 1}],
])
def test_invalid_or_duplicate_public_area_centers_fail_startup(tmp_path, records):
    source = tmp_path / "centers.json"
    source.write_text(json.dumps(records))
    with pytest.raises(ValueError):
        load_area_centers(source)
