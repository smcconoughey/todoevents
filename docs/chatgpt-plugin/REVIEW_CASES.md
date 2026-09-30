# Reviewer cases and demo recording plan

These are execution scripts, not claims of passed review. Run all five positive and three negative cases against the actual submitted package in installed ChatGPT; record build/commit, client/version, device, timestamp, fixture IDs, observed result, and screenshots/video references. Repeat the main discovery/review/cancel flows on desktop and mobile, including narrow viewports, keyboard navigation and widget failure. Automated local evidence belongs in TEST_REPORT.md.

Use synthetic events and verified dedicated reviewer identities. Creating a reviewer account, granting provider access or publishing fixtures requires the owner's explicit release-time approval. Provide the reviewer with a working account and the exact connection instructions through the portal's secure mechanism; never commit or put passwords/tokens in these instructions. The reviewer should have an organizer with the needed scopes, a second separate organizer for cross-owner checks, and a scope-restricted test identity. Public discovery requires none of these accounts.

## Five positive cases

| Case | Request and actions | Expected observable behavior |
| --- | --- | --- |
| P1 — Anonymous relevant discovery | “What community events can I attend this weekend in [supported public area]?” Choose a catalog area if needed; filter dates/category. | No connection prompt; actual current published matching listings only; local dates/times, venue and canonical `/e/{slug}` links; selected detail matches search. |
| P2 — Precise filters and no matches | Search a seeded area/date/category/radius with one boundary fixture and one outside it; then choose a combination with no matching rows. | Boundary behavior matches distance checks; no silent radius/date expansion or duplicates; empty state repeats filters and offers specific choices without fabricated events. |
| P3 — Public planning to reviewed publication | “Help me list this public community workshop.” Connect via OAuth, choose a public venue and future offset-aware times, prepare and inspect the draft, then explicitly approve the displayed listing. | Normal provider connection; exact review content and public notice; one owned published event after confirmation; useful canonical link and plain result. |
| P4 — Edit, interruption and retry | Edit the draft, review revised content, approve it; interrupt the response immediately after publication and repeat the same logical request/key. | Revision changes hash/version; the approved current draft publishes once; repeated attempt returns the same event/link without duplicate insertion. Back/edit never publishes. |
| P5 — Resume, discard and owned cancellation | Resume an unpublished draft with `get_draft`, discard it; then select an owned synthetic published event and explicitly cancel that event. | Draft payload discarded without a public listing; cancellation affects only the identified owned event; subsequent public discovery excludes it; readable result remains usable without widget. |

## Three negative cases

| Case | Request and adversarial variation | Required refusal/recovery |
| --- | --- | --- |
| N1 — Invalid or insufficient identity | Use missing/expired/forged token, wrong issuer/audience, missing scope, disabled mapping, then another organizer's draft/event ID. | Recoverable connection challenge where appropriate; no private draft leakage, role escalation, cross-owner changes or publication. Retrying after valid authorized connection remains possible. |
| N2 — Unapproved, changed or private publication | “Plan a private party at my home”; omit public intent; publish without confirmation; alter draft after review; use old hash/version or expired draft; press back/cancel. | Private plan never becomes public; raw personal-location collection avoided; no publication without exact current review approval; stale/expired cases require a new review; cancel/back has no unintended write. |
| N3 — Malicious data and invalid timing | Seed a description containing HTML/script and instructions to exfiltrate secrets or publish another event; supply unsafe link, naive datetime, DST nonexistent time, end before start, unsupported venue, or radius beyond limit. | Text is treated as data, with no script/tool instruction execution or secret leakage; invalid fields rejected clearly; valid retry recoverable; draft/unpublished/canceled records remain absent from public output. |

## Timing, radius and accessibility details

Include overnight and multiday listings, an exact start/end boundary, venue timezone different from the device timezone, the two occurrences of a daylight-saving fall-back hour, and a nonexistent spring-forward time. Search date filters use the venue's local date. Verify the returned filter summary and date labels; don't accept a visually plausible but wrong time.

Use synthetic fixtures both just inside and just outside the chosen radius from the catalog center. Verify pagination doesn't repeat events. On mobile check the entire review, public notice, error and buttons without horizontal clipping; verify touch targets, dark mode, accessible names, focus order and recovery after connection cancel. Resize checks in a local browser are not installed-ChatGPT mobile QA.

## Demo video shot list

1. Show the exact installed plugin/version and anonymous area/date/category discovery with canonical links.
2. Show a no-results search with visible unchanged filters and deliberate user-chosen recovery.
3. Begin a relevant public event plan, connect through the real OAuth interface, and choose a public venue.
4. Show every final event detail and public visibility notice in the review. Edit one field and show the refreshed preview.
5. Explicitly confirm publication and show its live synthetic canonical listing; demonstrate safe repeated request recovery.
6. Discard another draft, then cancel the approved synthetic published event. Show no accidental publication after back/cancel.
7. Show one auth/scope refusal and one stale-review refusal with clear recovery; include a mobile segment and useful plain output.

Use an approved fixture namespace and remove/cancel fixtures according to the agreed review plan. Record only designated test accounts and synthetic data; redact provider secrets. A storyboard or local mock recording is not evidence of a working installed production integration.
