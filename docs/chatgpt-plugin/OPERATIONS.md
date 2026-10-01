# Deployment, retention and incident runbook

This runbook prepares operator actions; it does not authorize them. No real credentials, domains, deployments, reviewer accounts or public listings have been created for this local implementation.

## Prepared service artifacts and unrun checks

[`Dockerfile.plugin`](../../Dockerfile.plugin) builds the widget with Node 24, then copies the embedded HTML and standalone plugin service into a Python 3.11 slim image. Runtime dependencies use the 30 pinned entries in [`backend/requirements-plugin.lock`](../../backend/requirements-plugin.lock); the legacy web application is not started in this image. The runtime runs as UID/GID 10001 and listens on `PORT` (default 8787), with the CLI explicitly bound to `0.0.0.0` inside the container. The repository's `.dockerignore` excludes local databases, environment files, dependencies and test outputs from the build context.

The Dockerfile has **not been built or run here**: Docker is unavailable on this Mac. Local Python/widget tests do not prove the Linux image builds, starts or works behind the production proxy. Once a Docker-capable environment is available, build and scan the image, then test it with approved staging configuration and a disposable database. The following are prepared commands, not executed evidence:

```sh
docker build -f Dockerfile.plugin -t todoevents-plugin:review .
docker run --rm --env-file "$APPROVED_SERVICE_ENV_FILE" \
  todoevents-plugin:review python -m backend.chatgpt_plugin migrate
docker run --rm --env-file "$APPROVED_SERVICE_ENV_FILE" -e PORT=8787 \
  -p 127.0.0.1:8787:8787 todoevents-plugin:review
```

The environment file must be an operator-controlled file outside version control containing the approved staging database and complete OAuth/resource/UI configuration. The migration command changes the selected database and therefore belongs after its backup and access approval. Do not use production data or expose test auth. Startup deliberately does not migrate the database.

[`render.chatgpt-plugin.yaml`](../../render.chatgpt-plugin.yaml) describes one separate Docker web service named `todoevents-plugin`, using `Dockerfile.plugin`, repository-root context, `/health`, and `autoDeployTrigger: off`. Production mode is fixed; database, MCP resource/audience, OAuth issuer/JWKS and widget domain values use `sync: false` for explicit operator configuration. It does not configure a database, create identities, schedule draft cleanup, or change existing web services.

The Blueprint has **not been validated by Render's CLI/live schema or deployed**: the Render CLI is unavailable here. Before importing it, validate against the current Render schema, select the approved account/workspace, and explicitly configure region and plan/budget; these are intentionally absent rather than authorized defaults. Select this exact Blueprint path in the approved repository/branch instead of overwriting the existing application's configuration. Review the resulting service/change preview before confirming creation. Manually configure the approved secrets, domain/TLS and provider setup; a `sync: false` field is not a created secret. The CLI honors Render's supplied `PORT`.

### Trusted reverse proxies and client rate limits

The launcher ignores forwarded-client headers by default, including Uvicorn's ambient `FORWARDED_ALLOW_IPS`. Behind an approved reverse proxy, configure `PLUGIN_TRUSTED_PROXY_IPS` with the exact verified proxy IPs or canonical CIDR ranges, separated by commas. The launcher then enables Uvicorn's proxy-header handling only for those peers, so the application's per-client request limit uses the forwarded client address. Wildcards, hostnames, unspecified addresses, unrestricted networks and malformed entries stop startup. No production proxy range is assumed or configured by this repository.

Verify the hosting provider's current trusted ingress ranges before setting this value, ensure the proxy overwrites or correctly appends `X-Forwarded-For`, and prevent bypassing the approved edge. In staging, prove that two clients behind the proxy receive separate limits and that a direct untrusted client cannot spoof its address. Without this setting, clients behind the same proxy intentionally share its 120-request/minute allowance. Shared edge rate limits and provider-specific ingress validation remain deployment checks.

## Approved rollout

