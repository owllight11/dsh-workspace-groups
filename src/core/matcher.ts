/**
 * Pure classification, ordering, and multi-level overlay mutations shared by
 * the host half (validation) and the client half (tree derivation & UI actions).
 */
import {
  ancestorCategoryKeys,
  categoryLeafName,
  EMPTY_MANUAL,
  isSameOrDescendantCategory,
  joinCategoryPath,
  normalizeManual,
  normalizePath,
  parentCategoryKey,
  replaceCategoryPrefix,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type GroupCategory,
  type GroupRule,
  type GroupsConfig,
  type ManualGroups,
  type NormalizedManual,
} from './types.ts'

/** One rule match against a workspace's path and title. */
function ruleMatches(rule: GroupRule, path: string, title: string): boolean {
  const normalized = normalizePath(path)
  if (rule.pathPrefix !== undefined && normalized.startsWith(normalizePath(rule.pathPrefix))) return true
  if (rule.pathExact !== undefined && normalized === normalizePath(rule.pathExact)) return true
  if (rule.nameContains !== undefined && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true
  if (rule.basenameContains !== undefined) {
    const base = path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? ''
    if (base.toLowerCase().includes(rule.basenameContains.toLowerCase())) return true
  }
  return false
}

/** Classify a workspace by rules only; hidden categories are inert. */
export function classify(categories: readonly GroupCategory[], path: string, title: string): GroupCategory | undefined {
  for (const category of categories) {
    if (category.rules.some(rule => ruleMatches(rule, path, title))) return category
  }
  return undefined
}

/** Display name of a rule category: the rename override when present. */
export function ruleDisplayName(manual: ManualGroups | undefined, originalName: string): string {
  return manual?.renamed?.[originalName] ?? originalName
}

/** Whether a rule category has been hidden by a UI delete. */
export function isHiddenRule(manual: ManualGroups | undefined, originalName: string): boolean {
  return manual?.hidden?.includes(originalName) ?? false
}

/** Rule category display names, in YAML render order (hidden ones excluded). */
export function ruleDisplayNames(categories: readonly GroupCategory[], manual: ManualGroups | undefined): string[] {
  const names: string[] = []
  for (const category of categories) {
    if (isHiddenRule(manual, category.name)) continue
    names.push(ruleDisplayName(manual, category.name))
  }
  return names
}

/** Original YAML rule name whose display name equals `key` (undefined when none). */
export function originalRuleNameForDisplay(
  categories: readonly GroupCategory[],
  manual: ManualGroups | undefined,
  key: string,
): string | undefined {
  return categories.find(c => !isHiddenRule(manual, c.name) && ruleDisplayName(manual, c.name) === key)?.name
}

/** Effective category entry in display order. */
export interface EffectiveCategory {
  /** Display path key (what the tree renders and assignments reference). */
  key: string
  /** Origin: a YAML rule category or a manual group. */
  source: 'rule' | 'manual'
}

export function effectiveCategories(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
): EffectiveCategory[] {
  const entries: EffectiveCategory[] = []
  const seen = new Set<string>()
  for (const category of config.categories) {
    if (isHiddenRule(manual, category.name)) continue
    const key = ruleDisplayName(manual, category.name)
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ key, source: 'rule' })
  }
  for (const name of manual?.categories ?? []) {
    if (seen.has(name)) continue
    seen.add(name)
    entries.push({ key: name, source: 'manual' })
  }
  const order = manual?.categoryOrder
  if (order === undefined || order.length === 0) return entries
  const position = new Map(order.map((key, index) => [key, index]))
  return [...entries].sort((a, b) => {
    const pa = position.get(a.key)
    const pb = position.get(b.key)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return 0
  })
}

/** Display keys of all explicit effective categories (top-level workspaces excluded). */
export function displayCategoryKeys(config: GroupsConfig, manual: ManualGroups | undefined): string[] {
  return effectiveCategories(config, manual).map(e => e.key)
}

/**
 * All category keys including any implicit ancestor paths derived from `/` keys,
 * deduplicated with ancestors materialized before their first descendant.
 * Respects `manual.categoryOrder` when ancestors also appear in it.
 */
