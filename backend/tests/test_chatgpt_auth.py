"""Real RSA access-token and explicit account-link boundary tests; no live IdP."""

import asyncio
import json
import sqlite3
import time

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from backend.chatgpt_plugin.auth import (
    SCOPES,
    AuthenticationError,
    AuthSettings,
    IdentityStore,
    JWKSCache,
    OAuthVerifier,
)


@pytest.fixture(scope="module")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def identity_store(tmp_path):
    path = tmp_path / "identities.db"

    def connect():
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    connection = connect()
    connection.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)")
    connection.execute("INSERT INTO users (id,email) VALUES (7,'organizer@example.test')")
    connection.commit()
    connection.close()
    store = IdentityStore(connect)
    store.migrate()
    connection = connect()
    connection.execute("INSERT INTO plugin_oauth_identities VALUES (?,?,?,?,1)", ("https://issuer.example.test", "subject-7", 7, " ".join(sorted(SCOPES))))
    connection.commit()
    connection.close()
    return store


@pytest.fixture
def auth(signing_key, identity_store):
    settings = AuthSettings(
        resource_url="https://plugin.example.test/mcp", issuer="https://issuer.example.test",
        audience="https://plugin.example.test/mcp", jwks_url="https://issuer.example.test/keys", clock_leeway_seconds=0,
    )
    key = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing_key.public_key()))
    key.update(kid="test-key", use="sig", alg="RS256")
    requests = []

    def fetch(request):
        requests.append(request)
        return httpx.Response(200, json={"keys": [key]})

    verifier = OAuthVerifier(settings, identity_store, jwks=JWKSCache(settings.jwks_url, transport=httpx.MockTransport(fetch)))

    def token(**claims):
        now = int(time.time())
        values = {"iss": settings.issuer, "aud": settings.audience, "sub": "subject-7", "iat": now, "exp": now + 300, "nbf": now - 1, "scope": " ".join(SCOPES)}
        values.update(claims)
        return jwt.encode(values, signing_key, algorithm="RS256", headers={"kid": "test-key"})

    return verifier, token, requests


def verify(verifier, token, scopes=frozenset({"events:publish"})):
    return asyncio.run(verifier.verify("Bearer " + token if token else None, scopes))


def test_valid_signed_access_token_and_cached_static_key_source(auth):
    verifier, token, requests = auth
    principal = verify(verifier, token())
    assert principal.user_id == 7
    assert principal.subject == "subject-7"
    assert principal.scopes == SCOPES
    verify(verifier, token())
    assert len(requests) == 1
    assert str(requests[0].url) == verifier.settings.jwks_url


@pytest.mark.parametrize("claims", [
    {"iss": "https://attacker.example.test"}, {"aud": "https://other-resource.example.test/mcp"},
    {"exp": 1}, {"nbf": 4102444800}, {"iat": 4102444800},
    {"sub": ""}, {"sub": 7}, {"scope": ["events:publish"]},
])
def test_wrong_issuer_audience_expiry_not_before_subject_and_scope_are_rejected(auth, claims):
    verifier, token, _ = auth
    with pytest.raises(AuthenticationError) as caught:
        verify(verifier, token(**claims))
    assert caught.value.code == "invalid_token"


@pytest.mark.parametrize("missing", ["exp", "iat", "iss", "aud", "sub"])
def test_required_claims_cannot_be_omitted(auth, signing_key, missing):
    verifier, token, _ = auth
    claims = jwt.decode(token(), options={"verify_signature": False})
    del claims[missing]
    value = jwt.encode(claims, signing_key, algorithm="RS256", headers={"kid": "test-key"})
    with pytest.raises(AuthenticationError):
        verify(verifier, value)


def test_missing_and_legacy_password_tokens_fail_closed(auth):
    verifier, _, requests = auth
    with pytest.raises(AuthenticationError) as caught:
        verify(verifier, None)
    assert caught.value.code == "authentication_required"
    legacy = jwt.encode({"sub": "organizer@example.test", "role": "admin", "exp": time.time() + 300}, "test-only-secret" * 3, algorithm="HS256")
    with pytest.raises(AuthenticationError):
        verify(verifier, legacy)
    assert not requests


def test_email_is_never_used_to_link_a_different_subject(auth):
    verifier, token, _ = auth
    with pytest.raises(AuthenticationError):
        verify(verifier, token(sub="different-subject", email="organizer@example.test", email_verified=True))


