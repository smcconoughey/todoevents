"""Draft retention on the existing single-worker backend scheduler."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from threading import RLock

from apscheduler.schedulers.base import STATE_RUNNING

from .models import iso_utc

LOG = logging.getLogger(__name__)
JOB_ID = "plugin_draft_cleanup"
MAX_SUCCESS_AGE_SECONDS = 65 * 60


class DraftCleanup:
    """Own one hourly job; failed cleanup closes the combined MCP boundary."""

    def __init__(self, store, scheduler, task_status=None):
        self.store = store
        self.scheduler = scheduler
        self.status = {"status": "pending", "last_run": None, "last_success": None}
        if task_status is not None:
            task_status[JOB_ID] = self.status
        self.active = False
        self.healthy = False
        self.last_success_monotonic = None
        self._lock = RLock()
        self._generation = 0
        self._stopped = False

    @property
    def available(self):
        if (
            not self.active
            or not self.healthy
            or self.scheduler.state != STATE_RUNNING
            or self.last_success_monotonic is None
            or time.monotonic() - self.last_success_monotonic > MAX_SUCCESS_AGE_SECONDS
        ):
            return False
        job = self.scheduler.get_job(JOB_ID)
        return bool(job and job.func == self.run and job.next_run_time is not None)

    def start(self):
        with self._lock:
            # A cancelled lifespan can stop us before to_thread begins running.
            # Each new host gets a fresh helper; stopped lifetimes never revive.
            if self._stopped:
                raise RuntimeError("Organizer draft cleanup startup was interrupted")
            if self.scheduler is None or self.scheduler.state != STATE_RUNNING:
                raise RuntimeError(
                    "Organizer draft cleanup requires the running scheduler"
                )
            job = self.scheduler.get_job(JOB_ID)
            if job and job.func != self.run:
                raise RuntimeError("Organizer draft cleanup job is already owned")
            self._generation += 1
            generation = self._generation
            self.active = True
        if not self.run():
            raise RuntimeError("Initial organizer draft cleanup failed")
        with self._lock:
            if not self.active or generation != self._generation:
                raise RuntimeError("Organizer draft cleanup startup was interrupted")
            self.scheduler.add_job(
                self.run,
                "interval",
                hours=1,
                id=JOB_ID,
                name="Organizer draft payload cleanup",
                replace_existing=job is not None,
                max_instances=1,
                coalesce=True,
                misfire_grace_time=300,
            )

    def run(self):
        with self._lock:
            if not self.active:
                return False
            generation = self._generation
            started = datetime.now(timezone.utc)
            now = iso_utc(started)
            # The legacy health check expects naive UTC in this shared field.
            self.status["last_run"] = started.replace(tzinfo=None).isoformat()
        try:
            count = self.store.purge_expired(now)
        except Exception as error:  # noqa: BLE001 - never log SQL, payloads or credentials
            with self._lock:
                if self.active and generation == self._generation:
                    self.healthy = False
                    self.status["status"] = "failed"
            LOG.error("Organizer draft cleanup failed (%s)", type(error).__name__)
            # Do not let APScheduler log the original exception or its traceback.
            return False
        with self._lock:
            if not self.active or generation != self._generation:
                return False
            finished = iso_utc(datetime.now(timezone.utc))
            self.healthy = True
            self.last_success_monotonic = time.monotonic()
            self.status.update(status="ok", last_success=finished, purged_count=count)
        LOG.info("Organizer draft cleanup succeeded at %s; cleared=%d", finished, count)
        return True

    def stop(self):
        with self._lock:
            self._generation += 1
            self._stopped = True
            self.active = False
            self.healthy = False
            self.status["status"] = "stopped"
            try:
                if self.scheduler is not None:
                    job = self.scheduler.get_job(JOB_ID)
                    if job and job.func == self.run:
                        self.scheduler.remove_job(JOB_ID)
            except Exception as error:  # noqa: BLE001 - preserve legacy shutdown
                LOG.error(
                    "Organizer draft cleanup job removal failed (%s)",
                    type(error).__name__,
                )
