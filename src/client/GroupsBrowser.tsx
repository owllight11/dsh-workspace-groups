/**
 * The workspace-groups browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + right-aligned search +
 * new-group + add workspace), the three-level tree (category → workspace →
 * session), group management dialogs, and the workspace/session dialogs. Wide
 * state renders the full browser; rail state renders the two region icons
 * (search / add workspace) as 36px controls on the shell's shared rail entry
 * path, each requesting expansion through the owner share.
 *
 * Data: workspaces/sessions via the framework global hooks; grouping config
 * via the host half's `/workspace-groups/config` route (refetched on mount).
 * Runtime group management (create/rename/delete any group, drag workspaces
 * between groups and into position, drag groups into position) persists
 * through `PUT /workspace-groups/manual`; the sidecar YAML is never rewritten
 * (rule-group rename/delete ride the overlay `renamed`/`hidden` maps).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import {
  Button,
  IconCloseFillMedium,
  IconFolderOpenOutlineRegular,
  IconProjectAddOutlineRegular,
  IconSearchOutlineRegular,
  IconWarningOutlineRegular,
  Modal,
  Toast,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState, SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import {
  allCategoryKeys,
  createCategoryInManual,
  deleteCategorySubtreeInManual,
  moveAfter,
  moveBefore,
  moveCategoryToRootInManual,
  renameOrMoveCategoryInManual,
  reorderCategoryInManual,
  resolveCategory,
  takenCategoryNames,
} from '../core/matcher.ts'
import {
  ancestorCategoryKeys,
  categoryLeafName,
  EMPTY_MANUAL,
  formatCategoryBreadcrumb,
  isSameOrDescendantCategory,
  joinCategoryPath,
  normalizeCategoryPath,
  normalizeManual,
  parentCategoryKey,
  replaceCategoryPrefix,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type GroupsConfig,
  type ManualGroups,
  type NormalizedManual,
} from '../core/types.ts'
import type { GroupsBrowserProps } from './contract.ts'
import { deriveGroups, deriveSearchGroups, deriveSearchMatches, deriveTopLevel, currentSessionId, UNCATEGORIZED_KEY, type CategoryNode, type WorkspaceGroupNode } from './tree.ts'
import { CategoryRow, DND_CATEGORY_TYPE, DND_WORKSPACE_TYPE, hasPluginDragType, SessionRow, TreeChildren, WorkspaceRow } from './rows.tsx'
import { fetchOpenInApps, folderAppId, openPathInApp } from './open-folder.ts'
import { QuickPanel } from './QuickPanel.tsx'
import { SessionTabs } from './SessionTabs.tsx'
import { FlowerBranch } from './FlowerBranch.tsx'
import { DirectoryFlowHost, useDirectoryFlowEntry } from './directory-flow.tsx'
import css from './styles.css?inline'

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_QUERY_MAX_CODE_UNITS = 500
const SPRING_EXPAND_DELAY_MS = 550

function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  return withoutNul.slice(0, SEARCH_QUERY_MAX_CODE_UNITS)
}

/** Immutable membership toggle for the local expand-all array. */
function toggled(list: readonly string[], key: string): string[] {
  return list.includes(key) ? list.filter(k => k !== key) : [...list, key]
}

interface RemoteSearchState {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: readonly SessionSearchResultItem[]
  hasMore: boolean
}

/** Light runtime guard for the manual overlay attached to the config fetch. */
function isManualGroups(value: unknown): value is ManualGroups {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { categories?: unknown; assignments?: unknown }
  return Array.isArray(candidate.categories) && typeof candidate.assignments === 'object' && candidate.assignments !== null
}

/** Minimal fetch of the grouping config + runtime overlay (no-cache revalidation). */
async function fetchGroupsConfig(): Promise<{ config: GroupsConfig; manual: NormalizedManual }> {
  const response = await fetch('/workspace-groups/config', { cache: 'no-cache' })
  if (!response.ok) throw new Error(`config request failed: ${response.status}`)
  const body = (await response.json()) as GroupsConfig
  const config: GroupsConfig = Array.isArray(body.categories) ? body : { categories: [] }
  return { config, manual: isManualGroups(body.manual) ? normalizeManual(body.manual) : EMPTY_MANUAL }
}

/** Persist the whole runtime overlay (idempotent; the host validates + writes). */
async function saveManualOverlay(manual: ManualGroups): Promise<void> {
  const response = await fetch('/workspace-groups/manual', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manual),
  })
  if (!response.ok) {
    let message = `manual save failed: ${response.status}`
    try {
      const text = await response.text()
      if (text !== '') message = text
    } catch { /* keep the fallback message */ }
    throw new Error(message)
  }
}

/** One group-management dialog state: create (optionally nested), or rename an existing group. */
type GroupDialogState = { mode: 'create'; parentKey?: string } | { mode: 'rename'; from: string } | null

/** Row reference used by drop targets: which kind of row, which key. */
export type DropRowRef = { kind: 'category' | 'workspace' | 'topLevel'; key: string }

/**
 * Which level's rows fold while a drag is in progress: dragging a project
 * folds every project row (grouped AND top-level), dragging a group folds
 * every group row. The other level keeps its expansion untouched.
 */
export type DragLevel = 'workspace' | 'category' | null

/**
 * Current drop indicator. A `line` renders a 2px insertion line above/below a
 * row (project reorder inside a group, or group reorder); an `into` renders
 * the whole-row highlight used when dropping a project into a group. Drop
 * handlers re-derive before/after from the drop event itself, so the
 * indicator is purely visual and can never go stale.
 */
export type DragIndicator =
  | { mode: 'line'; row: DropRowRef; before: boolean }
  | { mode: 'into'; categoryKey: string }
  | null

