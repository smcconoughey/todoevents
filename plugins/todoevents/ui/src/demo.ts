import { TodoEventsWidget } from './widget';
import type { Draft, PublicEvent, ToolData } from './types';

// Development-only fixtures. These are never used by the production widget.
const events: PublicEvent[] = [
  { id: 1, title: 'Demo · Art after hours', description: 'An easygoing evening of local art, artist conversations, and a little creative inspiration. Drop in, take your time, and discover something new.', category: 'arts', starts_at: '2026-10-09T17:00:00-04:00', ends_at: '2026-10-09T20:00:00-04:00', timezone: 'America/New_York', venue: { address: 'Example Gallery', city: 'New York', state: 'NY' }, host_name: 'Demo Arts Collective', price: 0, currency: 'USD', url: 'https://todo-events.com/e/demo-art-after-hours' },
  { id: 2, title: 'Demo · A Saturday at the market', description: 'Meet neighborhood makers, discover seasonal finds, and spend a slower morning exploring the stalls with friends.', category: 'community', starts_at: '2026-10-10T10:00:00-04:00', ends_at: '2026-10-10T14:00:00-04:00', timezone: 'America/New_York', venue: { address: 'Example Community Square', city: 'New York', state: 'NY' }, host_name: 'Demo Neighborhood Group', price: 0, currency: 'USD', url: 'https://todo-events.com/e/demo-saturday-market' },
];
const draft: Draft = { draft_id: 'demo-draft', version: 1, review_hash: 'a'.repeat(64), status: 'draft', expires_at: '2027-01-01T00:00:00Z', event: { ...events[0], venue_id: 'event:1', visibility: 'public' }, publication_notice: 'The event details, public venue, and organizer name shown above will be visible to everyone on Todo Events after you confirm publication.' };
const updateDraft: Draft = { ...draft, draft_id: 'demo-update', action: 'update', target_event_id: 1, event: { ...draft.event, title: 'Demo · Art after hours: autumn edition' }, changes: [{ field: 'title', before: events[0].title, after: 'Demo · Art after hours: autumn edition' }, { field: 'description', before: 'An evening of local art.', after: events[0].description }], publication_notice: 'Confirming applies these reviewed changes to your existing public Todo Events listing. Its event link stays the same.' };
export async function startDemo(root: HTMLElement): Promise<void> {
  const mode = new URLSearchParams(location.search).get('demo');
  const results = { events, filters: { area_id: 'demo-area', date_from: '2026-10-09', date_to: '2026-10-11' } };
  const widget = new TodoEventsWidget(root, {
    call: async (name, args) => {
      let data: ToolData = results;
      if (name === 'list_search_areas') data = { areas: [{ area_id: 'demo-area', label: 'New York, NY', radius_supported: true }] };
      if (name === 'list_organizer_events') data = { drafts: [draft], events };
      if (name === 'get_event') data = { event: events.find(event => event.id === args.event_id) || events[0] };
      if (name === 'get_draft') data = draft;
      if (name === 'prepare_event') data = { ...(args.event_id ? updateDraft : draft), version: 2, review_hash: 'b'.repeat(64), event: { ...(args.event as PublicEvent), venue: events[0].venue } };
      if (name === 'publish_event') data = { status: 'published', draft_id: draft.draft_id, event: events[0] };
      if (name === 'cancel_draft') data = { status: 'cancelled', draft_id: draft.draft_id };
      if (name === 'cancel_event') data = { status: 'cancelled', event_id: args.event_id as number };
      return { structuredContent: data as unknown as Record<string, unknown> };
    },
    openLink: async () => { window.alert('Development demo: no external listing is opened.'); },
    message: async () => { window.alert('Development demo: this request would continue in ChatGPT.'); },
  }, () => Date.parse('2026-09-30T12:00:00Z'));
  await widget.ready();
  widget.receive({ structuredContent: (mode === 'review' ? draft : mode === 'update' ? updateDraft : mode === 'empty' ? { events: [], filters: results.filters } : mode === 'organizer' ? { events, drafts: [draft] } : results) as unknown as Record<string, unknown> });
  const demoNotice = document.createElement('p'); demoNotice.className = 'notice'; demoNotice.textContent = 'LOCAL DEMO · Sample events only. No event can be published.'; root.before(demoNotice);
}
