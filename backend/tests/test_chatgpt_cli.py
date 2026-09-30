"""Operator commands must never overwrite a real database or create credentials."""

import sqlite3

import pytest

from backend.chatgpt_plugin.cli import seed_demo


def test_seed_demo_is_synthetic_and_contains_no_auth_authority(tmp_path):
    path = tmp_path / "local.sqlite3"
    seed_demo(path)
    with sqlite3.connect(path) as connection:
        assert (
            connection.execute(
                "SELECT count(*) FROM plugin_oauth_identities"
            ).fetchone()[0]
            == 0
        )
        assert (
            connection.execute("SELECT hashed_password FROM users").fetchone()[0] == "!"
        )
        assert (
            connection.execute("SELECT description FROM events")
            .fetchone()[0]
            .startswith("Synthetic local fixture")
        )
    assert path.stat().st_mode & 0o777 == 0o600


def test_seed_demo_refuses_existing_database(tmp_path):
    path = tmp_path / "existing.sqlite3"
    original = b"existing content must survive"
    path.write_bytes(original)
    with pytest.raises(FileExistsError):
        seed_demo(path)
    assert path.read_bytes() == original
