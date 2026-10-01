# Live discovery and organizer-auth approval proposal

Official pricing and authentication documentation was checked read-only on **2026-09-30 in this Mac's Codex In-app Browser**. No provider account, grant, key, paid service or billing setup was created during this research. Prices below are published baseline charges, not a quote for the account's final invoice.

## Immediate path: existing backend, public discovery

The approved near-term path adds opt-in MCP to the **existing Ohio backend**, retaining its PostgreSQL 16 database and static website. `public` mode exposes only `list_search_areas`, `search_events`, `get_event` and `search_venues`; it adds **$0 in new service compute charges** if the current plan is retained. Existing capacity/usage still applies; shared-host tests must pass and the website must remain functional.

Use `plugin_host:create_app` from the backend directory with `PLUGIN_MODE=public`, `PLUGIN_ENV=production`, and the actual existing HTTPS origin plus `/mcp` as `PLUGIN_RESOURCE_URL`. The adapter defaults to `off`, reuses `DATABASE_URL`, and does not migrate automatically. `/health` stays legacy; `/mcp/health` checks MCP. Invalid plugin configuration leaves the website available. Public mode has no OAuth metadata, and plain results do not require a widget domain.

Public mode creates no drafts and needs no draft-purge job. `full` mode requires approved OAuth plus cleanup. The combined host uses the existing APScheduler for an initial purge and hourly cleanup without another service charge; its lifecycle and failure behavior have isolated automated tests. Verify the scheduled job and retention evidence on the actual deployment before organizer rollout. A rollback to public/off after creating drafts requires continued operator cleanup as described in OPERATIONS.md.

## Standalone alternative and verified costs

| Option | Published incremental baseline | Limits and decision |
| --- | --- | --- |
| Existing backend, public-only MCP | $0 new service compute | Approved implementation path; existing capacity/usage still applies |
| Separate smallest paid Render web service | $7/month for 512 MB, listed as `0.5c-512mb` | Same existing workspace/Ohio and shared database; requires approval for the additional charge |
| Separate paid service plus a new Render cleanup cron | At least $8/month: $7 web + $1 minimum cron | Full organizer-mode option if no existing approved scheduler is used |
| Render Free web service | $0 compute | Preview only: idle sleep after 15 minutes, about a minute to wake, 750 free hours shared per workspace; not the production recommendation |

The smallest paid compute is currently `$7/month`; older selectors may say Starter. Cron has a **$1 minimum monthly charge**, increasing with sufficient runtime. Neither path needs a new database. Sources: [Render pricing](https://render.com/pricing), [cron billing](https://render.com/docs/cronjobs), [Free limitations](https://render.com/docs/free).

Usage/domain charges remain separate. Published Hobby allowances are 5 GB bandwidth, 500 build minutes and two custom domains; overages are $0.15/GB, $5/1,000 minutes and $0.25/domain/month. Verify the account's actual plan/usage. The existing MCP path requires no new domain or workspace/database upgrade. [Render pricing](https://render.com/pricing)

## Organizer authentication: possible $0 provider tier, approval still needed

Auth0 lists **Free at $0/month, up to 25,000 MAU**, Auth for MCP, one tenant, three administrators, one-day logs and community support. Custom database connections are excluded: bind verified identities to existing organizers without silently importing legacy passwords. Custom domains require card verification; propose the default tenant domain. [Auth0 pricing](https://auth0.com/pricing)

Propose **manual CIMD, public-client `none`, authorization code + PKCE S256**, with per-app delegated `events:read`, `events:write`, `events:publish`. Verify actual compatibility: OpenAI's CIMD advertises both `none`/`private_key_jwt` plus a legacy preference, while Auth0's `private_key_jwt` is Enterprise-only. Public-client support is documented, not an already tested connection. Sources: [OpenAI auth](https://developers.openai.com/plugins/build/auth), [Auth0 CIMD](https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application/manual-cimd-registration).

Keep open DCR disabled: Auth0 recommends manual CIMD for production and describes public-registration risks and Enterprise-only mitigation options. OpenAI also supports predefined OAuth clients with PKCE; that alternative still needs client/credential approval and testing. [Auth0 DCR guidance](https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application/dynamic-client-registration)

Before organizer writes are enabled, approve and verify all of the following:

1. Use a specified existing suitable provider/tenant, or approve creation of one Auth0 Free tenant with the chosen owner and region. Confirm current entitlement and terms; no paid upgrade, billing setup or custom login domain is proposed.
2. Register the exact OpenAI client metadata document and redirect URI shown on the live MCP management page. Use the actual deployed MCP URL as the API identifier/resource/audience; obtain exact issuer and JWKS values from the provider. Do not guess callback paths or tenant URLs.
3. Enable the provider's required resource handling and issuer-identification behavior, advertise PKCE S256, and grant only per-application user-delegated event scopes. For Auth0, verify **Resource Parameter Compatibility Profile** and **Include Issuer in Authorization Responses**. Approve any chosen domain-level connection configuration rather than broadly enabling all applications. [Resource compatibility](https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile)
4. Identify each initial organizer's verified issuer/subject and correct existing local account; explicitly approve the stored mapping and scopes. Create dedicated reviewer access only after its permissions and removal plan are approved. Do not collect passwords or tokens in chat.
5. Test real connection, consent, refresh/reconnect, issuer/audience/scope rejection, cross-owner refusal, reviewed create/update/cancel and interrupted retries. Enable and verify draft cleanup before turning on organizer tools. Complete installed ChatGPT desktop/mobile testing and publish accurate retention/support disclosures before submission.

The Free-tier proposal is conditional on the actual tenant features, client-registration compatibility and observed usage. Public-only discovery can launch independently of this organizer-auth work; local tests or provider marketing do not establish directory acceptance or overall compliance.
