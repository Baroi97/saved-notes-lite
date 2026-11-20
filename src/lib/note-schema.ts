import * as z from 'zod/v4';

export const NoteSchema = z.object({
  title: z.string().describe('Short descriptive title for the note (not the author name)'),
  summary: z.string().describe('2-4 sentence summary of what the content teaches or argues'),
  contentType: z.enum(['post', 'carousel', 'reel', 'video', 'article', 'document']),
  keyPoints: z.array(z.string()).describe('The substantive takeaways, one per item'),
  timeline: z
    .array(z.object({ t: z.string().describe('mm:ss'), point: z.string() }))
    .describe('For video: what is said/shown at key moments. Empty for non-video.'),
  visuals: z
    .array(z.string())
    .describe('What slides or key frames show, including any on-screen text worth keeping'),
  actionItems: z.array(z.string()).describe('Concrete things the reader could do or try'),
  quotes: z.array(z.string()).describe('Memorable verbatim lines, if any'),
  linkSummaries: z
    .array(z.object({ url: z.string(), title: z.string(), summary: z.string() }))
    .describe('One entry per linked page that was provided'),
  topics: z
    .array(z.string())
    .describe('1-3 broad Title Case topics; reuse existing topics when they fit'),
  extraLinks: z
    .array(z.string())
    .describe('Full URLs visible in images/frames/transcript that were NOT already provided'),
});

export type Note = z.infer<typeof NoteSchema>;
