# Concrete release proposal awaiting owner decisions

The local implementation is prepared for a separate MCP service while the existing website and event database continue to operate. No service, DNS record, OAuth tenant/client, persistent credential, reviewer account or real public listing has been created. The names below are proposals, not verified or reserved resources.

## Proposed configuration

| Item | Proposed choice | Decision or evidence required before action |
| --- | --- | --- |
| Hosting | Separate Render web service alongside the existing Render-hosted backend | Exact approved Render account/workspace, region, service plan/budget, database access and service owner |
| Public MCP endpoint | `https://mcp.todo-events.com/mcp` | Domain ownership, DNS change authority, availability and TLS verification |
| Resource/audience | `https://mcp.todo-events.com/mcp` for both `PLUGIN_RESOURCE_URL` and `PLUGIN_OAUTH_AUDIENCE` | Must exactly match the final selected MCP endpoint |
| Widget origin | `https://widget.todo-events.com` | Dedicated registered widget origin, ownership, platform configuration and exact CSP checks |
| OAuth provider | Proposed Auth0 tenant, or an existing owner-selected established provider meeting current OAuth/plugin requirements | Owner's exact provider/account/tenant and region, verified capabilities, plan/cost, administrative permission and data processing terms |
| OAuth issuer/JWKS | Exact values supplied by the approved provider | Never guess tenant names, issuer URL, key URL or signing material |
| OAuth callback | Exact callback value displayed by the OpenAI plugin management configuration | Copy from the actual management page; do not guess or use a documentation example |
| Scopes | `events:read`, `events:write`, `events:publish` | Approve least-privilege client grants and local mapping scopes |
| Publisher | Proposed Watchtower AB, Inc, as named in the repository license | Owner confirmation, verified publisher identity and control of listing assets/domain |
| Reviewer | Dedicated synthetic organizer identity with separate cross-owner/scope-restricted fixtures as needed | Exact account owner, allowed permissions, access delivery and expiry/removal plan |

Auth0 is a proposed managed-provider option, not a claim that a tenant exists or that a particular current plan, region, price or configuration has been verified. Verify provider fit and pricing before an owner approves any purchase or persistent setup. An existing suitable provider may avoid a new tenant. Configure the approved provider for current OAuth 2.1 requirements, including the actual client/redirect flow; do not infer compatibility from JWT verification alone. The plugin is a resource server, not a replacement login/password system.

## Ordered actions to request and execute

1. **Confirm the release identity and limits.** Obtain the exact Render workspace, selected region and cost ceiling; domain/DNS owner; OAuth provider/account/tenant choice; publisher identity; operations/support owner; and the public data/retention policy decisions. Approve the target commit and implementation scope.
2. **Prepare access and migration.** Identify the existing production database and the narrowly scoped service database role, approve required permissions, back up data, and rehearse migrations/rollback on staging. Approve the issuer+subject-to-local-organizer binding process and the exact permitted organizer/reviewer account IDs. No email-based automatic identity linking.
3. **Approve persistent configuration.** Present the selected provider's actual plan/cost/region and exact issuer/JWKS/redirect/resource/scopes. Then request approval to create or configure the OAuth client and persistent secrets through secure operator interfaces. Never collect secrets in chat or commit them. Approve the separate Render service and proposed DNS/TLS changes before performing them. No purchase or billing setup is part of the local implementation.
4. **Deploy and verify privately.** Build the widget and service, configure the approved values, migrate sidecars explicitly, schedule expiry cleanup, and run staging/provider/proxy/PostgreSQL smoke tests. Validate exact widget origin and CSP, auth reconnect/revocation, stale review/live-baseline rejection, cross-owner refusal and idempotency. Resolve any failure before public submission.
5. **Approve reviewer access and fixtures.** Present exact account permissions and synthetic event contents, request approval to create reviewer access and any public fixture listings, then run the five positive and three negative cases in installed ChatGPT desktop and mobile. Local Mac browser checks at 390px/1280px are useful evidence but do not fulfill installed-client QA. Record the real demo video and remove/cancel fixtures according to the approved plan.
6. **Prepare final submission.** Verify public website/support/privacy/terms, publisher/domain verification and final package against current portal requirements. Generate the ZIP with real verified values, calculate its checksum, attach actual tests/video/account instructions and unresolved limitations, then request explicit approval to submit that artifact. There is no guarantee of directory acceptance, contextual recommendations or overall compliance based on local tests.

Any materially changed service, permission, cost, fixture content or release artifact should be presented with its reason before the corresponding external action. Keep the website available throughout; discovery, canonical links, authorized updates and cancellation must agree across the plugin and shared website records.
