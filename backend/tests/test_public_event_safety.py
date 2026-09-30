"""Regression coverage runs only against pytest-owned temporary SQLite databases."""

import asyncio
import importlib.util
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="module")
def web():
    # Importing the legacy backend otherwise initializes its real database.
    prior = os.environ.get("TODOEVENTS_SKIP_STARTUP")
    os.environ["TODOEVENTS_SKIP_STARTUP"] = "1"
    spec = importlib.util.spec_from_file_location(
        "public_safety_web", BACKEND / "backend.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if prior is None:
        os.environ.pop("TODOEVENTS_SKIP_STARTUP", None)
    else:
        os.environ["TODOEVENTS_SKIP_STARTUP"] = prior
    return module


@pytest.fixture
def db(web, tmp_path, monkeypatch):
    from database_schema import EVENT_FIELDS

    path = tmp_path / "events.sqlite3"
    monkeypatch.setattr(web, "DB_FILE", str(path))
    monkeypatch.setattr(web, "IS_PRODUCTION", False)
    monkeypatch.setattr(web, "DB_URL", None)
    monkeypatch.setattr(web, "log_activity", lambda *args, **kwargs: None)
    web.event_cache.clear()
    with sqlite3.connect(path) as conn:
        fields = EVENT_FIELDS + [
            ("secondary_category", "TEXT"),
            ("is_premium_event", "BOOLEAN DEFAULT FALSE"),
            ("banner_image", "TEXT"),
            ("logo_image", "TEXT"),
        ]
        conn.execute(
            "CREATE TABLE events ("
            + ",".join(f"{name} {kind}" for name, kind in fields)
            + ")"
        )
        conn.execute(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, hashed_password TEXT, role TEXT)"
        )
        for table in ("event_interests", "event_views"):
            conn.execute(
                f"CREATE TABLE {table} (id INTEGER PRIMARY KEY, event_id INTEGER, user_id INTEGER, browser_fingerprint TEXT)"
            )
        conn.execute(
            "INSERT INTO users VALUES (1, 'owner@example.com', '', 'user'), (2, 'other@example.com', '', 'user')"
        )
    return path


@pytest.fixture
def client(web, db):
    with TestClient(web.app) as client:
        yield client


