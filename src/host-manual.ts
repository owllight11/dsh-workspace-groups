/**
 * Runtime grouping overlay for @dsh-xhl/workspace-groups: manual groups created in
 * the sidebar UI and per-workspace category overrides. Stored in a plugin-
 * owned JSON sidecar (`$DSH_HOME/workspace-groups.manual.json`), separate from
 * the operator YAML — the YAML stays the rule source, this file only records
 * runtime decisions, and writes are atomic (temp file + fsync + rename).
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { ruleDisplayName } from './core/matcher.ts'
import { ancestorCategoryKeys, normalizeCategoryPath, TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL, type ManualGroups } from './core/types.ts'

/** Default overlay location: `$DSH_HOME/workspace-groups.manual.json`. */
export function defaultManualPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-groups.manual.json')
}

function parseStringList(value: unknown, field: string, unique: boolean): string[] {
  if (!Array.isArray(value)) throw new Error(`workspace-groups.manual.json: ${field} must be a list`)
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error(`workspace-groups.manual.json: ${field} entries must be non-empty strings`)
    }
    const trimmed = entry.trim()
    if (unique && seen.has(trimmed)) {
      throw new Error(`workspace-groups.manual.json: ${field} has duplicate entry "${trimmed}"`)
    }
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

/**
 * Parse + shape-validate a raw overlay document into a ManualGroups.
 */
export function parseManualGroups(raw: unknown): ManualGroups {
  if (raw === undefined || raw === null) return { categories: [], assignments: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('workspace-groups.manual.json: top-level value must be a mapping')
  }
  const source = raw as Record<string, unknown>

  const categories: string[] = []
  if (source.categories !== undefined) {
    if (!Array.isArray(source.categories)) {
      throw new Error('workspace-groups.manual.json: categories must be a list')
    }
    const seen = new Set<string>()
    for (const entry of source.categories) {
      if (typeof entry !== 'string' || entry.trim() === '') {
        throw new Error('workspace-groups.manual.json: each manual category must be a non-empty string')
      }
      const rawName = entry.trim()
      if (rawName === UNCATEGORIZED_LABEL) {
        throw new Error(`workspace-groups.manual.json: manual category name "${rawName}" is reserved`)
      }
      const name = normalizeCategoryPath(rawName)
      if (name === null) {
        throw new Error(`workspace-groups.manual.json: manual category path "${rawName}" is invalid`)
      }
      if (seen.has(name)) {
        throw new Error(`workspace-groups.manual.json: duplicate manual category "${name}"`)
      }
      seen.add(name)
      categories.push(name)
    }
  }

  const assignments: Record<string, string | null> = {}
  if (source.assignments !== undefined) {
    if (typeof source.assignments !== 'object' || source.assignments === null || Array.isArray(source.assignments)) {
      throw new Error('workspace-groups.manual.json: assignments must be a mapping')
    }
    for (const [workspaceId, category] of Object.entries(source.assignments as Record<string, unknown>)) {
      if (workspaceId.trim() === '') {
        throw new Error('workspace-groups.manual.json: assignment keys must be non-empty')
      }
      if (category === null) {
        assignments[workspaceId] = null
        continue
      }
      if (typeof category !== 'string' || category.trim() === '') {
        throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" must be a category name or null`)
      }
      const trimmedCat = category.trim()
      if (trimmedCat === UNCATEGORIZED_LABEL) {
        assignments[workspaceId] = UNCATEGORIZED_LABEL
        continue
      }
      const normalizedCat = normalizeCategoryPath(trimmedCat)
      if (normalizedCat === null) {
        throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" has invalid category path "${trimmedCat}"`)
      }
      assignments[workspaceId] = normalizedCat
    }
  }

  const manual: ManualGroups = { categories, assignments }
  if (source.categoryOrder !== undefined) manual.categoryOrder = parseStringList(source.categoryOrder, 'categoryOrder', true)
  if (source.hidden !== undefined) manual.hidden = parseStringList(source.hidden, 'hidden', true)

  if (source.renamed !== undefined) {
    if (typeof source.renamed !== 'object' || source.renamed === null || Array.isArray(source.renamed)) {
      throw new Error('workspace-groups.manual.json: renamed must be a mapping')
    }
    const renamed: Record<string, string> = {}
    for (const [original, display] of Object.entries(source.renamed as Record<string, unknown>)) {
      if (original.trim() === '') {
        throw new Error('workspace-groups.manual.json: renamed keys must be non-empty')
      }
      if (typeof display !== 'string' || display.trim() === '') {
        throw new Error(`workspace-groups.manual.json: renamed "${original}" must be a non-empty string`)
      }
      const normalizedDisplay = normalizeCategoryPath(display)
      if (normalizedDisplay === null) {
        throw new Error(`workspace-groups.manual.json: renamed "${original}" has invalid category path "${display}"`)
      }
      renamed[original] = normalizedDisplay
    }
    manual.renamed = renamed
  }

  if (source.workspaceOrder !== undefined) {
    if (typeof source.workspaceOrder !== 'object' || source.workspaceOrder === null || Array.isArray(source.workspaceOrder)) {
      throw new Error('workspace-groups.manual.json: workspaceOrder must be a mapping')
    }
    const workspaceOrder: Record<string, string[]> = {}
    for (const [categoryKey, ids] of Object.entries(source.workspaceOrder as Record<string, unknown>)) {
      if (categoryKey.trim() === '') {
        throw new Error('workspace-groups.manual.json: workspaceOrder keys must be non-empty')
      }
      workspaceOrder[categoryKey] = parseStringList(ids, `workspaceOrder["${categoryKey}"]`, true)
    }
    manual.workspaceOrder = workspaceOrder
  }

  return manual
}

