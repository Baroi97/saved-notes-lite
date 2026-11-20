import { describe, expect, it, vi } from 'vitest';
import { markdownToBlocks, richText } from '../src/lib/notion/blocks';
import { noteMarkdown, noteProperties } from '../src/lib/notion/format';
import type { ItemRecord } from '../src/lib/types';
import { RestSink } from '../src/lib/notion/rest';
import { sampleNote } from '../src/lib/notion/sample';
import { parsePageId, sourceNeedle } from '../src/lib/notion/sink';
import { DEFAULT_SETTINGS } from '../src/lib/settings';
import { parsePostUrl } from '../src/lib/urls';

const item: ItemRecord = {
  key: 'instagram:ABC',
  platform: 'instagram',
  id: 'ABC',
  url: 'https://www.instagram.com/reel/ABC/',
  source: 'scrape',
  status: 'noted',
  attempts: 0,
  createdAt: 0,
  updatedAt: 0,
  savedAt: Date.UTC(2025, 0, 2),
  extraction: { type: 'reel', author: 'coach', caption: '', authorComments: [], hashtags: [], imageUrls: [], links: [], hasVideo: true, rawText: '' },
  media: { duration: 20, transcript: [{ start: 0, end: 3, text: 'Hello there.' }], frames: [] },
  note: {
    title: 'Focus routine',
    summary: 'A short routine for deep work.',
    contentType: 'reel',
    keyPoints: ['Block 90 minutes'],
    timeline: [{ t: '0:05', point: 'Shows calendar' }],
    visuals: [],
    actionItems: ['Try one block tomorrow'],
    quotes: ['Protect your mornings'],
    linkSummaries: [{ url: 'https://ex.com', title: 'Guide', summary: 'Longer guide.' }],
    topics: ['Productivity'],
    extraLinks: [],
  },
};

/** Stubs fetch with canned Notion responses, recording each request. */
function stubNotion(respond: (method: string, path: string) => { status?: number; json?: unknown }) {
  const calls: { method: string; path: string; body: any }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const method = init.method ?? 'GET';
    const path = url.replace('https://api.notion.com/v1', '');
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = respond(method, path);
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 });
  });
  return calls;
}

describe('note formatting', () => {
  it('builds properties', () => {
    expect(noteProperties(item)).toMatchObject({ Name: 'Focus routine', Platform: 'Instagram', Author: 'coach', Saved: '2025-01-02', Topics: ['Productivity'] });
  });

  it('renders markdown sections and skips empty ones', () => {
    const md = noteMarkdown(item);
    expect(md).toContain('## Timeline\n- **0:05** Shows calendar');
    expect(md).toContain('- [ ] Try one block tomorrow');
    expect(md).toContain('## Transcript\nHello there.');
    expect(md).not.toContain('## What it shows');
  });

  it('converts markdown to Notion blocks', () => {
    const types = markdownToBlocks(noteMarkdown(item)).map((b) => b.type);
    expect(types).toEqual(expect.arrayContaining(['heading_2', 'to_do', 'quote', 'bulleted_list_item', 'paragraph']));
  });

  it('parses links and bold, and splits long text', () => {
    const rt = richText('See [Guide](https://ex.com) and **this**');
    expect(rt[1]).toMatchObject({ text: { content: 'Guide', link: { url: 'https://ex.com' } } });
    expect(rt[3]).toMatchObject({ annotations: { bold: true } });
    expect(richText('x'.repeat(4500))).toHaveLength(3);
  });

  it('renders the sample note', () => {
    expect(markdownToBlocks(noteMarkdown(sampleNote())).length).toBeGreaterThan(3);
  });
});

describe('parent page id', () => {
  const id = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
  const dashed = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';

  it('accepts a bare id, a dashed id and page links', () => {
    expect(parsePageId(id)).toBe(dashed);
    expect(parsePageId(dashed)).toBe(dashed);
    expect(parsePageId(`https://www.notion.so/My-Notes-${id}`)).toBe(dashed);
    expect(parsePageId(`https://www.notion.so/team/My-Notes-${id.toUpperCase()}?pvs=4#abc`)).toBe(dashed);
  });

  it('rejects anything without an id', () => {
    expect(parsePageId('')).toBeNull();
    expect(parsePageId('https://www.notion.so/My-Notes')).toBeNull();
  });
});