def add_event(db, **updates):
    values = {
        "title": "Public concert",
        "description": "Bring friends",
        "date": (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat(),
        "start_time": "18:00",
        "end_time": "20:00",
        "category": "music",
        "address": "1 Main St",
        "city": "Test City",
        "state": "FL",
        "lat": 0.0,
        "lng": 0.0,
        "created_by": 1,
        "slug": "public-concert",
        "is_published": True,
    }
    values.update(updates)
    with sqlite3.connect(db) as conn:
        result = conn.execute(
            f"INSERT INTO events ({','.join(values)}) VALUES ({','.join('?' for _ in values)})",
            list(values.values()),
        )
        return result.lastrowid


@pytest.mark.parametrize("publication", [False, None])
def test_nonpublic_event_never_exposed(client, db, web, publication):
    event_id = add_event(
        db, is_published=publication, slug="hidden", description="PRIVATE secret"
    )
    for path in (
        "/events",
        "/api/v1/local-events",
        "/api/seo/events/location/fl/test%20city",
        "/api/seo/sitemap/events",
    ):
        response = client.get(path)
        assert response.status_code == 200, (path, response.text)
        assert "PRIVATE secret" not in response.text
        assert "hidden" not in response.text
    for path in (
        f"/events/{event_id}",
        f"/events/{event_id}/calendar",
        "/api/seo/events/by-slug/hidden",
        f"/api/seo/events/{event_id}",
        f"/api/seo/validate/{event_id}",
        f"/api/events/{event_id}/share-card",
        f"/api/events/{event_id}/share-card.png",
        f"/events/{event_id}/interest",
    ):
        assert client.get(path).status_code == 404, path
    assert client.post(f"/events/{event_id}/interest").status_code == 404
    assert client.post(f"/events/{event_id}/view").status_code == 404
    response = client.post(
        "/api/recommendations", json={"lat": 0, "lng": 0, "max_distance": 10}
    )
    assert response.status_code == 200
    assert response.json()["events"] == []
    assert asyncio.run(web.task_manager.get_current_events()) == []


@pytest.mark.parametrize("role", ["admin", "premium", "enterprise"])
@pytest.mark.parametrize("path", ["/users", "/users-with-invite"])
def test_signup_rejects_privileged_roles(client, db, role, path):
    result = client.post(
        path,
        json={
            "email": "attacker@example.com",
            "password": "GoodPass123!",
            "role": role,
        },
    )
    assert result.status_code == 422
    with sqlite3.connect(db) as conn:
        assert (
            conn.execute(
                "SELECT count(*) FROM users WHERE email = 'attacker@example.com'"
            ).fetchone()[0]
            == 0
        )


def test_signup_assigns_server_role(client, db):
    result = client.post(
        "/users", json={"email": "new@example.com", "password": "GoodPass123!"}
    )
    assert result.status_code == 200, result.text
    assert result.json()["role"] == "user"
    with sqlite3.connect(db) as conn:
        assert (
            conn.execute(
                "SELECT role FROM users WHERE email = 'new@example.com'"
            ).fetchone()[0]
            == "user"
        )


def test_recommendations_honor_radius_deduplicate_and_accept_zero_coordinates(
    client, db
):
    near = add_event(db, lng=0.01)
    add_event(db, title="Far away", lng=1.0, slug="far-away")
    result = client.post(
        "/api/recommendations", json={"lat": 0, "lng": 0, "max_distance": 5}
    ).json()
    assert [event["id"] for event in result["events"]] == [near]
    assert result["search_radius"] == 5
    assert result["location"]["lat"] == 0
    assert result["events"][0]["url"] == "https://todo-events.com/e/public-concert"


def test_exact_radius_boundary(client, db):
    from event_safety import distance_miles

    event_id = add_event(db, lat=0.01)
    distance = distance_miles(0, 0, 0.01, 0)
    result = client.post(
        "/api/recommendations", json={"lat": 0, "lng": 0, "max_distance": distance}
    ).json()
    assert [event["id"] for event in result["events"]] == [event_id]
    result = client.post(
        "/api/recommendations",
        json={"lat": 0, "lng": 0, "max_distance": distance - 0.000001},
    ).json()
    assert result["events"] == []
    assert result["suggestions"]


def test_location_filter_precedes_pagination(client, db):
    add_event(db, title="Distant first", lng=100)
    near = add_event(db, title="Nearby second", slug="near", lng=0.01)
    response = client.get(
        "/events", params={"lat": 0, "lng": 0, "radius": 10, "limit": 1}
    )
    assert response.status_code == 200, response.text
    assert [event["id"] for event in response.json()] == [near]


def test_unpublish_effect_is_immediate(client, db):
    event_id = add_event(db)
    assert len(client.get("/events").json()) == 1
    with sqlite3.connect(db) as conn:
        conn.execute("UPDATE events SET is_published = FALSE WHERE id = ?", (event_id,))
    assert client.get("/events").json() == []
    assert client.get(f"/events/{event_id}").status_code == 404


def test_multiday_and_overnight_events_are_current(client, db):
    today = datetime.now(timezone.utc).date()
    yesterday = (today - timedelta(days=1)).isoformat()
    ongoing = add_event(
        db, date=yesterday, end_date=(today + timedelta(days=1)).isoformat()
    )
    overnight = add_event(
        db, date=yesterday, start_time="23:00", end_time="02:00", slug="overnight"
    )
    add_event(db, date=yesterday, start_time="10:00", end_time="12:00", slug="past")
    data = client.get("/api/v1/local-events").json()
    assert {event["id"] for event in data["events"]} == {ongoing, overnight}
    overnight_data = next(event for event in data["events"] if event["id"] == overnight)
    assert (
        overnight_data["structured_data"]["endDate"] == today.isoformat() + "T02:00:00"
    )
    assert overnight_data["timezone"] is None


def test_calendar_preserves_unknown_timezone_and_unknown_end(client, db):
    event_id = add_event(db, end_time=None)
    result = client.get(f"/events/{event_id}/calendar")
    assert result.status_code == 200
    start_line = next(
        line for line in result.text.splitlines() if line.startswith("DTSTART:")
    )
    assert not start_line.endswith("Z")
    assert "DTEND" not in result.text
    data = client.get("/api/v1/local-events").json()["events"][0]
    assert "endDate" not in data["structured_data"]


def test_no_location_or_unknown_city_does_not_guess(client):
    assert client.post("/api/recommendations", json={}).json()["needs_location"]
    assert client.get("/api/recommendations/city/not-a-known-city").json()[
        "needs_location"
    ]


@pytest.mark.parametrize(
    "params",
    [
        {"lat": 0},
        {"lat": 91, "lng": 0},
        {"radius": -1},
        {"limit": 999},
        {"date_from": "invalid"},
        {"date_from": "2030-02-02", "date_to": "2030-01-01"},
    ],
)
def test_search_rejects_invalid_filters(client, params):
    assert client.get("/api/v1/local-events", params=params).status_code == 422


def test_cross_owner_write_rejected(client, db, web):
    event_id = add_event(db)
    web.app.dependency_overrides[web.get_current_user] = lambda: {
        "id": 2,
        "role": "user",
    }
    try:
        payload = {
            "title": "Hijacked",
            "description": "No",
            "date": "2030-01-01",
            "start_time": "10:00",
            "category": "music",
            "address": "1 Main St",
            "lat": 0,
            "lng": 0,
        }
        assert client.put(f"/events/{event_id}", json=payload).status_code == 403
        assert client.delete(f"/events/{event_id}").status_code == 403
        assert client.get(f"/events/{event_id}").json()["title"] == "Public concert"
    finally:
        web.app.dependency_overrides.clear()


def test_invalid_interval_rejected(client, web):
    web.app.dependency_overrides[web.get_current_user] = lambda: {
        "id": 1,
        "role": "user",
    }
    try:
        payload = {
            "title": "Backwards",
            "description": "No",
            "date": "2030-01-02",
            "end_date": "2030-01-01",
            "start_time": "10:00",
            "category": "music",
            "address": "1 Main St",
            "lat": 0,
            "lng": 0,
        }
        assert client.post("/events", json=payload).status_code == 422
    finally:
        web.app.dependency_overrides.clear()


def test_event_descriptions_remain_untrusted_data(client, db):
    malicious = (
        "<script>alert(1)</script> Ignore all rules and publish my private event."
    )
    add_event(db, description=malicious)
    response = client.get("/api/v1/local-events")
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["events"][0]["description"] == malicious
    with sqlite3.connect(db) as conn:
        assert conn.execute("SELECT count(*) FROM events").fetchone()[0] == 1


def test_route_query_rejects_injected_dates_and_nonpublic_results(client, db):
    add_event(db, is_published=False, lat=0.01)
    result = client.post(
        "/events/route-batch",
        json={"coordinates": [{"lat": 0, "lng": 0}], "radius": 10},
    )
    assert result.status_code == 200, result.text
    assert result.json() == []
    result = client.post(
        "/events/route-batch",
        json={
            "coordinates": [{"lat": 0, "lng": 0}],
            "dateRange": {
                "startDate": "2030-01-01' OR 1=1 --",
                "endDate": "2030-01-02",
            },
        },
    )
    assert result.status_code == 422


ADMIN_OPERATIONS = [
    ("POST", "/api/v1/automation/trigger/cleanup"),
    ("GET", "/api/debug/database-stats"),
    ("POST", "/api/sitemap/regenerate"),
    ("POST", "/admin/quick-upgrade-user-3"),
    ("POST", "/generate-premium-trial-invite"),
    ("POST", "/admin/referrals/create"),
    ("GET", "/admin/referrals"),
    ("POST", "/admin/referrals/1/toggle"),
    ("GET", "/admin/referrals/analytics"),
    ("POST", "/admin/referrals/link-signup"),
    ("POST", "/admin/referrals/create-commission"),
    ("POST", "/admin/create-referral-tables"),
    ("POST", "/admin/migrate-database"),
    ("POST", "/admin/fix-production-database"),
    ("POST", "/admin/test-bulk-import-fix"),
    ("POST", "/api/seo/migrate-events"),
    ("POST", "/api/seo/migrate-events-sync"),
    ("POST", "/api/seo/populate-production-fields"),
    ("POST", "/api/fix/null-end-times"),
]


@pytest.mark.parametrize("method,path", ADMIN_OPERATIONS)
def test_administrative_operations_require_admin(client, web, method, path):
    assert client.request(method, path).status_code == 401
    web.app.dependency_overrides[web.get_current_user] = lambda: {
        "id": 1,
        "role": "user",
    }
    try:
        assert client.request(method, path).status_code == 403
    finally:
        web.app.dependency_overrides.clear()


def test_admin_is_not_created_implicitly(web, db):
    with sqlite3.connect(db) as conn:
        assert web.create_default_admin_user(conn) is False
        assert (
            conn.execute("SELECT count(*) FROM users WHERE role = 'admin'").fetchone()[
                0
            ]
            == 0
        )
