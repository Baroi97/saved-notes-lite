import type { ItemRecord } from '../types';

export const DB_TITLE = 'Saved Content Notes';
export const DIGESTS_TITLE = 'Topic Digests';

export interface NoteProperties {
  Name: string;
  Platform: 'Instagram' | 'LinkedIn';
  Type: string;
  Author: string;
  'Source URL': string;
  Saved?: string;
  Processed: string;
  Topics: string[];
  Status: 'New';
}

export function noteProperties(item: ItemRecord): NoteProperties {
  const note = item.note!;
  return {
    Name: note.title,
    Platform: item.platform === 'instagram' ? 'Instagram' : 'LinkedIn',
    Type: note.contentType,
    Author: item.extraction?.author ?? item.author ?? '',
    'Source URL': item.url,
    Saved: item.savedAt ? new Date(item.savedAt).toISOString().slice(0, 10) : undefined,
    Processed: new Date().toISOString().slice(0, 10),
    Topics: note.topics,
    Status: 'New',
  };
}

/** Page body as Markdown; the sink converts it to Notion blocks. */
export function noteMarkdown(item: ItemRecord): string {
  const n = item.note!;
  const out: string[] = [n.summary, ''];
  const section = (title: string, lines: string[]) => {
    if (!lines.length) return;
    out.push(`## ${title}`, ...lines, '');
  };
  section('Key points', n.keyPoints.map((p) => `- ${p}`));
  section('Timeline', n.timeline.map((t) => `- **${t.t}** ${t.point}`));
  section('What it shows', n.visuals.map((v) => `- ${v}`));
  section('Try this', n.actionItems.map((a) => `- [ ] ${a}`));
  section('Quotes', n.quotes.map((q) => `> ${q}`));
  section('Linked resources', n.linkSummaries.map((l) => `- [${l.title || l.url}](${l.url}): ${l.summary}`));
  const transcript = item.media?.transcript ?? [];
  if (transcript.length) {
    section('Transcript', [transcript.map((s) => s.text).join(' ')]);
  }
  out.push(`[Open original post](${item.url})`);
  return out.join('\n');
}
