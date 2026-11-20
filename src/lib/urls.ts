import type { ContentType, SavedItem } from './types';

const IG_POST = /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;
const LI_UPDATE = /linkedin\.com\/feed\/update\/(urn:li:(?:activity|ugcPost|share):\d+)/;
const LI_POSTS = /linkedin\.com\/posts\/[^\s"'<>?#]*?-(activity|ugcPost|share)-(\d+)/;
const LI_PULSE = /linkedin\.com\/pulse\/([^\s"'<>?#/]+)/;

/** Normalizes any Instagram/LinkedIn post URL into a SavedItem, or null if it isn't one. */
export function parsePostUrl(url: string, source: SavedItem['source']): SavedItem | null {
  const ig = url.match(IG_POST);
  if (ig) {
    const kind = ig[1];
    const id = ig[2];
    const type: ContentType | undefined = kind === 'p' ? undefined : 'reel';
    const path = kind === 'p' ? 'p' : 'reel';
    return { key: `instagram:${id}`, platform: 'instagram', id, url: `https://www.instagram.com/${path}/${id}/`, type, source };
  }
  const update = url.match(LI_UPDATE);
  if (update) return linkedinItem(update[1], source);
  const posts = url.match(LI_POSTS);
  if (posts) return linkedinItem(`urn:li:${posts[1]}:${posts[2]}`, source);
  const pulse = url.match(LI_PULSE);
  if (pulse) {
    const id = `pulse:${pulse[1]}`;
    return {
      key: `linkedin:${id}`,
      platform: 'linkedin',
      id,
      url: `https://www.linkedin.com/pulse/${pulse[1]}/`,
      type: 'article',
      source,
    };
  }
  return null;
}

function linkedinItem(urn: string, source: SavedItem['source']): SavedItem {
  return { key: `linkedin:${urn}`, platform: 'linkedin', id: urn, url: `https://www.linkedin.com/feed/update/${urn}/`, source };
}

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;

/** Pulls http(s) URLs out of free text, trimming trailing punctuation. */
export function extractUrls(text: string): string[] {
  const found = text.match(URL_RE) ?? [];
  return [...new Set(found.map((u) => u.replace(/[.,;:!?…]+$/, '')))];
}

/** Instagram wraps outbound links as l.instagram.com/?u=<encoded>. */
export function unwrapRedirect(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'l.instagram.com' || u.hostname === 'l.facebook.com') {
      return u.searchParams.get('u') ?? url;
    }
    if (u.hostname.endsWith('linkedin.com') && u.pathname.startsWith('/redir/redirect')) {
      return u.searchParams.get('url') ?? url;
    }
  } catch {
    // not a URL
  }
  return url;
}

/** Links worth following: external pages, not the platforms' own profile/hashtag pages. */
export function isFollowable(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return !/(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|licdn\.com)$/.test(host) &&
      !(host === 'linkedin.com' && !url.includes('/pulse/'));
  } catch {
    return false;
  }
}
