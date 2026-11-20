import type { ItemRecord } from '../types';

export interface PageRef {
  pageId: string;
  url?: string;
}

export interface SetupResult {
  parentPageId: string;
  databaseId: string;
  digestsPageId: string;
}

/** A database row that already holds a note, found by its Source URL. */
export interface ExistingNote extends PageRef {
  sourceUrl: string;
}

/** Most rows checked per lookup call. */
export const LOOKUP_BATCH = 100;

/**
 * Text that identifies a post inside any Source URL we write: the Instagram shortcode, the
 * LinkedIn activity urn, or `/pulse/<slug>` for LinkedIn articles.
 */
export const sourceNeedle = (item: Pick<ItemRecord, 'id'>) =>
  item.id.startsWith('pulse:') ? `/pulse/${item.id.slice('pulse:'.length)}` : item.id;

/** Notion page URL from its id, for rows found without one. */
export const pageUrl = (pageId: string) => `https://www.notion.so/${pageId.replace(/-/g, '')}`;

/**
 * Page id from whatever the user pastes: a bare id (with or without dashes) or a Notion page
 * URL, where the id is the last 32 hex characters of the path.
 */
export function parsePageId(input: string): string | null {
  const path = input.trim().split(/[?#]/)[0];
  const m = path.replace(/-/g, '').match(/([0-9a-f]{32})$/i);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Where notes go. */
export interface NotionSink {
  /** Reuses an existing notes database if there is one, otherwise creates it. */
  setup(): Promise<SetupResult>;
  /** Rows whose Source URL contains one of the needles (at most LOOKUP_BATCH per call). */
  findExisting(needles: string[]): Promise<ExistingNote[]>;
  upsertNote(item: ItemRecord): Promise<PageRef>;
  writeDigest(topic: string, markdown: string, existingPageId?: string): Promise<PageRef>;
}
