"""Real scheduler ownership and retention against disposable local fixtures."""

import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from threading import Event

import pytest
from apscheduler.schedulers.background import BackgroundScheduler
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from backend.chatgpt_plugin.cleanup import JOB_ID, MAX_SUCCESS_AGE_SECONDS
from backend.chatgpt_plugin.cli import seed_demo
from backend.chatgpt_plugin.models import iso_utc
from backend.plugin_host import create_host

ORIGIN = "https://backend.example.test"


@pytest.fixture
def database(monkeypatch, tmp_path):
    import os

    for name in list(os.environ):
        if name.startswith("PLUGIN_") or name == "DATABASE_URL":
            monkeypatch.delenv(name)
    path = tmp_path / "events.sqlite3"
    seed_demo(path)
    monkeypatch.setenv("PLUGIN_SQLITE_PATH", str(path))
    monkeypatch.setenv("PLUGIN_ENV", "production")
    monkeypatch.setenv("PLUGIN_RESOURCE_URL", ORIGIN + "/mcp")
    monkeypatch.setenv("PLUGIN_OAUTH_ISSUER", "https://issuer.example.test")
    monkeypatch.setenv("PLUGIN_OAUTH_AUDIENCE", ORIGIN + "/mcp")
    monkeypatch.setenv("PLUGIN_OAUTH_JWKS_URL", "https://issuer.example.test/keys")
    return path


@pytest.fixture
def scheduler():
    scheduler = BackgroundScheduler()
    scheduler.start()
    try:
        yield scheduler
    finally:
        if scheduler.running:
            scheduler.shutdown()


def legacy():
    async def health(request):
        return JSONResponse({"legacy": "healthy"})

    return Starlette(routes=[Route("/health", health)])


def host(scheduler=None, status=None, mode="full"):
    return create_host(legacy(), mode=mode, scheduler=scheduler, task_status=status)


def rows(path, table):
    with sqlite3.connect(path) as connection:
        return connection.execute("SELECT * FROM " + table).fetchall()


