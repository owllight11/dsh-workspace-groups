/**
 * Host-side persistence for the session-tab strip (`$DSH_HOME/workspace-groups.tabs.json`).
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'

/** One persisted tab. */
export interface PersistedTab {
  readonly sessionId: string
  readonly order: number
}

/** The persisted document. */
export interface TabsDocument {
  readonly version: 1
  readonly order: number
  readonly tabs: readonly PersistedTab[]
}

/** Default location: `$DSH_HOME/workspace-groups.tabs.json`. */
export function defaultTabsPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-groups.tabs.json')
}

/** Parse + shape-validate a tabs document. */
export function parseTabsDocument(raw: unknown): TabsDocument | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  if (source.version !== 1) return null
  if (typeof source.order !== 'number' || !Number.isFinite(source.order)) return null
  if (!Array.isArray(source.tabs)) return null
  const tabs: PersistedTab[] = []
  const seen = new Set<string>()
  for (const entry of source.tabs) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    if (typeof row.sessionId !== 'string' || row.sessionId === '') continue
    if (typeof row.order !== 'number' || !Number.isFinite(row.order)) continue
    if (seen.has(row.sessionId)) continue
    seen.add(row.sessionId)
    tabs.push({ sessionId: row.sessionId, order: row.order })
  }
  return { version: 1, order: source.order, tabs }
}

/** Read the tabs document. */
export async function readTabsDocument(path: string): Promise<TabsDocument | null> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  try {
    return parseTabsDocument(JSON.parse(text))
  } catch {
    return null
  }
}

/** Write the tabs document atomically. */
export async function writeTabsDocument(path: string, document: TabsDocument): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  const body = `${JSON.stringify(document, null, 2)}\n`
  const handle = await open(temp, 'w')
  try {
    await handle.writeFile(body, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temp, path)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/** Build the document to persist. */
export function documentForTabs(state: { order: number; tabs: readonly PersistedTab[] }): TabsDocument {
  const highest = state.tabs.reduce((max, tab) => Math.max(max, tab.order), 0)
  return {
    version: 1,
    order: Math.max(state.order, highest),
    tabs: [...state.tabs],
  }
}
