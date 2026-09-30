# Submission dossier and release gates

Status: local implementation and review materials. No public deployment, credentials, reviewer account, real listing, or directory submission is authorized by this document. The `.invalid` MCP endpoint deliberately prevents accidental use of the source package as a release artifact.

## Directory metadata draft

| Field | Proposed value | Verification still required |
| --- | --- | --- |
| Display name | Todo-Events | Publisher confirms naming rights |
| Developer | Watchtower AB, Inc | Publisher identity verification |
| Description | Find events and share public happenings | Check final portal length/category constraints |
| Category | Productivity | Confirm supported live portal category |
| Website | `https://todo-events.com` | Reachability, ownership, current content |
| Support | `support@todo-events.com` | Monitored inbox and response process |
| Privacy policy | `https://todo-events.com/privacy` | Publish accurate plugin disclosure and verify public URL |
| Terms | `https://todo-events.com/terms` | Owner approval and verify public URL |
| Repository | `https://github.com/smcconoughey/todoevents` | Confirm intended distribution visibility |
| Icon | Existing `frontend/public/favicon.png`, copied unchanged | Check live portal asset rules |
| License | Todo-Events Commercial License Agreement | Existing terms preserved; no open-source grant |

Capabilities: anonymous published-event search and detail; connected organizer draft/review/publication, update and cancellation within server-enforced authority. Updating an owned existing website event preserves its canonical link and rejects a stale live baseline. Pricing may be shown as event information; no checkout, subscription purchase, or premium upsell is offered.

## Current submission requirements and evidence

The implementation team reviewed the official pages in the **Codex in-app browser on this Mac on 2026-09-30**. Recheck the live submission portal before release because it is the authoritative acceptance surface.

| Gate | Evidence prepared locally | External action still needed |
| --- | --- | --- |
| Portable package | Root manifests, URL-only MCP server, two skills, logo and license; clean ZIP script | Supply approved reachable endpoint and regenerate artifact |
| Public package restrictions | No app references or lifecycle hooks in distributable | Portal/package validation against final ZIP |
| Tool declarations | Narrow tool schemas, per-tool annotations and auth declarations | Installed-client inspection of final tool registration |
| Authentication | Anonymous reads plus OAuth-protected organizer tools | Approved provider/client, redirect registration, token audience/scopes, organizer identity provisioning |
| Review consent | Preview content/version/hash and explicit publication step | Demonstrate exact reviewed content in installed ChatGPT |
| UI | Source/build and local synthetic-fixture checks in the Mac Codex in-app browser at 390px and 1280px widths | Unique widget origin, exact CSP, installed ChatGPT desktop and mobile QA |
| Test cases | Five positive and three negative scripts in REVIEW_CASES.md | Execute in reviewer environment and attach actual results |
| Demo video | Shot list in REVIEW_CASES.md | Record functioning deployed integration; no fabricated demo |
| Reviewer access | Access requirements in REVIEW_CASES.md | Explicit approval to create dedicated account, provide portal access instructions |
| Privacy | Data inventory, retention limits and gaps in PRIVACY.md | Operator retention/deletion decisions and published accurate policy |
| Publisher/domain | Proposed metadata above | Complete identity verification and domain ownership verification |
| Release decision | Honest checklist and local test report | User approval to deploy, provision credentials, publish fixture listings and submit |

The latest guidelines state annotation justifications are no longer required; older app-review text still mentions them. Each tool still needs accurate explicit `readOnlyHint`, `destructiveHint`, and `openWorldHint` declarations. Follow the latest guidelines and the live portal; verify any remaining portal field instead of claiming the documentation discrepancy is resolved.

## Approval request to use at release time

Present the exact commit and artifact checksum; destination service/domain; OAuth provider, client, redirect and scopes; database migration/backup plan; reviewer account permissions; proposed synthetic public listings; policy URLs and retention choices; expected cost; and rollback method. Ask for approval of those concrete external actions. The ordered proposal and unresolved choices are recorded in [RELEASE_APPROVAL.md](RELEASE_APPROVAL.md). Approval to prepare local code is not approval to deploy or publish events.

## Official sources

- [Plugin build and portable layout](https://developers.openai.com/plugins/build/plugins)
- [Extensions](https://developers.openai.com/plugins/build/extensions)
- [Authentication](https://developers.openai.com/plugins/build/auth)
- [ChatGPT UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Plugin reference](https://developers.openai.com/plugins/reference)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Submission](https://developers.openai.com/plugins/deploy/submission)
- [App review](https://developers.openai.com/plugins/deploy/app-review)
- [DevDay 2026 recap](https://openai.com/index/devday-2026-recap/)

Contextually relevant discovery is the intended experience. Tool/skill quality and submission do not guarantee that ChatGPT recommends or selects this plugin in a conversation, nor do local tests establish overall compliance or directory acceptance.