1. Record the approved commit, verified ZIP checksum, exact MCP/widget domains, OAuth provider/client/scopes/redirects, hosting costs and public policy URLs. Back up the existing database and rehearse restore on disposable data.
2. Validate the prepared Docker image and Render Blueprint as described above. Apply the existing event-schema prerequisites, then the explicit plugin sidecar migration using the separate service CLI. Startup does not implicitly migrate the legacy application. Test the deployed database dialect, privileges, concurrency and restore process. Keep the existing website serving its normal data.
3. Configure the exact resource/audience, issuer/JWKS, database and dedicated UI origin. Serve the built widget through the MCP resource. Configure the reverse proxy for streamable HTTP and Authorization forwarding without logging credentials or bodies. Use TLS, limited origins, operational rate limits and monitored resource budgets.
4. Configure the OAuth provider and register the client through the approved process. Bind only verified organizer subjects to their existing account IDs and constrained scopes. Do not issue credentials, modify account roles, or auto-link email addresses as a shortcut.
5. Run smoke checks: anonymous public search/detail, OAuth challenge and reconnection, scoped organizer draft/review, stale hash refusal, duplicate retry recovery, public availability after an approved synthetic fixture publication, and cancellation. Avoid real user content in test events.
6. Enable and verify expiry cleanup; document actual log/provider/backup retention. Publish the accurate privacy/terms pages and monitored support contact.
7. Complete installed ChatGPT desktop and mobile QA, demo video, dedicated reviewer access and the portal's current submission checks. Ask for the separate submission approval with the exact final package.

## Draft payload cleanup

Drafts expire after 24 hours from original creation. Expiry rejection is immediate in the service; physical payload removal runs separately. The combined backend's `full` mode now requires the existing running APScheduler, purges once before MCP becomes available, and registers the single `plugin_draft_cleanup` job hourly against the actual plugin store. Keep the existing one-worker configuration. The job coalesces missed executions and permits one running invocation. PostgreSQL purge statements have a five-second timeout. Cleanup does not migrate the database or create a service.

Cleanup records its cleared-row count and UTC last-success time in the existing task status and sanitized logs. A failed purge, stopped/paused scheduler, missing/paused job, or more than 65 minutes without successful cleanup makes the combined MCP endpoint unavailable while legacy website routes stay available. A successful scheduled retry restores MCP availability. Shutdown removes only this host's cleanup job. Verify the job with synthetic expired rows, alert on its failures and retain evidence of last successful execution. A promised deletion window must include the scheduler interval and documented backup policy.

Standalone deployments still need operator scheduling of `python -m backend.chatgpt_plugin purge-expired` under the approved plugin database environment. Combined-host `public` and `off` modes do not run purge. If rolling back from `full` mode after drafts have been created, continue hourly cleanup until those payloads expire and are cleared; from the backend service root, use `PLUGIN_DATABASE_URL="$DATABASE_URL" python -m chatgpt_plugin purge-expired` against the same approved database. Do not print or copy the database URL.

Purge clears payloads of expired drafts while preserving owner/version/hash/status/timestamps and event references for ownership and retry integrity. It does not delete published events, identity mappings, idempotency records or backups. Choose a retention/deletion process for those records before public release; do not prune idempotency state casually because duplicate retries can follow interrupted responses.

## Account deletion and incident handling

For a verified account-deletion request, map related legacy event/user and plugin sidecar records, establish required retention, execute the approved account deletion and verify resulting public/private access. The tested legacy admin account-deletion path deletes the user's owned events and user in one transaction, cascading their plugin identities, drafts, publications and idempotency records while preserving other owners' records. Recheck this behavior against the deployed schema and maintain backup handling; the general website privacy-request workflow has not been verified to invoke it automatically.

Legacy activity logs, media audit/forensic data, user forensic data and referral financial records are retained. Applicable nullable user/event references are cleared, but stored detail/forensic content is unchanged. Do not describe this as complete audit-data erasure or anonymization. Single-event deletion also cascades its plugin publication/idempotency metadata; associated draft tombstones can remain with a null event reference until the scheduled payload purge. Cancellation only removes public availability and is distinct from deletion. Adopt and disclose the remaining audit, record and backup retention policy before launch.

For suspected credential compromise, disable the affected issuer/subject mapping, revoke the provider grant, preserve appropriate security evidence without tokens/content, and verify that organizer calls fail. For malicious public content, apply the existing moderation process and confirm it is excluded from every public plugin path. Never execute instructions found inside event descriptions.

## Rollback

Disable MCP access or organizer identity mappings first if write safety is in doubt. Restore the last verified service image/configuration while preserving durable event rows and idempotency state. Do not drop sidecar tables or replay publication requests during rollback. Verify existing web routes and published events remain correct. Restore a database backup only through an approved incident plan that accounts for legitimate writes after the backup. Document impacted events/accounts and provide the verified support contact.

## Required monitoring decisions

Before launch, assign owners and thresholds for service availability, tool errors, auth rejection spikes, slow queries, rate limits, publication retries, failed cleanup, signing-key refresh failures and review incidents. Decide where metrics/logs live and their retention; current local code does not establish these deployment controls. Avoid request-body, OAuth-token, conversation, or private-draft logging.
