import type { Note } from './note-schema';

export type Platform = 'instagram' | 'linkedin';
export type ContentType = 'post' | 'carousel' | 'reel' | 'video' | 'article' | 'document';

/**
 * discovered     → found on a saved page or in an export, nothing fetched yet
 * needs_capture  → text/images extracted, but a video needs tab capture (user gesture)
 * extracted      → all raw content gathered, ready for note generation
 * noted          → note written, ready for Notion
 * synced         → page exists in Notion
 * failed         → gave up after retries (see lastError)
 */
export type ItemStatus = 'discovered' | 'needs_capture' | 'extracted' | 'noted' | 'synced' | 'failed';

export interface SavedItem {
  /** `${platform}:${id}`, the dedupe key */
  key: string;
  platform: Platform;
  id: string;
  url: string;
  type?: ContentType;
  author?: string;
  /** epoch ms */
  savedAt?: number;
  source: 'scrape' | 'export';
}

/** What a content script returns after reading a post permalink. */
export interface PageExtraction {
  type: ContentType;
  author?: string;
  caption: string;
  authorComments: string[];
  hashtags: string[];
  imageUrls: string[];
  links: string[];
  hasVideo: boolean;
  postedAt?: string;
  /** innerText of the post container, used as a fallback when selectors miss */
  rawText: string;
  loggedOut?: boolean;
}

export interface ImageData {
  /** base64 without data: prefix */
  data: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  label?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface KeyFrame {
  /** seconds from video start */
  t: number;
  image: ImageData;
  transcript?: string;
  sceneChange: boolean;
}

export interface MediaAnalysis {
  duration: number;
  transcript: TranscriptSegment[];
  frames: KeyFrame[];
}

export interface LinkExtract {
  url: string;
  finalUrl: string;
  ok: boolean;
  title?: string;
  text?: string;
  truncated?: boolean;
  error?: string;
}

export interface ItemRecord extends SavedItem {
  status: ItemStatus;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: number;
  extraction?: PageExtraction;
  images?: ImageData[];
  media?: MediaAnalysis;
  links?: LinkExtract[];
  note?: Note;
  notionPageId?: string;
  notionUrl?: string;
  createdAt: number;
  updatedAt: number;
}
