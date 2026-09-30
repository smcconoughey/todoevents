"""Exercise package boundaries and safe offline output; run with unittest."""

import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from prepare_plugin_package import prepare
from validate_plugin_package import public_https_url, validate

SOURCE = Path(__file__).resolve().parents[1] / "plugins/todoevents"
OPTIONS = {
    "mcp_url": "https://mcp.todo-events.com/mcp",
    "ui_domain": "https://widget.todo-events.com",
    "website_url": "https://todo-events.com",
    "privacy_url": "https://todo-events.com/privacy",
    "terms_url": "https://todo-events.com/terms",
}


class PackageTests(unittest.TestCase):
    def test_source_valid_but_cannot_be_accidental_release(self):
        self.assertEqual(validate(SOURCE), [])
        self.assertTrue(
            any("mcp.url" in error for error in validate(SOURCE, release=True))
        )

    def test_clean_zip_excludes_ui_local_config_and_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "release"
            prepare(SOURCE, output, **OPTIONS)
            self.assertEqual(validate(output / "todoevents", release=True), [])
            with zipfile.ZipFile(output / "todoevents.zip") as archive:
                names = archive.namelist()
                self.assertIn("plugin.json", names)
                self.assertIn("skills/organize-public-event/SKILL.md", names)
                self.assertFalse(
                    any(name.startswith(("ui/", "docs/", ".")) for name in names)
                )
                self.assertNotIn("service-config.json", names)
                self.assertEqual(
                    archive.read("LICENSE"), (SOURCE / "LICENSE").read_bytes()
                )
            config = json.loads((output / "service-config.json").read_text())
            self.assertEqual(
                config["PLUGIN_RESOURCE_URL"], config["PLUGIN_OAUTH_AUDIENCE"]
            )
            self.assertEqual(config["PLUGIN_UI_DOMAIN"], OPTIONS["ui_domain"])
            before = (output / "todoevents.zip").read_bytes()
            with self.assertRaisesRegex(ValueError, "already exists"):
                prepare(SOURCE, output, **OPTIONS)
            self.assertEqual(before, (output / "todoevents.zip").read_bytes())

    def test_reject_private_placeholder_credential_and_non_https_urls(self):
        for value in (
            "http://todo-events.com/mcp",
            "https://127.0.0.1/mcp",
            "https://localhost./mcp",
            "https://mcp.todo-events.invalid/mcp",
            "https://example.com/mcp",
            "https://user:secret@todo-events.com/mcp",
            "https://todo-events.com/mcp?token=secret",
            "https://todo-events.com/mcp#secret",
            "https://192.168.1.2/mcp",
            "https://todo-events.com/\npath",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                public_https_url(value)

    def test_ui_must_be_origin_and_bad_input_creates_nothing(self):
        with self.assertRaises(ValueError):
            public_https_url("https://widget.todo-events.com/path", origin_only=True)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "release"
            with self.assertRaises(ValueError):
                prepare(
                    SOURCE,
                    output,
                    **{**OPTIONS, "mcp_url": "http://localhost:8787/mcp"},
                )
            self.assertFalse(output.exists())

    def test_apps_hooks_and_mcp_credentials_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / "plugin"
            shutil.copytree(SOURCE, package, ignore=shutil.ignore_patterns("ui"))
            manifest = json.loads((package / "plugin.json").read_text())
            manifest["extensions"]["com.openai"]["apps"] = ["./secret.app.json"]
            (package / "plugin.json").write_text(json.dumps(manifest))
            mcp = json.loads((package / "mcp.json").read_text())
            mcp["mcpServers"]["todoevents"]["headers"] = {
                "Authorization": "Bearer fake"
            }
            (package / "mcp.json").write_text(json.dumps(mcp))
            errors = validate(package)
            self.assertTrue(any("app references" in error for error in errors))
            self.assertTrue(any("credentials" in error for error in errors))

    def test_symlink_content_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory) / "plugin"
            shutil.copytree(SOURCE, package, ignore=shutil.ignore_patterns("ui"))
            (package / "assets" / "outside").symlink_to(Path(directory) / "outside")
            self.assertTrue(
                any(
                    "forbidden submission content" in error
                    for error in validate(package)
                )
            )


if __name__ == "__main__":
    unittest.main()
