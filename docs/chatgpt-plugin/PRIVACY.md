# Plugin data handling and policy publication draft

This is an engineering disclosure and policy draft for publisher review. It must be reconciled with the actual deployed infrastructure and published privacy notice before submission. The repository's existing `/privacy` route is not evidence that all statements below have been adopted publicly.

## Data processed

| Data | Purpose and handling | Retention in this implementation |
| --- | --- | --- |
| Public catalog area/venue identifiers, date/category/query filters | Find matching published events; no account required | The plugin does not persist search history or the conversation. Hosting/access-log retention is an unresolved operator decision. |
| Network peer IP and recent request count | Per-process abuse throttling; ignores untrusted forwarded-IP headers | Temporary in-memory rate-limit state; not a plugin database record. Proxy/service logs are a separate operator retention decision. |
| Public event details and canonical links | Return published listings as untrusted content | Existing event records remain in the normal event database. |
| Organizer OAuth bearer token | Validate signature, issuer, resource audience, expiry and granted scopes | Used for request verification; raw tokens are not stored in plugin tables. Provider/client storage and token lifetime must be documented separately. |
| OAuth issuer, subject, local user mapping, allowed scopes and enabled state | Bind verified OAuth authority to a specific existing organizer | Stored in `plugin_oauth_identities` until disabled/removed by the approved account process. |
| Draft title, description, time, public venue ID, category, host name, event URL and price | Prepare the exact public listing for organizer review | Draft validity is 24 hours from creation; edits do not extend it. Cancellation immediately clears the draft payload. Expired payloads require the purge operation below. |
| Draft ID, owner, version, hash, status, timestamps and event reference | Prevent stale/cross-owner publication and support retry handling | Minimal tombstones remain after payload erasure. No automatic tombstone retention period is implemented. Publisher must adopt and implement a retention/deletion policy. |
| Publication record and idempotency key/request hash | Prevent duplicate publication on retries; maintain event status and timezone | Retained with the published record. No automatic time-based deletion is implemented. |
| Published event contents | Make the explicitly confirmed event publicly discoverable | Durable existing event record. Canceling publication changes public availability/status; it is not a promise of full record or backup erasure. |

The widget and tools request public catalog resources, not a person's precise location. There are no raw attendee-coordinate or personal-address fields in tool schemas. Existing public venue addresses may appear in results because they describe the event venue. Do not use a private home or personal location as a workaround. The treatment of organizer venue details under the current location rules remains a release-review consideration; the first release conservatively selects existing public venue IDs. The plugin does not ingest contact lists, full chat transcripts, card details, or account passwords. It has no plugin analytics or advertising pipeline.

## Retention controls that must actually run

Expiry is enforced when a draft is read or published even if cleanup is delayed. This blocks use after 24 hours but does **not** itself erase stored payload bytes. `PluginStore.purge_expired(now_iso)` removes expired draft payloads while retaining minimal retry/ownership tombstones. An operator must schedule and monitor it; [OPERATIONS.md](OPERATIONS.md) gives the procedure. Until a job is configured and verified, do not tell users that draft data is automatically deleted after 24 hours.

The publisher must set and publish retention periods for infrastructure access/error logs, OAuth-provider logs, tombstones/idempotency records, account mappings, event records and backups. These are release blockers. Do not claim zero retention, guaranteed deletion within a fixed period, or deployment-wide absence of tracking from this local code review. The pre-existing website may have separate analytics and payment processing; those are not added to the plugin experience.

## Access, correction, deletion and disconnect

Users can cancel an unpublished plugin draft to discard its content, or cancel a plugin-managed published event through their organizer authority. Removing the ChatGPT connection prevents use of its client grant; the OAuth provider's token revocation policy governs the grant itself. Connection removal does not automatically delete durable event records, organizer mappings, or backups.

The proposed support contact is `support@todo-events.com`, already present in the repository license. Before release, verify that the inbox is monitored and publish a process for authenticated access/correction/deletion requests. The operator must verify requester ownership, handle the main event/user records and all plugin sidecar rows together, explain legally required retention, and track backup expiry. Do not ask users to send OAuth tokens or passwords by email or chat. Do not claim the existing general website privacy request form automatically deletes plugin sidecars until that integration is tested.

## Public publication notice

Before publishing, show the exact title, description, start/end with timezone, public venue, host, category, optional URL, price/currency, and the fact that this will be a public Todo-Events listing. Authentication alone is not publication consent. A private/invitation-only or undecided plan must remain unpublished. The approval must match the current preview hash/version and organizer; changes require a new preview and renewed approval.

## Review before public adoption

- Verify the registered controller/publisher name, contact, governing policy and jurisdiction-specific obligations with the owner.
- Inventory the chosen hosting and OAuth providers, their regions, logs, subprocessors, retention and deletion mechanisms.
- Choose retention periods and implement/verify the purge schedule and account deletion runbook.
- Verify policy/support URLs without sign-in and publish this plugin-specific disclosure in the actual notice.
- Document the legitimate event-publication use, public visibility, and limits of revoking already public information.

No claim of legal compliance or platform approval is made by this engineering draft.