/**
 * Cross-validate a parsed overlay against the current rule categories (write boundary only).
 */
export function validateManualGroups(manual: ManualGroups, ruleCategoryNames: readonly string[]): void {
  const ruleNames = new Set(ruleCategoryNames)
  const allowed = new Set<string>()
  const addWithAncestors = (key: string): void => {
    for (const anc of ancestorCategoryKeys(key)) allowed.add(anc)
    allowed.add(key)
  }
  for (const name of ruleCategoryNames) addWithAncestors(ruleDisplayName(manual, name))
  for (const name of manual.categories) addWithAncestors(name)
  allowed.add(UNCATEGORIZED_LABEL)

  for (const [workspaceId, category] of Object.entries(manual.assignments)) {
    if (category === null) continue
    if (!allowed.has(category)) {
      throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" references unknown category "${category}"`)
    }
  }
  for (const key of manual.categoryOrder ?? []) {
    if (!allowed.has(key) || key === UNCATEGORIZED_LABEL) {
      throw new Error(`workspace-groups.manual.json: categoryOrder references unknown category "${key}"`)
    }
  }
  for (const key of Object.keys(manual.workspaceOrder ?? {})) {
    if (key === TOP_LEVEL_ORDER_KEY) continue
    if (!allowed.has(key) || key === UNCATEGORIZED_LABEL) {
      throw new Error(`workspace-groups.manual.json: workspaceOrder references unknown category "${key}"`)
    }
  }
  for (const original of Object.keys(manual.renamed ?? {})) {
    if (!ruleNames.has(original)) {
      throw new Error(`workspace-groups.manual.json: renamed references unknown rule category "${original}"`)
    }
  }
  for (const original of manual.hidden ?? []) {
    if (!ruleNames.has(original)) {
      throw new Error(`workspace-groups.manual.json: hidden references unknown rule category "${original}"`)
    }
  }
}

/** Read + parse the overlay file. A missing file yields an empty overlay. */
export async function readManualGroups(path: string): Promise<ManualGroups> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { categories: [], assignments: {} }
    throw error
  }
  return parseManualGroups(JSON.parse(text))
}

/** Atomically replace the overlay file (temp file + fsync + rename). */
export async function writeManualGroups(path: string, manual: ManualGroups): Promise<void> {
  const json = `${JSON.stringify(manual, null, 2)}\n`
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(json, 'utf8')
    await handle.sync()
  } catch (error) {
    await handle.close().catch(() => {})
    await unlink(tmp).catch(() => {})
    throw error
  }
  await handle.close()
  try {
    await rename(tmp, path)
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
}
