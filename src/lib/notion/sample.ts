import type { ItemRecord } from '../types';

/** A made-up note for checking the database layout before any real posts are processed. */
export function sampleNote(): ItemRecord {
  const now = Date.now();
  return {
    key: 'sample:saved-notes-lite',
    platform: 'instagram',
    id: 'saved-notes-lite-sample',
    url: 'https://www.instagram.com/p/saved-notes-lite-sample/',
    source: 'scrape',
    status: 'noted',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    savedAt: now,
    extraction: { type: 'carousel', author: 'saved-notes-lite', caption: '', authorComments: [], hashtags: [], imageUrls: [], links: [], hasVideo: false, rawText: '' },
    note: {
      title: 'Sample note (safe to delete)',
      summary: 'This page was written by Saved Notes Lite to check that the Notion connection works. Delete it whenever you like.',
      contentType: 'carousel',
      keyPoints: ['Notes land in this database', 'Each section below appears only when the post has that content'],
      timeline: [],
      visuals: ['Slide 1: a title card', 'Slide 2: a checklist'],
      actionItems: ['Delete this sample page'],
      quotes: ['Write it down or it didn\'t happen.'],
      linkSummaries: [],
      topics: ['Sample'],
      extraLinks: [],
    },
  };
}
