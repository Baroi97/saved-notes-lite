import type { Settings } from '../settings';
import type { ItemRecord } from '../types';
import { markdownToBlocks, richText, type Block } from './blocks';
import { DB_TITLE, DIGESTS_TITLE, noteMarkdown, noteProperties } from './format';
import { parsePageId, type ExistingNote, type NotionSink, type PageRef, type SetupResult } from './sink';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Notion REST API with an internal integration token. Runs in the extension, no other software. */
export class RestSink implements NotionSink {
  constructor(private settings: Settings) {}

  private async call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.settings.notionToken) throw new Error('Add a Notion integration token in Setup.');
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.settings.notionToken}`,
          'Notion-Version': VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, Number(res.headers.get('retry-after') ?? 1) * 1000));
        continue;
      }
      if (res.status === 401) throw new NotionError('Notion rejected the token. Copy it again from notion.so/my-integrations.', 401);
      if (!res.ok) throw new NotionError(`Notion ${method} ${path} → ${res.status}: ${await res.text()}`, res.status);
      return res.json();
    }
  }

  /** Checks the token; returns the integration's workspace name. */
  async me(): Promise<string> {
    const bot = await this.call('GET', '/users/me');
    return bot.bot?.workspace_name ?? bot.name ?? 'Notion';
  }

  /** The parent page's id, after checking the integration can see it. */
  private async parent(): Promise<string> {
    const id = parsePageId(this.settings.notionParentPageId);
    if (!id) throw new Error('Paste the link (or id) of the Notion page that should hold your notes.');
    try {
      await this.call('GET', `/pages/${id}`);
    } catch (e) {
      if (e instanceof NotionError && e.status === 404) {
        throw new Error('The integration can\'t see that page. In Notion, open the page → ••• → Connections → add your integration.');
      }
      throw e;
    }
    return id;
  }

  async setup(): Promise<SetupResult> {
    const parent = await this.parent();
    return (await this.findWorkspace(parent)) ?? this.createWorkspace(parent);
  }

  /** An earlier setup under the same parent page: its database and digests page. */
  private async findWorkspace(parent: string): Promise<SetupResult | undefined> {
    const children = await this.children(parent);
    const db = children.find((c) => c.type === 'child_database' && c.child_database.title === DB_TITLE);
    if (!db) return undefined;
    let digests = children.find((c) => c.type === 'child_page' && c.child_page.title === DIGESTS_TITLE)?.id;
    digests ??= (await this.createDigestsPage(parent)).id;
    return { parentPageId: parent, databaseId: db.id, digestsPageId: digests };
  }

  private createDigestsPage(parent: string) {
    return this.call('POST', '/pages', {
      parent: { page_id: parent },
      properties: { title: { title: richText(DIGESTS_TITLE) } },
    });
  }

  private async children(blockId: string): Promise<any[]> {
    const out: any[] = [];
    let cursor: string | undefined;
    do {
      const list = await this.call('GET', `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
      out.push(...list.results);
      cursor = list.has_more ? list.next_cursor : undefined;
    } while (cursor);
    return out;
  }

  async findExisting(needles: string[]): Promise<ExistingNote[]> {
    const out: ExistingNote[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.call('POST', `/databases/${this.settings.notion.databaseId}/query`, {
        filter: { or: needles.map((contains) => ({ property: 'Source URL', url: { contains } })) },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      for (const page of res.results) {
        const sourceUrl: string | null = page.properties?.['Source URL']?.url;
        if (sourceUrl) out.push({ sourceUrl, pageId: page.id, url: page.url });
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);
    return out;
  }

  private async createWorkspace(parent: string): Promise<SetupResult> {
    const select = (names: string[]) => ({ select: { options: names.map((name) => ({ name })) } });
    const db = await this.call('POST', '/databases', {
      parent: { type: 'page_id', page_id: parent },
      title: richText(DB_TITLE),
      properties: {
        Name: { title: {} },
        Platform: select(['Instagram', 'LinkedIn']),
        Type: select(['post', 'carousel', 'reel', 'video', 'article', 'document']),
        Author: { rich_text: {} },
        'Source URL': { url: {} },
        Saved: { date: {} },
        Processed: { date: {} },
        Topics: { multi_select: {} },
        Status: select(['New', 'Reviewed', 'Archived']),
      },
    });
    const digests = await this.createDigestsPage(parent);
    return { parentPageId: parent, databaseId: db.id, digestsPageId: digests.id };
  }

  async upsertNote(item: ItemRecord): Promise<PageRef> {
    if (!this.settings.notion.databaseId) throw new Error('Set up the notes database first.');
    const p = noteProperties(item);
    const properties = {
      Name: { title: richText(p.Name) },
      Platform: { select: { name: p.Platform } },
      Type: { select: { name: p.Type } },
      Author: { rich_text: richText(p.Author) },
      'Source URL': { url: p['Source URL'] },
      ...(p.Saved ? { Saved: { date: { start: p.Saved } } } : {}),
      Processed: { date: { start: p.Processed } },
      Topics: { multi_select: p.Topics.map((name) => ({ name: name.replace(/,/g, ' ') })) },
      Status: { select: { name: p.Status } },
    };
    const blocks = markdownToBlocks(noteMarkdown(item));
    if (item.notionPageId) {
      await this.call('PATCH', `/pages/${item.notionPageId}`, { properties });
      await this.replaceChildren(item.notionPageId, blocks);
      return { pageId: item.notionPageId, url: item.notionUrl };
    }
    const page = await this.call('POST', '/pages', {
      parent: { database_id: this.settings.notion.databaseId },
      properties,
      children: blocks.slice(0, 100),
    });
    await this.append(page.id, blocks.slice(100));
    return { pageId: page.id, url: page.url };
  }

  async writeDigest(topic: string, markdown: string, existingPageId?: string): Promise<PageRef> {
    const blocks = markdownToBlocks(markdown);
    if (existingPageId) {
      await this.replaceChildren(existingPageId, blocks);
      return { pageId: existingPageId };
    }
    const page = await this.call('POST', '/pages', {
      parent: { page_id: this.settings.notion.digestsPageId },
      properties: { title: { title: richText(`Topic: ${topic}`) } },
      children: blocks.slice(0, 100),
    });
    await this.append(page.id, blocks.slice(100));
    return { pageId: page.id, url: page.url };
  }

  private async replaceChildren(pageId: string, blocks: Block[]) {
    for (const child of await this.children(pageId)) await this.call('DELETE', `/blocks/${child.id}`);
    await this.append(pageId, blocks);
  }

  private async append(pageId: string, blocks: Block[]) {
    for (let i = 0; i < blocks.length; i += 100) {
      await this.call('PATCH', `/blocks/${pageId}/children`, { children: blocks.slice(i, i + 100) });
    }
  }
}
