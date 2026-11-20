# Saved Notes Lite

A version of Saved Notes that runs entirely inside Chrome: no Claude Code, no native bridge, no Node at runtime, and no paid API. The original project is in `C:\InstagramLinkedinNotes`.

**Status:** only the Notion part exists so far. It covers connecting with an integration token, finding or creating the "Saved Content Notes" database and "Topic Digests" page, writing notes and digests, and looking up notes already in Notion by Source URL. Scraping, video capture and note writing will be added next. The plan is Chrome's built-in Gemini Nano, with an optional free Gemini API key.

## Install

Requirements: Node 22+ (only for building) and Chrome.

```sh
npm install
npm run build      # outputs .output/chrome-mv3
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `.output/chrome-mv3`.

## Connect Notion

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations), create an **internal** integration, and copy its token (`ntn_…`).
2. In Notion, open (or create) the page that should hold your notes, click **•••** → **Connections**, and add the integration.
3. Click the extension icon to open the side panel. Paste the token and the page's link, then:
   - **Test connection** checks the token.
   - **Set up notes database** reuses a "Saved Content Notes" database under that page if one exists, otherwise creates it plus a "Topic Digests" page.
   - **Write a sample note** adds one sample row so you can see the layout. Clicking it again updates that same row.

The token is stored in `chrome.storage.local` in this Chrome profile only.

## Layout

| Path | What it does |
| --- | --- |
| `src/lib/notion/rest.ts` | Notion API: setup, note writes, digests, Source URL lookup |
| `src/lib/notion/format.ts`, `blocks.ts` | Note properties, page Markdown, Markdown → Notion blocks |
| `src/lib/notion/sink.ts` | Shared types, page id parsing, lookup needles |
| `src/lib/settings.ts` | Token, parent page and saved database ids |
| `src/entrypoints/sidepanel/` | Setup UI |

`npm test` runs the unit tests and `npm run typecheck` runs TypeScript.
