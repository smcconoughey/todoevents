import { canonicalUrl, eventTime, localInput, priceLabel, toInstant, venueLabel } from './format';
import type { Area, Bridge, Draft, PublicEvent, SearchFilters, ToolData, ToolResult } from './types';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const categories = ['food-drink', 'cookout', 'music', 'arts', 'sports', 'automotive', 'airshows', 'vehicle-sports', 'community', 'religious', 'education', 'tech-education', 'veteran', 'networking', 'fair-festival', 'diving', 'shopping', 'health', 'outdoors', 'photography', 'family', 'gaming', 'real-estate', 'agriculture', 'adventure', 'seasonal', 'other'];
function categorySelect(value = '', optional = false): HTMLSelectElement {
  const select = el('select'); select.name = 'category';
  if (optional) select.append(new Option('Any category', ''));
  categories.forEach(category => select.append(new Option(category.replaceAll('-', ' '), category)));
  select.value = value; return select;
}
function button(text: string, action: () => void, kind = 'secondary'): HTMLButtonElement {
  const node = el('button', `button ${kind}`, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrap = el('label', 'field'); wrap.append(el('span', 'field-label', label), control); return wrap;
}
function input(name: string, value = '', type = 'text'): HTMLInputElement {
  const node = el('input'); node.name = name; node.type = type; node.value = value; return node;
}
type Request = { name: string; args: Record<string, unknown> };

export class TodoEventsWidget {
  private data: ToolData = {};
  private search: ToolData = {};
  private areas: Area[] = [];
  private filters: SearchFilters = {};
  private screen: 'search' | 'detail' | 'review' | 'organizer' | 'edit' | 'cancel-event' = 'search';
  private busy = false;
  private error = '';
  private notice = '';
  private authRequired = false;
  private retry?: Request;
  private serial = 0;
  private connected = false;
  private publishKeys = new Map<string, string>();
  private cancelTarget?: PublicEvent;
  private editValues?: Record<string, string>;
  private editingEventId?: number;
  private organizerData: ToolData = {};
  constructor(private root: HTMLElement, private bridge: Bridge, private now = () => Date.now()) { this.render(); }

  async ready(): Promise<void> {
    this.connected = true;
    try {
      const result = await this.bridge.call('list_search_areas', {});
      const data = result.structuredContent as ToolData | undefined;
      if (!result.isError && Array.isArray(data?.areas)) this.areas = data.areas;
    } catch { /* Existing tool results remain usable even if optional area lookup fails. */ }
    this.render();
  }
  disconnected(): void { this.error = 'The connection to ChatGPT was interrupted. Reopen this view or try the action again.'; this.busy = false; this.render(); }
  cancelled(): void {
    ++this.serial; this.busy = false; this.error = 'The action was interrupted. For a publication attempt, use Retry to check the same request safely.'; this.render();
  }
  receive(result: ToolResult): void {
    ++this.serial; this.busy = false;
    const data = result.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent as ToolData : undefined;
    if (result.isError || data?.error) {
      this.error = data?.error?.message || 'The action could not be completed. Please try again.';
      this.authRequired = Boolean(result._meta?.['mcp/www_authenticate']) || ['unauthorized', 'invalid_token', 'authentication_required', 'insufficient_scope'].includes(data?.error?.code || '');
      this.render(); return;
    }
    if (!data) { this.error = 'No event data was returned. Use the conversation to retry your request.'; this.render(); return; }
    this.error = ''; this.authRequired = false; this.notice = ''; this.retry = undefined;
    if (data.areas) { this.areas = data.areas; this.render(); return; }
    if (!data.venues) { this.editValues = undefined; this.editingEventId = undefined; }
    if (data.status === 'cancelled') {
      this.notice = data.event_id || data.event ? 'The event has been cancelled and removed from public discovery.' : 'Draft cancelled. No public listing was created.';
      this.screen = 'search'; this.data = this.search; this.cancelTarget = undefined;
    } else if (data.status === 'published' && data.event) {
      this.notice = data.replayed ? 'Your earlier request succeeded. This is the same listing.' : data.action === 'update' || this.data.action === 'update' ? 'Your public event has been updated. Its listing link stays the same.' : 'Your event is now publicly listed on Todo Events.';
      this.data = data; this.screen = 'detail';
    } else if (data.status === 'unpublished' && data.event) {
      this.notice = 'This event is currently unpublished and unavailable in public discovery.';
      this.data = data; this.screen = 'detail';
    } else if (data.draft_id && data.event && data.review_hash) {
      this.data = data; this.screen = 'review';
    } else if (data.drafts) { this.data = data; this.organizerData = data; this.screen = 'organizer'; }
    else if (data.events) {
      this.data = data; this.search = data; this.filters = data.filters || this.filters; this.screen = 'search';
    } else if (data.event) { this.data = data; this.screen = 'detail'; }
    else if (data.venues) { this.notice = data.message || 'Choose a venue in the conversation to update your draft.'; }
    else { this.data = data; }
    this.render();
  }
  private async run(name: string, args: Record<string, unknown>): Promise<void> {
    if (this.busy) return;
    const request = { name, args }; this.retry = request; this.busy = true; this.error = ''; this.authRequired = false; this.notice = '';
    const sequence = ++this.serial; this.render();
    try {
      const result = await this.bridge.call(name, args);
      if (sequence !== this.serial) return;
      this.receive(result);
      if (result.isError || (result.structuredContent as ToolData | undefined)?.error) this.retry = request;
    } catch {
      if (sequence !== this.serial) return;
      this.busy = false; this.error = name === 'publish_event' ? 'The publication response was interrupted. Retry checks this same request without creating another listing.' : 'The connection was interrupted. Your action can be retried.';
      this.render();
    }
  }
  private async ask(text: string): Promise<void> {
    try { await this.bridge.message(text); }
    catch { this.error = 'ChatGPT could not receive the request. Type your request in the conversation to continue.'; this.render(); }
  }
  private back(): void { this.screen = 'search'; this.data = this.search; this.error = ''; this.notice = ''; this.render(); }
  private render(): void {
    this.root.replaceChildren();
    const shell = el('main', 'shell'); shell.setAttribute('aria-busy', String(this.busy));
    const header = el('header', 'header');
    const brand = el('div', 'brand'); brand.append(el('span', 'brand-mark', 'te'), el('span', '', 'Todo Events'));
    const nav = el('nav', 'nav'); nav.setAttribute('aria-label', 'Event views');
    nav.append(button('Discover', () => this.back(), this.screen === 'search' ? 'nav-button active' : 'nav-button'), button('My events', () => void this.run('list_organizer_events', {}), this.screen === 'organizer' ? 'nav-button active' : 'nav-button'));
    header.append(brand, nav); shell.append(header);
    const live = el('div', 'live'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    if (this.busy) live.append(el('p', 'notice loading', 'Working on your request…'));
    if (this.notice) live.append(el('p', 'notice', this.notice));
    if (this.error) {
      const alert = el('div', 'error'); alert.setAttribute('role', 'alert'); alert.append(el('p', '', this.error));
      if (this.authRequired) alert.append(el('p', 'muted', 'Use ChatGPT’s secure account connection to continue. Never enter a password in this conversation.'));
      if (this.retry) alert.append(button(this.authRequired ? 'Connect account and retry' : 'Retry', () => { const r = this.retry!; void this.run(r.name, r.args); }));
      else if (this.authRequired) alert.append(button('Connect organizer account', () => void this.run('list_organizer_events', {})));
      live.append(alert);
    }
    shell.append(live);
    if (this.screen === 'review') this.renderReview(shell);
    else if (this.screen === 'edit') this.renderEdit(shell);
    else if (this.screen === 'detail') this.renderDetail(shell);
    else if (this.screen === 'organizer') this.renderOrganizer(shell);
    else if (this.screen === 'cancel-event') this.renderCancellation(shell);
    else this.renderSearch(shell);
    const footer = el('footer', 'footer', 'Public events. Real plans.');
    footer.append(el('span', '', 'Confirm details with the organizer before you go.')); shell.append(footer);
    if (this.busy) shell.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea').forEach(node => node.disabled = true);
    this.root.append(shell);
  }
  private heading(parent: HTMLElement, eyebrow: string, title: string, subtitle: string): void {
    const intro = el('div', 'intro'); intro.append(el('p', 'eyebrow', eyebrow), el('h1', '', title), el('p', 'subtitle', subtitle)); parent.append(intro);
  }
  private renderSearch(parent: HTMLElement): void {
    this.heading(parent, 'GO FROM MAYBE TO THERE', 'Find your next good plan.', 'Discover published events by destination, date, and what you love.');
    const form = el('form', 'search-form');
    const query = input('query', this.filters.query); query.placeholder = 'Music, art, a weekend market…'; query.maxLength = 160;
    const area = el('select'); area.name = 'area_id'; area.append(new Option('Choose a destination', ''));
    this.areas.forEach(a => area.append(new Option(a.label, a.area_id)));
    if (this.filters.area_id && !this.areas.some(a => a.area_id === this.filters.area_id)) area.append(new Option(this.filters.area_id, this.filters.area_id));
    area.value = this.filters.area_id || '';
    const from = input('date_from', this.filters.date_from, 'date'); const to = input('date_to', this.filters.date_to, 'date');
    const category = categorySelect(this.filters.category, true);
    const radius = el('select'); radius.name = 'radius_km'; [[ '', 'Destination only'], ['5', 'Within 5 km'], ['10', 'Within 10 km'], ['25', 'Within 25 km'], ['50', 'Within 50 km'], ['100', 'Within 100 km']].forEach(([value, label]) => radius.append(new Option(label, value)));
    const selectedRadius = String(this.filters.radius_km || '');
    if (selectedRadius && ![...radius.options].some(option => option.value === selectedRadius)) radius.append(new Option(`Within ${selectedRadius} km`, selectedRadius));
    radius.value = selectedRadius;
    const supported = () => { radius.disabled = !this.areas.find(a => a.area_id === area.value)?.radius_supported; if (radius.disabled) radius.value = ''; };
    supported(); area.addEventListener('change', supported);
    const primary = el('div', 'search-primary'); primary.append(field('What sounds good?', query), field('Destination', area));
    const secondary = el('div', 'search-secondary'); secondary.append(field('From', from), field('Through', to), field('Category', category), field('Distance from destination center', radius));
    const submit = button('Find events', () => {} , 'primary'); submit.type = 'submit';
    const searchActions = el('div', 'search-actions'); searchActions.append(el('p', 'helper', 'Choose a public destination. We do not collect your precise location.'), submit);
    form.append(primary, secondary, searchActions);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (from.value && to.value && from.value > to.value) { this.error = 'Choose an end date on or after the start date.'; this.render(); return; }
      const filters: SearchFilters = { limit: 12, offset: 0 };
      if (query.value.trim()) filters.query = query.value.trim(); if (area.value) filters.area_id = area.value;
      if (from.value) filters.date_from = from.value; if (to.value) filters.date_to = to.value;
      if (category.value.trim()) filters.category = category.value.trim(); if (radius.value && !radius.disabled) filters.radius_km = Number(radius.value);
      this.filters = filters; void this.run('search_events', { ...filters });
    }); parent.append(form);
    const results = this.search.events;
    if (results) {
      const summary = el('div', 'results-heading'); summary.append(el('h2', '', results.length ? `${results.length} ${results.length === 1 ? 'event' : 'events'} to explore` : 'No matching events yet'));
      summary.append(el('span', 'muted', this.filterSummary())); parent.append(summary);
      if (this.search.search_truncated) parent.append(el('p', 'notice', 'This search reached its result limit. Refine your destination, dates, or topic to search a more complete set of matching events.'));
      if (!results.length) {
        const empty = el('section', 'empty-state'); empty.append(el('div', 'empty-icon', '↗'), el('h3', '', 'A little flexibility can open things up.'), el('p', 'muted', this.search.message || 'There are no published events matching these filters.'));
        const actions = el('div', 'actions');
        actions.append(button('Remove date filters', () => { const {date_from: _from, date_to: _to, ...next} = this.filters; this.filters = { ...next, offset: 0 }; void this.run('search_events', { ...this.filters }); }), button('Try a different destination', () => area.focus()));
        empty.append(actions); parent.append(empty);
      } else { const grid = el('div', 'event-grid'); results.forEach(event => grid.append(this.eventCard(event))); parent.append(grid); }
      if (this.search.has_more && this.search.next_offset !== undefined) parent.append(button('Next events', () => void this.run('search_events', { ...this.filters, offset: this.search.next_offset }), 'load-more'));
    } else if (!this.busy) {
      const empty = el('section', 'empty-state initial'); empty.append(el('div', 'empty-icon', '✦'), el('h2', '', 'Your plans start here.'), el('p', 'muted', this.connected ? 'Choose a destination or search an interest to see current published events.' : 'Connecting to ChatGPT. Your event results will appear here.')); parent.append(empty);
    }
    const plan = el('aside', 'organizer-invitation'); plan.append(el('div', '', 'Bringing people together?'), button('Plan a public event', () => void this.ask('Help me prepare a public Todo Events listing. Ask for missing public event details and show me a reviewable preview before any publication.'), 'text-button')); parent.append(plan);
  }
  private filterSummary(): string {
    const area = this.areas.find(a => a.area_id === this.filters.area_id)?.label || (this.filters.area_id ? 'Selected destination' : 'All destinations');
    return [area, this.filters.date_from ? `from ${this.filters.date_from}` : '', this.filters.date_to ? `through ${this.filters.date_to}` : '', this.filters.radius_km ? `within ${this.filters.radius_km} km` : '', this.filters.query ? `“${this.filters.query}”` : ''].filter(Boolean).join(' · ');
  }
  private eventCard(event: PublicEvent, organizer = false): HTMLElement {
    const isPublic = !event.status || event.status === 'published';
    const ended = Boolean(event.ends_at && Date.parse(event.ends_at) <= this.now());
    const card = el('article', 'event-card');
    const meta = el('div', 'card-meta'); meta.append(el('span', 'badge', event.category || 'Event'), el('span', 'price', priceLabel(event))); card.append(meta);
    card.append(el('h3', '', event.title), el('p', 'event-date', eventTime(event)), el('p', 'location', venueLabel(event.venue)));
    if (event.description) card.append(el('p', 'card-description', event.description));
    const actions = el('div', 'card-actions');
    if (event.id !== undefined && isPublic && !ended) actions.append(button('Details', () => void this.run('get_event', { event_id: event.id }), 'text-button'));
    const url = canonicalUrl(event.url); if (url && isPublic) actions.append(this.link(url, 'Open listing ↗'));
    if (organizer && isPublic && !ended) actions.append(button('Edit event', () => { this.editValues = undefined; this.editingEventId = event.id; this.data = { event }; this.screen = 'edit'; this.render(); }, 'text-button'));
    if (organizer && isPublic && !ended) actions.append(button('Cancel event', () => { this.cancelTarget = event; this.screen = 'cancel-event'; this.render(); }, 'text-button danger-text'));
    if (event.status === 'cancelled') card.append(el('p', 'badge', 'Cancelled'));
    else if (!isPublic) card.append(el('p', 'badge', 'Unpublished'));
    else if (ended) card.append(el('p', 'badge', 'Ended'));
    card.append(actions); return card;
  }
  private link(url: string, label: string): HTMLAnchorElement {
    const link = el('a', 'listing-link', label); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.addEventListener('click', event => { event.preventDefault(); void this.bridge.openLink(url).catch(() => { this.error = 'The listing could not be opened. Use its canonical link in the conversation.'; this.render(); }); }); return link;
  }
  private renderDetail(parent: HTMLElement): void {
    const event = this.data.event; if (!event) return;
    const isPublic = (!this.data.status || this.data.status === 'published') && (!event.status || event.status === 'published');
    parent.append(button('← Back to discovery', () => this.back(), 'text-button'));
    this.heading(parent, isPublic ? event.category || 'PUBLIC EVENT' : 'UNPUBLISHED EVENT', event.title, eventTime(event));
    const panel = el('section', 'detail-panel'); panel.append(el('p', 'location', venueLabel(event.venue)), el('p', 'full-description', event.description));
    this.facts(panel, event);
    const url = canonicalUrl(event.url); if (url && isPublic) panel.append(this.link(url, 'View the public Todo Events listing ↗'));
    parent.append(panel);
  }
  private facts(parent: HTMLElement, event: PublicEvent): void {
    const list = el('dl', 'facts');
    [['Organizer', event.host_name || 'See listing'], ['Admission', priceLabel(event)], ['Time zone', event.timezone || 'Not supplied']].forEach(([label, value]) => { const row = el('div'); row.append(el('dt', '', label), el('dd', '', value)); list.append(row); }); parent.append(list);
  }
  private renderReview(parent: HTMLElement): void {
    const draft = this.data as Draft;
    const updating = draft.action === 'update';
    this.heading(parent, 'ORGANIZER · PREVIEW', updating ? 'Review your public update.' : 'Ready for the public?', updating ? 'Review the complete updated listing and the changes below. Your current listing stays public until you confirm.' : 'Review every detail. Only the confirmation below publishes this listing.');
    const panel = el('section', 'review-panel'); panel.append(el('span', 'badge draft', `Private preview · version ${draft.version}`), el('h2', '', draft.event.title), el('p', 'event-date', eventTime(draft.event)), el('p', 'location', venueLabel(draft.event.venue)), el('p', 'full-description', draft.event.description));
    this.facts(panel, draft.event);
    if (draft.event.event_url) panel.append(el('p', 'muted', `Organizer website: ${draft.event.event_url}`));
    panel.append(el('p', 'muted', `Category: ${draft.event.category}`));
    const fingerprint = el('details', 'review-reference'); fingerprint.append(el('summary', '', 'Review reference'), el('p', 'reference', `Draft ${draft.draft_id} · version ${draft.version}\nContent fingerprint: ${draft.review_hash}`)); panel.append(fingerprint);
    parent.append(panel);
    if (updating) {
      const changePanel = el('section', 'changes-panel'); changePanel.append(el('h2', '', 'What will change'));
      (draft.changes || []).forEach(change => {
        const row = el('div', 'change-row'); row.append(el('h3', '', change.field.replaceAll('_', ' ')));
        const values = el('div', 'change-values');
        const display = (value: unknown) => value === null || value === undefined || value === '' ? 'Not supplied' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        const before = el('div'); before.append(el('span', 'field-label', 'Currently public'), el('p', '', display(change.before)));
        const after = el('div'); after.append(el('span', 'field-label', 'After confirmation'), el('p', '', display(change.after)));
        values.append(before, after); row.append(values); changePanel.append(row);
      });
      if (!draft.changes?.length) changePanel.append(el('p', 'muted', 'The server returned no field differences. Review the complete listing above.'));
      parent.append(changePanel);
    }
    const publicNotice = el('section', 'publication-notice'); publicNotice.append(el('h3', '', updating ? 'This updates your existing public listing' : 'This creates a public listing'), el('p', '', draft.publication_notice || (updating ? 'The reviewed changes will replace the details on your existing public Todo Events listing. The canonical event link stays the same.' : 'The title, description, schedule, venue, and organizer information above will be publicly visible on Todo Events. Only submit details intended for everyone.')));
    const expired = !Number.isFinite(Date.parse(draft.expires_at)) || Date.parse(draft.expires_at) <= this.now();
    if (expired || draft.status !== 'draft') publicNotice.append(el('p', 'error', 'This preview is no longer ready for publication. Refresh it and review again.'));
    else publicNotice.append(el('p', 'helper', `Review expires ${new Date(draft.expires_at).toLocaleString()}.`));
    const consent = input('public-confirmation', '', 'checkbox'); consent.id = 'public-confirmation';
    const check = el('label', 'consent'); check.append(consent, el('span', '', 'I have authority to publish this event, and I confirm these exact details are intended for the public.'));
    const publish = button(updating ? 'Confirm public update' : 'Publish public event', () => {
      if (!consent.checked || expired || draft.status !== 'draft') return;
      const reference = `${draft.draft_id}:${draft.review_hash}`;
      let key = this.publishKeys.get(reference); if (!key) { key = crypto.randomUUID(); this.publishKeys.set(reference, key); }
      void this.run('publish_event', { draft_id: draft.draft_id, review_hash: draft.review_hash, confirmed: true, idempotency_key: key });
    }, 'primary'); publish.disabled = true;
    consent.addEventListener('change', () => { publish.disabled = !consent.checked || expired || draft.status !== 'draft'; });
    const actions = el('div', 'actions'); actions.append(publish, button('Edit details', () => { this.editValues = undefined; this.screen = 'edit'; this.render(); }), button('Refresh preview', () => void this.run('get_draft', { draft_id: draft.draft_id })), button('Cancel draft', () => void this.run('cancel_draft', { draft_id: draft.draft_id }), 'text-button danger-text'));
    publicNotice.append(check, actions); parent.append(publicNotice);
    parent.append(button(updating ? '← Back without updating' : '← Back without publishing', () => { this.back(); this.notice = updating ? 'Your changes remain private. The public event was not updated.' : 'Your preview remains private. No publication was requested.'; this.render(); }, 'text-button'));
  }
  private renderEdit(parent: HTMLElement): void {
    const draft = this.data as Draft; const event = draft.event;
    this.heading(parent, 'ORGANIZER · EDIT', 'Make it yours.', this.editingEventId ? 'Save a preview of your changes. Your existing public event only changes after you review and confirm.' : 'Saving creates a new preview that you must review before publication.');
    const form = el('form', 'edit-form'); const title = input('title', event.title); title.required = true; title.maxLength = 160;
    const description = el('textarea'); description.name = 'description'; description.value = event.description; description.required = true; description.rows = 5; description.maxLength = 10000;
    const category = categorySelect(event.category); category.required = true;
    const host = input('host_name', event.host_name); host.required = true; host.maxLength = 160;
    const timezone = input('timezone', event.timezone || ''); timezone.required = true;
    const legacyLocal = (date?: string, time?: string) => date && time ? `${date}T${time.slice(0, 5)}` : '';
    const start = input('starts_at', localInput(event.starts_at, event.timezone) || legacyLocal(event.date, event.start_time), 'datetime-local'); start.required = true;
    const end = input('ends_at', localInput(event.ends_at, event.timezone) || legacyLocal(event.end_date || event.date, event.end_time), 'datetime-local'); end.required = true;
    const website = input('event_url', event.event_url, 'url');
    const price = input('price', event.price === null || event.price === undefined ? '0' : String(event.price), 'number'); price.min = '0'; price.max = '100000'; price.step = '0.01'; price.required = true;
    const currency = input('currency', event.currency || 'USD'); currency.maxLength = 3;
    const pair = el('div', 'edit-grid'); pair.append(field('Category', category), field('Public organizer name', host), field('Start', start), field('End', end), field('Event time zone (e.g. America/New_York)', timezone), field('Organizer website (optional)', website), field('Admission price (0 = free)', price), field('Currency', currency));
    const venue = el('div', 'venue-fixed'); venue.append(el('strong', '', 'Public venue'), el('p', '', venueLabel(event.venue)), button('Choose another venue in ChatGPT', () => void this.ask(`Help me change the public venue for Todo Events ${this.editingEventId ? `published event ${this.editingEventId}` : `draft ${draft.draft_id}, version ${draft.version}`}. Use an existing public venue resource and prepare a new preview. Do not publish.`), 'text-button'));
    const save = button('Save new preview', () => {}, 'primary'); save.type = 'submit';
    const actions = el('div', 'actions'); actions.append(save, button(this.editingEventId ? 'Back without changes' : 'Back to current preview', () => { if (this.editingEventId) { this.screen = 'organizer'; this.data = this.organizerData; this.editingEventId = undefined; } else this.screen = 'review'; this.render(); }));
    form.append(field('Event title', title), field('Public description', description), pair, venue, actions);
    if (this.editValues) form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]').forEach(control => { if (this.editValues?.[control.name] !== undefined) control.value = this.editValues[control.name]; });
    const preserveEdits = () => { this.editValues = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value)])); };
    form.addEventListener('input', preserveEdits); form.addEventListener('change', preserveEdits);
    form.addEventListener('submit', submit => {
      submit.preventDefault();
      preserveEdits();
      try {
        const starts_at = toInstant(start.value, timezone.value); const ends_at = toInstant(end.value, timezone.value);
        if (Date.parse(ends_at) <= Date.parse(starts_at)) throw new Error('The event must end after it starts.');
        const updated = { title: title.value.trim(), description: description.value.trim(), category: category.value.trim(), host_name: host.value.trim(), starts_at, ends_at, timezone: timezone.value.trim(), venue_id: event.venue_id || event.venue?.venue_id, visibility: 'public', ...(website.value.trim() ? { event_url: website.value.trim() } : {}), ...(price.value ? { price: Number(price.value) } : {}), currency: currency.value.toUpperCase() };
        void this.run('prepare_event', { event: updated, ...(this.editingEventId ? { event_id: this.editingEventId } : { draft_id: draft.draft_id, expected_version: draft.version }) });
      } catch (error) { this.error = error instanceof Error ? error.message : 'Check your dates and time zone.'; this.render(); }
    }); parent.append(form);
  }
  private renderOrganizer(parent: HTMLElement): void {
    this.heading(parent, 'YOUR ORGANIZER SPACE', 'From idea to out there.', 'Review private drafts and manage your published events.');
    const drafts = this.data.drafts || []; const events = this.data.events || [];
    parent.append(el('h2', 'section-title', `Private drafts · ${drafts.length}`));
    drafts.forEach(draft => { const row = el('article', 'draft-row'); const text = el('div'); text.append(el('h3', '', draft.event.title), el('p', 'muted', `Version ${draft.version} · ${draft.status}`)); row.append(text, button('Review draft', () => void this.run('get_draft', { draft_id: draft.draft_id }))); parent.append(row); });
    if (!drafts.length) parent.append(el('p', 'muted', 'No private drafts waiting for review.'));
    parent.append(el('h2', 'section-title', `Events · ${events.length}`));
    const grid = el('div', 'event-grid'); events.forEach(event => grid.append(this.eventCard(event, true))); parent.append(grid);
    if (!events.length) parent.append(el('p', 'muted', 'Your published events will appear here.'));
    parent.append(button('Prepare a public event', () => void this.ask('Help me prepare a public Todo Events listing. Show me a reviewable draft before publishing anything.'), 'primary'));
  }
  private renderCancellation(parent: HTMLElement): void {
    const event = this.cancelTarget; if (!event) return;
    this.heading(parent, 'ORGANIZER · CANCEL EVENT', `Cancel “${event.title}”?`, 'This removes the event from public discovery. Make sure people expecting to attend hear from you too.');
    const consent = input('cancel-confirmation', '', 'checkbox'); const label = el('label', 'consent'); label.append(consent, el('span', '', 'I confirm this public event is cancelled.'));
    const confirm = button('Confirm cancellation', () => { if (consent.checked) void this.run('cancel_event', { event_id: event.id, confirmed: true }); }, 'danger'); confirm.disabled = true;
    consent.addEventListener('change', () => confirm.disabled = !consent.checked);
    const actions = el('div', 'actions'); actions.append(confirm, button('Keep event', () => { this.screen = 'organizer'; this.cancelTarget = undefined; this.render(); })); parent.append(label, actions);
  }
}