describe('Notion setup', () => {
  const parent = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  const settings = { ...DEFAULT_SETTINGS, notionToken: 't', notionParentPageId: 'https://www.notion.so/Notes-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d' };

  it('reuses an existing database under the parent page', async () => {
    const children = [
      { id: 'db1', type: 'child_database', child_database: { title: 'Saved Content Notes' } },
      { id: 'dg1', type: 'child_page', child_page: { title: 'Topic Digests' } },
    ];
    const calls = stubNotion((_m, path) => (path.startsWith('/blocks/') ? { json: { results: children, has_more: false } } : { json: { id: parent } }));
    const result = await new RestSink(settings).setup();
    vi.unstubAllGlobals();

    expect(result).toEqual({ parentPageId: parent, databaseId: 'db1', digestsPageId: 'dg1' });
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('creates the database and digests page when none exists', async () => {
    const calls = stubNotion((method, path) => {
      if (path.startsWith('/blocks/')) return { json: { results: [], has_more: false } };
      if (method === 'POST' && path === '/databases') return { json: { id: 'db2' } };
      if (method === 'POST' && path === '/pages') return { json: { id: 'dg2' } };
      return { json: { id: parent } };
    });
    const result = await new RestSink(settings).setup();
    vi.unstubAllGlobals();

    expect(result).toEqual({ parentPageId: parent, databaseId: 'db2', digestsPageId: 'dg2' });
    expect(calls.find((c) => c.path === '/databases')!.body.properties['Source URL']).toEqual({ url: {} });
  });

  it('explains a page the integration has not been added to', async () => {
    stubNotion(() => ({ status: 404, json: { code: 'object_not_found' } }));
    await expect(new RestSink(settings).setup()).rejects.toThrow(/Connections/);
    vi.unstubAllGlobals();
  });

  it('explains a bad token', async () => {
    stubNotion(() => ({ status: 401, json: { code: 'unauthorized' } }));
    await expect(new RestSink(settings).me()).rejects.toThrow(/rejected the token/);
    vi.unstubAllGlobals();
  });
});

describe('finding notes already in Notion', () => {
  const posts = [
    'https://www.instagram.com/reel/ABC_1/',
    'https://www.linkedin.com/feed/update/urn:li:activity:7123/',
    'https://www.linkedin.com/pulse/how-to-focus-jane-doe/',
  ];

  it('builds a needle that appears in the Source URL and maps back to the same item', () => {
    for (const url of posts) {
      const item = parsePostUrl(url, 'scrape')!;
      expect(url).toContain(sourceNeedle(item));
      expect(parsePostUrl(url, 'scrape')!.key).toBe(item.key);
    }
  });

  it('matches an Instagram post whether it was stored as /p/ or /reel/', () => {
    const fromExport = parsePostUrl('https://www.instagram.com/p/ABC_1/', 'export')!;
    expect(posts[0]).toContain(sourceNeedle(fromExport));
    expect(parsePostUrl(posts[0], 'scrape')!.key).toBe(fromExport.key);
  });

  it('lookup sends one "or" filter and pages through results', async () => {
    const pages = [
      { results: [{ id: 'p1', url: 'https://notion.so/p1', properties: { 'Source URL': { url: posts[0] } } }], has_more: true, next_cursor: 'c1' },
      { results: [{ id: 'p2', url: 'https://notion.so/p2', properties: { 'Source URL': { url: null } } }], has_more: false },
    ];
    const calls = stubNotion(() => ({ json: pages[calls.length - 1] }));
    const sink = new RestSink({ ...DEFAULT_SETTINGS, notionToken: 't', notion: { databaseId: 'db', digestPages: {} } });
    const rows = await sink.findExisting(['ABC_1', 'urn:li:activity:7123']);
    vi.unstubAllGlobals();

    expect(calls[0].body.filter.or).toEqual([
      { property: 'Source URL', url: { contains: 'ABC_1' } },
      { property: 'Source URL', url: { contains: 'urn:li:activity:7123' } },
    ]);
    expect(calls[1].body.start_cursor).toBe('c1');
    expect(rows).toEqual([{ sourceUrl: posts[0], pageId: 'p1', url: 'https://notion.so/p1' }]);
  });
});
