#!/usr/bin/env python3
"""Offline structural checks for this plugin; not a substitute for portal review."""

from __future__ import annotations

import argparse
import ipaddress
import json
from pathlib import Path
from urllib.parse import urlparse

PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"
LICENSE_ID = "LicenseRef-Todo-Events-Commercial"


def public_https_url(value: str, *, origin_only: bool = False) -> str:
    if not isinstance(value, str):
        raise TypeError("URL must be a string")
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username
        or parsed.password
        or parsed.fragment
        or parsed.query
        or any(character.isspace() for character in value)
    ):
        raise ValueError("must be an HTTPS URL without credentials, query, or fragment")
    if (
        host == "localhost"
        or "." not in host
        or host.endswith(
            (".invalid", ".localhost", ".local", ".internal", ".test", ".example")
        )
        or host in {"example.com", "example.net", "example.org"}
    ):
        raise ValueError("must use a real public service domain")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        if not address.is_global:
            raise ValueError(
                "private, loopback, and reserved IP addresses are not allowed"
            )
    if origin_only and (parsed.path not in {"", "/"} or parsed.port not in {None, 443}):
        raise ValueError("must be an HTTPS origin, without a path or custom port")
    return value.rstrip("/") if origin_only else value


def _read_json(path: Path, errors: list[str]) -> dict:
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(result, dict):
            errors.append(f"{path.name}: root must be an object")
            return {}
        return result
    except (OSError, ValueError) as exc:
        errors.append(f"{path.name}: {exc}")
        return {}


def _forbidden_keys(value: object, path: str = "manifest") -> list[str]:
    errors = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in {"apps", "hooks", "lifecyclehooks"}:
                errors.append(
                    f"{path}.{key}: app references and lifecycle hooks are not allowed"
                )
            errors.extend(_forbidden_keys(child, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            errors.extend(_forbidden_keys(child, f"{path}[{index}]"))
    elif isinstance(value, str) and value.endswith(".app.json"):
        errors.append(f"{path}: .app.json references are not allowed")
    return errors


def validate(package: Path, *, release: bool = False) -> list[str]:
    errors: list[str] = []
    for name in ("plugin.json", "mcp.json", "LICENSE", "README.md", "assets", "skills"):
        if (package / name).is_symlink():
            errors.append(f"{name}: symlinks are not allowed in distributable content")
    plugin = _read_json(package / "plugin.json", errors)
    mcp = _read_json(package / "mcp.json", errors)
    for label, document in (("plugin", plugin), ("mcp", mcp)):
        errors.extend(_forbidden_keys(document, label))
    if plugin.get("$schema") != PLUGIN_SCHEMA:
        errors.append("plugin.json: unexpected portable schema")
    if mcp.get("$schema") != MCP_SCHEMA:
        errors.append("mcp.json: unexpected portable schema")
    if plugin.get("name") != "todoevents" or not plugin.get("version"):
        errors.append("plugin.json: todoevents name and version are required")
    if plugin.get("license") != LICENSE_ID:
        errors.append("plugin.json: commercial license identifier must be preserved")
    license_path = package / "LICENSE"
    if (
        not license_path.is_file()
        or "TODO-EVENTS COMMERCIAL LICENSE AGREEMENT" not in license_path.read_text()
    ):
        errors.append("LICENSE: Todo-Events commercial license is required")
    interface = plugin
    for field in ("extensions", "com.openai", "interface"):
        interface = interface.get(field, {})
        if not isinstance(interface, dict):
            errors.append(f"plugin.json: {field} must be an object")
            interface = {}
    for field in (
        "displayName",
        "shortDescription",
        "longDescription",
        "developerName",
        "category",
        "websiteURL",
        "privacyPolicyURL",
        "termsOfServiceURL",
        "composerIcon",
        "logo",
    ):
        if not isinstance(interface.get(field), str) or not interface[field].strip():
            errors.append(f"plugin.json: missing interface {field}")
    for field in ("composerIcon", "logo"):
        asset = interface.get(field, "")
        if not isinstance(asset, str):
            asset = ""
        path = package / asset
        if (
            not asset.startswith("./assets/")
            or ".." in Path(asset).parts
            or not path.is_file()
        ):
            errors.append(f"plugin.json: {field} must reference a bundled asset")
    servers = mcp.get("mcpServers", {})
    if not isinstance(servers, dict):
        errors.append("mcp.json: mcpServers must be an object")
        servers = {}
    if set(servers) != {"todoevents"}:
        errors.append("mcp.json: exactly one todoevents server is required")
    server = servers.get("todoevents", {})
    if not isinstance(server, dict):
        errors.append("mcp.json: todoevents must be a server object")
        server = {}
    if set(server) != {"type", "url"} or server.get("type") != "streamable-http":
        errors.append(
            "mcp.json: use URL-only streamable-http, without bundled commands or credentials"
        )
    if release:
        for label, url in [("mcp.url", server.get("url", ""))] + [
            (key, interface.get(key, ""))
            for key in ("websiteURL", "privacyPolicyURL", "termsOfServiceURL")
        ]:
            try:
                public_https_url(url)
            except (ValueError, TypeError) as exc:
                errors.append(f"{label}: {exc}")
        allowed = {
            "plugin.json",
            "mcp.json",
            "LICENSE",
            "README.md",
            "assets",
            "skills",
        }
        for child in package.iterdir():
            if child.name not in allowed:
                errors.append(
                    f"{child.name}: excluded from the submission distribution"
                )
    for name in ("find-public-events", "organize-public-event"):
        skill = package / "skills" / name / "SKILL.md"
        if not skill.is_file():
            errors.append(f"skills/{name}: SKILL.md required")
        else:
            content = skill.read_text(encoding="utf-8")
            if (
                not content.startswith(f"---\nname: {name}\ndescription:")
                or "\n---\n" not in content[4:]
            ):
                errors.append(f"skills/{name}: invalid name/description frontmatter")
    # Only walk distributable content: source UI dependencies are not part of the package.
    for directory in (package / "skills", package / "assets"):
        if directory.is_dir():
            for path in directory.rglob("*"):
                if (
                    path.is_symlink()
                    or path.name.endswith(".app.json")
                    or path.name.lower() in {"hooks", "apps"}
                ):
                    errors.append(
                        f"{path.relative_to(package)}: forbidden submission content"
                    )
    for forbidden in ("apps", "hooks", ".app.json"):
        if (package / forbidden).exists():
            errors.append(f"{forbidden}: forbidden submission content")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument(
        "--release",
        action="store_true",
        help="also reject placeholder URLs and source-only content",
    )
    args = parser.parse_args()
    errors = validate(args.package, release=args.release)
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print(
        "PASS: offline package structure. Live endpoint, policy, UI, OAuth, and portal review remain separate."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
