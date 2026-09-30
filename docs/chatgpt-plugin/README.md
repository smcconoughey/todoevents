# Todo-Events ChatGPT plugin

The plugin adds anonymous discovery of current published events and an authenticated organizer workflow that previews exact public listing content before confirmed publication or update. Discovery links lead to canonical website events; authorized updates and cancellation operate on the same shared event records. The website and its existing database remain the source of listings. This implementation does not promise placement in ChatGPT recommendations, ticket checkout, private invitations, or paid organizer upgrades.

## Local development

Run from the repository root in an isolated Python environment. Use a disposable database containing the normal Todo-Events schema and synthetic events; do not point a local demo or tests at the production database. Backend prerequisites and test evidence are tracked in [TEST_REPORT.md](TEST_REPORT.md).

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-plugin.lock
npm --prefix plugins/todoevents/ui ci
npm --prefix plugins/todoevents/ui run build
```

The server is separate from the legacy backend application; loading it does not run legacy application migrations. Create a synthetic disposable demo database (this command refuses to overwrite an existing file and creates no credentials), then set:

```sh
export PLUGIN_ENV=development
export PLUGIN_RESOURCE_URL=http://127.0.0.1:8787/mcp
mkdir -p .test-runtime
.venv/bin/python -m backend.chatgpt_plugin seed-demo .test-runtime/demo.sqlite3
export PLUGIN_SQLITE_PATH="$PWD/.test-runtime/demo.sqlite3"
.venv/bin/python -m backend.chatgpt_plugin serve --host 127.0.0.1 --port 8787
```

`GET http://127.0.0.1:8787/health` provides a health check. The local streamable HTTP endpoint is `/mcp`; [examples/mcp.local.json](examples/mcp.local.json) is a development client configuration. It is not included in the public distribution. Development HTTP is restricted to loopback. No live credentials are generated. In development with OAuth fields absent, public search is available and organizer tools fail closed with an authentication challenge. Production startup requires the complete OAuth configuration. Organizer flows use injected mock principals only in the local test suite; do not expose a mock authentication server to the internet.

For a separately prepared database with the legacy schema already installed, `.venv/bin/python -m backend.chatgpt_plugin migrate` explicitly adds plugin sidecars. Serving does not apply migrations automatically.

`backend/requirements-plugin.txt` declares supported runtime dependency ranges; the lockfile above pins the reviewed runtime versions. The prepared `Dockerfile.plugin` and `render.chatgpt-plugin.yaml` are covered in [OPERATIONS.md](OPERATIONS.md). Their container build/runtime and Render live-schema checks remain unrun; the local instructions do not deploy them.

## Production configuration to prepare after approval

| Setting | Required value |
| --- | --- |
| `PLUGIN_RESOURCE_URL` | Approved public HTTPS MCP URL, including `/mcp` |
| `PLUGIN_OAUTH_ISSUER` | Approved OAuth provider's exact issuer |
| `PLUGIN_OAUTH_AUDIENCE` | Exact value of `PLUGIN_RESOURCE_URL` |
| `PLUGIN_OAUTH_JWKS_URL` | Approved provider's HTTPS signing-key endpoint |
| `PLUGIN_UI_DOMAIN` | Dedicated registered HTTPS widget origin |
| `PLUGIN_UI_PATH` | Absolute path to the built widget HTML |
| `PLUGIN_AREA_CENTERS_PATH` | Optional path to reviewed public-area-center JSON; required for radius search in each configured area |
| `PLUGIN_DATABASE_URL` or `PLUGIN_SQLITE_PATH` | Existing service database, using least-privilege connection handling |

The issuer, audience, and JWKS configuration must be supplied together. Provision an issuer/subject-to-organizer mapping through the reviewed operator process; existing password JWTs and an email match are insufficient. `events:read`, `events:write`, and `events:publish` are constrained by both the token grant and the stored identity mapping. Public discovery does not require sign-in. See [SECURITY.md](SECURITY.md) for authorization boundaries and [OPERATIONS.md](OPERATIONS.md) for rollout/rollback.

Area-center configuration is a server-side JSON array of objects with exactly `city`, `state`, `country`, `lat`, and `lng`. Values describe operator-reviewed public area centers, never an attendee's location. Matching normalized city/state/country labels determine radius support. Without a configured center, the catalog reports `radius_supported: false` and radius searches fail clearly; area-only search remains available. Do not invent coordinates or silently remove the user's radius constraint. The embedded widget build is `plugins/todoevents/ui/dist/events.html`; without a configured widget domain the service still returns useful plain results.

## Prepare a submission artifact

The checked-in MCP URL ends in `.invalid` and is intentionally unusable. Validate the source offline:

```sh
python3 scripts/validate_plugin_package.py plugins/todoevents
```

After approved domains and public policy documents exist, prepare the clean ZIP using the exact approved values. This command only writes local files; supply real values rather than the illustrative shell variables below:

```sh
python3 scripts/prepare_plugin_package.py \
  --mcp-url "$APPROVED_MCP_URL" \
  --ui-domain "$APPROVED_WIDGET_ORIGIN" \
  --website-url "$VERIFIED_WEBSITE_URL" \
  --privacy-url "$VERIFIED_PRIVACY_URL" \
  --terms-url "$VERIFIED_TERMS_URL" \
  --output /absolute/path/to/new-release-directory
python3 scripts/validate_plugin_package.py /absolute/path/to/new-release-directory/todoevents --release
```

The directory contains `todoevents.zip`, an unpacked copy, and a separate `service-config.json` to align MCP audience and widget domain. The ZIP includes the root `plugin.json`, `mcp.json`, scoped skills, unchanged licensed icon, README, and commercial license. It excludes the service/UI source, `.app.json` files, app references, hooks, local configuration, tests, and credentials. This structural checker does not fetch URLs or prove domain ownership or platform acceptance.

Complete [SUBMISSION.md](SUBMISSION.md), [REVIEW_CASES.md](REVIEW_CASES.md), and [PRIVACY.md](PRIVACY.md) before requesting release approval. The ordered proposal and exact approval choices are in [RELEASE_APPROVAL.md](RELEASE_APPROVAL.md). Local checks and remaining external gates are recorded separately in the test report.
