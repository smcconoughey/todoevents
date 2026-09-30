# Local verification — 30 September 2026

The implementation is complete locally on `codex/chatgpt-plugin`, based on `2c4d59eab199af40f6fc758821836b51092c16be`. It has not been pushed, deployed, installed in ChatGPT, submitted, or approved for the directory. No real event, live credential, reviewer account, billing flow, or service purchase was created.

## Final automated results

| Check | Actual result |
| --- | --- |
| Combined `pytest backend/tests` | **217 passed, 0 failed, 0 skipped**; 125 legacy deprecation warnings |
| OAuth verification and identity mapping | 33 tests passed, included above |
| Local CLI fixture, overwrite and trusted-proxy protection | 26 tests passed, included above |
| Domain discovery/review/publish/update/cancel | 43 tests passed, included above |
| Real OAuth/MCP/shared legacy application integration | 11 tests passed, included above |
| Actual PostgreSQL | **20 tests passed**, included above; PostgreSQL 18.6, temporary local Unix-socket instance |
| MCP transport, schemas, challenges and widget metadata | 25 tests passed, included above |
| Existing backend publication/authority/time/deletion regressions | 59 tests passed, included above |
| Widget | **58 tests passed**; ESLint, TypeScript 6.0.3 and Vite 8.3.1 production build passed |
| Package generation and boundaries | **6 tests passed**; offline source validator passed |
| Focused Python Ruff lint and formatting | Passed for plugin, safety/recommendations helpers, all new tests and packaging scripts |
| Python compilation and diff whitespace | Passed for changed code/docs; full branch whitespace check flags one inherited trailing space in the byte-identical packaged LICENSE, deliberately preserved |
| Dependency consistency | `pip check` passed in both integrated test and fresh standalone runtime environments |
| Widget dependency audit | **0 reported vulnerabilities** on this date |

Total across the backend, widget, and packaging suites: **281 passing tests**. The PostgreSQL tests actually ran; they were not counted from a skipped run. Each uses isolated schema/records; no production database was accessed. PostgreSQL tests include concurrent create/update retries, competing previews, update/cancel races, rollback, and actual legacy web event/account deletion with absent or sparse optional tables.

## The shared-record loop

`backend/tests/test_chatgpt_integration.py::test_complete_publication_update_discovery_and_cancellation_loop` runs the actual MCP resource server, signed test OAuth tokens, domain service, existing FastAPI routes and one shared SQLite event database. It verifies:

1. An organizer plan becomes a private review; searches and web routes cannot see it.
2. Explicit confirmation publishes one new event into the application's existing `events` table.
3. Anonymous MCP discovery, legacy public discovery, event details, and the canonical slug's data route immediately return the same ID/content/link.
4. An owned update produces a private before/after review; neither the preview nor rejected confirmation changes public content.
5. Confirmed publication updates that same ID and canonical URL, including legacy admission text. A retry creates no second event.
6. Another organizer cannot edit or cancel the listing.
7. Authorized cancellation removes the listing from MCP and web discovery/detail. Old create/update retries cannot resurrect it.

The fixture begins with two application records, including an unpublished record, and finishes with three records after one creation and one update. The unpublished content never appears in public responses. Cancellation retains the durable event record while removing public availability.

These are measurable local outcomes: one consented creation, one consented update, no duplicate row, consistent matching search results before cancellation, and no matching listing afterward. They are not production adoption or attendance measurements. The widget separately verifies that an explicit outbound action requests the exact canonical URL through the host; a click/open request is not called attendance or proof of a completed visit. No covert analytics or new external tracking service was added. Aggregate production search/publication/outbound measurement and retention still require an operator decision; see OPERATIONS.md.

The SPA's `/e/:slug` route and its actual canonical data endpoint are verified together in integration assertions. This is not a claim that a deployed ChatGPT widget and a production website were exercised in one live browser session.

## Browser and runtime verification

Browser work used **this Mac's Codex In-app Browser**. Final local widget inspection covered desktop 1280×900 and mobile 390×844, using clearly labelled synthetic demo views. Desktop and mobile screenshots were inspected during QA. At 390px, document width remained 390px and measured action buttons were 44px tall. The temporary viewport override was reset afterward.

Verified visually and through browser controls:

- Full reviewed update and readable before/after differences.
- My events → Edit event with complete prefilled public fields and explicit event timezone.
- Back from editing preserves the current review and keeps confirmation unchecked/disabled.
- Back without updating reports that changes remain private.
- Cancellation has a separate unchecked confirmation; Keep event returns to the organizer view.
- No-results state retains date/destination filters and offers explicit recovery actions.

Automated widget tests additionally cover safe text rendering, malicious links/descriptions, interrupted calls, stable retry keys, expired/stale review recovery, timezone/DST errors, radius preservation, and unavailable/cancelled/unpublished states. Production `dist/events.html` is self-contained and contains no local demo fixture markers or external assets.

A fresh Python 3.11 virtual environment installed only `backend/requirements-plugin.lock`. Its loopback server successfully returned health, all **10 tools**, one synthetic anonymous search match, `auth_unavailable` for organizer access without a configured provider, and the **267,717-character** built widget resource. The widget metadata used a fictional `.invalid` origin only for this local smoke test. This was not an external domain registration. Runtime smoke checks were corrected to configure widget metadata and send valid tool arguments; the final checks passed.

## Independent review and fixed findings

