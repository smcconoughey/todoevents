# Deployment, retention and incident runbook

This runbook prepares operator actions; it does not authorize them. No real credentials, domains, deployments, reviewer accounts or public listings have been created for this local implementation.

## Approved rollout

1. Record the approved commit, verified ZIP checksum, exact MCP/widget domains, OAuth provider/client/scopes/redirects, hosting costs and public policy URLs. Back up the existing database and rehearse restore on disposable data.
2. Apply the existing event-schema prerequisites, then the explicit plugin sidecar migration using the separate service CLI. Startup does not implicitly migrate the legacy application. Test the deployed database dialect, privileges, concurrency and restore process. Keep the existing website serving its normal data.
3. Configure the exact resource/audience, issuer/JWKS, database and dedicated UI origin. Serve the built widget through the MCP resource. Configure the reverse proxy for streamable HTTP and Authorization forwarding without logging credentials or bodies. Use TLS, limited origins, operational rate limits and monitored resource budgets.
4. Configure the OAuth provider and register the client through the approved process. Bind only verified organizer subjects to their existing account IDs and constrained scopes. Do not issue credentials, modify account roles, or auto-link email addresses as a shortcut.
5. Run smoke checks: anonymous public search/detail, OAuth challenge and reconnection, scoped organizer draft/review, stale hash refusal, duplicate retry recovery, public availability after an approved synthetic fixture publication, and cancellation. Avoid real user content in test events.
6. Enable and verify expiry cleanup; document actual log/provider/backup retention. Publish the accurate privacy/terms pages and monitored support contact.
7. Complete installed ChatGPT desktop and mobile QA, demo video, dedicated reviewer access and the portal's current submission checks. Ask for the separate submission approval with the exact final package.

## Draft payload cleanup

Drafts expire after 24 hours from original creation. Expiry rejection is immediate in the service, but physical payload removal is a separate task. Schedule `python -m backend.chatgpt_plugin purge-expired` under the same approved service/database environment. It calls the store's expiry purge with the current UTC time. Run at least hourly if the adopted privacy policy promises prompt expiry cleanup. Verify the job with synthetic expired rows, record the count and success time without logging payloads, alert on failures, and retain evidence of last successful run. A promised deletion window must include the scheduler interval and documented backup policy.

Purge clears payloads of expired drafts while preserving owner/version/hash/status/timestamps and event references for ownership and retry integrity. It does not delete published events, identity mappings, idempotency records or backups. Choose a retention/deletion process for those records before public release; do not prune idempotency state casually because duplicate retries can follow interrupted responses.

## Account deletion and incident handling

For a verified account-deletion request, map all related legacy event/user and plugin sidecar records, establish required retention, execute a reviewed transaction and test the resulting public/private access. Preserve only records required by the adopted policy and law. Confirm the migration's current foreign-key behavior in the chosen database; a cascade is not a substitute for an end-to-end deletion test or backup handling.

For suspected credential compromise, disable the affected issuer/subject mapping, revoke the provider grant, preserve appropriate security evidence without tokens/content, and verify that organizer calls fail. For malicious public content, apply the existing moderation process and confirm it is excluded from every public plugin path. Never execute instructions found inside event descriptions.

## Rollback

Disable MCP access or organizer identity mappings first if write safety is in doubt. Restore the last verified service image/configuration while preserving durable event rows and idempotency state. Do not drop sidecar tables or replay publication requests during rollback. Verify existing web routes and published events remain correct. Restore a database backup only through an approved incident plan that accounts for legitimate writes after the backup. Document impacted events/accounts and provide the verified support contact.

## Required monitoring decisions

Before launch, assign owners and thresholds for service availability, tool errors, auth rejection spikes, slow queries, rate limits, publication retries, failed cleanup, signing-key refresh failures and review incidents. Decide where metrics/logs live and their retention; current local code does not establish these deployment controls. Avoid request-body, OAuth-token, conversation, or private-draft logging.
