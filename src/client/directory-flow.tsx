import { Component, useSyncExternalStore, type ComponentType, type ErrorInfo, type ReactNode } from 'react'

/** Single-occupant directory picker slot owned by the official sidebar workspace browser. */
export const DIRECTORY_FLOW_SLOT = 'sidebar.workspaces.directoryFlow'

/** Props owned and passed by the sidebar workspace host into the winning directoryFlow occupant. */
export interface DirectoryFlowOwnerProps {
  open: boolean
  busy: boolean
  onPicked: (path: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

/** Shape of a live StoredEntry in `sidebar.workspaces.directoryFlow`. */
export interface DirectoryFlowEntry {
  component: ComponentType<Record<string, unknown>>
  inject?: () => Record<string, unknown>
  locale?: string
  options?: { priority?: number }
}

/** Read-only slot registry surface needed to observe and render `directoryFlow`. */
export interface DirectoryFlowSlotsLike {
  entriesOfSlot?: (key: string) => readonly unknown[]
  subscribe?: (key: string, listener: () => void) => () => void
}

/** Locale service surface used when an entry specifies `locale` without injecting `t` itself. */
export interface DirectoryFlowLocaleLike {
  bind?: (namespace: string) => unknown
}

/** Bridge handed from `apply()` into `GroupsBrowser` via inject props. */
export interface DirectoryFlowBridge {
  getEntry: () => DirectoryFlowEntry | null
  subscribe: (listener: () => void) => () => void
  resolveProps: (entry: DirectoryFlowEntry) => Record<string, unknown>
}

function isDirectoryFlowEntry(value: unknown): value is DirectoryFlowEntry {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { component?: unknown }
  return typeof candidate.component === 'function'
}

function normalizeInjectedRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {}
  return value as Record<string, unknown>
}

/**
 * Observe and resolve the active occupant of `sidebar.workspaces.directoryFlow`
 * without redeclaring the child slot (owned by the shadowed official browser).
 */
export function createDirectoryFlowBridge(
  slots: DirectoryFlowSlotsLike | undefined,
  locale: DirectoryFlowLocaleLike | undefined,
): DirectoryFlowBridge {
  const injectCache = new WeakMap<DirectoryFlowEntry, Record<string, unknown>>()

  const getEntry = (): DirectoryFlowEntry | null => {
    const head = slots?.entriesOfSlot?.(DIRECTORY_FLOW_SLOT)?.[0]
    return isDirectoryFlowEntry(head) ? head : null
  }

  const subscribe = (listener: () => void): (() => void) => {
    return slots?.subscribe?.(DIRECTORY_FLOW_SLOT, listener) ?? (() => {})
  }

  const resolveProps = (entry: DirectoryFlowEntry): Record<string, unknown> => {
    let injected = injectCache.get(entry)
    if (injected === undefined) {
      injected = typeof entry.inject === 'function' ? normalizeInjectedRecord(entry.inject()) : {}
      injectCache.set(entry, injected)
    }
    if (
      typeof entry.locale === 'string'
      && entry.locale !== ''
      && typeof locale?.bind === 'function'
      && !('t' in injected)
    ) {
      return { t: locale.bind(entry.locale), ...injected }
    }
    return injected
  }

  return { getEntry, subscribe, resolveProps }
}

/** React hook tracking the current head occupant of `sidebar.workspaces.directoryFlow`. */
export function useDirectoryFlowEntry(bridge: DirectoryFlowBridge): DirectoryFlowEntry | null {
  return useSyncExternalStore(bridge.subscribe, bridge.getEntry, bridge.getEntry)
}

const entryKeyIds = new WeakMap<DirectoryFlowEntry, number>()
let nextEntryKeyId = 1

function getEntryKey(entry: DirectoryFlowEntry): number {
  const existing = entryKeyIds.get(entry)
  if (existing !== undefined) return existing
  const allocated = nextEntryKeyId
  nextEntryKeyId += 1
  entryKeyIds.set(entry, allocated)
  return allocated
}

interface BoundaryProps {
  onError: (message: string) => void
  children: ReactNode
}

interface BoundaryState {
  failed: boolean
}

class DirectoryFlowErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error instanceof Error ? error.message : String(error))
  }

  override render(): ReactNode {
    if (this.state.failed) return null
    return this.props.children
  }
}

function DirectoryFlowInner({
  entry,
  resolveProps,
  owner,
}: {
  entry: DirectoryFlowEntry
  resolveProps: (entry: DirectoryFlowEntry) => Record<string, unknown>
  owner: DirectoryFlowOwnerProps
}) {
  const injected = resolveProps(entry)
  const FlowComponent = entry.component
  return (
    <FlowComponent
      {...injected}
      open={owner.open}
      busy={owner.busy}
      onPicked={owner.onPicked}
      onCancel={owner.onCancel}
      onError={owner.onError}
    />
  )
}

/**
 * Mount the winning `sidebar.workspaces.directoryFlow` occupant (such as
 * `@yh4922/dsh-workspace`'s `AddWorkspaceFlow` or official pickers) inside a
 * protective error boundary so a faulty picker never crashes `GroupsBrowser`.
 */
export function DirectoryFlowHost({
  entry,
  resolveProps,
  owner,
}: {
  entry: DirectoryFlowEntry | null
  resolveProps: (entry: DirectoryFlowEntry) => Record<string, unknown>
  owner: DirectoryFlowOwnerProps
}) {
  if (entry === null) return null
  const key = getEntryKey(entry)
  return (
    <DirectoryFlowErrorBoundary key={`eb-${key}`} onError={owner.onError}>
      <DirectoryFlowInner key={`in-${key}`} entry={entry} resolveProps={resolveProps} owner={owner} />
    </DirectoryFlowErrorBoundary>
  )
}
