export interface NotionTargets {
  parentPageId?: string;
  databaseId?: string;
  digestsPageId?: string;
  /** topic name → digest page id */
  digestPages: Record<string, string>;
}

export interface Settings {
  /** Internal integration token from notion.so/my-integrations */
  notionToken: string;
  /** Page shared with the integration; the database and digests go under it */
  notionParentPageId: string;
  notion: NotionTargets;
}

export const DEFAULT_SETTINGS: Settings = {
  notionToken: '',
  notionParentPageId: '',
  notion: { digestPages: {} },
};

export async function getSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get('settings')).settings as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored, notion: { ...DEFAULT_SETTINGS.notion, ...stored?.notion } };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
