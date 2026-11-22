/** One persisted tab. */
export interface PersistedTab {
    readonly sessionId: string;
    readonly order: number;
}
/** The persisted document. */
export interface TabsDocument {
    readonly version: 1;
    readonly order: number;
    readonly tabs: readonly PersistedTab[];
}
/** Default location: `$DSH_HOME/workspace-groups.tabs.json`. */
export declare function defaultTabsPath(): string;
/** Parse + shape-validate a tabs document. */
export declare function parseTabsDocument(raw: unknown): TabsDocument | null;
/** Read the tabs document. */
export declare function readTabsDocument(path: string): Promise<TabsDocument | null>;
/** Write the tabs document atomically. */
export declare function writeTabsDocument(path: string, document: TabsDocument): Promise<void>;
/** Build the document to persist. */
export declare function documentForTabs(state: {
    order: number;
    tabs: readonly PersistedTab[];
}): TabsDocument;
