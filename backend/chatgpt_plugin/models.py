"""Transport-independent authorization and validation for Todo-Events tools."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

CATEGORIES = (
    "food-drink",
    "cookout",
    "music",
    "arts",
    "sports",
    "automotive",
    "airshows",
    "vehicle-sports",
    "community",
    "religious",
    "education",
    "tech-education",
    "veteran",
    "networking",
    "fair-festival",
    "diving",
    "shopping",
    "health",
    "outdoors",
    "photography",
    "family",
    "gaming",
    "real-estate",
    "agriculture",
    "adventure",
    "seasonal",
    "other",
)


class DomainError(Exception):
    """Safe, stable error to return to a caller, without database details."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass(frozen=True)
class Principal:
    """Created by the token verifier, never by a model-supplied user id."""

    user_id: int
    issuer: str = ""
    subject: str = ""
    scopes: frozenset[str] = field(default_factory=frozenset)


def text_field(value, name: str, maximum: int, required: bool = True) -> str:
    if value is None and not required:
        return ""
    if not isinstance(value, str):
        raise DomainError("invalid_input", f"{name} must be text.")
    value = value.strip()
    if (required and not value) or len(value) > maximum:
        raise DomainError(
            "invalid_input",
            f"{name} must contain {'1' if required else '0'}–{maximum} characters.",
        )
    if any(ord(c) < 32 and c not in "\n\r\t" for c in value):
        raise DomainError(
            "invalid_input", f"{name} contains unsupported control characters."
        )
    return value


def public_url(value, name: str = "event_url") -> str:
    value = text_field(value, name, 2048, required=False)
    if not value:
        return ""
    try:
        parts = urlsplit(value)
        if (
            parts.scheme != "https"
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.port not in (None, 443)
        ):
            raise ValueError()
        if (
            re.search(r"[\s<>\\]", value)
            or parts.hostname == "localhost"
            or "." not in parts.hostname
        ):
            raise ValueError()
        # These URLs are displayed, never fetched. Reject literal IPs to avoid
        # turning a public listing into a local/private-network link.
        import ipaddress

        try:
            ipaddress.ip_address(parts.hostname)
        except ValueError:
            pass
        else:
            raise ValueError()
        if parts.hostname.endswith((".local", ".internal", ".localhost")):
            raise ValueError()
    except (ValueError, TypeError):
        raise DomainError(
            "invalid_input", f"{name} must be a public HTTPS URL without credentials."
        )
    return value


def aware_instant(value, name: str) -> datetime:
    value = text_field(value, name, 40)
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None or result.utcoffset() is None:
            raise ValueError()
    except ValueError:
        raise DomainError(
            "invalid_input",
            f"{name} needs an ISO 8601 date/time with an explicit UTC offset.",
        )
    return result


def iso_utc(value: datetime) -> str:
    return (
        value.astimezone(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def validate_event(event: dict, now: datetime) -> dict:
    if not isinstance(event, dict):
        raise DomainError("invalid_input", "event must be an object.")
    allowed = {
        "title",
        "description",
        "category",
        "starts_at",
        "ends_at",
        "timezone",
        "venue_id",
        "host_name",
        "event_url",
        "price",
        "currency",
        "visibility",
    }
    extra = set(event) - allowed
    if extra:
        raise DomainError(
            "invalid_input", "Unsupported event fields: " + ", ".join(sorted(extra))
        )
    if event.get("visibility") != "public":
        raise DomainError(
            "public_events_only",
            "This tool prepares public listings. Private, invitation-only, or undecided plans cannot be published here.",
        )
    result = {
        name: text_field(event.get(name), name, maximum)
        for name, maximum in (
            ("title", 160),
            ("description", 10000),
            ("host_name", 160),
            ("venue_id", 100),
            ("timezone", 100),
            ("category", 40),
        )
    }
    if result["category"] not in CATEGORIES:
        raise DomainError("invalid_input", "Choose a supported event category.")
    try:
        zone = ZoneInfo(result["timezone"])
    except (ZoneInfoNotFoundError, ValueError):
        raise DomainError(
            "invalid_input",
            "timezone must be a valid IANA timezone, for example America/New_York.",
        )
    start = aware_instant(event.get("starts_at"), "starts_at")
    end = aware_instant(event.get("ends_at"), "ends_at")
    for instant in (start, end):
        local = instant.astimezone(zone)
        if (
            local.replace(tzinfo=None) != instant.replace(tzinfo=None)
            or local.utcoffset() != instant.utcoffset()
        ):
            raise DomainError(
                "invalid_timezone",
                "The local date/time or offset does not exist in the selected timezone. Check daylight-saving time.",
            )
        if instant.second or instant.microsecond:
            raise DomainError(
                "invalid_input", "Event start and end times must use whole minutes."
            )
    if end <= start or (end - start).total_seconds() > 366 * 86400:
        raise DomainError(
            "invalid_dates", "Event end must follow start and be within 366 days."
        )
    if start <= now:
        raise DomainError("event_in_past", "The public event must start in the future.")
    if (start - now).days > 730:
        raise DomainError(
            "invalid_dates", "Events can be planned up to two years ahead."
        )
    price = event.get("price", 0)
    if (
        isinstance(price, bool)
        or not isinstance(price, (int, float))
        or not math.isfinite(price)
        or not 0 <= price <= 100000
    ):
        raise DomainError("invalid_input", "price must be between 0 and 100000.")
    currency = text_field(event.get("currency", "USD"), "currency", 3)
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise DomainError(
            "invalid_input", "currency must be a three-letter uppercase currency code."
        )
    result.update(
        starts_at=start.isoformat(timespec="seconds"),
        ends_at=end.isoformat(timespec="seconds"),
        event_url=public_url(event.get("event_url")),
        price=round(price, 2),
        currency=currency,
        visibility="public",
    )
    return result