export function allCategoryKeys(config: GroupsConfig, manual: ManualGroups | undefined): string[] {
  const explicit = displayCategoryKeys(config, manual)
  const explicitSet = new Set(explicit)
  const keys: string[] = []
  const seen = new Set<string>()
  const pushUnique = (k: string): void => {
    if (seen.has(k)) return
    seen.add(k)
    keys.push(k)
  }

  for (const key of explicit) {
    for (const anc of ancestorCategoryKeys(key)) {
      if (!explicitSet.has(anc)) pushUnique(anc)
    }
    pushUnique(key)
  }

  const order = manual?.categoryOrder
  if (order === undefined || order.length === 0) return keys
  const position = new Map(order.map((k, idx) => [k, idx]))
  return [...keys].sort((a, b) => {
    const pa = position.get(a)
    const pb = position.get(b)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return 0
  })
}

/**
 * Resolve the category key a workspace renders under, or `undefined` when it
 * is top-level (ungrouped). Precedence: manual override (`null` = forced
 * top-level) → rule classification (hidden rules inert) → top-level.
 */
export function resolveCategory(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  workspaceId: string,
  path: string,
  title: string,
): string | undefined {
  const override = manual?.assignments[workspaceId]
  if (override !== undefined) return override ?? undefined
  const matched = classify(config.categories, path, title)
  if (matched === undefined) return undefined
  if (isHiddenRule(manual, matched.name)) return undefined
  return ruleDisplayName(manual, matched.name)
}

/** Whether a category key is a manual-only group. */
export function isManualOnlyCategory(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  key: string,
): boolean {
  return (manual?.categories.includes(key) ?? false) && !ruleDisplayNames(config.categories, manual).includes(key)
}

/**
 * Names that may not be used for a new/renamed group: reserved labels plus
 * every current category key (explicit or implicit ancestor).
 */
export function takenCategoryNames(config: GroupsConfig, manual: ManualGroups | undefined): Set<string> {
  const taken = new Set<string>(allCategoryKeys(config, manual))
  taken.add(UNCATEGORIZED_LABEL)
  taken.add(TOP_LEVEL_ORDER_KEY)
  return taken
}

/** Order a bucket of workspace ids according to stored per-category order. */
export function orderedWorkspaceIds(
  manual: ManualGroups | undefined,
  categoryKey: string,
  members: readonly string[],
): string[] {
  const stored = manual?.workspaceOrder?.[categoryKey]
  if (stored === undefined || stored.length === 0) return [...members]
  const memberSet = new Set(members)
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const id of stored) {
    if (!memberSet.has(id) || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }
  for (const id of members) {
    if (seen.has(id)) continue
    ordered.push(id)
  }
  return ordered
}

/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
export function moveBefore(list: readonly string[], id: string, beforeId: string | undefined): string[] {
  const rest = list.filter(x => x !== id)
  if (beforeId === undefined) return [...rest, id]
  const index = rest.indexOf(beforeId)
  if (index === -1) return [...rest, id]
  rest.splice(index, 0, id)
  return rest
}

/** Move `id` after `afterId` (undefined = append) within an ordered list. */
export function moveAfter(list: readonly string[], id: string, afterId: string | undefined): string[] {
  const rest = list.filter(x => x !== id)
  if (afterId === undefined) return [...rest, id]
  const index = rest.indexOf(afterId)
  if (index === -1) return [...rest, id]
  rest.splice(index + 1, 0, id)
  return rest
}

