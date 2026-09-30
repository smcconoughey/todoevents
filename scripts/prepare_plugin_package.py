#!/usr/bin/env python3
"""Prepare an offline distributable; never deploys or contacts the supplied URLs."""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

from validate_plugin_package import public_https_url, validate


def prepare(
    source: Path,
    output: Path,
    *,
    mcp_url: str,
    ui_domain: str,
    website_url: str,
    privacy_url: str,
    terms_url: str,
) -> None:
    for value in (mcp_url, website_url, privacy_url, terms_url):
        public_https_url(value)
    ui_domain = public_https_url(ui_domain, origin_only=True)
    if output.exists():
        raise ValueError(
            "output already exists; choose a new directory to preserve prior artifacts"
        )
    errors = validate(source)
    if errors:
        raise ValueError("source failed validation: " + "; ".join(errors))
    with tempfile.TemporaryDirectory(prefix="todoevents-package-") as temporary:
        package = Path(temporary) / "todoevents"
        package.mkdir()
        for name in ("plugin.json", "mcp.json", "LICENSE", "README.md"):
            shutil.copyfile(source / name, package / name)
        for name in ("assets", "skills"):
            shutil.copytree(source / name, package / name)
        manifest = json.loads((package / "plugin.json").read_text())
        manifest["homepage"] = website_url
        manifest["author"]["url"] = website_url
        interface = manifest["extensions"]["com.openai"]["interface"]
        interface.update(
            websiteURL=website_url,
            privacyPolicyURL=privacy_url,
            termsOfServiceURL=terms_url,
        )
        (package / "plugin.json").write_text(json.dumps(manifest, indent=2) + "\n")
        mcp = json.loads((package / "mcp.json").read_text())
        mcp["mcpServers"]["todoevents"]["url"] = mcp_url
        (package / "mcp.json").write_text(json.dumps(mcp, indent=2) + "\n")
        errors = validate(package, release=True)
        if errors:
            raise ValueError("distribution failed validation: " + "; ".join(errors))
        output.mkdir(parents=True)
        shutil.copytree(package, output / "todoevents")
        with zipfile.ZipFile(
            output / "todoevents.zip", "w", zipfile.ZIP_DEFLATED
        ) as archive:
            for path in sorted(package.rglob("*")):
                if path.is_file():
                    archive.write(path, path.relative_to(package))
        # Not shipped in the ZIP. Values are JSON strings to avoid shell quoting ambiguity.
        (output / "service-config.json").write_text(
            json.dumps(
                {
                    "PLUGIN_RESOURCE_URL": mcp_url,
                    "PLUGIN_OAUTH_AUDIENCE": mcp_url,
                    "PLUGIN_UI_DOMAIN": ui_domain,
                    "status": "Prepared offline; domain ownership, OAuth issuer/JWKS, deployment and review are still required.",
                },
                indent=2,
            )
            + "\n"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "plugins/todoevents",
    )
    parser.add_argument("--output", type=Path, required=True)
    for flag in ("mcp-url", "ui-domain", "website-url", "privacy-url", "terms-url"):
        parser.add_argument(f"--{flag}", required=True)
    args = parser.parse_args()
    try:
        prepare(
            args.source,
            args.output,
            mcp_url=args.mcp_url,
            ui_domain=args.ui_domain,
            website_url=args.website_url,
            privacy_url=args.privacy_url,
            terms_url=args.terms_url,
        )
    except (OSError, ValueError) as exc:
        parser.exit(1, f"Package not prepared: {exc}\n")
    print(f"Prepared {args.output / 'todoevents.zip'}; no network actions performed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
