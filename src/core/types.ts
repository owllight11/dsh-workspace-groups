/**
 * Shared config types and multi-level category path utilities for
 * `@dsh-xhl/workspace-groups`. Pure types & helpers (zero runtime deps) so both
 * the node half and the browser half share identical semantics.
 */

/** One classification rule: any rule that matches places the workspace in the category. */
export interface GroupRule {
  /** Absolute path prefix match (normalized, case-sensitive). */
  pathPrefix?: string
  /** Case-insensitive substring match against the workspace display title. */
  nameContains?: string
  /** Case-insensitive substring match against the workspace directory basename. */
  basenameContains?: string
  /** Exact absolute path match (normalized). */
  pathExact?: string
}

/** One category folder in the sidebar tree. */
export interface GroupCategory {
  /** Display label or `/` path of the category folder. */
  name: string
  /** Rules; a workspace is classified here when ANY rule matches. */
  rules: GroupRule[]
}

/** The full sidecar configuration (mirrors workspace-groups.yaml). */
export interface GroupsConfig {
  /** Category folders, in render order. First match wins. */
  categories: GroupCategory[]
  /** Runtime grouping overlay (manual groups + per-workspace overrides). */
  manual?: ManualGroups
}

/**
 * Runtime-managed grouping overlay: groups created in the sidebar UI plus
 * per-workspace category overrides and user-controlled ordering. Owned by the
 * plugin (JSON sidecar, `$DSH_HOME/workspace-groups.manual.json`).
 */
export interface ManualGroups {
  /** Manually created category folder keys (supports `/` for nested folders). */
  categories: string[]
  /** Per-workspace category override, keyed by workspace id (`null` = top-level). */
  assignments: Record<string, string | null>
  /** Display order of all category keys (rule display keys + manual keys). */
  categoryOrder?: string[]
  /** Per-category ordered workspace ids. */
  workspaceOrder?: Record<string, string[]>
  /** Rule category rename/reparent overrides: original YAML rule name → display path key. */
  renamed?: Record<string, string>
  /** Rule category original names hidden by a UI delete. */
  hidden?: string[]
}

/** Overlay with every optional field materialized. */
export type NormalizedManual = Required<ManualGroups>

export const EMPTY_MANUAL: NormalizedManual = {
  categories: [],
  assignments: {},
  categoryOrder: [],
  workspaceOrder: {},
  renamed: {},
  hidden: [],
}

/** Materialize optional overlay fields so updates are plain object edits. */
export function normalizeManual(manual: ManualGroups): NormalizedManual {
  return {
    categories: manual.categories,
    assignments: manual.assignments,
    categoryOrder: manual.categoryOrder ?? [],
    workspaceOrder: manual.workspaceOrder ?? {},
    renamed: manual.renamed ?? {},
    hidden: manual.hidden ?? [],
  }
}

/**
 * Legacy label of the fallback bucket. The top-level (ungrouped) concept
 * replaced the rendered "未分类" bucket. The constant survives for data
 * compatibility (reserved name, assignment null marker).
 */
export const UNCATEGORIZED_LABEL = '未分类'

/** Reserved key under `workspaceOrder` holding the manual order of top-level rows. */
export const TOP_LEVEL_ORDER_KEY = '__topLevel__'

/** Canonical separator for nested folder paths (e.g. `Windows主机/MKINSP`). */
export const CATEGORY_PATH_SEPARATOR = '/'

/** Normalize a filesystem path for prefix matching: trailing slashes stripped. */
export function normalizePath(path: string): string {
  return path.replace(/[/\\]+$/, '')
}

/** Split a category key into trimmed segments (preserves empty segments for validation). */
export function splitCategoryPath(key: string): string[] {
  const trimmed = key.trim()
  if (trimmed === '') return []
  return trimmed.split(CATEGORY_PATH_SEPARATOR).map(seg => seg.trim())
}

/**
 * Normalize and validate a category path string.
 * Rejects empty input, leading/trailing `/`, empty `//` segments, and reserved
 * segment names (`未分类`, `__topLevel__`).
 */
export function normalizeCategoryPath(raw: string): string | null {
  const segments = splitCategoryPath(raw)
  if (segments.length === 0) return null
  for (const seg of segments) {
    if (seg === '' || seg === UNCATEGORIZED_LABEL || seg === TOP_LEVEL_ORDER_KEY) {
      return null
    }
  }
  return segments.join(CATEGORY_PATH_SEPARATOR)
}

/** Parent folder key of a nested category, or `undefined` at root level. */
export function parentCategoryKey(key: string): string | undefined {
  const idx = key.lastIndexOf(CATEGORY_PATH_SEPARATOR)
  return idx <= 0 ? undefined : key.slice(0, idx)
}

/** Display leaf name (last segment) of a category path. */
export function categoryLeafName(key: string): string {
  const idx = key.lastIndexOf(CATEGORY_PATH_SEPARATOR)
  return idx < 0 ? key : key.slice(idx + 1)
}

/** Join an optional parent key and a leaf segment into a canonical path key. */
export function joinCategoryPath(parentKey: string | undefined, leafName: string): string {
  return parentKey === undefined || parentKey === ''
    ? leafName
    : `${parentKey}${CATEGORY_PATH_SEPARATOR}${leafName}`
}

/** Ancestor keys from outermost root to direct parent (e.g. `A/B/C` -> `['A', 'A/B']`). */
export function ancestorCategoryKeys(key: string): string[] {
  const parts = splitCategoryPath(key)
  const ancestors: string[] = []
  for (let i = 1; i < parts.length; i += 1) {
    ancestors.push(parts.slice(0, i).join(CATEGORY_PATH_SEPARATOR))
  }
  return ancestors
}

/** True when `candidate` equals `ancestor` or sits strictly inside `ancestor/`. */
export function isSameOrDescendantCategory(candidate: string, ancestor: string): boolean {
  return candidate === ancestor || candidate.startsWith(`${ancestor}${CATEGORY_PATH_SEPARATOR}`)
}

/** Rewrite `oldPrefix` (and `oldPrefix/...`) to `newPrefix` (and `newPrefix/...`). */
export function replaceCategoryPrefix(key: string, oldPrefix: string, newPrefix: string): string {
  if (key === oldPrefix) return newPrefix
  if (key.startsWith(`${oldPrefix}${CATEGORY_PATH_SEPARATOR}`)) {
    return `${newPrefix}${key.slice(oldPrefix.length)}`
  }
  return key
}

/** Format a category path as a readable breadcrumb (`A/B` -> `A › B`). */
export function formatCategoryBreadcrumb(key: string): string {
  return splitCategoryPath(key).join(' › ')
}
