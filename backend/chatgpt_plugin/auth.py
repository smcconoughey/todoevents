"""OAuth resource-server verification; never accepts the legacy password JWT.

An external OAuth 2.1 authorization server owns login, consent, PKCE, revocation,
and token issuance. This module only consumes its access tokens. Identity linking
is explicit and performed out of band: an email claim is never account authority.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
import jwt

from .models import Principal

SCOPES = frozenset({"events:read", "events:write", "events:publish"})


def validate_url(value: str, *, allow_loopback: bool = False) -> str:
    parsed = urlsplit(value)
    local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    if (
        not parsed.hostname
        or "*" in parsed.hostname
        or any(char.isspace() or char in '\\"<>' for char in value)
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or (
            parsed.scheme != "https"
            and not (allow_loopback and local and parsed.scheme == "http")
        )
    ):
        raise ValueError(
            "OAuth URLs must use HTTPS (HTTP loopback requires development mode)"
        )
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError("OAuth URL port must be between 1 and 65535")
    return value.rstrip("/")


@dataclass(frozen=True)
class AuthSettings:
    resource_url: str
    issuer: str = ""
    audience: str = ""
    jwks_url: str = ""
    development: bool = False
    clock_leeway_seconds: int = 30

    def __post_init__(self) -> None:
        validate_url(self.resource_url, allow_loopback=self.development)
        supplied = [bool(self.issuer), bool(self.audience), bool(self.jwks_url)]
        if any(supplied) and not all(supplied):
            raise ValueError("Configure OAuth issuer, audience, and JWKS URL together")
        if self.issuer:
            validate_url(self.issuer, allow_loopback=self.development)
            validate_url(self.jwks_url, allow_loopback=self.development)
            if self.audience != self.resource_url:
                raise ValueError(
                    "OAuth audience must exactly equal the MCP resource URL"
                )
        if not 0 <= self.clock_leeway_seconds <= 60:
            raise ValueError("OAuth clock leeway must be between zero and 60 seconds")

    @property
    def configured(self) -> bool:
        return bool(self.issuer and self.audience and self.jwks_url)

    @property
    def metadata_url(self) -> str:
        parsed = urlsplit(self.resource_url)
        return f"{parsed.scheme}://{parsed.netloc}/.well-known/oauth-protected-resource{parsed.path}"

    def metadata(self) -> dict[str, Any]:
        return {
            "resource": self.resource_url,
            "authorization_servers": [self.issuer] if self.configured else [],
            "scopes_supported": sorted(SCOPES),
            "bearer_methods_supported": ["header"],
            "resource_name": "Todo-Events organizer",
        }

    @classmethod
    def from_env(cls) -> AuthSettings:
        settings = cls(
            resource_url=os.environ["PLUGIN_RESOURCE_URL"],
            issuer=os.getenv("PLUGIN_OAUTH_ISSUER", ""),
            audience=os.getenv("PLUGIN_OAUTH_AUDIENCE", ""),
            jwks_url=os.getenv("PLUGIN_OAUTH_JWKS_URL", ""),
            development=os.getenv("PLUGIN_ENV", "production") == "development",
        )
        if not settings.development and not settings.configured:
            raise ValueError("Production requires a configured external OAuth provider")
        return settings


class AuthenticationError(Exception):
    def __init__(self, code: str, message: str, status: int = 401) -> None:
        super().__init__(message)
        self.code, self.message, self.status = code, message, status

    def challenge(self, settings: AuthSettings, scopes: frozenset[str]) -> str:
        # All values here are validated configuration or fixed server constants.
        result = f'Bearer resource_metadata="{settings.metadata_url}"'
        code = (
            "insufficient_scope"
            if self.code == "insufficient_scope"
            else "invalid_token"
        )
        result += f', error="{code}", error_description="Connect an authorized Todo-Events organizer account"'
        if scopes:
            result += f', scope="{" ".join(sorted(scopes))}"'
        return result


class IdentityStore:
    """Explicit issuer/subject -> existing account mapping with revocable scopes."""

    def __init__(self, connection_factory: Callable, dialect: str = "sqlite") -> None:
        if dialect not in {"sqlite", "postgres"}:
            raise ValueError("Unsupported database dialect")
        self.connection_factory, self.dialect = connection_factory, dialect

    def migrate(self) -> None:
        connection = self.connection_factory()
        try:
            cursor = connection.cursor()
            cursor.execute(
                """CREATE TABLE IF NOT EXISTS plugin_oauth_identities (
                    issuer TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    scopes TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    PRIMARY KEY (issuer, subject)
                )"""
            )
            connection.commit()
            cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def resolve(
        self, issuer: str, subject: str, token_scopes: frozenset[str]
    ) -> Principal:
        placeholder = "%s" if self.dialect == "postgres" else "?"
        connection = self.connection_factory()
        try:
            cursor = connection.cursor()
            cursor.execute(
                f"""SELECT i.user_id, i.scopes FROM plugin_oauth_identities i
                JOIN users u ON u.id = i.user_id
                WHERE i.issuer = {placeholder} AND i.subject = {placeholder} AND i.enabled = 1""",
                (issuer, subject),
            )
            row = cursor.fetchone()
            cursor.close()
        finally:
            connection.close()
        if row is None:
            raise AuthenticationError(
                "invalid_token",
                "This organizer account is not linked or is disabled.",
                403,
            )
        if isinstance(row, dict):
            user_id, granted = row["user_id"], row["scopes"]
        else:
            user_id, granted = row[0], row[1]
        return Principal(
            user_id=int(user_id),
            issuer=issuer,
            subject=subject,
            scopes=token_scopes & frozenset(granted.split()) & SCOPES,
        )


class JWKSCache:
    """Bounded HTTPS fetch; neither token jku nor redirects choose a key source."""

    def __init__(
        self,
        url: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        ttl: int = 300,
    ) -> None:
        self.url, self.transport, self.ttl = url, transport, ttl
        self.keys: dict[str, Any] = {}
        self.loaded_at = 0.0
        self.lock = asyncio.Lock()

    async def get_key(self, kid: str) -> Any:
        now = time.monotonic()
        if kid in self.keys and now - self.loaded_at < self.ttl:
            return self.keys[kid]
        async with self.lock:
            now = time.monotonic()
            if kid in self.keys and now - self.loaded_at < self.ttl:
                return self.keys[kid]
            # Unknown key IDs cannot force unlimited upstream calls.
            if self.loaded_at and now - self.loaded_at < 10:
                raise AuthenticationError("invalid_token", "Unknown signing key.")
            async with (
                httpx.AsyncClient(
                    timeout=5.0, follow_redirects=False, transport=self.transport
                ) as client,
                client.stream(
                    "GET", self.url, headers={"Accept": "application/json"}
                ) as response,
            ):
                response.raise_for_status()
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 131072:
                        raise ValueError("JWKS is too large")
            payload = json.loads(body)
            raw_keys = payload.get("keys")
            if not isinstance(raw_keys, list) or len(raw_keys) > 32:
                raise ValueError("Invalid JWKS")
            keys: dict[str, Any] = {}
            for key in raw_keys:
                if (
                    key.get("kty") == "RSA"
                    and key.get("use", "sig") == "sig"
                    and key.get("alg", "RS256") == "RS256"
                    and isinstance(key.get("kid"), str)
                    and key.get("key_ops", ["verify"]) == ["verify"]
                ):
                    if key["kid"] in keys:
                        raise ValueError("Duplicate JWKS key ID")
                    parsed_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    if parsed_key.key_size < 2048:
                        raise ValueError(
                            "OAuth signing keys must be at least 2048 bits"
                        )
                    keys[key["kid"]] = parsed_key
            self.keys, self.loaded_at = keys, time.monotonic()
            if kid not in keys:
                raise AuthenticationError("invalid_token", "Unknown signing key.")
            return keys[kid]


class OAuthVerifier:
    def __init__(
        self,
        settings: AuthSettings,
        identities: IdentityStore,
        *,
        jwks: JWKSCache | None = None,
    ) -> None:
        self.settings, self.identities = settings, identities
        self.jwks = jwks or JWKSCache(settings.jwks_url)

    async def verify(
        self, authorization: str | None, required_scopes: frozenset[str]
    ) -> Principal:
        if not self.settings.configured:
            raise AuthenticationError(
                "auth_unavailable",
                "Organizer sign-in is not configured on this server.",
                503,
            )
        if not authorization:
            raise AuthenticationError(
                "authentication_required",
                "Connect your Todo-Events organizer account to continue.",
            )
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer" or len(parts[1]) > 16384:
            raise AuthenticationError("invalid_token", "Invalid access token.")
        token = parts[1]
        try:
            header = jwt.get_unverified_header(token)
            if (
                header.get("alg") != "RS256"
                or not isinstance(header.get("kid"), str)
                or not 1 <= len(header["kid"]) <= 128
            ):
                raise AuthenticationError("invalid_token", "Invalid access token.")
            key = await self.jwks.get_key(header["kid"])
            claims = jwt.decode(
                token,
                key=key,
                algorithms=["RS256"],
                issuer=self.settings.issuer,
                audience=self.settings.audience,
                leeway=self.settings.clock_leeway_seconds,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
            if not isinstance(claims["sub"], str) or not 1 <= len(claims["sub"]) <= 512:
                raise AuthenticationError(
                    "invalid_token", "Invalid access token subject."
                )
            scope = claims.get("scope", "")
            if not isinstance(scope, str):
                raise AuthenticationError(
                    "invalid_token",
                    "Access token scope must be a space-delimited string.",
                )
            principal = await asyncio.to_thread(
                self.identities.resolve,
                claims["iss"],
                claims["sub"],
                frozenset(scope.split()),
            )
        except AuthenticationError:
            raise
        except (
            jwt.PyJWTError,
            httpx.HTTPError,
            ValueError,
            TypeError,
            KeyError,
            AttributeError,
        ):
            raise AuthenticationError(
                "invalid_token", "The access token could not be verified."
            ) from None
        except Exception:  # noqa: BLE001 - fail closed for unavailable identity storage
            # Database/schema failures never fall back to email, legacy JWT, or anonymous mutation.
            raise AuthenticationError(
                "auth_unavailable", "Organizer sign-in is temporarily unavailable.", 503
            ) from None
        if not required_scopes <= principal.scopes:
            raise AuthenticationError(
                "insufficient_scope",
                "This account has not granted the required organizer permission.",
                403,
            )
        return principal
