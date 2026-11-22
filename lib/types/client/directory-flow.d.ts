import { type ComponentType } from 'react';
/** Single-occupant directory picker slot owned by the official sidebar workspace browser. */
export declare const DIRECTORY_FLOW_SLOT = "sidebar.workspaces.directoryFlow";
/** Props owned and passed by the sidebar workspace host into the winning directoryFlow occupant. */
export interface DirectoryFlowOwnerProps {
    open: boolean;
    busy: boolean;
    onPicked: (path: string) => void;
    onCancel: () => void;
    onError: (message: string) => void;
}
/** Shape of a live StoredEntry in `sidebar.workspaces.directoryFlow`. */
export interface DirectoryFlowEntry {
    component: ComponentType<Record<string, unknown>>;
    inject?: () => Record<string, unknown>;
    locale?: string;
    options?: {
        priority?: number;
    };
}
/** Read-only slot registry surface needed to observe and render `directoryFlow`. */
export interface DirectoryFlowSlotsLike {
    entriesOfSlot?: (key: string) => readonly unknown[];
    subscribe?: (key: string, listener: () => void) => () => void;
}
/** Locale service surface used when an entry specifies `locale` without injecting `t` itself. */
export interface DirectoryFlowLocaleLike {
    bind?: (namespace: string) => unknown;
}
/** Bridge handed from `apply()` into `GroupsBrowser` via inject props. */
export interface DirectoryFlowBridge {
    getEntry: () => DirectoryFlowEntry | null;
    subscribe: (listener: () => void) => () => void;
    resolveProps: (entry: DirectoryFlowEntry) => Record<string, unknown>;
}
/**
 * Observe and resolve the active occupant of `sidebar.workspaces.directoryFlow`
 * without redeclaring the child slot (owned by the shadowed official browser).
 */
export declare function createDirectoryFlowBridge(slots: DirectoryFlowSlotsLike | undefined, locale: DirectoryFlowLocaleLike | undefined): DirectoryFlowBridge;
/** React hook tracking the current head occupant of `sidebar.workspaces.directoryFlow`. */
export declare function useDirectoryFlowEntry(bridge: DirectoryFlowBridge): DirectoryFlowEntry | null;
/**
 * Mount the winning `sidebar.workspaces.directoryFlow` occupant (such as
 * `@yh4922/dsh-workspace`'s `AddWorkspaceFlow` or official pickers) inside a
 * protective error boundary so a faulty picker never crashes `GroupsBrowser`.
 */
export declare function DirectoryFlowHost({ entry, resolveProps, owner, }: {
    entry: DirectoryFlowEntry | null;
    resolveProps: (entry: DirectoryFlowEntry) => Record<string, unknown>;
    owner: DirectoryFlowOwnerProps;
}): import("react").JSX.Element | null;
