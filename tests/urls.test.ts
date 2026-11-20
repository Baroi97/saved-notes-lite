import { describe, expect, it } from 'vitest';
import { extractUrls, isFollowable, parsePostUrl, unwrapRedirect } from '../src/lib/urls';

describe('urls', () => {
  it('normalizes post URLs', () => {
    expect(parsePostUrl('https://www.instagram.com/user/reel/ABC/?igsh=1', 'scrape')?.url).toBe('https://www.instagram.com/reel/ABC/');
    expect(parsePostUrl('https://www.linkedin.com/pulse/how-to-x-jane-doe', 'scrape')).toMatchObject({ type: 'article', id: 'pulse:how-to-x-jane-doe' });
    expect(parsePostUrl('https://example.com/p/abc', 'scrape')).toBeNull();
  });

  it('extracts and trims URLs from text', () => {
    expect(extractUrls('Read https://example.com/guide. Also (https://x.io/a)!')).toEqual(['https://example.com/guide', 'https://x.io/a']);
  });

  it('unwraps platform redirects', () => {
    expect(unwrapRedirect('https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2Fa&e=1')).toBe('https://example.com/a');
  });

  it('skips platform-internal links', () => {
    expect(isFollowable('https://www.instagram.com/explore/tags/ai/')).toBe(false);
    expect(isFollowable('https://www.linkedin.com/in/someone')).toBe(false);
    expect(isFollowable('https://www.linkedin.com/pulse/article-x')).toBe(true);
    expect(isFollowable('https://github.com/org/repo')).toBe(true);
  });
});
