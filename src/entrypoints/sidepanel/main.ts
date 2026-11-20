import { RestSink } from '../../lib/notion/rest';
import { sampleNote } from '../../lib/notion/sample';
import { pageUrl } from '../../lib/notion/sink';
import { getSettings, saveSettings } from '../../lib/settings';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('settings');
const status = (text: string, error = false) => {
  $('notion-status').textContent = text;
  $('notion-status').className = error ? 'error' : 'muted small';
};

async function loadSettings() {
  const s = await getSettings();
  (form.elements.namedItem('notionToken') as HTMLInputElement).value = s.notionToken;
  (form.elements.namedItem('notionParentPageId') as HTMLInputElement).value = s.notionParentPageId;
  if (s.notion.databaseId) {
    $('activity').textContent = 'Notion connected. Notes database ready.';
    ($('setup') as HTMLDetailsElement).open = false;
  }
}

/** Saves the form; a new parent page forgets the old database so setup finds or makes one there. */
async function saveForm() {
  const data = new FormData(form);
  const before = await getSettings();
  const notionParentPageId = String(data.get('notionParentPageId') ?? '').trim();
  return saveSettings({
    notionToken: String(data.get('notionToken') ?? '').trim(),
    notionParentPageId,
    ...(notionParentPageId !== before.notionParentPageId ? { notion: { digestPages: {} } } : {}),
  });
}

/** Runs one action with the buttons disabled and its result or error in the status line. */
function action(id: string, busy: string, run: () => Promise<string>) {
  $(id).addEventListener('click', async () => {
    const buttons = form.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));
    status(busy);
    try {
      status(await run());
    } catch (e) {
      status((e as Error).message, true);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveForm();
  status('Saved');
});

action('notion-test', 'Checking…', async () => {
  const workspace = await new RestSink(await saveForm()).me();
  return `Token works (workspace: ${workspace}).`;
});

action('notion-setup', 'Finding or creating the database…', async () => {
  const s = await saveForm();
  const result = await new RestSink(s).setup();
  await saveSettings({ notion: { ...s.notion, ...result } });
  $('activity').textContent = 'Notion connected. Notes database ready.';
  return `Database ready: ${pageUrl(result.databaseId)}`;
});

action('notion-sample', 'Writing a sample note…', async () => {
  const s = await getSettings();
  const sink = new RestSink(s);
  const item = sampleNote();
  // Reuses the earlier sample page instead of adding another one.
  const [existing] = await sink.findExisting([item.id]);
  const page = await sink.upsertNote({ ...item, notionPageId: existing?.pageId, notionUrl: existing?.url });
  return `Sample note written: ${page.url ?? pageUrl(page.pageId)}`;
});

void loadSettings();
