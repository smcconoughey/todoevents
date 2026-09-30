import type { PublicEvent, Venue } from './types';

export function canonicalUrl(value?: string): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && url.hostname === 'todo-events.com' && !url.username && !url.password && !url.port && /^\/e\/[^/]+\/?$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
export function venueLabel(venue?: Venue): string {
  return venue ? [venue.address, [venue.city, venue.state].filter(Boolean).join(', '), venue.country].filter(Boolean).join(' · ') : 'Venue details not supplied';
}
export function eventTime(event: PublicEvent): string {
  if (!event.starts_at || !event.timezone || event.time_status === 'timezone_unknown') {
    return [event.date, event.start_time, event.end_time ? `– ${event.end_time}` : '', 'Time zone not supplied — check with the organizer'].filter(Boolean).join(' ');
  }
  try {
    const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: event.timezone });
    return `${formatter.format(new Date(event.starts_at))}${event.ends_at ? ` – ${formatter.format(new Date(event.ends_at))}` : ''}`;
  } catch { return 'Schedule unavailable — check the public listing'; }
}
export function localInput(instant: string | null | undefined, timezone: string | null | undefined): string {
  if (!instant || !timezone) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const value = (type: string) => parts.find(p => p.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
  } catch { return ''; }
}
/** Reject daylight-saving gaps and folds instead of silently changing an organizer's time. */
export function toInstant(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Choose a complete start and end date and time.');
  const naive = Date.parse(`${local}:00Z`);
  const matches = new Set<string>();
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(naive + offset * 60_000).toISOString();
    if (localInput(instant, timezone) === local) matches.add(instant);
  }
  if (matches.size === 0) throw new Error('This time does not exist in that time zone. Choose another time and review it again.');
  if (matches.size > 1) throw new Error('This time occurs twice when the clocks change. Ask ChatGPT to set an explicit time-zone offset, then review the new preview.');
  const offset = Math.round((naive - Date.parse([...matches][0])) / 60_000);
  const sign = offset >= 0 ? '+' : '-';
  return `${local}:00${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
}
export function priceLabel(event: PublicEvent): string {
  if (event.price === 0) return 'Free';
  if (typeof event.price !== 'number') return 'See listing for admission';
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: event.currency || 'USD' }).format(event.price); }
  catch { return `${event.price} ${event.currency || ''}`.trim(); }
}