def test_token_scope_and_explicit_mapping_scope_are_both_required(auth, identity_store):
    verifier, token, _ = auth
    with pytest.raises(AuthenticationError) as caught:
        verify(verifier, token(scope="events:read"))
    assert caught.value.code == "insufficient_scope"
    connection = identity_store.connection_factory()
    connection.execute("UPDATE plugin_oauth_identities SET scopes='events:read'")
    connection.commit()
    connection.close()
    with pytest.raises(AuthenticationError) as caught:
        verify(verifier, token())
    assert caught.value.code == "insufficient_scope"


def test_disable_and_account_deletion_take_effect_for_each_request(auth, identity_store):
    verifier, token, _ = auth
    value = token()
    verify(verifier, value)
    connection = identity_store.connection_factory()
    connection.execute("UPDATE plugin_oauth_identities SET enabled=0")
    connection.commit()
    with pytest.raises(AuthenticationError):
        verify(verifier, value)
    connection.execute("DELETE FROM users WHERE id=7")
    connection.commit()
    assert connection.execute("SELECT count(*) FROM plugin_oauth_identities").fetchone()[0] == 0
    connection.close()


def test_unknown_kid_does_not_trigger_unbounded_network_requests(auth, signing_key):
    verifier, token, requests = auth
    verify(verifier, token())
    claims = jwt.decode(token(), options={"verify_signature": False})
    for kid in ["unknown-a", "unknown-b", "unknown-c"]:
        forged = jwt.encode(claims, signing_key, algorithm="RS256", headers={"kid": kid, "jku": "https://attacker.example.test/keys"})
        with pytest.raises(AuthenticationError):
            verify(verifier, forged)
    assert len(requests) == 1


@pytest.mark.parametrize("response", [
    httpx.Response(302, headers={"Location": "https://other.example.test/keys"}),
    httpx.Response(200, content=b"x" * 131073),
    httpx.Response(200, json={"keys": [{}] * 33}),
    httpx.Response(200, json={"keys": "invalid"}),
])
def test_jwks_redirects_and_unbounded_or_invalid_responses_rejected(auth, response):
    verifier, token, _ = auth
    verifier.jwks = JWKSCache(verifier.settings.jwks_url, transport=httpx.MockTransport(lambda request: response))
    with pytest.raises(AuthenticationError):
        verify(verifier, token())


def test_unconfigured_provider_and_missing_identity_schema_fail_closed(identity_store):
    settings = AuthSettings("http://localhost:8001/mcp", development=True)
    verifier = OAuthVerifier(settings, identity_store)
    with pytest.raises(AuthenticationError) as caught:
        verify(verifier, "anything")
    assert caught.value.code == "auth_unavailable"


@pytest.mark.parametrize("kwargs", [
    {"resource_url": "http://public.example.test/mcp"},
    {"resource_url": "https://*.example.test/mcp"},
    {"resource_url": "https://public.example.test:invalid/mcp"},
    {"resource_url": "https://user:password@public.example.test/mcp"},
    {"resource_url": 'https://public.example.test/mcp"\nheader'},
    {"resource_url": "https://public.example.test/mcp", "issuer": "https://issuer.example.test"},
    {"resource_url": "https://public.example.test/mcp", "issuer": "https://issuer.example.test", "audience": "other", "jwks_url": "https://issuer.example.test/keys"},
])
def test_unsafe_or_partial_oauth_configuration_rejected(kwargs):
    with pytest.raises(ValueError):
        AuthSettings(**kwargs)


def test_production_env_requires_external_provider(monkeypatch):
    monkeypatch.setenv("PLUGIN_RESOURCE_URL", "https://plugin.example.test/mcp")
    for name in ["PLUGIN_ENV", "PLUGIN_OAUTH_ISSUER", "PLUGIN_OAUTH_AUDIENCE", "PLUGIN_OAUTH_JWKS_URL"]:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(ValueError, match="Production requires"):
        AuthSettings.from_env()


def test_authentication_challenge_contains_discovery_error_and_description(auth):
    verifier, _, _ = auth
    challenge = AuthenticationError("authentication_required", "Sign in").challenge(verifier.settings, frozenset({"events:write"}))
    assert 'resource_metadata="https://plugin.example.test/.well-known/oauth-protected-resource/mcp"' in challenge
    assert 'error="invalid_token"' in challenge
    assert 'error_description="' in challenge
    assert 'scope="events:write"' in challenge
