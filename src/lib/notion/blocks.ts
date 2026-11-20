/** Minimal Markdown → Notion blocks (covers what noteMarkdown/digests emit). */

type RichText = { type: 'text'; text: { content: string; link?: { url: string } | null }; annotations?: { bold?: boolean } };
export type Block = Record<string, unknown> & { object: 'block'; type: string };

const MAX_TEXT = 2000;

export function richText(s: string): RichText[] {
  const out: RichText[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  const plain = (t: string) => {
    for (let i = 0; i < t.length; i += MAX_TEXT) out.push({ type: 'text', text: { content: t.slice(i, i + MAX_TEXT) } });
  };
  for (const m of s.matchAll(re)) {
    if (m.index! > last) plain(s.slice(last, m.index));
    if (m[1]) out.push({ type: 'text', text: { content: m[1].slice(0, MAX_TEXT), link: { url: m[2] } } });
    else out.push({ type: 'text', text: { content: m[3].slice(0, MAX_TEXT) }, annotations: { bold: true } });
    last = m.index! + m[0].length;
  }
  if (last < s.length) plain(s.slice(last));
  return out;
}

const block = (type: string, body: Record<string, unknown>): Block => ({ object: 'block', type, [type]: body });

export function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      blocks.push(block(`heading_${m[1].length}`, { rich_text: richText(m[2]) }));
    } else if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)$/))) {
      blocks.push(block('to_do', { rich_text: richText(m[2]), checked: m[1] === 'x' }));
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      blocks.push(block('bulleted_list_item', { rich_text: richText(m[1]) }));
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      blocks.push(block('numbered_list_item', { rich_text: richText(m[1]) }));
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      blocks.push(block('quote', { rich_text: richText(m[1]) }));
    } else {
      blocks.push(block('paragraph', { rich_text: richText(line) }));
    }
  }
  return blocks;
}
