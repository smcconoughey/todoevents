"""Opt-in MCP routing beside the unchanged legacy web application.

From the Render backend root: uvicorn plugin_host:create_app --factory.
PLUGIN_MODE defaults to off here. Public mode exposes discovery only; full mode
requires the configured external OAuth provider. No migration runs at startup.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import AsyncExitStack, asynccontextmanager
from urllib.parse import urlsplit

from starlette.applications import Starlette
from starlette.responses import JSONResponse

LOG = logging.getLogger(__name__)
PLUGIN_PATHS = frozenset(
    {
        "/mcp",
        "/mcp/",
        "/mcp/health",
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-protected-resource/mcp",
    }
)


class CombinedApp:
    """Dispatch before legacy middleware, preserving both app boundaries."""

    def __init__(
        self,
        legacy_app,
        plugin_app=None,
        *,
        mode="off",
        reason="disabled",
        trusted_proxies="",
        cleanup=None,
    ):
        self.legacy_app = legacy_app
        self.plugin_app = plugin_app
        self.mode = mode
        self.reason = reason
        self.ready = False
        self.cleanup = cleanup
        self.plugin_http_app = plugin_app
        if plugin_app is not None and trusted_proxies:
            from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

            self.plugin_http_app = ProxyHeadersMiddleware(
                plugin_app, trusted_hosts=trusted_proxies
            )

        @asynccontextmanager
        async def lifespan(app):
            # A legacy startup failure retains its existing failure behavior.
            async with (
                legacy_app.router.lifespan_context(legacy_app) as legacy_state,
                AsyncExitStack() as stack,
            ):
                if self.plugin_app is not None:
                    try:
                        if self.mode == "full":
                            if self.cleanup is None:
                                raise RuntimeError(
                                    "Organizer draft cleanup is required"
                                )
                            stack.callback(self.cleanup.stop)
                            await asyncio.to_thread(self.cleanup.start)
                        await stack.enter_async_context(
                            self.plugin_app.router.lifespan_context(self.plugin_app)
                        )
                        self.ready = True
                    except Exception as error:  # noqa: BLE001 - an optional plugin must not break the web service
                        if self.cleanup is not None:
                            self.cleanup.stop()
                        self.reason = "startup_unavailable"
                        LOG.error(
                            "Optional MCP startup unavailable (%s)",
                            type(error).__name__,
                        )
                try:
                    yield legacy_state
                finally:
                    self.ready = False

        self.lifespan_app = Starlette(lifespan=lifespan)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            return await self.lifespan_app(scope, receive, send)
        if scope["type"] == "http" and scope.get("path") in PLUGIN_PATHS:
            cleanup_unavailable = (
                self.mode == "full"
                and self.cleanup is not None
                and not self.cleanup.available
            )
            if self.plugin_app is None or not self.ready or cleanup_unavailable:
                return await JSONResponse(
                    {
                        "status": "unavailable",
                        "service": "todoevents-plugin",
                        "reason": "cleanup_unavailable"
                        if cleanup_unavailable
                        else self.reason,
                    },
                    status_code=503,
                    headers={"Cache-Control": "no-store"},
                )(scope, receive, send)
            if scope["path"] == "/mcp/health":
                scope = {**scope, "path": "/health", "raw_path": b"/health"}
            return await self.plugin_http_app(scope, receive, send)
        return await self.legacy_app(scope, receive, send)


def create_host(legacy_app, *, mode=None, scheduler=None, task_status=None):
    mode = os.getenv("PLUGIN_MODE", "off") if mode is None else mode
    if mode == "off":
        return CombinedApp(legacy_app)
    try:
        if mode not in {"public", "full"}:
            raise ValueError("PLUGIN_MODE must be off, public or full")
        if __package__:
            from .chatgpt_plugin.cleanup import DraftCleanup
            from .chatgpt_plugin.cli import trusted_proxy_allowlist
            from .chatgpt_plugin.server import ServerSettings
            from .chatgpt_plugin.server import create_app as create_plugin
        else:
            from chatgpt_plugin.cleanup import DraftCleanup
            from chatgpt_plugin.cli import trusted_proxy_allowlist
            from chatgpt_plugin.server import ServerSettings
            from chatgpt_plugin.server import create_app as create_plugin
        trusted_proxies = trusted_proxy_allowlist(os.getenv("PLUGIN_TRUSTED_PROXY_IPS"))
        settings = ServerSettings.from_env(mode=mode)
        if urlsplit(settings.auth.resource_url).path != "/mcp":
            raise ValueError("The combined backend MCP resource must use the /mcp path")
        plugin_app = create_plugin(settings=settings, use_legacy_database=True)
        return CombinedApp(
            legacy_app,
            plugin_app,
            mode=mode,
            reason="startup_unavailable",
            trusted_proxies=trusted_proxies,
            cleanup=(
                DraftCleanup(plugin_app.state.service.store, scheduler, task_status)
                if mode == "full"
                else None
            ),
        )
    except Exception as error:  # noqa: BLE001 - retain the existing website on plugin configuration errors
        LOG.error("Optional MCP configuration unavailable (%s)", type(error).__name__)
        return CombinedApp(legacy_app, mode=mode, reason="configuration_unavailable")


def create_app():
    """Uvicorn factory; normal imports of this module have no DB side effects."""
    if __package__:
        from . import backend as legacy
    else:
        import backend as legacy
    return create_host(
        legacy.app,
        scheduler=legacy.task_manager.scheduler,
        task_status=legacy.task_manager.task_status,
    )