function dedupeList(items: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

/** Create a manual category path and materialize any missing ancestor groups. */
export function createCategoryInManual(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  fullPath: string,
): NormalizedManual {
  const base = normalizeManual(manual ?? EMPTY_MANUAL)
  const existingKeys = new Set(allCategoryKeys(config, base))
  const ruleKeys = new Set(ruleDisplayNames(config.categories, base))
  const toAdd = [...ancestorCategoryKeys(fullPath), fullPath]
  const categories = [...base.categories]
  const addedKeys: string[] = []
  for (const key of toAdd) {
    if (!ruleKeys.has(key) && !categories.includes(key)) {
      categories.push(key)
    }
    if (!existingKeys.has(key)) {
      addedKeys.push(key)
    }
  }
  const categoryOrder = base.categoryOrder.length > 0
    ? dedupeList([...base.categoryOrder, ...addedKeys])
    : []
  return { ...base, categories, categoryOrder }
}

/**
 * Rename or reparent `fromKey` to `toKey`, atomically updating `fromKey` and
 * all nested descendants (`fromKey/*` -> `toKey/*`) across every overlay map.
 */
export function renameOrMoveCategoryInManual(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  fromKey: string,
  toKey: string,
): NormalizedManual {
  const base = normalizeManual(manual ?? EMPTY_MANUAL)
  if (fromKey === toKey) return base

  const renamed: Record<string, string> = { ...base.renamed }
  for (const rule of config.categories) {
    if (isHiddenRule(base, rule.name)) continue
    const currentDisplay = ruleDisplayName(base, rule.name)
    if (!isSameOrDescendantCategory(currentDisplay, fromKey)) continue
    const nextDisplay = replaceCategoryPrefix(currentDisplay, fromKey, toKey)
    if (nextDisplay === rule.name) {
      delete renamed[rule.name]
    } else {
      renamed[rule.name] = nextDisplay
    }
  }

  const ruleKeysAfter = new Set<string>()
  for (const rule of config.categories) {
    if (isHiddenRule(base, rule.name)) continue
    ruleKeysAfter.add(renamed[rule.name] ?? rule.name)
  }

  const categories = dedupeList(
    base.categories.map(c => replaceCategoryPrefix(c, fromKey, toKey)),
  )
  for (const anc of ancestorCategoryKeys(toKey)) {
    if (!ruleKeysAfter.has(anc) && !categories.includes(anc)) {
      categories.push(anc)
    }
  }

  const assignments: Record<string, string | null> = {}
  for (const [wsId, cat] of Object.entries(base.assignments)) {
    assignments[wsId] = cat === null ? null : replaceCategoryPrefix(cat, fromKey, toKey)
  }

  const workspaceOrder: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(base.workspaceOrder)) {
    if (key === TOP_LEVEL_ORDER_KEY) {
      workspaceOrder[key] = ids
      continue
    }
    const mapped = replaceCategoryPrefix(key, fromKey, toKey)
    workspaceOrder[mapped] = workspaceOrder[mapped] !== undefined
      ? dedupeList([...workspaceOrder[mapped], ...ids])
      : ids
  }

  const categoryOrder = dedupeList(
    base.categoryOrder.map(key => replaceCategoryPrefix(key, fromKey, toKey)),
  )

  return {
    ...base,
    categories,
    assignments,
    workspaceOrder,
    categoryOrder,
    renamed,
  }
}

/**
 * Delete `targetKey` and all nested subgroups. Workspaces resolved into any
 * deleted group are forced top-level (`null`) so rules do not silently re-group them.
 */
export function deleteCategorySubtreeInManual(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  workspaces: readonly { workspaceId: string; path: string; title: string }[],
  targetKey: string,
): NormalizedManual {
  const base = normalizeManual(manual ?? EMPTY_MANUAL)
  const assignments: Record<string, string | null> = { ...base.assignments }
  for (const ws of workspaces) {
    const resolved = resolveCategory(config, base, ws.workspaceId, ws.path, ws.title)
    if (resolved !== undefined && isSameOrDescendantCategory(resolved, targetKey)) {
      assignments[ws.workspaceId] = null
    }
  }
  for (const [wsId, cat] of Object.entries(assignments)) {
    if (cat !== null && isSameOrDescendantCategory(cat, targetKey)) {
      assignments[wsId] = null
    }
  }

  const renamed = { ...base.renamed }
  const hiddenSet = new Set(base.hidden)
  for (const rule of config.categories) {
    if (isHiddenRule(base, rule.name)) continue
    const currentDisplay = ruleDisplayName(base, rule.name)
    if (isSameOrDescendantCategory(currentDisplay, targetKey)) {
      hiddenSet.add(rule.name)
      delete renamed[rule.name]
    }
  }

  const workspaceOrder: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(base.workspaceOrder)) {
    if (key !== TOP_LEVEL_ORDER_KEY && isSameOrDescendantCategory(key, targetKey)) continue
    workspaceOrder[key] = ids
  }

  return {
    ...base,
    categories: base.categories.filter(c => !isSameOrDescendantCategory(c, targetKey)),
    assignments,
    workspaceOrder,
    categoryOrder: base.categoryOrder.filter(k => !isSameOrDescendantCategory(k, targetKey)),
    renamed,
    hidden: [...hiddenSet],
  }
}

export type ReorderCategoryResult =
  | { ok: true; manual: NormalizedManual; newKey: string; expandedParent?: string }
  | { ok: false; reason: 'noop' | 'cycle' | 'duplicate' }

function insertSubtreeAfterTargetAndDescendants(
  list: readonly string[],
  subtree: readonly string[],
  targetKey: string,
): string[] {
  const targetIdx = list.indexOf(targetKey)
  if (targetIdx === -1) return [...list, ...subtree]
  let insertAt = targetIdx + 1
  while (insertAt < list.length && isSameOrDescendantCategory(list[insertAt] as string, targetKey)) {
    insertAt += 1
  }
  const out = [...list]
  out.splice(insertAt, 0, ...subtree)
  return out
}

