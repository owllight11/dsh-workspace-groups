import { type ManualGroups } from './core/types.ts';
/** Default overlay location: `$DSH_HOME/workspace-groups.manual.json`. */
export declare function defaultManualPath(): string;
/**
 * Parse + shape-validate a raw overlay document into a ManualGroups.
 */
export declare function parseManualGroups(raw: unknown): ManualGroups;
/**
 * Cross-validate a parsed overlay against the current rule categories (write boundary only).
 */
export declare function validateManualGroups(manual: ManualGroups, ruleCategoryNames: readonly string[]): void;
/** Read + parse the overlay file. A missing file yields an empty overlay. */
export declare function readManualGroups(path: string): Promise<ManualGroups>;
/** Atomically replace the overlay file (temp file + fsync + rename). */
export declare function writeManualGroups(path: string, manual: ManualGroups): Promise<void>;
