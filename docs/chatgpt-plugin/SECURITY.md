# Security model and verification boundaries

The plugin is a separate MCP service over the existing Todo-Events data model. Anonymous users may read current published event content. Organizer actions require standards-based OAuth verification and an explicit mapping to an existing organizer. A legacy web password JWT is never sufficient plugin authorization, and no tool requests a password or creates a live credential.

## Trust boundaries

| Boundary or threat | Enforced control | Verification and remaining operational work |
| --- | --- | --- |
| Draft leakage through public search/detail | Server-side published/current-event filtering; public output projection | Test unpublished, canceled, ended and nonexistent records through every public path |
| Forged or wrong-service bearer token | RS256 signature and key checks; exact issuer/resource audience; expiration/issued-at/not-before validation | Negative tests for signature, algorithm, issuer, audience, expiry and scope; register provider correctly |
| Broad or stolen organizer authority | Token scopes intersect stored mapping; identity subject is not a supplied user ID | Protect provider keys and account recovery; approved out-of-band identity binding |
| Cross-owner draft/event mutation | Ownership checked in the transaction | Different organizer negative tests; guessed IDs must not reveal private draft content |
| Publication without reviewed consent | Exact review hash/version and explicit confirmation; stale/expired previews rejected | Host confirmation and human review remain essential; a boolean tool field alone cannot prove human consent |
| Changed content after review | Update invalidates review hash; supplied publication hash must match current draft | Stale-preview and changed-content tests |
| Lost updates to shared website events | Existing-event update draft binds the live baseline; publication checks it again transactionally | Change the live event after preview and verify refusal; approved update retains ID/canonical link |
| Duplicate writes on retries or concurrent requests | Owner-scoped idempotency record, transaction/locks, existing publication recovery | Repeat/interrupted/concurrent-flow tests; preserve idempotency records during rollout |
| Private planning mistaken for public listing | `visibility: public` required; private/undecided intent rejected in skill and validation | Host tests for private party/guest details; do not silently convert visibility |
| XSS or hostile listing text | Text-only rendering, bounded fields, safe link schemes; descriptions treated as untrusted data | Malicious markup/link/instruction test fixtures; verify rendered widget and plain output |
| Prompt injection in public listing | Skills/tools frame event descriptions as data, not instructions | Model must not change tools, reveal data, or publish because a retrieved listing tells it to |
| Location overcollection | Select opaque public area/venue IDs, no attendee coordinates or personal-address schema fields | Review actual tool schema/client context against current guidelines before submission |
| Unapproved tool mutation | Explicit per-tool read/destructive/open-world annotations and scopes | Inspect emitted tool catalog in final service and installed client |
| Token/request leakage in logs | Plugin does not store raw tokens or conversation transcripts | Configure reverse proxy, error collection and host logs to redact authorization and content; verify before launch |

## Authentication deployment

The resource advertises OAuth protected-resource metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`. Organizer calls without valid authority return a recoverable authentication challenge. Configure the approved OAuth authorization server for the resource URL, least-privilege scopes, client registration and redirect requirements. The plugin does not implement a password grant and does not silently link accounts by matching email addresses.

Use all required issuer/audience/JWKS settings together. Development loopback HTTP is allowed only with explicit development configuration. Production issuer/resource/JWKS URLs use HTTPS. Test-only injected principals must remain inaccessible in a production server. Mapping issuer+subject to a local organizer is an operator-controlled, auditable step after identity proof; no model-supplied identity or caller-supplied role may grant organizer authority.

## Release security checks

Run the automated suite and inspect actual results in TEST_REPORT.md; test definitions alone are not pass evidence. Exercise anonymous, unauthenticated, expired/invalid OAuth, insufficient scopes, disabled/missing mapping, cross-owner, stale, repeated, canceled and malicious-content flows. Verify the real provider's refresh/reconnect and token revocation behavior separately. Re-test behind the actual HTTPS proxy with exact CSP origins and installed ChatGPT before public release.

The widget has a dedicated `_meta.ui.domain` and a minimal exact CSP. Avoid wildcards and unrelated domains. The service returns useful plain text plus structured output even when widgets are unavailable. All external event descriptions and URLs remain untrusted; neither UI availability nor a successful search grants publishing authority.
