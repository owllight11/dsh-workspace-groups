/**
 * Pure classification, ordering, and multi-level overlay mutations shared by
 * the host half (validation) and the client half (tree derivation & UI actions).
 */
import { type GroupCategory, type GroupsConfig, type ManualGroups, type NormalizedManual } from './types.ts';
/** Classify a workspace by rules only; hidden categories are inert. */
export declare function classify(categories: readonly GroupCategory[], path: string, title: string): GroupCategory | undefined;
/** Display name of a rule category: the rename override when present. */
export declare function ruleDisplayName(manual: ManualGroups | undefined, originalName: string): string;
/** Whether a rule category has been hidden by a UI delete. */
export declare function isHiddenRule(manual: ManualGroups | undefined, originalName: string): boolean;
/** Rule category display names, in YAML render order (hidden ones excluded). */
export declare function ruleDisplayNames(categories: readonly GroupCategory[], manual: ManualGroups | undefined): string[];
/** Original YAML rule name whose display name equals `key` (undefined when none). */
export declare function originalRuleNameForDisplay(categories: readonly GroupCategory[], manual: ManualGroups | undefined, key: string): string | undefined;
/** Effective category entry in display order. */
export interface EffectiveCategory {
    /** Display path key (what the tree renders and assignments reference). */
    key: string;
    /** Origin: a YAML rule category or a manual group. */
    source: 'rule' | 'manual';
}
export declare function effectiveCategories(config: GroupsConfig, manual: ManualGroups | undefined): EffectiveCategory[];
/** Display keys of all explicit effective categories (top-level workspaces excluded). */
export declare function displayCategoryKeys(config: GroupsConfig, manual: ManualGroups | undefined): string[];
/**
 * All category keys including any implicit ancestor paths derived from `/` keys,
 * deduplicated with ancestors materialized before their first descendant.
 * Respects `manual.categoryOrder` when ancestors also appear in it.
 */
export declare function allCategoryKeys(config: GroupsConfig, manual: ManualGroups | undefined): string[];
/**
 * Resolve the category key a workspace renders under, or `undefined` when it
 * is top-level (ungrouped). Precedence: manual override (`null` = forced
 * top-level) → rule classification (hidden rules inert) → top-level.
 */
export declare function resolveCategory(config: GroupsConfig, manual: ManualGroups | undefined, workspaceId: string, path: string, title: string): string | undefined;
/** Whether a category key is a manual-only group. */
export declare function isManualOnlyCategory(config: GroupsConfig, manual: ManualGroups | undefined, key: string): boolean;
/**
 * Names that may not be used for a new/renamed group: reserved labels plus
 * every current category key (explicit or implicit ancestor).
 */
export declare function takenCategoryNames(config: GroupsConfig, manual: ManualGroups | undefined): Set<string>;
/** Order a bucket of workspace ids according to stored per-category order. */
export declare function orderedWorkspaceIds(manual: ManualGroups | undefined, categoryKey: string, members: readonly string[]): string[];
/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
export declare function moveBefore(list: readonly string[], id: string, beforeId: string | undefined): string[];
/** Move `id` after `afterId` (undefined = append) within an ordered list. */
export declare function moveAfter(list: readonly string[], id: string, afterId: string | undefined): string[];
/** Create a manual category path and materialize any missing ancestor groups. */
export declare function createCategoryInManual(config: GroupsConfig, manual: ManualGroups | undefined, fullPath: string): NormalizedManual;
/**
 * Rename or reparent `fromKey` to `toKey`, atomically updating `fromKey` and
 * all nested descendants (`fromKey/*` -> `toKey/*`) across every overlay map.
 */
export declare function renameOrMoveCategoryInManual(config: GroupsConfig, manual: ManualGroups | undefined, fromKey: string, toKey: string): NormalizedManual;
/**
 * Delete `targetKey` and all nested subgroups. Workspaces resolved into any
 * deleted group are forced top-level (`null`) so rules do not silently re-group them.
 */
export declare function deleteCategorySubtreeInManual(config: GroupsConfig, manual: ManualGroups | undefined, workspaces: readonly {
    workspaceId: string;
    path: string;
    title: string;
}[], targetKey: string): NormalizedManual;
export type ReorderCategoryResult = {
    ok: true;
    manual: NormalizedManual;
    newKey: string;
    expandedParent?: string;
} | {
    ok: false;
    reason: 'noop' | 'cycle' | 'duplicate';
};
/**
 * Reorder or reparent a category subtree relative to `targetKey`.
 * - `'before'` / `'after'`: places `draggedKey` as a sibling before/after `targetKey`
 *   (adopting `parentCategoryKey(targetKey)` as its new parent).
 * - `'into'`: nests `draggedKey` inside `targetKey` (`targetKey/<leaf>`).
 */
export declare function reorderCategoryInManual(config: GroupsConfig, manual: ManualGroups | undefined, draggedKey: string, targetKey: string, position: 'before' | 'after' | 'into'): ReorderCategoryResult;
/** Move a nested category back to the root level (un-nest). */
export declare function moveCategoryToRootInManual(config: GroupsConfig, manual: ManualGroups | undefined, draggedKey: string): ReorderCategoryResult;
