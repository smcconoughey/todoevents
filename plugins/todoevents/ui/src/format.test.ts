import { describe, expect, it } from 'vitest';
import { canonicalUrl, eventTime, localInput, priceLabel, toInstant, venueLabel } from './format';
import type { PublicEvent } from './types';

const event: PublicEvent = { title: 'Art', description: 'Public art', category: 'arts' };
describe('safe canonical links', () => {
  it('accepts only HTTPS Todo Events canonical paths', () => expect(canonicalUrl('https://todo-events.com/e/art-night')).toBe('https://todo-events.com/e/art-night'));
  it.each(['javascript:alert(1)', 'https://todo-events.com.evil.com/e/test', 'http://todo-events.com/e/test', 'https://user:password@todo-events.com/e/test', 'https://evil.com/e/test', 'https://todo-events.com/admin', 'https://todo-events.com:444/e/test', '//todo-events.com/e/test'])('rejects %s', url => expect(canonicalUrl(url)).toBeNull());
});
describe('event-local times', () => {
  it('renders confirmed time in the supplied event zone', () => {
    expect(eventTime({ ...event, starts_at: '2026-10-10T20:00:00Z', ends_at: '2026-10-10T22:00:00Z', timezone: 'America/New_York' })).toContain('4:00 PM');
  });
  it('never guesses the zone of legacy events', () => expect(eventTime({ ...event, date: '2026-10-10', start_time: '18:00', time_status: 'timezone_unknown' })).toContain('Time zone not supplied'));
  it('round-trips ordinary zoned minutes with matching local offset', () => {
    expect(toInstant('2026-10-10T16:30', 'America/New_York')).toBe('2026-10-10T16:30:00-04:00');
    expect(localInput('2026-10-10T20:30:00Z', 'America/New_York')).toBe('2026-10-10T16:30');
  });
  it('handles non-hour time zone offsets', () => expect(toInstant('2026-10-10T16:30', 'Asia/Kathmandu')).toBe('2026-10-10T16:30:00+05:45'));
  it('handles a date boundary in an event zone', () => expect(localInput('2026-10-10T01:00:00Z', 'America/Los_Angeles')).toBe('2026-10-09T18:00'));
  it('rejects a nonexistent spring-forward minute', () => expect(() => toInstant('2027-03-14T02:30', 'America/New_York')).toThrow('does not exist'));
  it('rejects an ambiguous fall-back minute', () => expect(() => toInstant('2026-11-01T01:30', 'America/New_York')).toThrow('occurs twice'));
  it('rejects invalid input and invalid zones', () => {
    expect(() => toInstant('not a date', 'UTC')).toThrow();
    expect(() => toInstant('2026-10-10T10:00', 'Unknown/Nowhere')).toThrow();
  });
});
it('does not invent venue or ticket information', () => {
  expect(venueLabel()).toContain('not supplied');
  expect(priceLabel(event)).toBe('See listing for admission');
  expect(priceLabel({ ...event, price: 0 })).toBe('Free');
});