/**
 * Reorder or reparent a category subtree relative to `targetKey`.
 * - `'before'` / `'after'`: places `draggedKey` as a sibling before/after `targetKey`
 *   (adopting `parentCategoryKey(targetKey)` as its new parent).
 * - `'into'`: nests `draggedKey` inside `targetKey` (`targetKey/<leaf>`).
 */
export function reorderCategoryInManual(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  draggedKey: string,
  targetKey: string,
  position: 'before' | 'after' | 'into',
): ReorderCategoryResult {
  if (draggedKey === targetKey) return { ok: false, reason: 'noop' }
  if (isSameOrDescendantCategory(targetKey, draggedKey)) return { ok: false, reason: 'cycle' }

  const base = normalizeManual(manual ?? EMPTY_MANUAL)
  const targetParent = position === 'into' ? targetKey : parentCategoryKey(targetKey)
  const leaf = categoryLeafName(draggedKey)
  const newKey = joinCategoryPath(targetParent, leaf)

  if (newKey !== draggedKey) {
    const existingAll = allCategoryKeys(config, base)
    const outsideSet = new Set(existingAll.filter(k => !isSameOrDescendantCategory(k, draggedKey)))
    const movedKeys = existingAll
      .filter(k => isSameOrDescendantCategory(k, draggedKey))
      .map(k => replaceCategoryPrefix(k, draggedKey, newKey))
    if (movedKeys.length === 0) movedKeys.push(newKey)
    for (const candidate of movedKeys) {
      if (outsideSet.has(candidate)) return { ok: false, reason: 'duplicate' }
    }
  }

  let working = newKey !== draggedKey
    ? renameOrMoveCategoryInManual(config, base, draggedKey, newKey)
    : base

  // Ensure any implicit rule parent becomes explicit so categoryOrder validation passes cleanly
  if (targetParent !== undefined) {
    const ruleKeys = new Set(ruleDisplayNames(config.categories, working))
    if (!ruleKeys.has(targetParent) && !working.categories.includes(targetParent)) {
      working = { ...working, categories: [...working.categories, targetParent] }
    }
  }

  const currentOrder = allCategoryKeys(config, working)
  const subtree = currentOrder.filter(k => isSameOrDescendantCategory(k, newKey))
  const rest = currentOrder.filter(k => !isSameOrDescendantCategory(k, newKey))

  let nextOrder: string[]
  if (position === 'before') {
    const targetIdx = rest.indexOf(targetKey)
    if (targetIdx === -1) {
      nextOrder = [...rest, ...subtree]
    } else {
      nextOrder = [...rest]
      nextOrder.splice(targetIdx, 0, ...subtree)
    }
  } else {
    nextOrder = insertSubtreeAfterTargetAndDescendants(rest, subtree, targetKey)
  }

  const nextManual: NormalizedManual = { ...working, categoryOrder: nextOrder }
  return {
    ok: true,
    manual: nextManual,
    newKey,
    ...(targetParent !== undefined ? { expandedParent: targetParent } : {}),
  }
}

/** Move a nested category back to the root level (un-nest). */
export function moveCategoryToRootInManual(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  draggedKey: string,
): ReorderCategoryResult {
  if (parentCategoryKey(draggedKey) === undefined) return { ok: false, reason: 'noop' }
  const base = normalizeManual(manual ?? EMPTY_MANUAL)
  const newKey = categoryLeafName(draggedKey)
  const existingAll = allCategoryKeys(config, base)
  const outsideSet = new Set(existingAll.filter(k => !isSameOrDescendantCategory(k, draggedKey)))
  const movedKeys = existingAll
    .filter(k => isSameOrDescendantCategory(k, draggedKey))
    .map(k => replaceCategoryPrefix(k, draggedKey, newKey))
  if (movedKeys.length === 0) movedKeys.push(newKey)
  for (const candidate of movedKeys) {
    if (outsideSet.has(candidate)) return { ok: false, reason: 'duplicate' }
  }

  const working = renameOrMoveCategoryInManual(config, base, draggedKey, newKey)
  const currentOrder = allCategoryKeys(config, working)
  const subtree = currentOrder.filter(k => isSameOrDescendantCategory(k, newKey))
  const rest = currentOrder.filter(k => !isSameOrDescendantCategory(k, newKey))
  return {
    ok: true,
    manual: { ...working, categoryOrder: [...rest, ...subtree] },
    newKey,
  }
}
