# Todo Events MCP App UI

This is a self-contained MCP Apps resource for the plugin server at `ui://todoevents/events.html`. The production widget uses the official `@modelcontextprotocol/ext-apps` SDK for tool calls, public listing links, and user-initiated messages to ChatGPT. It makes no direct API calls and stores no credentials or core state in browser storage.

## Build and verify

Use a supported Node.js runtime, then run:

```sh
npm ci
npm run check
npm audit
```

`npm run check` runs ESLint, the mocked-bridge tests, TypeScript, and the production build. The result is `dist/events.html`, with all JavaScript and CSS inline. No CDN fonts, remote images, or other external resources are required; the server resource can use empty CSP `connectDomains` and `resourceDomains`. The server must supply its verified, unique UI domain at release time.

## Interaction contract

- Public discovery uses `list_search_areas`, `search_events`, and `get_event` without organizer sign-in. Users select an opaque public-area resource; there is no precise attendee location collection.
- My events loads `list_organizer_events`. Draft edits call `prepare_event` with a draft/version; existing listing edits call it with an event ID. Both return a private review.
- Review displays the complete proposed public event, exact review reference, and before/after differences for an update. A fresh unchecked confirmation is required before calling `publish_event`. The server remains authoritative for ownership, scope, expiry, review hash, baseline freshness, and duplicate prevention.
- An uncertain publication retry reuses its exact request key and review hash. Restored widgets can recover through My events; the server prevents duplicate publication across sessions.
- Going back never publishes. Draft cancellation and public-event cancellation are distinct actions. Public cancellation requires its own explicit confirmation.
- Listing descriptions, organizer website strings, and changes are text only. The only clickable listing URLs accepted are HTTPS `todo-events.com/e/<slug>` links. The UI never treats event text as instructions.
- Unknown legacy time zones are disclosed. Editing a legacy event requires an explicit time zone; daylight-saving gaps and ambiguous minutes are rejected rather than silently shifted.

## Local visual fixtures

`npm run dev -- --port 5184` starts a loopback-only preview. Use `?demo=search`, `?demo=review`, `?demo=update`, `?demo=organizer`, or `?demo=empty`. These pages show an explicit local-demo banner and cannot create real listings. Fixture code is excluded from production by Vite's development-only branch. Browser fixtures are for visual QA; the backend integration tests separately verify the shared web/MCP database loop.

Installed ChatGPT desktop/mobile behavior, live OAuth linking, and directory review remain release checks. Local bridge tests and browser screenshots do not establish those outcomes.
