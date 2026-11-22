/**
 * Shared config types and multi-level category path utilities for
 * `@dsh-xhl/workspace-groups`. Pure types & helpers (zero runtime deps) so both
 * the node half and the browser half share identical semantics.
 */
/** One classification rule: any rule that matches places the workspace in the category. */
export interface GroupRule {
    /** Absolute path prefix match (normalized, case-sensitive). */
    pathPrefix?: string;
    /** Case-insensitive substring match against the workspace display title. */
    nameContains?: string;
    /** Case-insensitive substring match against the workspace directory basename. */
    basenameContains?: string;
    /** Exact absolute path match (normalized). */
    pathExact?: string;
}
/** One category folder in the sidebar tree. */
export interface GroupCategory {
    /** Display label or `/` path of the category folder. */
    name: string;
    /** Rules; a workspace is classified here when ANY rule matches. */
    rules: GroupRule[];
}
/** The full sidecar configuration (mirrors workspace-groups.yaml). */
export interface GroupsConfig {
    /** Category folders, in render order. First match wins. */
    categories: GroupCategory[];
    /** Runtime grouping overlay (manual groups + per-workspace overrides). */
    manual?: ManualGroups;
}
/**
 * Runtime-managed grouping overlay: groups created in the sidebar UI plus
 * per-workspace category overrides and user-controlled ordering. Owned by the
 * plugin (JSON sidecar, `$DSH_HOME/workspace-groups.manual.json`).
 */
export interface ManualGroups {
    /** Manually created category folder keys (supports `/` for nested folders). */
    categories: string[];
    /** Per-workspace category override, keyed by workspace id (`null` = top-level). */
    assignments: Record<string, string | null>;
    /** Display order of all category keys (rule display keys + manual keys). */
    categoryOrder?: string[];
    /** Per-category ordered workspace ids. */
    workspaceOrder?: Record<string, string[]>;
    /** Rule category rename/reparent overrides: original YAML rule name → display path key. */
    renamed?: Record<string, string>;
    /** Rule category original names hidden by a UI delete. */
    hidden?: string[];
}
/** Overlay with every optional field materialized. */
export type NormalizedManual = Required<ManualGroups>;
export declare const EMPTY_MANUAL: NormalizedManual;
/** Materialize optional overlay fields so updates are plain object edits. */
export declare function normalizeManual(manual: ManualGroups): NormalizedManual;
/**
 * Legacy label of the fallback bucket. The top-level (ungrouped) concept
 * replaced the rendered "未分类" bucket. The constant survives for data
 * compatibility (reserved name, assignment null marker).
 */
export declare const UNCATEGORIZED_LABEL = "\u672A\u5206\u7C7B";
/** Reserved key under `workspaceOrder` holding the manual order of top-level rows. */
export declare const TOP_LEVEL_ORDER_KEY = "__topLevel__";
/** Canonical separator for nested folder paths (e.g. `Windows主机/MKINSP`). */
export declare const CATEGORY_PATH_SEPARATOR = "/";
/** Normalize a filesystem path for prefix matching: trailing slashes stripped. */
export declare function normalizePath(path: string): string;
/** Split a category key into trimmed segments (preserves empty segments for validation). */
export declare function splitCategoryPath(key: string): string[];
/**
 * Normalize and validate a category path string.
 * Rejects empty input, leading/trailing `/`, empty `//` segments, and reserved
 * segment names (`未分类`, `__topLevel__`).
 */
export declare function normalizeCategoryPath(raw: string): string | null;
/** Parent folder key of a nested category, or `undefined` at root level. */
export declare function parentCategoryKey(key: string): string | undefined;
/** Display leaf name (last segment) of a category path. */
export declare function categoryLeafName(key: string): string;
/** Join an optional parent key and a leaf segment into a canonical path key. */
export declare function joinCategoryPath(parentKey: string | undefined, leafName: string): string;
/** Ancestor keys from outermost root to direct parent (e.g. `A/B/C` -> `['A', 'A/B']`). */
export declare function ancestorCategoryKeys(key: string): string[];
/** True when `candidate` equals `ancestor` or sits strictly inside `ancestor/`. */
export declare function isSameOrDescendantCategory(candidate: string, ancestor: string): boolean;
/** Rewrite `oldPrefix` (and `oldPrefix/...`) to `newPrefix` (and `newPrefix/...`). */
export declare function replaceCategoryPrefix(key: string, oldPrefix: string, newPrefix: string): string;
/** Format a category path as a readable breadcrumb (`A/B` -> `A › B`). */
export declare function formatCategoryBreadcrumb(key: string): string;
