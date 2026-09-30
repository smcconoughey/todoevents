export interface Venue { venue_id?: string; address?: string; city?: string; state?: string; country?: string }
export interface PublicEvent {
  id?: number; title: string; description: string; category: string; url?: string;
  starts_at?: string | null; ends_at?: string | null; timezone?: string | null;
  time_status?: string; date?: string; start_time?: string; end_time?: string; end_date?: string;
  venue?: Venue; venue_id?: string; host_name?: string; price?: number | null; price_notice?: string; currency?: string;
  event_url?: string; visibility?: string; status?: string; distance_km?: number;
}
export interface Draft {
  draft_id: string; version: number; review_hash: string; status: string; expires_at: string;
  event: PublicEvent; publication_notice?: string;
  action?: 'create' | 'update'; target_event_id?: number | null; changes?: {field: string; before: unknown; after: unknown}[];
}
export interface Area { area_id: string; label: string; city?: string; state?: string; country?: string; radius_supported?: boolean }
export interface SearchFilters { area_id?: string; query?: string; date_from?: string; date_to?: string; category?: string; radius_km?: number; limit?: number; offset?: number }
export interface ToolData extends Partial<Draft> {
  events?: PublicEvent[]; drafts?: Draft[]; venues?: Venue[]; areas?: Area[];
  filters?: SearchFilters; has_more?: boolean; next_offset?: number; message?: string;
  suggestions?: string[]; search_truncated?: boolean; error?: {code: string; message: string}; replayed?: boolean; event_id?: number;
}
export interface ToolResult { structuredContent?: unknown; isError?: boolean; _meta?: Record<string, unknown>; content?: unknown[] }
export interface Bridge {
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  openLink(url: string): Promise<void>;
  message(text: string): Promise<void>;
}