/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export function GroupsBrowser({
  wide,
  expandSidebar,
  useSessions,
  useWorkspaces,
  useSessionStatus,
  useStore,
  actions,
  startSession,
  open,
  renameSession,
  forkSession,
  renameWorkspace,
  deleteWorkspace,
  insertWorkspaceBefore,
  archiveSession,
  insertSessionBefore,
  createWorkspace,
  pickDirectory,
  directoryFlow,
  searchSessions,
  searchResultLimit,
  openTab,
  useTabs,
  tabActions,
  t,
}: GroupsBrowserProps) {
  // Inject the stylesheet once per fiber; dispose removes it (HMR safe).
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-plugin', 'dsh-workspace-groups')
    style.textContent = css
    document.head.append(style)
    return () => { style.remove() }
  }, [])

  // Ctrl+R toggles the quick switch panel. Capture phase + preventDefault:
  // beats the browser's page-reload default and any shell-level handler.
  const [quickOpen, setQuickOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        e.stopPropagation()
        setQuickOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Grouping config from the host route + the runtime manual overlay.
  const [config, setConfig] = useState<GroupsConfig>({ categories: [] })
  const [manual, setManual] = useState<NormalizedManual>(EMPTY_MANUAL)
  const [configError, setConfigError] = useState<string | null>(null)
  const reloadConfig = () => {
    setConfigError(null)
    fetchGroupsConfig().then(({ config: nextConfig, manual: nextManual }) => {
      setConfig(nextConfig)
      setManual(nextManual)
    }).catch((reason: unknown) => {
      setConfigError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  useEffect(() => { reloadConfig() }, [])

  // Transient save errors for drag/menu group operations (dialog errors are local).
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSaving, setManualSaving] = useState(false)

  const workspaces = useWorkspaces(state => state.items)
  const workspacePhase = useWorkspaces(state => state.phase)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const categoryExpansion = useStore(s => s.categoryExpansion)
  const workspaceExpansion = useStore(s => s.workspaceExpansion)

  const list = useSessions(s => s)
  const statuses = useSessionStatus(s => s)
  // 0.1.6: the selected Session is the one retained through `mainView`, not a
  // `list.current` field (the list snapshot carries catalog facts only).
  const current = currentSessionId(list)
  const currentWorkspaceKey = current === undefined
    ? undefined
    : (workspaces.find(w => w.sessionIds.includes(current as SessionId))?.workspaceId as string | undefined)

  // Whether the open session is WORKING right now, which is what makes the
  // flower at the branch's endpoint turn. Read from the unified status snapshot
  // (the catalog summary alone goes stale), folded together with the session's
  // own `running` so a subagent-only turn still counts.
  //
  // Derived as a boolean on purpose: the overlay re-measures through its own
  // MutationObserver, so handing it a live value would re-render the tree on
  // every status tick.
  const currentRunning = current !== undefined
    && ((statuses.get(current)?.running ?? false) || (list.byId[current]?.running ?? false))

  // Auto-expand the category + workspace containing the current session, but
  // ONLY when the user has never touched that key (`Object.hasOwn`): a
  // present `false` is a deliberate collapse and must stay folded. Without
  // this guard the effect re-expands the just-collapsed current category on
  // every store change (the reported "cannot collapse" bug).
  useEffect(() => {
    if (current === undefined || currentWorkspaceKey === undefined) return
    const category = categoriesForCurrent(config, workspaces, current, manual)
    if (category !== undefined) {
      for (const key of [...ancestorCategoryKeys(category), category]) {
        if (!Object.hasOwn(categoryExpansion, key)) {
          actions.setCategoryExpanded(key, true)
        }
      }
    }
    if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) {
      actions.setWorkspaceExpanded(currentWorkspaceKey, true)
    }
  }, [current, currentWorkspaceKey, config, workspaces, manual, categoryExpansion, workspaceExpansion, actions])

  // Drop expansion keys that no longer exist (group edits / workspace deletion).
  useEffect(() => {
    if (workspacePhase !== 'ready') return
    actions.retainKeys(
      allCategoryKeys(config, manual),
      workspaces.map(w => w.workspaceId as string),
    )
  }, [actions, config, manual, workspacePhase, workspaces])

  // Session tabs: the strip lives in the conversation column, but its lifecycle
  // belongs here — the browser already derives the open session for its own tree,
  // so one effect covers every way a session can be opened (sidebar row,
  // workspace New Session, quick panel, conversation-header crumbs).
  //
  // `statuses` is a dependency on purpose: a session earns its tab when it
  // STARTS working, which is a status change, not a catalog change. Without it a
  // conversation that began while already open would never surface a tab.
  useEffect(() => {
    if (current === undefined) return
    openTab(current, statuses.get(current))
  }, [current, list, statuses, openTab])

  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const normalizedQuery = sanitizeSearchQuery(query).trim()
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState>({
    query: '', status: 'idle', items: [], hasMore: false,
  })
  const searchInput = useRef<HTMLInputElement | null>(null)
  const searchRoot = useRef<HTMLDivElement | null>(null)
  // Box the flower branch measures and paints into. Held as a ref (not state)
  // because the overlay re-measures on its own MutationObserver; a state update
  // here would re-render the whole tree on every layout tick.
  const branchScope = useRef<HTMLDivElement | null>(null)

  // Search debounce + abort, same posture as the official browser.
  useEffect(() => {
    if (normalizedQuery === '') {
      setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemoteSearch({ query: normalizedQuery, status: 'loading', items: [], hasMore: false })
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setRemoteSearch({ query: normalizedQuery, status: 'ready', items: result.items, hasMore: result.hasMore })
      }).catch(() => {
        if (controller.signal.aborted) return
        setRemoteSearch({ query: normalizedQuery, status: 'error', items: [], hasMore: false })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, searchSessions])

  // Outside-click dismissal of the search box.
  useEffect(() => {
    if (!wide || !searchExpanded) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return
      searchInput.current?.blur()
      if (normalizedQuery !== '') return
      setSearchExpanded(false)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick) }
  }, [normalizedQuery, wide, searchExpanded])

  const expandedCategories = useMemo(
    () => Object.entries(categoryExpansion).filter(([, v]) => v).map(([k]) => k),
    [categoryExpansion],
  )
  const expandedWorkspaces = useMemo(
    () => Object.entries(workspaceExpansion).filter(([, v]) => v).map(([k]) => k),
    [workspaceExpansion],
  )
  // Which level is being dragged: drives the top-level drop target (project
  // drags only) and which level's rows fold.
  const [dragging, setDragging] = useState<DragLevel>(null)
  const [draggingNestedCategory, setDraggingNestedCategory] = useState(false)
  const groups = useMemo(
    () => deriveGroups(list, workspaces, archivedSessionIds, config, {
      expandedCategories,
      expandedWorkspaces,
    }, manual, statuses),
    [list, workspaces, archivedSessionIds, config, manual, statuses, expandedCategories, expandedWorkspaces],
  )
  // Top-level (ungrouped) workspace rows, rendered after the group folders.
  const topLevel = useMemo(
    () => deriveTopLevel(list, workspaces, archivedSessionIds, config, {
      expandedCategories,
      expandedWorkspaces,
    }, manual, statuses),
    [list, workspaces, archivedSessionIds, config, manual, statuses, expandedCategories, expandedWorkspaces],
  )
  // Quick panel (Ctrl+R): formatted category breadcrumb per grouped workspace id.
  const categoryByWorkspace = useMemo(() => {
    const map = new Map<string, string>()
    const visit = (nodes: readonly CategoryNode[]): void => {
      for (const category of nodes) {
        const breadcrumb = formatCategoryBreadcrumb(category.key)
        for (const workspace of category.workspaces) {
          map.set(workspace.workspaceId as string, breadcrumb)
        }
        visit(category.children)
      }
    }
    visit(groups)
    return map
  }, [groups])
  // While dragging a project (or a nested subgroup), an empty top-level area
  // still shows a landing line so items can always be moved out to root.
  const topLevelDropActive =
    topLevel.length === 0
    && (dragging === 'workspace' || (dragging === 'category' && draggingNestedCategory))
  // The top-level area is the move-out landing spot: rows reorder with an
  // insertion line (before/after), and the blank space below the last row
  // appends to the end of the list. No whole-area highlight box.
  const topLevelRef: DropRowRef = { kind: 'topLevel', key: UNCATEGORIZED_KEY }

  // Add workspace flow: delegate to the winning `sidebar.workspaces.directoryFlow`
  // occupant when present (supporting `@yh4922/dsh-workspace` and official pickers),
  // falling back to `pickDirectory()` otherwise.
  const directoryFlowEntry = useDirectoryFlowEntry(directoryFlow)
  const [flowOpen, setFlowOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addErrorOpen, setAddErrorOpen] = useState(false)

  useEffect(() => {
    if (flowOpen && directoryFlowEntry === null) {
      setFlowOpen(false)
    }
  }, [flowOpen, directoryFlowEntry])

  const adoptPickedDirectory = async (path: string): Promise<void> => {
    setAdding(true)
    setAddError(null)
    setAddErrorOpen(false)
    try {
      const workspace = await createWorkspace({ path })
      setFlowOpen(false)
      startSession(workspace.workspaceId)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setFlowOpen(false)
      setAddError(message)
      setAddErrorOpen(true)
    } finally {
      setAdding(false)
    }
  }

  const addWorkspace = async (): Promise<void> => {
    if (adding || flowOpen) return
    setAddError(null)
    setAddErrorOpen(false)
    if (directoryFlowEntry !== null) {
      setFlowOpen(true)
      return
    }
    setAdding(true)
    try {
      const path = await pickDirectory()
      if (path === null) return // cancelled
      const workspace = await createWorkspace({ path })
      startSession(workspace.workspaceId)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setAddError(message)
      setAddErrorOpen(true)
    } finally {
      setAdding(false)
    }
  }

  // Workspace rename dialog.
  const [renameTarget, setRenameTarget] = useState<{ workspaceId: WorkspaceId; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameTrimmed = renameDraft.trim()
  const renameDuplicate = renameTarget !== null && renameTrimmed !== '' && renameTrimmed !== renameTarget.currentTitle
    && workspaces.some(w => w.title === renameTrimmed)
  const renameBlocked = renaming || renameTrimmed === '' || renameTarget === null
    || renameTrimmed === renameTarget.currentTitle || renameDuplicate
  const confirmRename = () => {
    if (renameBlocked || renameTarget === null) return
    setRenaming(true)
    setRenameError(null)
    renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Workspace delete dialog.
  const [deleteTarget, setDeleteTarget] = useState<{ workspaceId: WorkspaceId; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const confirmDelete = () => {
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteError(null)
    deleteWorkspace(deleteTarget.workspaceId).then(() => {
      setDeleting(false)
      setDeleteTarget(null)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Session rename dialog.
  const [sessionRenameTarget, setSessionRenameTarget] = useState<{ sessionId: SessionId; currentTitle: string } | null>(null)
  const [sessionRenameDraft, setSessionRenameDraft] = useState('')
  const [sessionRenaming, setSessionRenaming] = useState(false)
  const [sessionRenameError, setSessionRenameError] = useState<string | null>(null)
  const sessionRenameTrimmed = sessionRenameDraft.trim()
  const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === '' || sessionRenameTarget === null
  const confirmSessionRename = () => {
    if (sessionRenameBlocked || sessionRenameTarget === null) return
    setSessionRenaming(true)
    setSessionRenameError(null)
    renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
      setSessionRenaming(false)
      setSessionRenameTarget(null)
    }).catch((reason: unknown) => {
      setSessionRenaming(false)
      setSessionRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const onSessionRename = (sessionId: SessionId, currentTitle: string) => {
    setSessionRenameTarget({ sessionId, currentTitle })
    setSessionRenameDraft(currentTitle)
    setSessionRenameError(null)
  }

  // The strip is a child of this component (rendered through a DOM portal), so
  // it shares this fiber's props directly: renames call the dialog owner here,
  // and activation goes through the same navigation verb the sidebar rows use.
  const activateTab = (sessionId: SessionId) => { open(sessionId) }

  const onSessionArchive = (sessionId: SessionId) => {
    archiveSession(sessionId).catch((reason: unknown) => {
      console.warn('session archive rejected:', reason)
    })
  }

  // "Open in folder": the host half of the official open-in-app plugin resolves
  // which applications it can launch; the project row then just posts the
  // project directory to that host's launch route. One availability read per
  // mount — a host without the capability (or a refused read) leaves
  // `folderApp` undefined, which drops the menu entry rather than failing.
  const [folderApp, setFolderApp] = useState<string | undefined>(undefined)
  const [folderError, setFolderError] = useState<{ id: number; text: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchOpenInApps(controller.signal).then((apps) => {
      if (controller.signal.aborted) return
      setFolderApp(folderAppId(apps))
    }).catch(() => { /* no capability: the row simply offers no folder entry */ })
    return () => { controller.abort() }
  }, [])

  const openInFolder = folderApp === undefined
    ? undefined
    : (workspaceId: WorkspaceId): void => {
        const workspace = workspaces.find(w => w.workspaceId === workspaceId)
        if (workspace === undefined) return
        openPathInApp(folderApp, workspace.path).catch((reason: unknown) => {
          const detail = reason instanceof Error ? reason.message : String(reason)
          setFolderError({ id: Date.now(), text: `${t('workspace.openInFolderError')}: ${detail}` })
        })
      }

  // ---- Runtime group management ----------------------------------------------

  const [groupDialog, setGroupDialog] = useState<GroupDialogState>(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupBusy, setGroupBusy] = useState(false)
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<string | null>(null)
  const [groupDeleting, setGroupDeleting] = useState(false)
  const [groupDeleteError, setGroupDeleteError] = useState<string | null>(null)

  const takenNames = useMemo(() => takenCategoryNames(config, manual), [config, manual])

  const groupTrimmed = groupDraft.trim()
  const groupParentKey = groupDialog === null
    ? undefined
    : groupDialog.mode === 'create'
      ? groupDialog.parentKey
      : parentCategoryKey(groupDialog.from)
  const candidateNormalizedPath = groupDialog !== null && groupTrimmed !== ''
    ? normalizeCategoryPath(joinCategoryPath(groupParentKey, groupTrimmed))
    : null
  const groupNameIssue = groupDialog !== null && groupTrimmed !== ''
    ? (groupTrimmed === UNCATEGORIZED_LABEL
        ? t('group.nameReserved')
        : candidateNormalizedPath === null
          ? t('group.nameInvalid')
          : (groupDialog.mode === 'rename' && candidateNormalizedPath === groupDialog.from)
            ? null
            : (groupDialog.mode === 'rename' && isSameOrDescendantCategory(candidateNormalizedPath, groupDialog.from))
              ? t('group.nameCycle')
              : takenNames.has(candidateNormalizedPath)
                ? t('group.nameDuplicate')
                : null)
    : null
  const groupBlocked = groupBusy || groupTrimmed === '' || candidateNormalizedPath === null || groupNameIssue !== null
    || (groupDialog !== null && groupDialog.mode === 'rename' && candidateNormalizedPath === groupDialog.from)

  const confirmGroupDialog = () => {
    if (groupBlocked || groupDialog === null || candidateNormalizedPath === null) return
    const nextPath = candidateNormalizedPath
    const from = groupDialog.mode === 'rename' ? groupDialog.from : undefined
    const renaming = groupDialog.mode === 'rename' && from !== undefined && from !== nextPath

    const next = groupDialog.mode === 'create'
      ? createCategoryInManual(config, manual, nextPath)
      : renameOrMoveCategoryInManual(config, manual, from as string, nextPath)

    setGroupBusy(true)
    setGroupError(null)
    saveManualOverlay(next).then(() => {
      setManual(next)
      setManualError(null)
      setGroupBusy(false)
      setGroupDialog(null)
      setGroupDraft('')
      if (groupDialog.mode === 'create') {
        for (const key of ancestorCategoryKeys(nextPath)) {
          actions.setCategoryExpanded(key, true)
        }
        actions.setCategoryExpanded(nextPath, true)
      } else if (renaming && from !== undefined) {
        for (const [key, expanded] of Object.entries(categoryExpansion)) {
          if (expanded && isSameOrDescendantCategory(key, from)) {
            actions.setCategoryExpanded(replaceCategoryPrefix(key, from, nextPath), true)
          }
        }
        actions.setCategoryExpanded(nextPath, true)
      }
    }).catch((reason: unknown) => {
      setGroupBusy(false)
      setGroupError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const groupDeleteHasSubgroups = useMemo(() => {
    if (groupDeleteTarget === null) return false
    return allCategoryKeys(config, manual).some(
      k => k !== groupDeleteTarget && isSameOrDescendantCategory(k, groupDeleteTarget),
    )
  }, [config, manual, groupDeleteTarget])

  const confirmGroupDelete = () => {
    if (groupDeleting || groupDeleteTarget === null) return
    const next = deleteCategorySubtreeInManual(config, manual, workspaces, groupDeleteTarget)

    setGroupDeleting(true)
    setGroupDeleteError(null)
    saveManualOverlay(next).then(() => {
      setManual(next)
      setManualError(null)
      setGroupDeleting(false)
      setGroupDeleteTarget(null)
    }).catch((reason: unknown) => {
      setGroupDeleting(false)
      setGroupDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // ---- Drag & drop (move/reorder workspaces, reorder/nest groups) ------------

  const [dragIndicator, setDragIndicator] = useState<DragIndicator>(null)
  // `dataTransfer.getData()` is unreadable during `dragover`, so track the
  // currently dragged category key in a ref for live cycle/nest checks.
  const draggedCategoryRef = useRef<string | null>(null)
  const springExpandTimerRef = useRef<number | null>(null)
  const springTargetKeyRef = useRef<string | null>(null)

  const clearSpringExpand = (): void => {
    if (springExpandTimerRef.current !== null) {
      window.clearTimeout(springExpandTimerRef.current)
      springExpandTimerRef.current = null
    }
    springTargetKeyRef.current = null
  }

  // Expansion state taken at dragstart; dragend restores it so the folding
  // caused by a drag is always undone afterwards ("结束后恢复").
  const expansionSnapshot = useRef<{ categories: Record<string, boolean>; workspaces: Record<string, boolean> } | null>(null)
  // Live expansion state for the dragend restore (the document-level listener
  // is registered once, so it must read current values through a ref).
  const liveExpansionRef = useRef({ categoryExpansion, workspaceExpansion, actions })
  liveExpansionRef.current = { categoryExpansion, workspaceExpansion, actions }

  const scheduleSpringExpand = (key: string): void => {
    if (springTargetKeyRef.current === key) return
    clearSpringExpand()
    if (liveExpansionRef.current.categoryExpansion[key] === true) return
    springTargetKeyRef.current = key
    springExpandTimerRef.current = window.setTimeout(() => {
      springExpandTimerRef.current = null
      springTargetKeyRef.current = null
      liveExpansionRef.current.actions.setCategoryExpanded(key, true)
    }, SPRING_EXPAND_DELAY_MS)
  }

  const preserveExpandedAfterDrag = (key: string): void => {
    if (expansionSnapshot.current !== null) {
      expansionSnapshot.current.categories[key] = true
    }
    actions.setCategoryExpanded(key, true)
  }

  // Cancel any stale indicator when a drag ends outside a row (or is aborted),
  // and restore the expansion snapshot taken at dragstart.
  useEffect(() => {
    const clear = () => {
      clearSpringExpand()
      draggedCategoryRef.current = null
      setDragIndicator(null)
      setDragging(null)
      setDraggingNestedCategory(false)
      const snapshot = expansionSnapshot.current
      if (snapshot === null) return
      expansionSnapshot.current = null
      const { categoryExpansion: currentCategories, workspaceExpansion: currentWorkspaces, actions: currentActions } = liveExpansionRef.current
      for (const [key, value] of Object.entries(snapshot.categories)) {
        if (currentCategories[key] !== value) currentActions.setCategoryExpanded(key, value)
      }
      for (const [key, value] of Object.entries(snapshot.workspaces)) {
        if (currentWorkspaces[key] !== value) currentActions.setWorkspaceExpanded(key, value)
      }
    }
    document.addEventListener('dragend', clear)
    return () => {
      clearSpringExpand()
      document.removeEventListener('dragend', clear)
    }
  }, [])

  /** Move a workspace into a category (or reorder inside it when `beforeWorkspaceId`/`afterWorkspaceId`). */
  const moveWorkspaceTo = async (workspaceId: string, categoryKey: string, beforeWorkspaceId?: string, afterWorkspaceId?: string): Promise<void> => {
    if (manualSaving) return
    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
    if (workspace === undefined) return
    if (categoryKey !== UNCATEGORIZED_KEY) {
      for (const anc of [...ancestorCategoryKeys(categoryKey), categoryKey]) {
        preserveExpandedAfterDrag(anc)
      }
    }
    setManualSaving(true)
    try {
      let next: NormalizedManual
      if (categoryKey === UNCATEGORIZED_KEY) {
        // Move to the TOP LEVEL: force ungrouped (null) and drop from every
        // group's order list, while recording the position inside the ordered
        // top-level list (`workspaceOrder[TOP_LEVEL_ORDER_KEY]`).
        const assignments = { ...manual.assignments, [workspaceId]: null }
        const workspaceOrder: Record<string, string[]> = {}
        for (const [key, ids] of Object.entries(manual.workspaceOrder)) {
          if (key === TOP_LEVEL_ORDER_KEY) continue
          workspaceOrder[key] = ids.filter(id => id !== workspaceId)
        }
        const topLevelIds = workspaces
          .filter(w => w.workspaceId !== workspaceId && resolveCategory(config, manual, w.workspaceId, w.path, w.title) === undefined)
          .map(w => w.workspaceId as string)
        workspaceOrder[TOP_LEVEL_ORDER_KEY] = afterWorkspaceId !== undefined
          ? moveAfter(topLevelIds, workspaceId, afterWorkspaceId)
          : moveBefore(topLevelIds, workspaceId, beforeWorkspaceId)
        next = { ...manual, assignments, workspaceOrder }
      } else {
        const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title)
        const movingAcross = currentKey !== categoryKey
        const assignments = movingAcross
          ? { ...manual.assignments, [workspaceId]: categoryKey }
          : manual.assignments
        const targetOrder = afterWorkspaceId !== undefined
          ? moveAfter(manual.workspaceOrder[categoryKey] ?? [], workspaceId, afterWorkspaceId)
          : moveBefore(manual.workspaceOrder[categoryKey] ?? [], workspaceId, beforeWorkspaceId)
        const workspaceOrder = { ...manual.workspaceOrder, [categoryKey]: targetOrder }
        if (movingAcross && currentKey !== undefined && workspaceOrder[currentKey] !== undefined) {
          workspaceOrder[currentKey] = workspaceOrder[currentKey]!.filter(id => id !== workspaceId)
        }
        next = { ...manual, assignments, workspaceOrder }
      }
      await saveManualOverlay(next)
      setManual(next)
      setManualError(null)
    } catch (reason) {
      setManualError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setManualSaving(false)
    }
  }

  /** Reorder or nest a category relative to `targetKey`. */
  const moveCategory = async (
    draggedKey: string,
    targetKey: string,
    position: 'before' | 'after' | 'into',
  ): Promise<void> => {
    if (manualSaving || draggedKey === targetKey) return
    const result = reorderCategoryInManual(config, manual, draggedKey, targetKey, position)
    if (!result.ok) {
      if (result.reason === 'duplicate') setManualError(t('group.moveDuplicateError'))
      else if (result.reason === 'cycle') setManualError(t('group.moveCycleError'))
      return
    }
    if (result.expandedParent !== undefined) {
      for (const anc of [...ancestorCategoryKeys(result.expandedParent), result.expandedParent]) {
        preserveExpandedAfterDrag(anc)
      }
    }
    if (result.newKey !== draggedKey) {
      if (expansionSnapshot.current !== null) {
        const remapped: Record<string, boolean> = {}
        for (const [k, v] of Object.entries(expansionSnapshot.current.categories)) {
          remapped[replaceCategoryPrefix(k, draggedKey, result.newKey)] = v
        }
        expansionSnapshot.current.categories = remapped
      }
      for (const [k, v] of Object.entries(categoryExpansion)) {
        if (v && isSameOrDescendantCategory(k, draggedKey)) {
          actions.setCategoryExpanded(replaceCategoryPrefix(k, draggedKey, result.newKey), true)
        }
      }
    }
    setManualSaving(true)
    try {
      await saveManualOverlay(result.manual)
      setManual(result.manual)
      setManualError(null)
    } catch (reason) {
      setManualError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setManualSaving(false)
    }
  }

  /** Un-nest a nested category back to root level. */
  const moveCategoryToRoot = async (draggedKey: string): Promise<void> => {
    if (manualSaving) return
    const result = moveCategoryToRootInManual(config, manual, draggedKey)
    if (!result.ok) {
      if (result.reason === 'duplicate') setManualError(t('group.moveDuplicateError'))
      return
    }
    if (expansionSnapshot.current !== null) {
      const remapped: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(expansionSnapshot.current.categories)) {
        remapped[replaceCategoryPrefix(k, draggedKey, result.newKey)] = v
      }
      expansionSnapshot.current.categories = remapped
    }
    for (const [k, v] of Object.entries(categoryExpansion)) {
      if (v && isSameOrDescendantCategory(k, draggedKey)) {
        actions.setCategoryExpanded(replaceCategoryPrefix(k, draggedKey, result.newKey), true)
      }
    }
    setManualSaving(true)
    try {
      await saveManualOverlay(result.manual)
      setManual(result.manual)
      setManualError(null)
    } catch (reason) {
      setManualError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setManualSaving(false)
    }
  }

  /**
   * Drop on a row. Re-derives the exact drop zone from cursor position so
   * drop always matches the last rendered visual indicator.
   */
  const onDropRow = (categoryKey: string, row: DropRowRef) => (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    clearSpringExpand()
    const fallbackDraggedCat = draggedCategoryRef.current ?? ''
    draggedCategoryRef.current = null
    setDragIndicator(null)
    setDragging(null)
    setDraggingNestedCategory(false)
    const draggedCategory = event.dataTransfer.getData(DND_CATEGORY_TYPE) || fallbackDraggedCat
    if (draggedCategory !== '') {
      if (row.kind === 'topLevel') {
        void moveCategoryToRoot(draggedCategory)
        return
      }
      if (row.kind !== 'category') return
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const ratio = (event.clientY - rect.top) / Math.max(1, rect.height)
      const position: 'before' | 'after' | 'into' = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'into'
      void moveCategory(draggedCategory, row.key, position)
      return
    }
    const workspaceId = event.dataTransfer.getData(DND_WORKSPACE_TYPE) || event.dataTransfer.getData('text/plain')
    if (workspaceId === '') return
    if (row.kind === 'topLevel') {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const before = event.clientY < rect.top + rect.height / 2
      const specificKey = row.key === UNCATEGORIZED_KEY ? undefined : row.key
      void moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY, before ? specificKey : undefined, !before ? specificKey : undefined)
      return
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    const beforeWsid = row.kind === 'workspace' && before ? row.key : undefined
    const afterWsid = row.kind === 'workspace' && !before ? row.key : undefined
    void moveWorkspaceTo(workspaceId, categoryKey, beforeWsid, afterWsid)
  }

  const onDragOverRow = (row: DropRowRef) => (event: DragEvent): void => {
    if (!hasPluginDragType(event.dataTransfer.types)) return
    const draggingCategory = Array.from(event.dataTransfer.types as Iterable<string>).includes(DND_CATEGORY_TYPE)
    const activeCat = draggedCategoryRef.current
    if (draggingCategory) {
      if (row.kind === 'topLevel') {
        if (activeCat === null || parentCategoryKey(activeCat) === undefined) return
        clearSpringExpand()
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDragIndicator(prev =>
          prev?.mode === 'line' && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === false
            ? prev
            : { mode: 'line', row, before: false })
        return
      }
      if (row.kind !== 'category') return
      if (activeCat !== null && isSameOrDescendantCategory(row.key, activeCat)) {
        clearSpringExpand()
        setDragIndicator(null)
        return
      }
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const ratio = (event.clientY - rect.top) / Math.max(1, rect.height)
      if (ratio < 0.25) {
        clearSpringExpand()
        setDragIndicator(prev =>
          prev?.mode === 'line' && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === true
            ? prev
            : { mode: 'line', row, before: true })
      } else if (ratio > 0.75) {
        clearSpringExpand()
        setDragIndicator(prev =>
          prev?.mode === 'line' && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === false
            ? prev
            : { mode: 'line', row, before: false })
      } else {
        scheduleSpringExpand(row.key)
        setDragIndicator(prev =>
          prev?.mode === 'into' && prev.categoryKey === row.key ? prev : { mode: 'into', categoryKey: row.key })
      }
      return
    }
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    if (row.kind === 'workspace' || row.kind === 'topLevel') {
      clearSpringExpand()
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === before
          ? prev
          : { mode: 'line', row, before })
    } else {
      scheduleSpringExpand(row.key)
      setDragIndicator(prev =>
        prev?.mode === 'into' && prev.categoryKey === row.key ? prev : { mode: 'into', categoryKey: row.key })
    }
  }

  const onDragLeaveRow = (event: DragEvent): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    clearSpringExpand()
    setDragIndicator(null)
  }

  /**
   * Drag over the TOP-LEVEL AREA's blank space (accepts workspaces or nested
   * categories being un-nested back to root).
   */
  const onDragOverTopLevelArea = (event: DragEvent): void => {
    if (!hasPluginDragType(event.dataTransfer.types)) return
    const draggingCategory = Array.from(event.dataTransfer.types as Iterable<string>).includes(DND_CATEGORY_TYPE)
    if (draggingCategory && (draggedCategoryRef.current === null || parentCategoryKey(draggedCategoryRef.current) === undefined)) {
      return
    }
    clearSpringExpand()
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const last = topLevel.length > 0 ? topLevel[topLevel.length - 1] : undefined
    if (last !== undefined) {
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === 'topLevel' && prev.row.key === last.workspaceId && prev.before === false
          ? prev
          : { mode: 'line', row: { kind: 'topLevel', key: last.workspaceId }, before: false })
    } else {
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === 'topLevel' && prev.row.key === topLevelRef.key && prev.before === false
          ? prev
          : { mode: 'line', row: topLevelRef, before: false })
    }
  }

  // While dragging a project, collapse expanded workspace rows so groups stand out clearly.
  const onDragStartWorkspace = (_workspaceId: string) => (): void => {
    setDragging('workspace')
    setDraggingNestedCategory(false)
    expansionSnapshot.current = {
      categories: { ...categoryExpansion },
      workspaces: { ...workspaceExpansion },
    }
    for (const key of Object.keys(workspaceExpansion)) {
      if (workspaceExpansion[key]) actions.setWorkspaceExpanded(key, false)
    }
  }

  // While dragging a category, fold ONLY workspace sessions + the dragged
  // category itself so other folders remain open as nested drop targets.
  const onDragStartCategory = (categoryKey: string) => (event: DragEvent): void => {
    event.stopPropagation()
    event.dataTransfer.setData(DND_CATEGORY_TYPE, categoryKey)
    event.dataTransfer.effectAllowed = 'move'
    draggedCategoryRef.current = categoryKey
    setDragging('category')
    setDraggingNestedCategory(parentCategoryKey(categoryKey) !== undefined)
    expansionSnapshot.current = {
      categories: { ...categoryExpansion },
      workspaces: { ...workspaceExpansion },
    }
    for (const key of Object.keys(workspaceExpansion)) {
      if (workspaceExpansion[key]) actions.setWorkspaceExpanded(key, false)
    }
    if (categoryExpansion[categoryKey]) {
      actions.setCategoryExpanded(categoryKey, false)
    }
  }

  const now = Date.now()

  return (
    <div className={`wgRoot${wide ? '' : ' wgRail'}`}>
      {/* The tab strip portals itself into the conversation column's head seat,
          so its position here is irrelevant to where it appears; rendering it
          from this component is what keeps it on this fiber (and therefore on
          this store's single scope) while still reaching the other column. */}
      <SessionTabs
        useSessions={useSessions}
        useSessionStatus={useSessionStatus}
        useWorkspaces={useWorkspaces}
        useTabs={useTabs}
        actions={tabActions}
        activate={activateTab}
        rename={onSessionRename}
        t={t}
      />
      <div className="wgSectionHeader">
        {wide && <span className="wgSectionLabel">{t('section.workspaces')}</span>}
        {wide && (
          <div className={`wgSearch${searchExpanded ? ' wgSearchExpanded' : ''}`} ref={searchRoot}>
            <button
              type="button"
              className="wgIconButton"
              aria-label={t('search')}
              onClick={() => { setSearchExpanded(true) }}
            >
              <IconSearchOutlineRegular size={searchExpanded ? 11 : 14} />
            </button>
            {searchExpanded && (
              <input
                ref={searchInput}
                className="wgSearchInput"
                type="text"
                placeholder={t('search.placeholder')}
                maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
                value={query}
                autoFocus
                onChange={(e) => { setQuery(sanitizeSearchQuery(e.target.value)) }}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return
                  setQuery('')
                  setSearchExpanded(false)
                }}
              />
            )}
            {searchExpanded && (
              <button
                type="button"
                className="wgIconButton"
                aria-label={t('search.clear')}
                onClick={(e) => {
                  e.stopPropagation()
                  setQuery('')
                  setSearchExpanded(false)
                }}
              >
                <IconCloseFillMedium />
              </button>
            )}
          </div>
        )}
        <Tooltip label={t('group.create')} side="bottom" delayMs={500}>
          <button
            type="button"
            className="wgIconButton"
            aria-label={t('group.create')}
            onClick={() => {
              setGroupDraft('')
              setGroupError(null)
              setGroupDialog({ mode: 'create' })
            }}
          >
            <IconFolderOpenOutlineRegular size={wide ? 16 : 18} />
          </button>
        </Tooltip>
        <Tooltip label={t('workspace.add')} side="bottom" delayMs={500}>
          <button
            type="button"
            className="wgIconButton"
            aria-label={t('workspace.add')}
            disabled={adding || flowOpen}
            onClick={() => { void addWorkspace() }}
          >
            <IconProjectAddOutlineRegular size={wide ? 16 : 18} />
          </button>
        </Tooltip>
      </div>

      {!wide && (
        <div className="wgSectionHeader">
          <Tooltip label={t('search')}>
            <button
              type="button"
              className="wgIconButton"
              aria-label={t('search')}
              onClick={() => { setSearchExpanded(true); expandSidebar() }}
            >
              <IconSearchOutlineRegular size={18} />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="wgTreeBody">
        {configError !== null && (
          <div className="wgSearchStatus" role="status">{t('configUnavailable')}</div>
        )}
        {manualError !== null && (
          <div className="wgSearchStatus wgManualError" role="alert">{t('manual.saveError')}: {manualError}</div>
        )}
        {wide && normalizedQuery !== '' ? (
          <SearchBody
            list={list}
            workspaces={workspaces}
            config={config}
            archivedSessionIds={archivedSessionIds}
            statuses={statuses}
            query={normalizedQuery}
            remote={remoteSearch}
            resultLimit={searchResultLimit}
            current={current}
            now={now}
            open={open}
            manual={manual}
            t={t}
          />
        ) : (
          /* The branch overlay lives beside the tree, not inside it: it measures
             the rows and paints behind them, so it must share their box without
             becoming a row itself (which would break role="tree" semantics and
             the index-based measurement). */
          <div className="wgTreeWrap" ref={branchScope}>
            <FlowerBranch scope={branchScope.current} spinning={currentRunning} />
            <div className="wgList" role="tree" aria-label={t('section.workspaces')}>
            {groups.length === 0 && topLevel.length === 0 && !topLevelDropActive && (
              <div className="wgEmpty">{workspacePhase === 'ready' ? t('empty.noWorkspaces') : t('empty.none')}</div>
            )}
            {groups.map((category) => (
              <CategorySection
                key={category.key}
                category={category}
                current={current}
                now={now}
                t={t}
                dragIndicator={dragIndicator}
                onDragOverRow={onDragOverRow}
                onDragLeaveRow={onDragLeaveRow}
                onDropRow={onDropRow}
                onDragStartCategory={onDragStartCategory}
                onDragStartWorkspace={onDragStartWorkspace}
                onToggleCategory={(key, nextExpanded) => { actions.setCategoryExpanded(key, nextExpanded) }}
                onToggleWorkspace={(key) => { actions.setWorkspaceExpanded(key, !workspaceExpansion[key]) }}
                onNewSession={startSession}
                onOpen={open}
                onRenameRequest={(workspaceId, title) => {
                  setRenameTarget({ workspaceId, currentTitle: title })
                  setRenameDraft(title)
                  setRenameError(null)
                }}
                onDeleteRequest={(workspaceId, title) => {
                  setDeleteTarget({ workspaceId, title })
                  setDeleteError(null)
                }}
                onSessionRename={onSessionRename}
                onSessionArchive={onSessionArchive}
                onFork={forkSession}
                onGroupCreateSubgroup={(parentKey) => {
                  setGroupDraft('')
                  setGroupError(null)
                  setGroupDialog({ mode: 'create', parentKey })
                }}
                onGroupMoveToRoot={(key) => { void moveCategoryToRoot(key) }}
                onGroupRename={(key) => {
                  setGroupDraft(categoryLeafName(key))
                  setGroupError(null)
                  setGroupDialog({ mode: 'rename', from: key })
                }}
                onGroupDelete={(key) => {
                  setGroupDeleteTarget(key)
                  setGroupDeleteError(null)
                }}
                onMoveOut={(workspaceId) => { void moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY) }}
                onOpenInFolder={openInFolder}
                canMoveOut={(workspaceId) => {
                  const workspace = workspaces.find(w => w.workspaceId === workspaceId)
                  return workspace !== undefined
                    && resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title) !== undefined
                }}
              />
            ))}
            {/* Top-level (ungrouped) workspaces, rendered after the group
                folders. While dragging a project or nested group, the whole area
                acts as a move-out landing spot. */}
            {(topLevel.length > 0 || topLevelDropActive) && (
              <TopLevelSection
                topLevel={topLevel}
                current={current}
                now={now}
                t={t}
                dragging={dragging === 'workspace' || (dragging === 'category' && draggingNestedCategory)}
                dragIndicator={dragIndicator}
                topLevelRef={topLevelRef}
                onDragOverRow={onDragOverRow}
                onDragOverTopLevelArea={onDragOverTopLevelArea}
                onDragLeaveRow={onDragLeaveRow}
                onDropRow={onDropRow}
                onDragStartWorkspace={onDragStartWorkspace}
                onToggleWorkspace={(key) => { actions.setWorkspaceExpanded(key, !workspaceExpansion[key]) }}
                onNewSession={startSession}
                onOpen={open}
                onRenameRequest={(workspaceId, title) => {
                  setRenameTarget({ workspaceId, currentTitle: title })
                  setRenameDraft(title)
                  setRenameError(null)
                }}
                onDeleteRequest={(workspaceId, title) => {
                  setDeleteTarget({ workspaceId, title })
                  setDeleteError(null)
                }}
                onSessionRename={onSessionRename}
                onSessionArchive={onSessionArchive}
                onFork={forkSession}
                onOpenInFolder={openInFolder}
              />
            )}
            </div>
          </div>
        )}
      </div>

      {/* Group create / rename dialog */}
      <Modal
        open={groupDialog !== null}
        onClose={() => { setGroupDialog(null) }}
        closeLabel={t('close')}
        title={
          groupDialog?.mode === 'rename'
            ? t('group.renameTitle')
            : groupDialog?.mode === 'create' && groupDialog.parentKey !== undefined
              ? t('group.createSubgroupTitle')
              : t('group.createTitle')
        }
        footer={(
          <>
            <Button variant="outline" onClick={() => { setGroupDialog(null) }}>{t('group.createCancel')}</Button>
            <Button variant="primary" disabled={groupBlocked} onClick={confirmGroupDialog}>
              {groupDialog?.mode === 'rename' ? t('group.renameConfirm') : t('group.createConfirm')}
            </Button>
          </>
        )}
      >
        {groupParentKey !== undefined && (
          <div className="wgDialogBreadcrumb">
            {t('group.parentLabel')}: {formatCategoryBreadcrumb(groupParentKey)}
          </div>
        )}
        <input
          className="wgRenameInput"
          value={groupDraft}
          aria-label={t('group.createPlaceholder')}
          placeholder={t('group.createPlaceholder')}
          autoFocus
          onChange={(e) => { setGroupDraft(e.target.value); setGroupError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmGroupDialog() }}
        />
        {groupDialog?.mode === 'create' && (
          <div className="wgDialogHint">{t('group.pathHint')}</div>
        )}
        {groupNameIssue !== null && <div className="wgAddError" role="alert">{groupNameIssue}</div>}
        {groupError !== null && <div className="wgAddError" role="alert">{groupError}</div>}
      </Modal>

      {/* Group delete dialog */}
      <Modal
        open={groupDeleteTarget !== null}
        onClose={() => { setGroupDeleteTarget(null) }}
        closeLabel={t('close')}
        title={t('group.deleteTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setGroupDeleteTarget(null) }}>{t('group.deleteCancel')}</Button>
            <Button variant="outline" disabled={groupDeleting} onClick={confirmGroupDelete}>{t('group.delete')}</Button>
          </>
        )}
      >
        <div className="wgAddError">
          {groupDeleteHasSubgroups ? t('group.deleteConfirmNested') : t('group.deleteConfirm')}
        </div>
        {groupDeleteError !== null && <div className="wgAddError" role="alert">{groupDeleteError}</div>}
      </Modal>

      {/* Workspace rename dialog */}
      <Modal
        open={renameTarget !== null}
        onClose={() => { setRenameTarget(null) }}
        closeLabel={t('close')}
        title={t('workspace.renameTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setRenameTarget(null) }}>{t('cancel')}</Button>
            <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('workspace.renameConfirm')}</Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={renameDraft}
          aria-label={t("workspace.renamePlaceholder")}
          autoFocus
          onChange={(e) => { setRenameDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmRename() }}
        />
        {renameError !== null && <div className="wgAddError" role="alert">{renameError}</div>}
      </Modal>

      {/* Workspace delete dialog */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null) }}
        closeLabel={t('close')}
        title={t('workspace.deleteTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setDeleteTarget(null) }}>{t('workspace.deleteCancel')}</Button>
            <Button variant="outline" disabled={deleting} onClick={confirmDelete}>{t('workspace.delete')}</Button>
          </>
        )}
      >
        <div className="wgAddError">{t('workspace.deleteConfirm')}</div>
        {deleteError !== null && <div className="wgAddError" role="alert">{deleteError}</div>}
      </Modal>

      {/* Session rename dialog */}
      <Modal
        open={sessionRenameTarget !== null}
        onClose={() => { setSessionRenameTarget(null) }}
        closeLabel={t('close')}
        title={t('session.renameTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setSessionRenameTarget(null) }}>{t('session.renameCancel')}</Button>
            <Button variant="primary" disabled={sessionRenameBlocked} onClick={confirmSessionRename}>{t('session.renameConfirm')}</Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={sessionRenameDraft}
          aria-label={t("session.renamePlaceholder")}
          autoFocus
          onChange={(e) => { setSessionRenameDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmSessionRename() }}
        />
        {sessionRenameError !== null && <div className="wgAddError" role="alert">{sessionRenameError}</div>}
      </Modal>

      {/* Winning `sidebar.workspaces.directoryFlow` picker occupant (e.g. `@yh4922/dsh-workspace`
          or official pickers); stays mounted across wide/rail transitions. */}
      <DirectoryFlowHost
        entry={directoryFlowEntry}
        resolveProps={directoryFlow.resolveProps}
        owner={{
          open: flowOpen,
          busy: adding,
          onPicked: (path) => { void adoptPickedDirectory(path) },
          onCancel: () => { setFlowOpen(false) },
          onError: (message) => {
            setFlowOpen(false)
            setAddError(message)
            setAddErrorOpen(true)
          },
        }}
      />

      {/* Add workspace error dialog */}
      <Modal
        open={addErrorOpen}
        onClose={() => { setAddErrorOpen(false) }}
        closeLabel={t('close')}
        title={t('workspace.addErrorTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setAddErrorOpen(false) }}>{t('close')}</Button>
            <Button variant="primary" onClick={() => { void addWorkspace() }}>{t('retry')}</Button>
          </>
        )}
      >
        <div className="wgAddError" role="alert">{addError}</div>
      </Modal>

      {/* "Open in folder" failure: transient banner, keyed per attempt so a
          repeat failure restarts the cycle. */}
      {folderError !== null && (
        <Toast
          key={folderError.id}
          text={folderError.text}
          icon={<IconWarningOutlineRegular size={16} />}
          onDone={() => { setFolderError(null) }}
        />
      )}

      {/* Ctrl+R quick switch panel (conditionally mounted: fresh query per open). */}
      {quickOpen && (
        <QuickPanel
          onClose={() => { setQuickOpen(false) }}
          list={list}
          workspaces={workspaces}
          archivedSessionIds={archivedSessionIds}
          categoryByWorkspace={categoryByWorkspace}
          current={current}
          startSession={startSession}
          openSession={open}
          now={now}
          t={t}
        />
      )}
    </div>
  )
}

/** Resolve the category label containing the current session (auto-expand helper). */
function categoriesForCurrent(
  config: GroupsConfig,
  workspaces: readonly WorkspaceView[],
  current: SessionId,
  manual: ManualGroups,
): string | undefined {
  const workspace = workspaces.find(w => w.sessionIds.includes(current))
  if (workspace === undefined) return undefined
  return resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
}

/** One recursive category section: header row + child subgroups + workspace folders. */
function CategorySection({
  category,
  current,
  now,
  t,
  dragIndicator,
  onDragOverRow,
  onDragLeaveRow,
  onDropRow,
  onDragStartCategory,
  onDragStartWorkspace,
  onToggleCategory,
  onToggleWorkspace,
  onNewSession,
  onOpen,
  onRenameRequest,
  onDeleteRequest,
  onSessionRename,
  onSessionArchive,
  onFork,
  onGroupCreateSubgroup,
  onGroupMoveToRoot,
  onGroupRename,
  onGroupDelete,
  onMoveOut,
  canMoveOut,
  onOpenInFolder,
}: {
  category: CategoryNode
  current: SessionId | undefined
  now: number
  t: GroupsBrowserProps['t']
  dragIndicator: DragIndicator
  onDragOverRow: (row: DropRowRef) => (event: DragEvent) => void
  onDragLeaveRow: (event: DragEvent) => void
  onDropRow: (categoryKey: string, row: DropRowRef) => (event: DragEvent) => void
  onDragStartCategory: (key: string) => (event: DragEvent) => void
  onDragStartWorkspace: (workspaceId: WorkspaceId) => () => void
  onToggleCategory: (key: string, nextExpanded: boolean) => void
  onToggleWorkspace: (key: string) => void
  onNewSession: (workspaceId?: WorkspaceId) => void
  onOpen: (sessionId: SessionId) => void
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  onDeleteRequest: (workspaceId: WorkspaceId, title: string) => void
  onSessionRename: (sessionId: SessionId, currentTitle: string) => void
  onSessionArchive: (sessionId: SessionId) => void
  onFork: (sessionId: SessionId) => void
  onGroupCreateSubgroup: (parentKey: string) => void
  onGroupMoveToRoot: (key: string) => void
  onGroupRename: (key: string) => void
  onGroupDelete: (key: string) => void
  onMoveOut: (workspaceId: WorkspaceId) => void
  canMoveOut: (workspaceId: WorkspaceId) => boolean
  onOpenInFolder?: ((workspaceId: WorkspaceId) => void) | undefined
}) {
  const categoryLine = dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'category' && dragIndicator.row.key === category.key
    ? (dragIndicator.before ? 'before' : 'after')
    : undefined
  const categoryInto = dragIndicator?.mode === 'into' && dragIndicator.categoryKey === category.key
  const childDepth = category.depth + 1
  return (
    <div role="group">
      <CategoryRow
        node={category}
        t={t}
        onToggle={() => { onToggleCategory(category.key, !category.expanded) }}
        onCreateSubgroup={() => { onGroupCreateSubgroup(category.key) }}
        {...(category.depth > 0 ? { onMoveToRoot: () => { onGroupMoveToRoot(category.key) } } : {})}
        onRename={() => { onGroupRename(category.key) }}
        onDelete={() => { onGroupDelete(category.key) }}
        dropNestLabel={t('group.dropNestBadge')}
        onDragStartCategory={onDragStartCategory(category.key)}
        dropActive={categoryInto}
        {...(categoryLine !== undefined ? { insertLine: categoryLine } : {})}
        onRowDragOver={onDragOverRow({ kind: 'category', key: category.key })}
        onRowDragLeave={onDragLeaveRow}
        onRowDrop={onDropRow(category.key, { kind: 'category', key: category.key })}
      />
      {category.expanded && (
        <div
          className="wgSubgroupChildren"
          role="group"
          style={{ '--wg-guide-depth': category.depth } as CSSProperties}
        >
          {category.children.map((child) => (
            <CategorySection
              key={child.key}
              category={child}
              current={current}
              now={now}
              t={t}
              dragIndicator={dragIndicator}
              onDragOverRow={onDragOverRow}
              onDragLeaveRow={onDragLeaveRow}
              onDropRow={onDropRow}
              onDragStartCategory={onDragStartCategory}
              onDragStartWorkspace={onDragStartWorkspace}
              onToggleCategory={onToggleCategory}
              onToggleWorkspace={onToggleWorkspace}
              onNewSession={onNewSession}
              onOpen={onOpen}
              onRenameRequest={onRenameRequest}
              onDeleteRequest={onDeleteRequest}
              onSessionRename={onSessionRename}
              onSessionArchive={onSessionArchive}
              onFork={onFork}
              onGroupCreateSubgroup={onGroupCreateSubgroup}
              onGroupMoveToRoot={onGroupMoveToRoot}
              onGroupRename={onGroupRename}
              onGroupDelete={onGroupDelete}
              onMoveOut={onMoveOut}
              canMoveOut={canMoveOut}
              onOpenInFolder={onOpenInFolder}
            />
          ))}
          {category.workspaces.map((workspace) => (
            <div key={workspace.workspaceId} role="group">
              <WorkspaceRow
                node={workspace}
                t={t}
                depth={childDepth}
                onToggle={() => { onToggleWorkspace(workspace.workspaceId as string) }}
                onNewSession={() => { onNewSession(workspace.workspaceId) }}
                onRename={() => { onRenameRequest(workspace.workspaceId, workspace.label) }}
                onDelete={() => { onDeleteRequest(workspace.workspaceId, workspace.label) }}
                canMoveOut={canMoveOut(workspace.workspaceId)}
                onMoveOut={() => { onMoveOut(workspace.workspaceId) }}
                {...(onOpenInFolder !== undefined
                  ? { onOpenInFolder: () => { onOpenInFolder(workspace.workspaceId) } }
                  : {})}
                dropActive={false}
                {...(dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'workspace' && dragIndicator.row.key === workspace.workspaceId
                  ? { insertLine: dragIndicator.before ? 'before' : 'after' }
                  : {})}
                onRowDragOver={onDragOverRow({ kind: 'workspace', key: workspace.workspaceId })}
                onRowDragLeave={onDragLeaveRow}
                onRowDrop={onDropRow(category.key, { kind: 'workspace', key: workspace.workspaceId })}
                onDragStartExtra={onDragStartWorkspace(workspace.workspaceId)}
              />
              {workspace.expanded && (
                <TreeChildren>
                  {workspace.sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      node={session}
                      currentId={current}
                      now={now}
                      t={t}
                      workspaceDepth={childDepth}
                      onOpen={onOpen}
                      onRename={onSessionRename}
                      onFork={onFork}
                      onArchive={onSessionArchive}
                    />
                  ))}
                </TreeChildren>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Top-level (ungrouped) workspace rows rendered after the group folders. While
 * a project drag is in progress the WHOLE top-level area is the move-out
 * landing spot, shown with an insertion LINE (not a highlight box):
 * - a top-level row reorders before/after it (line above/below, like a group);
 * - the blank space below the last row appends to the end (line below the
 *   last row);
 * - an empty top level shows a standalone line under the last group folder.
 */
function TopLevelSection({ topLevel, current, now, t, dragging, dragIndicator, topLevelRef, onDragOverRow, onDragOverTopLevelArea, onDragLeaveRow, onDropRow, onDragStartWorkspace, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, onOpenInFolder }: {
  topLevel: readonly WorkspaceGroupNode[]
  current: SessionId | undefined
  now: number
  t: GroupsBrowserProps['t']
  /** A project drag is in progress (drives the empty-top-level landing line). */
  dragging: boolean
  dragIndicator: DragIndicator
  topLevelRef: DropRowRef
  onDragOverRow: (row: DropRowRef) => (event: DragEvent) => void
  onDragOverTopLevelArea: (event: DragEvent) => void
  onDragLeaveRow: (event: DragEvent) => void
  onDropRow: (categoryKey: string, row: DropRowRef) => (event: DragEvent) => void
  onDragStartWorkspace: (workspaceId: WorkspaceId) => () => void
  onToggleWorkspace: (key: string) => void
  onNewSession: (workspaceId?: WorkspaceId) => void
  onOpen: (sessionId: SessionId) => void
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  onDeleteRequest: (workspaceId: WorkspaceId, title: string) => void
  onSessionRename: (sessionId: SessionId, currentTitle: string) => void
  onSessionArchive: (sessionId: SessionId) => void
  onFork: (sessionId: SessionId) => void
  /** Absent when the host resolved no folder application. */
  onOpenInFolder?: ((workspaceId: WorkspaceId) => void) | undefined
}) {
  const emptyLineActive = dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'topLevel' && dragIndicator.row.key === topLevelRef.key
  return (
    <div
      role="group"
      aria-label={t('section.topLevel')}
      className="wgTopLevelArea"
      onDragOver={onDragOverTopLevelArea}
      onDragLeave={onDragLeaveRow}
      onDrop={onDropRow(UNCATEGORIZED_KEY, topLevelRef)}
    >
      {topLevel.length === 0 && dragging && (
        <div
          className={`wgTopLevelEmpty${emptyLineActive ? ' wgTopLevelEmptyActive' : ''}`}
          role="treeitem"
          onDragOver={onDragOverRow(topLevelRef)}
          onDragLeave={onDragLeaveRow}
          onDrop={onDropRow(UNCATEGORIZED_KEY, topLevelRef)}
        >
          <span className="wgTopLevelEmptyLine" />
        </div>
      )}
      {topLevel.map((workspace) => (
        <div key={workspace.workspaceId} role="group">
          <WorkspaceRow
            node={workspace}
            t={t}
            flat
            depth={0}
            onToggle={() => { onToggleWorkspace(workspace.workspaceId as string) }}
            onNewSession={() => { onNewSession(workspace.workspaceId) }}
            onRename={() => { onRenameRequest(workspace.workspaceId, workspace.label) }}
            onDelete={() => { onDeleteRequest(workspace.workspaceId, workspace.label) }}
            {...(onOpenInFolder !== undefined
              ? { onOpenInFolder: () => { onOpenInFolder(workspace.workspaceId) } }
              : {})}
            {...(dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'topLevel' && dragIndicator.row.key === workspace.workspaceId
              ? { insertLine: dragIndicator.before ? 'before' : 'after' }
              : {})}
            onRowDragOver={onDragOverRow({ kind: 'topLevel', key: workspace.workspaceId })}
            onRowDragLeave={onDragLeaveRow}
            onRowDrop={onDropRow(UNCATEGORIZED_KEY, { kind: 'topLevel', key: workspace.workspaceId })}
            onDragStartExtra={onDragStartWorkspace(workspace.workspaceId)}
          />
          {workspace.expanded && (
            <TreeChildren>
              {workspace.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  node={session}
                  currentId={current}
                  now={now}
                  t={t}
                  workspaceDepth={0}
                  onOpen={onOpen}
                  onRename={onSessionRename}
                  onFork={onFork}
                  onArchive={onSessionArchive}
                />
              ))}
            </TreeChildren>
          )}
        </div>
      ))}
    </div>
  )
}

function SearchCategorySection({ category, current, now, open, t }: {
  category: CategoryNode
  current: SessionId | undefined
  now: number
  open: (sessionId: SessionId) => void
  t: GroupsBrowserProps['t']
}) {
  const childDepth = category.depth + 1
  return (
    <div role="group">
      <CategoryRow node={category} t={t} onToggle={() => {}} />
      <div
        className="wgSubgroupChildren"
        role="group"
        style={{ '--wg-guide-depth': category.depth } as CSSProperties}
      >
        {category.children.map((child) => (
          <SearchCategorySection
            key={child.key}
            category={child}
            current={current}
            now={now}
            open={open}
            t={t}
          />
        ))}
        {category.workspaces.map((workspace) => (
          <div key={workspace.workspaceId} role="group">
            <WorkspaceRow
              node={workspace}
              t={t}
              depth={childDepth}
              onToggle={() => {}}
              onNewSession={() => {}}
              onRename={() => {}}
              onDelete={() => {}}
            />
            <div role="group">
              {workspace.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  node={session}
                  currentId={current}
                  now={now}
                  t={t}
                  workspaceDepth={childDepth}
                  onOpen={open}
                  onRename={() => {}}
                  onFork={() => {}}
                  onArchive={() => {}}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Search body rendered as a recursive multi-level tree pruned to matched branches.
 */
function SearchBody({ list, workspaces, config, archivedSessionIds, statuses, query, remote, resultLimit, current, now, open, manual, t }: {
  list: SessionListState
  workspaces: readonly WorkspaceView[]
  config: GroupsConfig
  archivedSessionIds: readonly SessionId[]
  statuses: SessionStatusSnapshot
  query: string
  remote: RemoteSearchState
  resultLimit: number
  current: SessionId | undefined
  now: number
  open: (sessionId: SessionId) => void
  manual: ManualGroups
  t: GroupsBrowserProps['t']
}) {
  const currentRemote = remote.query === query ? remote : { query, status: 'loading' as const, items: [], hasMore: false }
  const matches = useMemo(
    () => deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit),
    [list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit],
  )
  const searchTree = useMemo(
    () => deriveSearchGroups(list, workspaces, config, matches.matchedIds, archivedSessionIds, manual, matches.snippetsBySession, statuses),
    [list, workspaces, config, matches, archivedSessionIds, manual, statuses],
  )
  const groups = searchTree.categories
  const searchTopLevel = searchTree.topLevel
  const pending = currentRemote.status === 'loading'
  const failed = currentRemote.status === 'error'
  return (
    <div className="wgList" role="tree" aria-label={t('search.results.aria')}>
      {groups.map((category) => (
        <SearchCategorySection
          key={category.key}
          category={category}
          current={current}
          now={now}
          open={open}
          t={t}
        />
      ))}
      {searchTopLevel.map((workspace) => (
        <div key={workspace.workspaceId} role="group">
          <WorkspaceRow
            node={workspace}
            t={t}
            flat
            depth={0}
            onToggle={() => {}}
            onNewSession={() => {}}
            onRename={() => {}}
            onDelete={() => {}}
          />
          <div role="group">
            {workspace.sessions.map((session) => (
              <SessionRow
                key={session.id}
                node={session}
                currentId={current}
                now={now}
                t={t}
                workspaceDepth={0}
                onOpen={open}
                onRename={() => {}}
                onFork={() => {}}
                onArchive={() => {}}
              />
            ))}
          </div>
        </div>
      ))}
      {pending && <div className="wgSearchStatus" role="status">{t('search.pending')}</div>}
      {failed && <div className="wgSearchStatus" role="status">{t('search.unavailable')}</div>}
      {!pending && groups.length === 0 && searchTopLevel.length === 0 && (
        <div className="wgEmpty">{t('search.noMatches')}</div>
      )}
      {matches.hasMore && (
        <div className="wgSearchStatus">{t('search.hasMore')}</div>
      )}
    </div>
  )
}