def test_initial_and_hourly_cleanup_preserves_records_and_other_jobs(
    database, scheduler
):
    now = datetime.now(timezone.utc)
    expired = iso_utc(now - timedelta(hours=1))
    future = iso_utc(now + timedelta(hours=1))
    with sqlite3.connect(database) as connection:
        for draft_id, status, expiry in (
            ("expired", "draft", expired),
            ("active", "draft", future),
            ("published", "published", expired),
            ("cancelled", "cancelled", expired),
        ):
            connection.execute(
                "INSERT INTO plugin_drafts VALUES (?,1,?,1,?,?,1,?,?,?)",
                (
                    draft_id,
                    '{"private":"fixture"}',
                    "a" * 64,
                    status,
                    expired,
                    expired,
                    expiry,
                ),
            )
        connection.execute(
            "INSERT INTO plugin_publications VALUES (1,1,'published','published',NULL,NULL,NULL,?)",
            (expired,),
        )
        connection.execute(
            "INSERT INTO plugin_idempotency VALUES (1,'fixture-key','fixture-hash',1,?)",
            (expired,),
        )
        connection.execute(
            "INSERT INTO plugin_oauth_identities VALUES ('https://issuer.example.test','fixture-subject',1,'events:read',1)"
        )
    preserved = {
        table: rows(database, table)
        for table in (
            "events",
            "users",
            "plugin_publications",
            "plugin_idempotency",
            "plugin_oauth_identities",
        )
    }
    scheduler.add_job(lambda: None, "interval", hours=6, id="existing-legacy-job")
    status = {}
    app = host(scheduler, status)
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 200
        job = scheduler.get_job(JOB_ID)
        assert job.trigger.interval == timedelta(hours=1)
        assert job.max_instances == 1 and job.coalesce
        assert job.misfire_grace_time == 300
        assert len(scheduler.get_jobs()) == 2
        drafts = {row[0]: row for row in rows(database, "plugin_drafts")}
        assert drafts["expired"][2] is None and drafts["expired"][5] == "expired"
        assert drafts["active"][2] is not None and drafts["active"][5] == "draft"
        for name in ("published", "cancelled"):
            assert drafts[name][2] is None and drafts[name][5] == name
        assert status[JOB_ID]["purged_count"] == 3
        # Preserve compatibility with the legacy naive-UTC health-check parser.
        assert datetime.now(timezone.utc).replace(tzinfo=None) - datetime.fromisoformat(
            status[JOB_ID]["last_run"]
        ) < timedelta(seconds=5)
        assert status[JOB_ID]["last_success"].endswith("Z")
        with sqlite3.connect(database) as connection:
            connection.execute(
                "UPDATE plugin_drafts SET expires_at=? WHERE id='active'", (expired,)
            )
        assert job.func() is True
        assert status[JOB_ID]["purged_count"] == 1
        assert job.func() is True
        assert status[JOB_ID]["purged_count"] == 0
        assert {table: rows(database, table) for table in preserved} == preserved
    assert scheduler.running
    assert scheduler.get_job(JOB_ID) is None
    assert scheduler.get_job("existing-legacy-job") is not None
    assert status[JOB_ID]["status"] == "stopped"
    # A fresh service lifespan performs cleanup and owns exactly one replacement.
    with TestClient(host(scheduler), base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 200
        assert len(scheduler.get_jobs()) == 2
    assert scheduler.get_job(JOB_ID) is None


@pytest.mark.parametrize("mode", ["off", "public"])
def test_public_and_off_never_schedule_or_purge(database, scheduler, monkeypatch, mode):
    from backend.chatgpt_plugin.store import PluginStore

    def forbidden(*args):
        raise AssertionError("Public mode must not purge drafts")

    monkeypatch.setattr(PluginStore, "purge_expired", forbidden)
    with TestClient(host(scheduler, mode=mode), base_url=ORIGIN) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/mcp/health").status_code == (
            200 if mode == "public" else 503
        )
        assert scheduler.get_job(JOB_ID) is None


@pytest.mark.parametrize(
    "failure", ["purge", "registration", "missing_scheduler", "paused_scheduler"]
)
def test_startup_failures_preserve_legacy_and_leave_no_cleanup_job(
    database, scheduler, monkeypatch, caplog, failure
):
    app = host(None if failure == "missing_scheduler" else scheduler)

    def broken(*args, **kwargs):
        raise RuntimeError("private-payload-and-credential-fixture")

    if failure == "purge":
        monkeypatch.setattr(app.cleanup.store, "purge_expired", broken)
    elif failure == "registration":
        monkeypatch.setattr(scheduler, "add_job", broken)
    elif failure == "paused_scheduler":
        scheduler.pause()
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/health").json() == {"legacy": "healthy"}
        response = client.get("/mcp/health")
        assert response.status_code == 503
        assert scheduler.get_job(JOB_ID) is None
        assert "private-payload-and-credential-fixture" not in response.text
    assert "private-payload-and-credential-fixture" not in caplog.text


def test_runtime_failure_closes_mcp_and_successful_retry_recovers(
    database, scheduler, monkeypatch, caplog
):
    app = host(scheduler)
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 200
        with monkeypatch.context() as patch:

            def broken(now):
                raise RuntimeError("sensitive-fixture")

            patch.setattr(app.cleanup.store, "purge_expired", broken)
            assert scheduler.get_job(JOB_ID).func() is False
        assert client.get("/mcp/health").status_code == 503
        assert client.get("/health").status_code == 200
        assert app.cleanup.status["status"] == "failed"
        assert "sensitive-fixture" not in caplog.text
        assert scheduler.get_job(JOB_ID).func() is True
        assert client.get("/mcp/health").status_code == 200