Separate reviewers examined the final domain/transport/UI/package changes, including public/private filtering, OAuth issuer/audience/signature/scope and issuer/subject binding, exact review/version/content ownership, replay locking, stale live updates, and untrusted display data. No additional concrete security bypass remained in that review.

Review and integration testing resulted in fixes for: published-only reads across public APIs; caller-supplied signup roles; unprotected administrative routes; implicit administrator provisioning; radius expansion/deduplication; invalid/overnight event times; cancelled and unpublished web edits; stale timezone metadata; canonical slug stability; deletion cascades; child-first account deletion and sparse PostgreSQL optional tables. Existing commercial licensing and source assets remain unchanged.

Review is evidence, not certification. Installed-client consent behavior, real provider configuration and deployed proxy/database behavior remain release gates.

The final deployment review also found that ignoring all forwarded client addresses would make reverse-proxy traffic share a rate-limit bucket. The launcher now supports an explicit validated `PLUGIN_TRUSTED_PROXY_IPS` boundary and continues to reject forwarded headers by default. Wildcards, hostnames, unrestricted networks and invalid values are rejected. Tests verify that an approved proxy can forward distinct clients and an untrusted sender cannot spoof the peer. Actual provider proxy ranges and aggregate capacity still require deployment verification; the code does not guess or automatically trust a hosting network.

## Existing application failures and unrun checks

| Check | Result and limit |
| --- | --- |
| Existing frontend and beta production compilation | Both Vite builds passed in disposable copies installed from their existing lockfiles; 2,263 and 2,241 modules respectively |
| Existing frontend and beta lint commands | Both fail: ESLint configuration is absent in the baseline projects |
| Existing frontend and beta dependency audit | Each reports **23 vulnerabilities: 4 low, 3 moderate, 16 high**; no dependency overhaul was included in this plugin scope |
| Legacy monolithic backend Ruff | Baseline 867 findings; final 858. It is not lint-clean. Focused new code is lint-clean |
| Legacy warnings | Pydantic v1-style validators/config/dict and passlib `crypt` deprecations; 125 warnings in the final combined run |
| Web build wrapper/live sitemap generation | Unrun. Direct Vite builds were used because the wrapper fetches the live sitemap and performs dependency installation |
| Legacy ad-hoc scripts outside `backend/tests` | Unrun where they can create live accounts or invoke external services/payments |
| Docker image build/scan and Render live schema validation | Unrun: neither Docker nor Render CLI is installed on this Mac. Prepared artifacts are `Dockerfile.plugin` and `render.chatgpt-plugin.yaml` |
| GitHub Actions | Workflow prepared, not run remotely; no push occurred |
| Live OAuth, installed ChatGPT desktop/mobile, reviewer/video/domain verification | Unrun; require approved external configuration/access |

Existing frontend builds retain warnings about stale Browserslist data, large chunks and mixed dynamic/static imports. These limitations do not change the passing plugin results and must not be described as passing full-repository lint/audit.

The original and packaged LICENSE both have SHA-256 `0ec228a0d290e810a51e56bc4b716476ce4e427fae87352c8c67559a470b7bfc`. Its existing line 59 trailing space is the sole full-branch whitespace finding; no license text was rewritten to suppress it.

## Reproduction

From the repository root, with an isolated test environment and disposable PostgreSQL DSN:

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt -r backend/requirements-plugin.lock pytest ruff
PLUGIN_TEST_POSTGRES_DSN="$DISPOSABLE_TEST_POSTGRES_DSN" TODOEVENTS_SKIP_STARTUP=1 \
  .venv/bin/python -m pytest backend/tests -q
.venv/bin/ruff check backend/chatgpt_plugin backend/event_safety.py backend/recommendations_endpoints.py backend/tests scripts/*plugin*.py
.venv/bin/ruff format --check backend/chatgpt_plugin backend/event_safety.py backend/recommendations_endpoints.py backend/tests scripts/*plugin*.py
.venv/bin/python -m unittest discover -s scripts -p 'test_plugin_packaging.py'
.venv/bin/python scripts/validate_plugin_package.py plugins/todoevents
npm --prefix plugins/todoevents/ui ci
npm --prefix plugins/todoevents/ui run check
```

The PostgreSQL suite skips without its explicit test DSN; do not report that skipped run as PostgreSQL validation. Never provide a production DSN. Local disposable data and reports live under ignored `.test-runtime/`.

## Documentation and release decisions

Current official pages were reviewed through the Mac browser: [DevDay recap](https://openai.com/index/devday-2026-recap/), [building plugins](https://developers.openai.com/plugins/build/plugins), [extensions](https://developers.openai.com/plugins/build/extensions), [authentication](https://developers.openai.com/plugins/build/auth), [guidelines](https://developers.openai.com/plugins/plugin-guidelines), [submission](https://developers.openai.com/plugins/deploy/submission), and [app review](https://developers.openai.com/plugins/deploy/app-review). The latest guidelines and live portal should govern the annotation-justification discrepancy in older review text.

The exact ordered approval bundle is in [RELEASE_APPROVAL.md](RELEASE_APPROVAL.md): choose hosting account/region/plan and cost ceiling; verify domains and publisher/license authority; choose OAuth provider/tenant and actual callbacks/scopes; approve database role/migration and organizer identity bindings; build/validate/deploy staging; run installed desktop/mobile review cases and make the real video; then approve the exact final submission artifact. [SUBMISSION.md](SUBMISSION.md) and [REVIEW_CASES.md](REVIEW_CASES.md) contain five positive and three negative cases. Privacy documentation explicitly distinguishes implemented deletion from retained audit/financial/backup data.
