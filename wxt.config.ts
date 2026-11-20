import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Saved Notes Lite',
    description: 'Turns your Instagram and LinkedIn saved posts into Notion notes. Runs entirely in Chrome.',
    permissions: ['storage', 'sidePanel'],
    host_permissions: ['https://api.notion.com/*'],
    action: { default_title: 'Saved Notes Lite' },
  },
});