def test_registered_job_is_executed_by_existing_scheduler(
    database, scheduler, monkeypatch
):
    app = host(scheduler)
    completed = Event()
    purge = app.cleanup.store.purge_expired
    calls = []

    def record(now):
        count = purge(now)
        calls.append(now)
        completed.set()
        return count

    monkeypatch.setattr(app.cleanup.store, "purge_expired", record)
    with TestClient(app, base_url=ORIGIN):
        assert len(calls) == 1
        completed.clear()
        # The default one-second grace would skip this delayed invocation.
        scheduler.modify_job(
            JOB_ID, next_run_time=datetime.now(timezone.utc) - timedelta(seconds=2)
        )
        assert completed.wait(5), "The existing scheduler did not execute its job"
        assert len(calls) == 2


@pytest.mark.parametrize(
    "failure", ["scheduler_paused", "job_paused", "job_removed", "overdue"]
)
def test_unavailable_or_overdue_scheduler_closes_mcp(database, scheduler, failure):
    app = host(scheduler)
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 200
        if failure == "scheduler_paused":
            scheduler.pause()
        elif failure == "job_paused":
            scheduler.pause_job(JOB_ID)
        elif failure == "job_removed":
            scheduler.remove_job(JOB_ID)
        else:
            app.cleanup.last_success_monotonic -= MAX_SUCCESS_AGE_SECONDS + 1
        assert client.get("/mcp/health").status_code == 503
        assert client.get("/health").status_code == 200


def test_job_collision_is_not_replaced_or_removed(database, scheduler):
    existing = scheduler.add_job(lambda: None, "interval", hours=1, id=JOB_ID)
    with TestClient(host(scheduler), base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 503
        assert client.get("/health").status_code == 200
        assert scheduler.get_job(JOB_ID) is existing
    assert scheduler.get_job(JOB_ID) is existing


def test_plugin_startup_failure_removes_registered_cleanup(database, scheduler):
    app = host(scheduler)

    @asynccontextmanager
    async def broken_lifespan(app):
        raise RuntimeError("synthetic MCP startup failure")
        yield

    app.plugin_app.router.lifespan_context = broken_lifespan
    with TestClient(app, base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 503
        assert client.get("/health").status_code == 200
        assert scheduler.get_job(JOB_ID) is None


@pytest.mark.parametrize("phase", ["startup", "scheduled"])
def test_stopping_during_purge_cannot_register_or_revive_job(
    database, scheduler, monkeypatch, phase
):
    app = host(scheduler)
    if phase == "scheduled":
        app.cleanup.start()
    entered, release = Event(), Event()
    purge = app.cleanup.store.purge_expired

    def blocked(now):
        entered.set()
        assert release.wait(5), "Test did not release the synthetic purge"
        return purge(now)

    monkeypatch.setattr(app.cleanup.store, "purge_expired", blocked)
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(
            app.cleanup.start if phase == "startup" else app.cleanup.run
        )
        try:
            assert entered.wait(5)
            app.cleanup.stop()
        finally:
            release.set()
        if phase == "startup":
            with pytest.raises(
                RuntimeError, match="Initial organizer draft cleanup failed"
            ):
                future.result(timeout=5)
        else:
            assert future.result(timeout=5) is False
    assert app.cleanup.status["status"] == "stopped"
    assert not app.cleanup.available
    assert scheduler.get_job(JOB_ID) is None
    with TestClient(host(scheduler), base_url=ORIGIN) as client:
        assert client.get("/mcp/health").status_code == 200


def test_cancellation_before_worker_entry_cannot_start_cleanup(
    database, scheduler, monkeypatch
):
    app = host(scheduler)
    entered, release = Event(), Event()

    def forbidden(now):
        raise AssertionError("A stopped lifecycle must not begin a purge")

    def delayed_start():
        entered.set()
        assert release.wait(5)
        app.cleanup.start()

    monkeypatch.setattr(app.cleanup.store, "purge_expired", forbidden)
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(delayed_start)
        try:
            assert entered.wait(5)
            app.cleanup.stop()
        finally:
            release.set()
        with pytest.raises(RuntimeError, match="startup was interrupted"):
            future.result(timeout=5)
    assert app.cleanup.status["status"] == "stopped"
    assert scheduler.get_job(JOB_ID) is None
