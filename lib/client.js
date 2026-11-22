window.__ModuleLoader__.load({
	id: "@dsh-xhl/workspace-groups",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_dom = require("react-dom");
		// src/client/store-core.ts
		/** Collapse writes `false` (key retained); expand writes `true`. */
		function setCategoryExpandedImpl(state, key, expanded) {
			state.categoryExpansion[key] = expanded;
		}
		/** Collapse writes `false` (key retained); expand writes `true`. */
		function setWorkspaceExpandedImpl(state, key, expanded) {
			state.workspaceExpansion[key] = expanded;
		}
		/** Drop expansion keys that no longer exist (renames/deletes/config edits). */
		function retainKeysImpl(state, categoryKeys, workspaceKeys) {
			state.categoryExpansion = Object.fromEntries(Object.entries(state.categoryExpansion).filter(([key]) => categoryKeys.includes(key)));
			state.workspaceExpansion = Object.fromEntries(Object.entries(state.workspaceExpansion).filter(([key]) => workspaceKeys.includes(key)));
		}
		// src/client/stores.ts
		/**
		* The workspace-groups viewing store: category / workspace folder expansion,
		* persisted across reloads under an independent key (the official
		* ui-workspace store keeps its own `dsh.workspace.view.v5` — we never touch
		* it). Module level exports the factory only (a module-level handle would pin
		* the store identity across plugin reloads); register() receives the factory
		* and the browser derives its PropsStore share from the return type.
		*
		* The action implementations live in `store-core.ts` (pure, runtime-free) so
		* unit tests exercise the real semantics without a browser module loader;
		* this file only binds them through defineStore.
		*/
		/**
		* Create the workspace-groups viewing store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createGroupsViewStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					categoryExpansion: {},
					workspaceExpansion: {}
				}),
				persist: "dsh.workspace.groups.view.v1",
				actions: {
					setCategoryExpanded: setCategoryExpandedImpl,
					setWorkspaceExpanded: setWorkspaceExpandedImpl,
					retainKeys: retainKeysImpl
				}
			});
		}
		// src/client/tabs.ts
		/**
		* Add a session to the strip, or leave an existing entry exactly where it is.
		*
		* Arrival order is the strip's only order, so re-opening a session that already
		* has a tab is a NO-OP: the tab keeps its position and its arrival key. Moving
		* it to the front here would fight the whole point of stable positions — a user
		* clicking through sessions would watch the strip reshuffle on every click.
		*
		* @param tabs - current strip (oldest first).
		* @param sessionId - arriving session.
		* @param nextOrder - monotonic arrival counter to spend when appending.
		* @returns the strip, unchanged (same array) when the session already has a tab.
		*/
		function appendTab(tabs, sessionId, nextOrder) {
			if (tabs.find((tab) => tab.sessionId === sessionId) !== void 0) return tabs;
			return [...tabs, {
				sessionId,
				order: nextOrder
			}];
		}
		/**
		* Remove one session's tab. An absent session leaves the strip untouched.
		* @param tabs - current strip.
		* @param sessionId - session whose tab closes.
		* @returns a new strip.
		*/
		function removeTab(tabs, sessionId) {
			return tabs.filter((tab) => tab.sessionId !== sessionId);
		}
		/**
		* Order the strip for display: strictly by arrival, regardless of which tab is
		* active.
		*
		* Position is a property of the TAB, not of the selection. Switching to a tab
		* must not move it — an earlier version pulled the active tab to the front,
		* which made every click reshuffle the strip and slid the chip out from under
		* the pointer that had just clicked it.
		*
		* `activeId` is therefore accepted only to document that "active" deliberately
		* does NOT participate in ordering; it is unused. The returned array is a copy
		* so callers cannot mutate the store's state through it.
		*
		* @param tabs - strip in arrival order.
		* @param activeId - the open session, if it has a tab (intentionally unused).
		* @returns a new array in arrival order.
		*/
		function orderedTabs(tabs, activeId) {
			return [...tabs];
		}
		/**
		* Whether the open session must surface a tab.
		*
		* A tab means "this conversation is in play right now", not "I once opened
		* this". Browsing history is what the sidebar is for; opening an old
		* conversation to read it should not litter the strip, which is the whole point
		* of the strip being a working set rather than a second session list.
		*
		* A session therefore earns a tab only once a conversation has actually STARTED
		* in it and is still engaged, which is any of:
		* - **running** — the agent is producing output (including subagents);
		* - **waiting on you** — an approval / plan review / question is pending;
		* - **unseen completion** — it finished while you were elsewhere, so the tab is
		*   the thing that tells you to come back.
		*
		* A still-blank draft gets NO tab: the tab appears the moment the first message
		* is sent (which is when the controller flips `blank` on `turn/start`). Once the
		* turn ends and you have read the result, the session is settled history and
		* does not earn a tab — so clicking through finished conversations leaves the
		* strip alone. Tabs already opened stay open: this gate only decides whether a
		* NEW tab appears, never whether an existing one closes.
		*
		* `blank` (from `sessionListMetadata`) is exactly "no turn has started": the
		* controller flips it to false on `turn/start`. It is the right signal for
		* "has this conversation begun", and the wrong one ALONE — a conversation
		* finished a week ago is also non-blank, which is why the earlier `!blank` rule
		* surfaced every old conversation the user clicked.
		*
		* @param mode - feature switch ('auto' applies the engagement rule).
		* @param summary - the session's catalog row (absent while the catalog has not
		*   caught up with a just-created session).
		* @param status - the session's unified UI status (absent → no live signal).
		* @returns true when a tab belongs in the strip.
		*/
		function shouldOpenTab(mode, summary, status) {
			if (mode === "manual") return false;
			if (summary === void 0) return false;
			if (summary.blank) return false;
			if (summary.running) return true;
			if (status?.running === true) return true;
			if (status?.pendingInteraction !== void 0) return true;
			if (status?.completionUnread === true) return true;
			return false;
		}
		/**
		* Derive one tab's indicators from the catalog row and the unified UI status.
		* @param summary - the tab session's catalog row (absent → inert indicators).
		* @param status - the tab session's unified UI status (absent → idle).
		* @returns the indicator quadruple.
		*/
		function tabIndicator(summary, status) {
			const pending = status?.pendingInteraction !== void 0;
			const running = status?.running === true || summary?.running === true;
			const unread = status?.completionUnread === true;
			const blank = summary?.blank !== false;
			return {
				attention: pending,
				running,
				unread,
				settled: !pending && !running && !unread && summary !== void 0 && !blank
			};
		}
		/**
		* Index sessions by the project that owns them.
		*
		* Membership comes from the workspace registry (`sessionIds`), which is the same
		* authority the sidebar tree uses — a tab and its sidebar row therefore agree on
		* the project without a second derivation.
		*
		* Built once per render pass rather than scanned per tab: a strip of N tabs over
		* M projects is O(N×M) with a naive `find` per tab.
		*
		* @param workspaces - workspace views from the controller snapshot.
		* @returns a session id → project map; sessions in no workspace are absent.
		*/
		function projectIndex(workspaces) {
			const index = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) {
				const label = projectLabel(workspace);
				const project = {
					workspaceId: workspace.workspaceId,
					label,
					path: workspace.path
				};
				for (const sessionId of workspace.sessionIds) if (!index.has(sessionId)) index.set(sessionId, project);
			}
			return index;
		}
		/**
		* Display label for a project: its title, else the directory basename.
		* @param workspace - workspace view.
		* @returns a non-empty label, falling back to the raw path.
		*/
		function projectLabel(workspace) {
			const title = workspace.title.trim();
			if (title !== "") return title;
			const parts = workspace.path.split(/[\\/]/).filter((part) => part !== "");
			return parts[parts.length - 1] ?? workspace.path;
		}
		/**
		* Store transform: add the open session, or leave its existing tab in place.
		*
		* Live here rather than in `tab-store.ts` so unit tests can exercise the real
		* semantics without importing `@deepseek-ai/dsh-client-store` (which pulls
		* `zustand` into the test process). The store module binds these into its
		* actions table.
		*
		* The no-op guard matters: this runs on EVERY catalog change for the open
		* session, so an unguarded write would wake the strip and spend arrival keys on
		* every projection tick.
		*
		* @param state - store draft, mutated in place.
		* @param sessionId - the session that just became open.
		*/
		function touchTabImpl(state, sessionId) {
			const next = appendTab(state.tabs, sessionId, state.order + 1);
			if (next === state.tabs) return;
			state.order += 1;
			state.tabs = next;
		}
		/**
		* Store transform: close one tab. Closing a session that has no tab is not a
		* state change, so it writes nothing.
		* @param state - store draft, mutated in place.
		* @param sessionId - the tab to close.
		*/
		function closeTabImpl(state, sessionId) {
			const next = removeTab(state.tabs, sessionId);
			if (next.length === state.tabs.length) return;
			state.tabs = next;
		}
		/**
		* Store transform: adopt tabs loaded from the host, MERGING with whatever is
		* already in the strip.
		*
		* Async by nature (the host read is a `fetch`), so it can land after the browser
		* has already opened a tab for the current session. Merging — rather than
		* "ignore the read if the strip is non-empty" — is what makes a restart safe:
		* the tab opened during startup survives AND the stored tabs still come back.
		* (Bailing on a non-empty strip would silently drop every stored tab whenever
		* the startup tab won the race, which is the common case for a session that is
		* running or unread.)
		*
		* The arrival counter is lifted above every restored key so a tab opened later
		* cannot reuse one; a reused key makes React move a chip's DOM node instead of
		* reconciling it.
		*
		* @param state - store draft, mutated in place.
		* @param tabs - tabs read from the host, oldest first.
		*/
		function restoreTabsImpl(state, tabs) {
			if (tabs.length === 0) return;
			const present = new Set(state.tabs.map((tab) => tab.sessionId));
			const additions = [];
			let order = state.order;
			for (const tab of tabs) {
				if (present.has(tab.sessionId)) continue;
				present.add(tab.sessionId);
				order += 1;
				additions.push({
					sessionId: tab.sessionId,
					order
				});
			}
			if (additions.length > 0) state.tabs = [...state.tabs, ...additions];
			state.order = order;
		}
		// src/client/tab-store.ts
		/**
		* The session-tab store: the `defineStore` binding and nothing else.
		*
		* The action TRANSFORMS live in `tabs.ts` (pure, runtime-free), so unit tests
		* exercise the real semantics without pulling in the store engine — this module
		* is the only place that needs `@deepseek-ai/dsh-client-store`, and importing it
		* from a test would drag `zustand` into the test process.
		*
		* One handle, one scope: the tab store is seated by the `sidebar.workspaces`
		* entry alone. The tab strip is a CHILD of that entry (rendered through a DOM
		* portal into the conversation column), not a second slot registration, so the
		* handle is never mounted under a second, differently-scoped slot — which the
		* registry rejects outright ("one handle, one scope").
		*
		* Placement is navigation, not data: the strip derives its active chip from the
		* open session, and arrival order is the strip's only order, so nothing here
		* mirrors selection.
		*/
		/**
		* Create the session-tab store handle.
		*
		* The strip starts EMPTY and is hydrated by the caller through the `restore`
		* action: persistence lives on the host behind a `fetch`, which cannot run
		* during `init()`. Browser storage is deliberately not used — the origin
		* includes the port, and every launch picks a new one, so `localStorage` and
		* `sessionStorage` both start empty on the next start.
		*
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createSessionTabsStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					tabs: [],
					order: 0
				}),
				actions: {
					touch: touchTabImpl,
					close: closeTabImpl,
					restore: restoreTabsImpl
				}
			});
		}
		// src/client/tab-persist.ts
		/**
		* Client side of the session-tab persistence, talking to
		* `GET|PUT /workspace-groups/tabs` on the host.
		*
		* Why not browser storage: **the origin includes the PORT**, and every `dsh web`
		* / `dsh test` / desktop launch picks a different one. `localStorage` and
		* `sessionStorage` are both scoped to the origin, so they start empty on the
		* next launch — a tab list kept there survives a reload only when the port
		* happens to match. The host's JSON sidecar has no such problem, which is why
		* the strip is stored there and read back verbatim.
		*
		* There is deliberately no per-browser-session marker. A marker has to live in
		* browser storage, which the port invalidates, so every restart looked like a
		* fresh session and silently discarded the user's tabs — the exact failure this
		* module exists to prevent.
		*
		* Every call is best-effort: a failed read means "no tabs" and a failed write is
		* swallowed, because the strip is a convenience and must never break the app.
		*/
		/** Host route holding the strip. */
		const TABS_ROUTE = "/workspace-groups/tabs";
		/**
		* Fetch the stored strip.
		* @param fetchImpl - fetch implementation (injectable for tests).
		* @returns the tabs, oldest first; empty on any failure.
		*/
		async function loadTabs(fetchImpl = fetch) {
			try {
				const response = await fetchImpl(TABS_ROUTE, {
					method: "GET",
					cache: "no-store"
				});
				if (!response.ok) return [];
				const body = await response.json();
				if (typeof body !== "object" || body === null) return [];
				const list = body.tabs;
				if (!Array.isArray(list)) return [];
				const tabs = [];
				for (const entry of list) {
					if (typeof entry !== "object" || entry === null) continue;
					const row = entry;
					if (typeof row.sessionId !== "string" || row.sessionId === "") continue;
					if (typeof row.order !== "number" || !Number.isFinite(row.order)) continue;
					tabs.push({
						sessionId: row.sessionId,
						order: row.order
					});
				}
				return tabs;
			} catch {
				return [];
			}
		}
		/**
		* Store the strip. Failures are swallowed.
		* @param state - the client's current strip and its arrival counter.
		* @param fetchImpl - fetch implementation (injectable for tests).
		*/
		async function saveTabs(state, fetchImpl = fetch) {
			try {
				await fetchImpl(TABS_ROUTE, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						order: state.order,
						tabs: state.tabs
					}),
					cache: "no-store",
					keepalive: true
				});
			} catch {}
		}
		// src/client/store-hook.ts
		/**
		* A framework-shaped selector hook over a store instance.
		*
		* The renderer builds this hook for slot seats (`bindSnapshotSelector` in
		* ui-renderer, wrapping React's `useSyncExternalStoreWithSelector`), but the tab
		* strip is NOT a slot occupant: it renders through a DOM seat as a child of this
		* plugin's own `sidebar.workspaces` occupant, so it receives its store face as a
		* plain prop and needs the equivalent binding here.
		*
		* The implementation mirrors React's `useSyncExternalStoreWithSelector` without
		* depending on the `use-sync-external-store` package (it is not resolvable from
		* this plugin). The two behaviours that matter:
		*
		* - identity-stable subscribe/getSnapshot closures, so the strip never
		*   resubscribes across renders;
		* - a memoized selection: the selector re-runs only when the state reference
		*   changes, and an equal result (by `eq`, defaulting to `Object.is`) returns
		*   the PREVIOUS reference, so a selector allocating a fresh array or object
		*   does not spin the render loop.
		*
		* The hook must be called unconditionally (Rules of Hooks).
		*/
		/**
		* Build a selector hook bound to one store instance.
		* @param instance - the live store instance (snapshot source).
		* @returns a `SnapshotSelectorHook`-compatible hook over that instance.
		*/
		function createStoreHook(instance) {
			const subscribe = (onChange) => instance.subscribe(onChange);
			const getState = () => instance.getSnapshot();
			return function useSelector(selector, eq) {
				const memory = (0, react.useRef)(null);
				const getSelection = (0, react.useCallback)(() => {
					const state = getState();
					const previous = memory.current;
					if (previous !== null && previous.hasValue && Object.is(previous.state, state)) return previous.value;
					const value = selector(state);
					if (previous !== null && previous.hasValue) {
						if (eq !== void 0 ? eq(previous.value, value) : Object.is(previous.value, value)) {
							memory.current = {
								state,
								value: previous.value,
								hasValue: true
							};
							return previous.value;
						}
					}
					memory.current = {
						state,
						value,
						hasValue: true
					};
					return value;
				}, [selector, eq]);
				return (0, react.useSyncExternalStore)(subscribe, getSelection, getSelection);
			};
		}
		// src/client/directory-flow.tsx
		/** Single-occupant directory picker slot owned by the official sidebar workspace browser. */
		const DIRECTORY_FLOW_SLOT = "sidebar.workspaces.directoryFlow";
		function isDirectoryFlowEntry(value) {
			if (typeof value !== "object" || value === null) return false;
			return typeof value.component === "function";
		}
		function normalizeInjectedRecord(value) {
			if (typeof value !== "object" || value === null) return {};
			return value;
		}
		/**
		* Observe and resolve the active occupant of `sidebar.workspaces.directoryFlow`
		* without redeclaring the child slot (owned by the shadowed official browser).
		*/
		function createDirectoryFlowBridge(slots, locale) {
			const injectCache = /* @__PURE__ */ new WeakMap();
			const getEntry = () => {
				const head = slots?.entriesOfSlot?.(DIRECTORY_FLOW_SLOT)?.[0];
				return isDirectoryFlowEntry(head) ? head : null;
			};
			const subscribe = (listener) => {
				return slots?.subscribe?.("sidebar.workspaces.directoryFlow", listener) ?? (() => {});
			};
			const resolveProps = (entry) => {
				let injected = injectCache.get(entry);
				if (injected === void 0) {
					injected = typeof entry.inject === "function" ? normalizeInjectedRecord(entry.inject()) : {};
					injectCache.set(entry, injected);
				}
				if (typeof entry.locale === "string" && entry.locale !== "" && typeof locale?.bind === "function" && !("t" in injected)) return {
					t: locale.bind(entry.locale),
					...injected
				};
				return injected;
			};
			return {
				getEntry,
				subscribe,
				resolveProps
			};
		}
		/** React hook tracking the current head occupant of `sidebar.workspaces.directoryFlow`. */
		function useDirectoryFlowEntry(bridge) {
			return (0, react.useSyncExternalStore)(bridge.subscribe, bridge.getEntry, bridge.getEntry);
		}
		const entryKeyIds = /* @__PURE__ */ new WeakMap();
		let nextEntryKeyId = 1;
		function getEntryKey(entry) {
			const existing = entryKeyIds.get(entry);
			if (existing !== void 0) return existing;
			const allocated = nextEntryKeyId;
			nextEntryKeyId += 1;
			entryKeyIds.set(entry, allocated);
			return allocated;
		}
		var DirectoryFlowErrorBoundary = class extends react.Component {
			state = { failed: false };
			static getDerivedStateFromError() {
				return { failed: true };
			}
			componentDidCatch(error, _info) {
				this.props.onError(error instanceof Error ? error.message : String(error));
			}
			render() {
				if (this.state.failed) return null;
				return this.props.children;
			}
		};
		function DirectoryFlowInner({ entry, resolveProps, owner }) {
			const injected = resolveProps(entry);
			const FlowComponent = entry.component;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FlowComponent, {
				...injected,
				open: owner.open,
				busy: owner.busy,
				onPicked: owner.onPicked,
				onCancel: owner.onCancel,
				onError: owner.onError
			});
		}
		/**
		* Mount the winning `sidebar.workspaces.directoryFlow` occupant (such as
		* `@yh4922/dsh-workspace`'s `AddWorkspaceFlow` or official pickers) inside a
		* protective error boundary so a faulty picker never crashes `GroupsBrowser`.
		*/
		function DirectoryFlowHost({ entry, resolveProps, owner }) {
			if (entry === null) return null;
			const key = getEntryKey(entry);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DirectoryFlowErrorBoundary, {
				onError: owner.onError,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DirectoryFlowInner, {
					entry,
					resolveProps,
					owner
				}, `in-${key}`)
			}, `eb-${key}`);
		}
		// src/core/types.ts
		const EMPTY_MANUAL = {
			categories: [],
			assignments: {},
			categoryOrder: [],
			workspaceOrder: {},
			renamed: {},
			hidden: []
		};
		/** Materialize optional overlay fields so updates are plain object edits. */
		function normalizeManual(manual) {
			return {
				categories: manual.categories,
				assignments: manual.assignments,
				categoryOrder: manual.categoryOrder ?? [],
				workspaceOrder: manual.workspaceOrder ?? {},
				renamed: manual.renamed ?? {},
				hidden: manual.hidden ?? []
			};
		}
		/**
		* Legacy label of the fallback bucket. The top-level (ungrouped) concept
		* replaced the rendered "未分类" bucket. The constant survives for data
		* compatibility (reserved name, assignment null marker).
		*/
		const UNCATEGORIZED_LABEL = "未分类";
		/** Reserved key under `workspaceOrder` holding the manual order of top-level rows. */
		const TOP_LEVEL_ORDER_KEY = "__topLevel__";
		/** Normalize a filesystem path for prefix matching: trailing slashes stripped. */
		function normalizePath(path) {
			return path.replace(/[/\\]+$/, "");
		}
		/** Split a category key into trimmed segments (preserves empty segments for validation). */
		function splitCategoryPath(key) {
			const trimmed = key.trim();
			if (trimmed === "") return [];
			return trimmed.split("/").map((seg) => seg.trim());
		}
		/**
		* Normalize and validate a category path string.
		* Rejects empty input, leading/trailing `/`, empty `//` segments, and reserved
		* segment names (`未分类`, `__topLevel__`).
		*/
		function normalizeCategoryPath(raw) {
			const segments = splitCategoryPath(raw);
			if (segments.length === 0) return null;
			for (const seg of segments) if (seg === "" || seg === "未分类" || seg === "__topLevel__") return null;
			return segments.join("/");
		}
		/** Parent folder key of a nested category, or `undefined` at root level. */
		function parentCategoryKey(key) {
			const idx = key.lastIndexOf("/");
			return idx <= 0 ? void 0 : key.slice(0, idx);
		}
		/** Display leaf name (last segment) of a category path. */
		function categoryLeafName(key) {
			const idx = key.lastIndexOf("/");
			return idx < 0 ? key : key.slice(idx + 1);
		}
		/** Join an optional parent key and a leaf segment into a canonical path key. */
		function joinCategoryPath(parentKey, leafName) {
			return parentKey === void 0 || parentKey === "" ? leafName : `${parentKey}/${leafName}`;
		}
		/** Ancestor keys from outermost root to direct parent (e.g. `A/B/C` -> `['A', 'A/B']`). */
		function ancestorCategoryKeys(key) {
			const parts = splitCategoryPath(key);
			const ancestors = [];
			for (let i = 1; i < parts.length; i += 1) ancestors.push(parts.slice(0, i).join("/"));
			return ancestors;
		}
		/** True when `candidate` equals `ancestor` or sits strictly inside `ancestor/`. */
		function isSameOrDescendantCategory(candidate, ancestor) {
			return candidate === ancestor || candidate.startsWith(`${ancestor}/`);
		}
		/** Rewrite `oldPrefix` (and `oldPrefix/...`) to `newPrefix` (and `newPrefix/...`). */
		function replaceCategoryPrefix(key, oldPrefix, newPrefix) {
			if (key === oldPrefix) return newPrefix;
			if (key.startsWith(`${oldPrefix}/`)) return `${newPrefix}${key.slice(oldPrefix.length)}`;
			return key;
		}
		/** Format a category path as a readable breadcrumb (`A/B` -> `A › B`). */
		function formatCategoryBreadcrumb(key) {
			return splitCategoryPath(key).join(" › ");
		}
		// src/core/matcher.ts
		/**
		* Pure classification, ordering, and multi-level overlay mutations shared by
		* the host half (validation) and the client half (tree derivation & UI actions).
		*/
		/** One rule match against a workspace's path and title. */
		function ruleMatches(rule, path, title) {
			const normalized = normalizePath(path);
			if (rule.pathPrefix !== void 0 && normalized.startsWith(normalizePath(rule.pathPrefix))) return true;
			if (rule.pathExact !== void 0 && normalized === normalizePath(rule.pathExact)) return true;
			if (rule.nameContains !== void 0 && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true;
			if (rule.basenameContains !== void 0) {
				if ((path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "").toLowerCase().includes(rule.basenameContains.toLowerCase())) return true;
			}
			return false;
		}
		/** Classify a workspace by rules only; hidden categories are inert. */
		function classify(categories, path, title) {
			for (const category of categories) if (category.rules.some((rule) => ruleMatches(rule, path, title))) return category;
		}
		/** Display name of a rule category: the rename override when present. */
		function ruleDisplayName(manual, originalName) {
			return manual?.renamed?.[originalName] ?? originalName;
		}
		/** Whether a rule category has been hidden by a UI delete. */
		function isHiddenRule(manual, originalName) {
			return manual?.hidden?.includes(originalName) ?? false;
		}
		/** Rule category display names, in YAML render order (hidden ones excluded). */
		function ruleDisplayNames(categories, manual) {
			const names = [];
			for (const category of categories) {
				if (isHiddenRule(manual, category.name)) continue;
				names.push(ruleDisplayName(manual, category.name));
			}
			return names;
		}
		function effectiveCategories(config, manual) {
			const entries = [];
			const seen = /* @__PURE__ */ new Set();
			for (const category of config.categories) {
				if (isHiddenRule(manual, category.name)) continue;
				const key = ruleDisplayName(manual, category.name);
				if (seen.has(key)) continue;
				seen.add(key);
				entries.push({
					key,
					source: "rule"
				});
			}
			for (const name of manual?.categories ?? []) {
				if (seen.has(name)) continue;
				seen.add(name);
				entries.push({
					key: name,
					source: "manual"
				});
			}
			const order = manual?.categoryOrder;
			if (order === void 0 || order.length === 0) return entries;
			const position = new Map(order.map((key, index) => [key, index]));
			return [...entries].sort((a, b) => {
				const pa = position.get(a.key);
				const pb = position.get(b.key);
				if (pa !== void 0 && pb !== void 0) return pa - pb;
				if (pa !== void 0) return -1;
				if (pb !== void 0) return 1;
				return 0;
			});
		}
		/** Display keys of all explicit effective categories (top-level workspaces excluded). */
		function displayCategoryKeys(config, manual) {
			return effectiveCategories(config, manual).map((e) => e.key);
		}
		/**
		* All category keys including any implicit ancestor paths derived from `/` keys,
		* deduplicated with ancestors materialized before their first descendant.
		* Respects `manual.categoryOrder` when ancestors also appear in it.
		*/
		function allCategoryKeys(config, manual) {
			const explicit = displayCategoryKeys(config, manual);
			const explicitSet = new Set(explicit);
			const keys = [];
			const seen = /* @__PURE__ */ new Set();
			const pushUnique = (k) => {
				if (seen.has(k)) return;
				seen.add(k);
				keys.push(k);
			};
			for (const key of explicit) {
				for (const anc of ancestorCategoryKeys(key)) if (!explicitSet.has(anc)) pushUnique(anc);
				pushUnique(key);
			}
			const order = manual?.categoryOrder;
			if (order === void 0 || order.length === 0) return keys;
			const position = new Map(order.map((k, idx) => [k, idx]));
			return [...keys].sort((a, b) => {
				const pa = position.get(a);
				const pb = position.get(b);
				if (pa !== void 0 && pb !== void 0) return pa - pb;
				if (pa !== void 0) return -1;
				if (pb !== void 0) return 1;
				return 0;
			});
		}
		/**
		* Resolve the category key a workspace renders under, or `undefined` when it
		* is top-level (ungrouped). Precedence: manual override (`null` = forced
		* top-level) → rule classification (hidden rules inert) → top-level.
		*/
		function resolveCategory(config, manual, workspaceId, path, title) {
			const override = manual?.assignments[workspaceId];
			if (override !== void 0) return override ?? void 0;
			const matched = classify(config.categories, path, title);
			if (matched === void 0) return void 0;
			if (isHiddenRule(manual, matched.name)) return void 0;
			return ruleDisplayName(manual, matched.name);
		}
		/**
		* Names that may not be used for a new/renamed group: reserved labels plus
		* every current category key (explicit or implicit ancestor).
		*/
		function takenCategoryNames(config, manual) {
			const taken = new Set(allCategoryKeys(config, manual));
			taken.add(UNCATEGORIZED_LABEL);
			taken.add(TOP_LEVEL_ORDER_KEY);
			return taken;
		}
		/** Order a bucket of workspace ids according to stored per-category order. */
		function orderedWorkspaceIds(manual, categoryKey, members) {
			const stored = manual?.workspaceOrder?.[categoryKey];
			if (stored === void 0 || stored.length === 0) return [...members];
			const memberSet = new Set(members);
			const ordered = [];
			const seen = /* @__PURE__ */ new Set();
			for (const id of stored) {
				if (!memberSet.has(id) || seen.has(id)) continue;
				seen.add(id);
				ordered.push(id);
			}
			for (const id of members) {
				if (seen.has(id)) continue;
				ordered.push(id);
			}
			return ordered;
		}
		/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
		function moveBefore(list, id, beforeId) {
			const rest = list.filter((x) => x !== id);
			if (beforeId === void 0) return [...rest, id];
			const index = rest.indexOf(beforeId);
			if (index === -1) return [...rest, id];
			rest.splice(index, 0, id);
			return rest;
		}
		/** Move `id` after `afterId` (undefined = append) within an ordered list. */
		function moveAfter(list, id, afterId) {
			const rest = list.filter((x) => x !== id);
			if (afterId === void 0) return [...rest, id];
			const index = rest.indexOf(afterId);
			if (index === -1) return [...rest, id];
			rest.splice(index + 1, 0, id);
			return rest;
		}
		function dedupeList(items) {
			const seen = /* @__PURE__ */ new Set();
			const out = [];
			for (const item of items) {
				if (seen.has(item)) continue;
				seen.add(item);
				out.push(item);
			}
			return out;
		}
		/** Create a manual category path and materialize any missing ancestor groups. */
		function createCategoryInManual(config, manual, fullPath) {
			const base = normalizeManual(manual ?? EMPTY_MANUAL);
			const existingKeys = new Set(allCategoryKeys(config, base));
			const ruleKeys = new Set(ruleDisplayNames(config.categories, base));
			const toAdd = [...ancestorCategoryKeys(fullPath), fullPath];
			const categories = [...base.categories];
			const addedKeys = [];
			for (const key of toAdd) {
				if (!ruleKeys.has(key) && !categories.includes(key)) categories.push(key);
				if (!existingKeys.has(key)) addedKeys.push(key);
			}
			const categoryOrder = base.categoryOrder.length > 0 ? dedupeList([...base.categoryOrder, ...addedKeys]) : [];
			return {
				...base,
				categories,
				categoryOrder
			};
		}
		/**
		* Rename or reparent `fromKey` to `toKey`, atomically updating `fromKey` and
		* all nested descendants (`fromKey/*` -> `toKey/*`) across every overlay map.
		*/
		function renameOrMoveCategoryInManual(config, manual, fromKey, toKey) {
			const base = normalizeManual(manual ?? EMPTY_MANUAL);
			if (fromKey === toKey) return base;
			const renamed = { ...base.renamed };
			for (const rule of config.categories) {
				if (isHiddenRule(base, rule.name)) continue;
				const currentDisplay = ruleDisplayName(base, rule.name);
				if (!isSameOrDescendantCategory(currentDisplay, fromKey)) continue;
				const nextDisplay = replaceCategoryPrefix(currentDisplay, fromKey, toKey);
				if (nextDisplay === rule.name) delete renamed[rule.name];
				else renamed[rule.name] = nextDisplay;
			}
			const ruleKeysAfter = /* @__PURE__ */ new Set();
			for (const rule of config.categories) {
				if (isHiddenRule(base, rule.name)) continue;
				ruleKeysAfter.add(renamed[rule.name] ?? rule.name);
			}
			const categories = dedupeList(base.categories.map((c) => replaceCategoryPrefix(c, fromKey, toKey)));
			for (const anc of ancestorCategoryKeys(toKey)) if (!ruleKeysAfter.has(anc) && !categories.includes(anc)) categories.push(anc);
			const assignments = {};
			for (const [wsId, cat] of Object.entries(base.assignments)) assignments[wsId] = cat === null ? null : replaceCategoryPrefix(cat, fromKey, toKey);
			const workspaceOrder = {};
			for (const [key, ids] of Object.entries(base.workspaceOrder)) {
				if (key === "__topLevel__") {
					workspaceOrder[key] = ids;
					continue;
				}
				const mapped = replaceCategoryPrefix(key, fromKey, toKey);
				workspaceOrder[mapped] = workspaceOrder[mapped] !== void 0 ? dedupeList([...workspaceOrder[mapped], ...ids]) : ids;
			}
			const categoryOrder = dedupeList(base.categoryOrder.map((key) => replaceCategoryPrefix(key, fromKey, toKey)));
			return {
				...base,
				categories,
				assignments,
				workspaceOrder,
				categoryOrder,
				renamed
			};
		}
		/**
		* Delete `targetKey` and all nested subgroups. Workspaces resolved into any
		* deleted group are forced top-level (`null`) so rules do not silently re-group them.
		*/
		function deleteCategorySubtreeInManual(config, manual, workspaces, targetKey) {
			const base = normalizeManual(manual ?? EMPTY_MANUAL);
			const assignments = { ...base.assignments };
			for (const ws of workspaces) {
				const resolved = resolveCategory(config, base, ws.workspaceId, ws.path, ws.title);
				if (resolved !== void 0 && isSameOrDescendantCategory(resolved, targetKey)) assignments[ws.workspaceId] = null;
			}
			for (const [wsId, cat] of Object.entries(assignments)) if (cat !== null && isSameOrDescendantCategory(cat, targetKey)) assignments[wsId] = null;
			const renamed = { ...base.renamed };
			const hiddenSet = new Set(base.hidden);
			for (const rule of config.categories) {
				if (isHiddenRule(base, rule.name)) continue;
				if (isSameOrDescendantCategory(ruleDisplayName(base, rule.name), targetKey)) {
					hiddenSet.add(rule.name);
					delete renamed[rule.name];
				}
			}
			const workspaceOrder = {};
			for (const [key, ids] of Object.entries(base.workspaceOrder)) {
				if (key !== "__topLevel__" && isSameOrDescendantCategory(key, targetKey)) continue;
				workspaceOrder[key] = ids;
			}
			return {
				...base,
				categories: base.categories.filter((c) => !isSameOrDescendantCategory(c, targetKey)),
				assignments,
				workspaceOrder,
				categoryOrder: base.categoryOrder.filter((k) => !isSameOrDescendantCategory(k, targetKey)),
				renamed,
				hidden: [...hiddenSet]
			};
		}
		function insertSubtreeAfterTargetAndDescendants(list, subtree, targetKey) {
			const targetIdx = list.indexOf(targetKey);
			if (targetIdx === -1) return [...list, ...subtree];
			let insertAt = targetIdx + 1;
			while (insertAt < list.length && isSameOrDescendantCategory(list[insertAt], targetKey)) insertAt += 1;
			const out = [...list];
			out.splice(insertAt, 0, ...subtree);
			return out;
		}
		/**
		* Reorder or reparent a category subtree relative to `targetKey`.
		* - `'before'` / `'after'`: places `draggedKey` as a sibling before/after `targetKey`
		*   (adopting `parentCategoryKey(targetKey)` as its new parent).
		* - `'into'`: nests `draggedKey` inside `targetKey` (`targetKey/<leaf>`).
		*/
		function reorderCategoryInManual(config, manual, draggedKey, targetKey, position) {
			if (draggedKey === targetKey) return {
				ok: false,
				reason: "noop"
			};
			if (isSameOrDescendantCategory(targetKey, draggedKey)) return {
				ok: false,
				reason: "cycle"
			};
			const base = normalizeManual(manual ?? EMPTY_MANUAL);
			const targetParent = position === "into" ? targetKey : parentCategoryKey(targetKey);
			const newKey = joinCategoryPath(targetParent, categoryLeafName(draggedKey));
			if (newKey !== draggedKey) {
				const existingAll = allCategoryKeys(config, base);
				const outsideSet = new Set(existingAll.filter((k) => !isSameOrDescendantCategory(k, draggedKey)));
				const movedKeys = existingAll.filter((k) => isSameOrDescendantCategory(k, draggedKey)).map((k) => replaceCategoryPrefix(k, draggedKey, newKey));
				if (movedKeys.length === 0) movedKeys.push(newKey);
				for (const candidate of movedKeys) if (outsideSet.has(candidate)) return {
					ok: false,
					reason: "duplicate"
				};
			}
			let working = newKey !== draggedKey ? renameOrMoveCategoryInManual(config, base, draggedKey, newKey) : base;
			if (targetParent !== void 0) {
				if (!new Set(ruleDisplayNames(config.categories, working)).has(targetParent) && !working.categories.includes(targetParent)) working = {
					...working,
					categories: [...working.categories, targetParent]
				};
			}
			const currentOrder = allCategoryKeys(config, working);
			const subtree = currentOrder.filter((k) => isSameOrDescendantCategory(k, newKey));
			const rest = currentOrder.filter((k) => !isSameOrDescendantCategory(k, newKey));
			let nextOrder;
			if (position === "before") {
				const targetIdx = rest.indexOf(targetKey);
				if (targetIdx === -1) nextOrder = [...rest, ...subtree];
				else {
					nextOrder = [...rest];
					nextOrder.splice(targetIdx, 0, ...subtree);
				}
			} else nextOrder = insertSubtreeAfterTargetAndDescendants(rest, subtree, targetKey);
			return {
				ok: true,
				manual: {
					...working,
					categoryOrder: nextOrder
				},
				newKey,
				...targetParent !== void 0 ? { expandedParent: targetParent } : {}
			};
		}
		/** Move a nested category back to the root level (un-nest). */
		function moveCategoryToRootInManual(config, manual, draggedKey) {
			if (parentCategoryKey(draggedKey) === void 0) return {
				ok: false,
				reason: "noop"
			};
			const base = normalizeManual(manual ?? EMPTY_MANUAL);
			const newKey = categoryLeafName(draggedKey);
			const existingAll = allCategoryKeys(config, base);
			const outsideSet = new Set(existingAll.filter((k) => !isSameOrDescendantCategory(k, draggedKey)));
			const movedKeys = existingAll.filter((k) => isSameOrDescendantCategory(k, draggedKey)).map((k) => replaceCategoryPrefix(k, draggedKey, newKey));
			if (movedKeys.length === 0) movedKeys.push(newKey);
			for (const candidate of movedKeys) if (outsideSet.has(candidate)) return {
				ok: false,
				reason: "duplicate"
			};
			const working = renameOrMoveCategoryInManual(config, base, draggedKey, newKey);
			const currentOrder = allCategoryKeys(config, working);
			const subtree = currentOrder.filter((k) => isSameOrDescendantCategory(k, newKey));
			const rest = currentOrder.filter((k) => !isSameOrDescendantCategory(k, newKey));
			return {
				ok: true,
				manual: {
					...working,
					categoryOrder: [...rest, ...subtree]
				},
				newKey
			};
		}
		// src/client/subagent-lineage.ts
		/**
		* Index uninterrupted subagent descendants under each ancestor.
		* @param summaries - Session summaries keyed by id.
		* @returns descendant totals keyed by possible parent id.
		*/
		function indexSubagentDescendants(summaries) {
			const indexed = /* @__PURE__ */ new Map();
			for (const descendant of Object.values(summaries)) {
				if (descendant.origin !== "subagent") continue;
				const seen = /* @__PURE__ */ new Set();
				let current = descendant;
				while (current?.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
					seen.add(current.id);
					const aggregate = indexed.get(current.parentId);
					if (aggregate === void 0) indexed.set(current.parentId, {
						count: 1,
						runningCount: descendant.running ? 1 : 0
					});
					else {
						aggregate.count += 1;
						if (descendant.running) aggregate.runningCount += 1;
					}
					current = summaries[current.parentId];
				}
			}
			return indexed;
		}
		// src/client/tree.ts
		/**
		* The Session the Conversation is currently showing.
		*
		* 0.1.6 removed `SessionListState.current`: selection is expressed as the
		* Session retained through the `mainView` reference source (the ui-workspace
		* navigation holds exactly one). Same read the official browser performs.
		* @param list - sessions list snapshot.
		* @returns the retained Session id, or undefined while no Session is selected.
		*/
		function currentSessionId(list) {
			return Object.values(list.byId).find((session) => (session.retainedBy?.mainView ?? 0) > 0)?.id;
		}
		/** Keep navigation presentation independent from domain-owned interaction objects. */
		function visiblePendingKind(kind) {
			switch (kind) {
				case "approval":
				case "plan-review":
				case "question": return kind;
				default: return;
			}
		}
		/** Key of the uncategorized bucket (matches the config fallback label). */
		const UNCATEGORIZED_KEY = UNCATEGORIZED_LABEL;
		/** Directory display label: basename of the path (both separators accepted). */
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return UNCATEGORIZED_LABEL;
			const base = cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : cwd;
		}
		/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
		function sessionVisible(session, current, archived) {
			return session.origin !== "subagent" && !archived.has(session.id) && (!session.blank || session.id === current);
		}
		/** Blank rows display the localized New Session label (never enters search). */
		function sessionTitle(session) {
			return session.blank ? "New Session" : session.displayTitle;
		}
		function sessionNode(s, descendants, statuses) {
			const status = typeof statuses?.get === "function" ? statuses.get(s.id) : statuses[s.id];
			const pending = visiblePendingKind(status?.pendingInteraction?.kind);
			return {
				id: s.id,
				title: sessionTitle(s),
				blank: s.blank,
				running: status?.running ?? s.running,
				runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
				completed: status?.completionUnread === true,
				updatedAt: s.updatedAt,
				...pending === void 0 ? {} : { pendingInteraction: pending }
			};
		}
		/** Visible sessions of one workspace in its stored account order. */
		function workspaceSessions(list, workspace, archived, descendants, statuses, current) {
			const nodes = [];
			for (const id of workspace.sessionIds) {
				const summary = list.byId[id];
				if (summary === void 0) continue;
				if (!sessionVisible(summary, current, archived)) continue;
				nodes.push(sessionNode(summary, descendants, statuses));
			}
			return nodes;
		}
		function buildCategoryForest(orderedKeys, workspacesByCategory, manualCategories, expandedCategories, preserveEmptyManual) {
			const nodeMap = /* @__PURE__ */ new Map();
			const insertionOrder = [];
			const ensureNode = (key) => {
				const existing = nodeMap.get(key);
				if (existing !== void 0) return existing;
				for (const anc of ancestorCategoryKeys(key)) ensureNode(anc);
				const depth = Math.max(0, splitCategoryPath(key).length - 1);
				const node = {
					key,
					label: categoryLeafName(key),
					depth,
					parentKey: parentCategoryKey(key),
					expanded: expandedCategories === "all" ? true : expandedCategories.has(key),
					workspaces: workspacesByCategory.get(key) ?? [],
					children: []
				};
				nodeMap.set(key, node);
				insertionOrder.push(node);
				return node;
			};
			for (const key of orderedKeys) ensureNode(key);
			for (const key of workspacesByCategory.keys()) ensureNode(key);
			const roots = [];
			for (const node of insertionOrder) {
				if (node.parentKey !== void 0) {
					const parent = nodeMap.get(node.parentKey);
					if (parent !== void 0) {
						parent.children.push(node);
						continue;
					}
				}
				roots.push(node);
			}
			const finalize = (node) => {
				const children = [];
				for (const child of node.children) {
					const finalized = finalize(child);
					if (finalized !== void 0) children.push(finalized);
				}
				if (!(node.workspaces.length > 0 || children.length > 0) && !(preserveEmptyManual && manualCategories.has(node.key))) return;
				const containsCurrent = node.workspaces.some((w) => w.containsCurrent) || children.some((c) => c.containsCurrent);
				const totalWorkspaceCount = node.workspaces.length + children.reduce((sum, c) => sum + c.totalWorkspaceCount, 0);
				return {
					key: node.key,
					label: node.label,
					depth: node.depth,
					parentKey: node.parentKey,
					expanded: node.expanded,
					containsCurrent,
					totalWorkspaceCount,
					workspaces: node.workspaces,
					children
				};
			};
			const out = [];
			for (const root of roots) {
				const finalized = finalize(root);
				if (finalized !== void 0) out.push(finalized);
			}
			return out;
		}
		/**
		* Derive the multi-level tree: Category (arbitrarily nested) → Workspace → Session.
		*/
		function deriveGroups(list, workspaces, archivedSessionIds, config, view, manual, statuses = /* @__PURE__ */ new Map()) {
			const archived = new Set(archivedSessionIds);
			const expandedCategories = new Set(view.expandedCategories);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const byCategory = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) {
				const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				if (key === void 0) continue;
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(workspace);
			}
			const manualCategories = new Set(manual.categories);
			const currentWorkspaceId = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId;
			const orderedKeys = allCategoryKeys(config, manual);
			const workspacesByCategory = /* @__PURE__ */ new Map();
			for (const key of orderedKeys) {
				const bucket = byCategory.get(key) ?? [];
				if (bucket.length === 0) continue;
				const ordered = orderedWorkspaceIds(manual, key, bucket.map((w) => w.workspaceId));
				const workspaceNodes = [];
				for (const workspaceId of ordered) {
					const workspace = bucket.find((w) => w.workspaceId === workspaceId);
					if (workspace === void 0) continue;
					const sessions = workspaceSessions(list, workspace, archived, descendants, statuses, current);
					const wsExpanded = expandedWorkspaces.has(workspace.workspaceId);
					const wsContainsCurrent = workspace.workspaceId === currentWorkspaceId;
					workspaceNodes.push({
						workspaceId: workspace.workspaceId,
						path: workspace.path,
						label: workspace.title,
						createdAt: Date.parse(workspace.createdAt),
						sessionCount: sessions.length,
						expanded: wsExpanded,
						containsCurrent: wsContainsCurrent,
						sessions: wsExpanded ? sessions : []
					});
				}
				workspacesByCategory.set(key, workspaceNodes);
			}
			return buildCategoryForest(orderedKeys, workspacesByCategory, manualCategories, expandedCategories, true);
		}
		/**
		* Top-level (ungrouped) workspace rows: workspaces resolving to no category
		* (no manual override and no matching rule, or a forced `null` override).
		* Rendered after the group folders as plain project rows (not inside any
		* folder), in manual top-level order (`workspaceOrder[TOP_LEVEL_ORDER_KEY]`),
		* falling back to host registration order.
		*/
		function deriveTopLevel(list, workspaces, archivedSessionIds, config, view, manual, statuses = /* @__PURE__ */ new Map()) {
			const archived = new Set(archivedSessionIds);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const currentWorkspaceId = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId;
			const topLevelIds = workspaces.filter((w) => resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0).map((w) => w.workspaceId);
			const ordered = orderedWorkspaceIds(manual, TOP_LEVEL_ORDER_KEY, topLevelIds);
			const nodes = [];
			for (const workspaceId of ordered) {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) continue;
				const sessions = workspaceSessions(list, workspace, archived, descendants, statuses, current);
				const wsExpanded = expandedWorkspaces.has(workspaceId);
				nodes.push({
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: sessions.length,
					expanded: wsExpanded,
					containsCurrent: workspace.workspaceId === currentWorkspaceId,
					sessions: wsExpanded ? sessions : []
				});
			}
			return nodes;
		}
		/** Recency comparator: newest first, id as the deterministic tiebreak. */
		function byRecency(a, b) {
			if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
			return a.id < b.id ? -1 : 1;
		}
		/**
		* Compute the matched-session set: immediate title/Workspace substring matches
		* from the local list, merged with ranked Host content matches. The consumer
		* (SearchBody) derives the pruned three-level tree from these ids.
		*/
		function deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, content, limit) {
			const q = query.trim().toLowerCase();
			if (q === "") return {
				matchedIds: /* @__PURE__ */ new Set(),
				snippetsBySession: /* @__PURE__ */ new Map(),
				hasMore: false
			};
			const archived = new Set(archivedSessionIds);
			indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const workspaceBySession = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace);
			const labelOf = (summary) => workspaceBySession.get(summary.id)?.title ?? workspaceLabel(summary.cwd);
			const local = [];
			for (const id of list.ids) {
				const summary = list.byId[id];
				if (summary === void 0 || summary.blank || !sessionVisible(summary, current, archived)) continue;
				if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
			}
			local.sort(byRecency);
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			const include = (summary) => {
				if (included.has(summary.id)) return;
				included.add(summary.id);
				ordered.push(summary);
			};
			for (const summary of local) include(summary);
			for (const item of content.items) {
				const summary = list.byId[item.sessionId];
				if (summary !== void 0 && !summary.blank && sessionVisible(summary, current, archived)) include(summary);
			}
			const snippets = /* @__PURE__ */ new Map();
			for (const item of content.items) if (item.snippet !== void 0) snippets.set(item.sessionId, item.snippet);
			return {
				matchedIds: ordered.slice(0, limit).reduce((set, summary) => {
					set.add(summary.id);
					return set;
				}, /* @__PURE__ */ new Set()),
				snippetsBySession: snippets,
				hasMore: content.hasMore || ordered.length > limit
			};
		}
		/**
		* Build a three-level search tree containing ONLY the branches that hold a
		* matched session: 分类文件夹 → 项目文件夹 → 命中会话行. Every matched
		* session carries `matched: true` so rows render with the search-hit tint.
		* Classification uses the same precedence as the idle tree (manual override →
		* rules), so search shows the same grouping the user sees. Matched top-level
		* workspaces are returned separately (rendered as plain rows).
		*
		* @param list - sessions list snapshot.
		* @param workspaces - real workspaces in stable Host order.
		* @param config - sidecar grouping config.
		* @param matchedIds - set of session ids that matched the query.
		* @param archivedSessionIds - registry-global archive set.
		* @param manual - runtime overlay (manual groups + overrides).
		* @param snippetsBySession - optional content-match snippets keyed by session id.
		* @param statuses - unified UI status by Session (drives the running / warning
		* / unread-completion row indicators); defaults to none (tests).
		* @returns group folders in render order plus top-level matched workspaces,
		* pruned to matched branches only.
		*/
		function deriveSearchGroups(list, workspaces, config, matchedIds, archivedSessionIds, manual, snippetsBySession, statuses = /* @__PURE__ */ new Map()) {
			const archived = new Set(archivedSessionIds);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const byCategory = /* @__PURE__ */ new Map();
			const topLevel = [];
			for (const workspace of workspaces) {
				const nodes = [];
				for (const id of workspace.sessionIds) {
					const summary = list.byId[id];
					if (summary === void 0 || !matchedIds.has(id)) continue;
					if (!sessionVisible(summary, current, archived)) continue;
					const node = sessionNode(summary, descendants, statuses);
					const snippet = snippetsBySession?.get(id);
					nodes.push({
						...node,
						matched: true,
						...snippet === void 0 ? {} : { snippet }
					});
				}
				if (nodes.length === 0) continue;
				const node = {
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: nodes.length,
					expanded: true,
					containsCurrent: false,
					sessions: nodes
				};
				const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				if (key === void 0) {
					topLevel.push(node);
					continue;
				}
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(node);
			}
			return {
				categories: buildCategoryForest(allCategoryKeys(config, manual), byCategory, /* @__PURE__ */ new Set(), "all", false),
				topLevel
			};
		}
		// src/client/rows.tsx
		/**
		* Row components for the workspace-groups tree. Kept dependency-light: they
		* consume only React, primitives (StateDot/Menu/icons), and the shared CSS
		* string. Each row owns its hover actions menu; dialogs live in the browser
		* root so they survive row unmounts during collapse.
		*
		* Drag & drop: workspace rows are draggable sources; category rows (and
		* workspace rows, standing for their containing category) are drop targets.
		* The payload is a custom dataTransfer type so only in-plugin drags land.
		*/
		/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
		const DND_WORKSPACE_TYPE = "application/x-dsh-workspace-groups";
		/** dataTransfer type carrying the dragged category key (group reorder). */
		const DND_CATEGORY_TYPE = "application/x-dsh-workspace-groups-category";
		/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
		function hasPluginDragType(types) {
			const list = Array.from(types);
			return list.includes("application/x-dsh-workspace-groups") || list.includes("application/x-dsh-workspace-groups-category");
		}
		/** Pending interaction status → primitives StateDot state. */
		function pendingState(status) {
			switch (status) {
				case "approval":
				case "plan-review":
				case "question": return "warning";
				default: return;
			}
		}
		/** Primary status dot state for a session row. */
		function sessionDotState(node) {
			if (pendingState(node.pendingInteraction) !== void 0) return "warning";
			if (node.running || node.runningSubagentCount > 0) return "ongoing";
			return node.completed ? "done" : "done";
		}
		/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
		function relativeTimeLabel(updatedAt, now) {
			const diff = Math.max(0, now - updatedAt);
			const MIN = 6e4;
			const HOUR = 36e5;
			const DAY = 864e5;
			if (diff < MIN) return "now";
			if (diff < HOUR) return `${Math.floor(diff / MIN)}min`;
			if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
			if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`;
			if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`;
			return `${Math.floor(diff / (365 * DAY))}y`;
		}
		/**
		* One category folder row: supports arbitrary nesting depth, toggle,
		* subgroup creation / move-to-root / rename / delete menu, draggable source
		* for group reorder/reparenting, and 3-zone drop target.
		*/
		function CategoryRow({ node, t, onToggle, onCreateSubgroup, onMoveToRoot, onRename, onDelete, dropNestLabel, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const count = node.totalWorkspaceCount;
			const manageable = onRename !== void 0 && onDelete !== void 0;
			const depthStyle = { "--wg-depth": node.depth };
			const menuItems = [
				...onCreateSubgroup !== void 0 ? [{
					id: "createSubgroup",
					label: t("group.createSubgroup"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 })
				}] : [],
				...node.depth > 0 && onMoveToRoot !== void 0 ? [{
					id: "moveToRoot",
					label: t("group.moveToRoot"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 16 })
				}] : [],
				...manageable ? [{
					id: "rename",
					label: t("group.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
				}, {
					id: "delete",
					label: t("group.delete"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
					danger: true
				}] : []
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgCategoryRow${node.depth > 0 ? " wgCategorySub" : ""}${node.containsCurrent ? " wgCategoryActive" : ""}${manageable ? " wgCategoryManageable" : ""}${dropActive ? " wgDropTarget" : ""}${insertLine === "before" ? " wgInsertBefore" : insertLine === "after" ? " wgInsertAfter" : ""}`,
				style: depthStyle,
				role: "treeitem",
				"aria-expanded": node.expanded,
				"aria-label": node.label,
				"data-wg-category": node.key,
				"data-wg-depth": node.depth,
				"data-wg-branch-row": "",
				"data-wg-branch-group": "",
				draggable: onDragStartCategory !== void 0,
				onClick: onToggle,
				onDragStart: onDragStartCategory,
				onDragOver: onRowDragOver,
				onDragLeave: onRowDragLeave,
				onDrop: onRowDrop,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFillMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						"data-wg-row-icon": "group",
						children: node.depth > 0 ? node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseMedium, { size: 14 }) : node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenMedium, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryLabel",
						title: node.key,
						children: node.label
					}),
					dropActive && dropNestLabel !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgDropBadge",
						children: dropNestLabel
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryCount",
						children: count
					}),
					manageable && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowActions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: menuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								if (id === "createSubgroup") onCreateSubgroup?.();
								if (id === "moveToRoot") onMoveToRoot?.();
								if (id === "rename") onRename();
								if (id === "delete") onDelete();
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								draggable: false,
								"aria-label": `${t("group.rename")} ${node.label}`,
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
							})
						}), onCreateSubgroup !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "wgIconButton",
							draggable: false,
							title: t("group.createSubgroup"),
							"aria-label": `${t("group.createSubgroup")} ${node.label}`,
							onClick: (e) => {
								e.stopPropagation();
								onCreateSubgroup();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
						})]
					})
				]
			});
		}
		/** One workspace folder row inside a category: draggable source + drop target. */
		function WorkspaceRow({ node, t, depth, onToggle, onNewSession, onRename, onDelete, canMoveOut = false, onMoveOut, onOpenInFolder, flat = false, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartExtra }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const effectiveDepth = depth ?? (flat ? 0 : 1);
			const menuItems = [
				...onOpenInFolder !== void 0 ? [{
					id: "openInFolder",
					label: t("workspace.openInFolder"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 })
				}] : [],
				...canMoveOut && onMoveOut !== void 0 ? [{
					id: "moveOut",
					label: t("workspace.moveOutOfGroup"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 16 })
				}] : [],
				{
					id: "rename",
					label: t("workspace.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
				},
				{
					id: "delete",
					label: t("workspace.delete"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
					danger: true
				}
			];
			const onDragStart = (event) => {
				event.dataTransfer.setData(DND_WORKSPACE_TYPE, node.workspaceId);
				event.dataTransfer.effectAllowed = "move";
				onDragStartExtra?.();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgProjectRow${node.containsCurrent ? " wgProjectActive" : ""}${flat ? " wgProjectFlat" : ""}${dropActive ? " wgDropTarget" : ""}${insertLine === "before" ? " wgInsertBefore" : insertLine === "after" ? " wgInsertAfter" : ""}`,
				style: { "--wg-depth": effectiveDepth },
				role: "treeitem",
				"aria-expanded": node.expanded,
				"data-wsid": node.workspaceId,
				"data-wg-depth": effectiveDepth,
				"data-wg-branch-row": "",
				"data-wg-branch-group": "",
				draggable: true,
				onClick: onToggle,
				onDragStart,
				onDragOver: onRowDragOver,
				onDragLeave: onRowDragLeave,
				onDrop: onRowDrop,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFillMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						"data-wg-row-icon": "project",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutlineRegular, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgProjectLabel",
						title: node.path,
						children: node.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowActions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: menuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								if (id === "openInFolder") onOpenInFolder?.();
								if (id === "moveOut") onMoveOut?.();
								if (id === "rename") onRename();
								if (id === "delete") onDelete();
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								draggable: false,
								"aria-label": `${t("workspace.rename")} ${node.label}`,
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "wgIconButton",
							draggable: false,
							"aria-label": `${t("session.new")} ${node.label}`,
							onClick: (e) => {
								e.stopPropagation();
								onNewSession();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
						})]
					})
				]
			});
		}
		/**
		* Children container for one folder's rows.
		*
		* Keeps the tree's `role="group"` semantics and gives the rows a single
		* positioned ancestor. It used to draw a per-folder guide rail; that is now the
		* flower branch's job (one continuous stem for the whole tree, see
		* `FlowerBranch.tsx`), so this is structure only.
		*/
		function TreeChildren({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wgTreeChildren",
				role: "group",
				children
			});
		}
		/** One session leaf row. */
		function SessionRow({ node, currentId, now, t, workspaceDepth = 1, onOpen, onRename, onFork, onArchive }) {
			const selected = node.id === currentId;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const showStatus = !selected;
			const menuItems = [
				{
					id: "rename",
					label: t("session.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
				},
				{
					id: "fork",
					label: t("session.fork"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, {})
				},
				{
					id: "archive",
					label: t("session.archive"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 16 })
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgSessionRow${selected ? " wgSelected" : ""}${node.matched === true ? " wgMatched" : ""}`,
				style: { "--wg-depth": workspaceDepth },
				role: "treeitem",
				"aria-selected": selected,
				"data-wg-branch-row": "",
				"data-wg-depth": workspaceDepth,
				...selected ? { "data-wg-branch-active": "" } : {},
				onClick: () => {
					onOpen(node.id);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgStatusSlot",
						children: showStatus && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: sessionDotState(node) })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionTitle",
						children: node.title
					}),
					!node.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionTime",
						children: relativeTimeLabel(node.updatedAt, now)
					}),
					node.snippet !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionSnippet",
						title: node.snippet,
						children: node.snippet
					}),
					!node.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgRowActions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: menuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								if (id === "rename") onRename(node.id, node.title);
								if (id === "fork") onFork(node.id);
								if (id === "archive") onArchive(node.id);
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": `${t("session.rename")} ${node.title}`,
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
							})
						})
					})
				]
			});
		}
		// src/client/open-folder.ts
		/**
		* Transport for the official open-in-app host routes served by
		* `@deepseek-ai/dsh-host-open-in-app`. The project row offers "open this
		* project's folder" by asking that host half for the applications it verified
		* as installed, then POSTing the launcher it already resolved — this plugin
		* never probes or spawns a launcher itself, and a host without the capability
		* (no resolved application, e.g. an SSH launch) simply yields no menu entry.
		*/
		/** GET route serving the probed application ids (host-owned constant). */
		const OPEN_IN_APP_APPS_ROUTE = "/open-in-app/apps";
		/** POST route launching one resolved application on one absolute directory. */
		const OPEN_IN_APP_OPEN_ROUTE = "/open-in-app/open";
		/**
		* Catalog ids that open a directory in the platform file manager, most
		* specific first (the official catalog names one per platform: `explorer` on
		* Windows, `finder` on macOS, `filemanager` on Linux).
		*/
		const FOLDER_APP_IDS = [
			"explorer",
			"finder",
			"filemanager"
		];
		/**
		* The installed file-manager id for this host, or undefined when the host
		* resolved none (the row then offers no "open in folder" entry).
		* @param apps - installed catalog ids from the apps route.
		* @returns the preferred available id.
		*/
		function folderAppId(apps) {
			for (const id of FOLDER_APP_IDS) if (apps.includes(id)) return id;
		}
		/**
		* Resolve the browser's Host base with the connection carrier's null-origin
		* fallback (same rule the official button uses): a sandboxed document reports
		* the literal origin "null", which cannot address the host.
		* @returns the absolute base URL of the current Host.
		*/
		function hostBase() {
			const origin = globalThis.location?.origin;
			return origin !== void 0 && origin !== "null" ? origin : "http://dsh.internal";
		}
		/**
		* Read the host's installed-application ids. A host without the capability
		* (or one that refuses) reads as an empty list rather than an error, so the
		* caller can treat "no apps" and "no route" identically.
		* @param signal - aborts the read when the browser half unmounts.
		* @returns installed catalog ids, in host menu order.
		*/
		async function fetchOpenInApps(signal) {
			const response = await fetch(new URL(OPEN_IN_APP_APPS_ROUTE, hostBase()), {
				headers: { accept: "application/json" },
				cache: "no-store",
				...signal === void 0 ? {} : { signal }
			});
			if (!response.ok) throw new Error(`open-in-app apps request failed: ${response.status}`);
			const apps = (await response.json()).apps;
			return Array.isArray(apps) ? apps.filter((id) => typeof id === "string") : [];
		}
		/**
		* Launch one installed application on one absolute directory.
		* @param appId - catalog id from the apps route.
		* @param path - the project's absolute directory.
		* @returns after the host acknowledged the launch; rejects on any refusal.
		*/
		async function openPathInApp(appId, path) {
			const response = await fetch(new URL(OPEN_IN_APP_OPEN_ROUTE, hostBase()), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					app: appId,
					path
				})
			});
			if (!response.ok) throw new Error(`open-in-app launch failed: ${response.status}`);
		}
		// src/client/quick.ts
		/** A session row eligible for quick switching: running, top-level, real. */
		function quickEligible(summary) {
			return summary.running === true && summary.origin !== "subagent" && !summary.blank;
		}
		/**
		* Running quick-switchable sessions across the whole list, newest first.
		* @param list - sessions list snapshot.
		* @param archived - registry-global archive set (archived rows never surface).
		* @returns running summaries in recency order (id as deterministic tiebreak).
		*/
		function runningSessions(list, archived) {
			const out = [];
			for (const id of list.ids) {
				if (archived.has(id)) continue;
				const summary = list.byId[id];
				if (summary !== void 0 && quickEligible(summary)) out.push(summary);
			}
			out.sort((a, b) => b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1);
			return out;
		}
		/**
		* Every quick-switchable session across the whole list — the sessions tab's
		* data: running rows pinned on top, everything else under them, both groups
		* newest first. Visibility mirrors the tree (subagent rows never; archived
		* never; a blank row only while it is the open session).
		* @param list - sessions list snapshot.
		* @param archived - registry-global archive set (archived rows never surface).
		* @param current - the selected session (`mainView` retention; keeps its blank row visible).
		* @returns summaries with running first, then recency (id as deterministic tiebreak).
		*/
		function allSessions(list, archived, current) {
			const out = [];
			for (const id of list.ids) {
				if (archived.has(id)) continue;
				const summary = list.byId[id];
				if (summary === void 0) continue;
				if (summary.origin === "subagent") continue;
				if (summary.blank && summary.id !== current) continue;
				out.push(summary);
			}
			out.sort((a, b) => {
				if (a.running !== b.running) return a.running ? -1 : 1;
				return b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1;
			});
			return out;
		}
		/**
		* Session search for the quick panel: display-title or owning-workspace-title
		* substring match (trimmed, case-insensitive). Filters only — the incoming
		* running-first/recency order is preserved verbatim, so "running on top"
		* survives any query.
		* @param sessions - allSessions() output (running pinned on top, then recency).
		* @param query - raw query.
		* @param workspaceTitleOf - owning workspace title resolver (sub-line source).
		* @param limit - hard render cap.
		* @returns matching sessions in the given order.
		*/
		function filterSessions(sessions, query, workspaceTitleOf, limit = 200) {
			const q = query.trim().toLowerCase();
			if (q === "") return sessions.slice(0, limit);
			const out = [];
			for (const session of sessions) {
				const workspace = workspaceTitleOf(session)?.toLowerCase() ?? "";
				if (session.displayTitle.toLowerCase().includes(q) || workspace.includes(q)) out.push(session);
			}
			return out.slice(0, limit);
		}
		/**
		* Most recently updated running session inside one workspace.
		* @param list - sessions list snapshot.
		* @param workspace - target workspace (its session account order is irrelevant;
		* recency picks the row).
		* @returns the session id, or undefined when nothing in the workspace runs.
		*/
		function latestRunningInWorkspace(list, workspace) {
			let best;
			let bestTime = Number.NEGATIVE_INFINITY;
			for (const id of workspace.sessionIds) {
				const summary = list.byId[id];
				if (summary === void 0 || !quickEligible(summary)) continue;
				if (summary.updatedAt > bestTime) {
					best = summary.id;
					bestTime = summary.updatedAt;
				}
			}
			return best;
		}
		/**
		* Running-session count per workspace id (badge on the workspace tab rows).
		* @param running - runningSessions() output.
		* @param workspaces - real workspaces in stable Host order.
		* @returns counts keyed by workspace id; absent key = none running.
		*/
		function runningCountByWorkspace(running, workspaces) {
			const counts = /* @__PURE__ */ new Map();
			if (running.length === 0) return counts;
			const runningIds = new Set(running.map((s) => s.id));
			for (const workspace of workspaces) {
				let count = 0;
				for (const sessionId of workspace.sessionIds) if (runningIds.has(sessionId)) count += 1;
				if (count > 0) counts.set(workspace.workspaceId, count);
			}
			return counts;
		}
		/**
		* The workspace that owns the currently open session.
		* @param workspaces - real workspaces in stable Host order.
		* @param currentSessionId - the selected session (`mainView` retention); may be undefined
		*   (no session open, cleared selection) or an id no listed workspace holds
		*   (e.g. an addressed subagent session).
		* @returns the workspace id, or undefined when there is no active workspace.
		*/
		function activeWorkspaceId(workspaces, currentSessionId) {
			if (currentSessionId === void 0) return void 0;
			return workspaces.find((w) => w.sessionIds.includes(currentSessionId))?.workspaceId;
		}
		/**
		* Workspace search for the quick panel: title prefix → title substring →
		* category label substring → path substring; ties keep host order via a
		* stable title compare inside one rank.
		* @param workspaces - real workspaces in stable Host order.
		* @param query - raw query (trimmed, case-insensitive).
		* @param categoryLabelOf - category label resolver (grouped workspaces only).
		* @param limit - hard render cap.
		* @returns ranked matches; an empty query returns host order.
		*/
		function filterWorkspaces(workspaces, query, categoryLabelOf, limit = 50) {
			const q = query.trim().toLowerCase();
			if (q === "") return workspaces.slice(0, limit);
			const scored = [];
			for (const workspace of workspaces) {
				const title = workspace.title.toLowerCase();
				const path = workspace.path.toLowerCase();
				const category = (categoryLabelOf?.(workspace) ?? "").toLowerCase();
				let score;
				if (title.startsWith(q)) score = 0;
				else if (title.includes(q)) score = 1;
				else if (category !== "" && category.includes(q)) score = 2;
				else if (path.includes(q)) score = 3;
				if (score !== void 0) scored.push({
					workspace,
					score
				});
			}
			scored.sort((a, b) => a.score !== b.score ? a.score - b.score : a.workspace.title.localeCompare(b.workspace.title));
			return scored.slice(0, limit).map((entry) => entry.workspace);
		}
		// src/client/QuickPanel.tsx
		/**
		* Ctrl+R quick switch panel: two tabs over the framework's global hooks.
		*
		* - Workspaces tab: search real Workspaces, select one, then either start a
		*   New Session in it or jump straight to its most recently updated running
		*   session (the button reads the none-running state and disables).
		* - Sessions tab: every top-level session across workspaces — running ones
		*   pinned on top, everything else under them, both groups newest first; one
		*   click (or Enter) opens it. The shared search input filters by session or
		*   workspace title and never re-sorts, so the running-first order survives.
		*
		* Current-row marker: the open workspace (workspaces tab) and the open
		* session (sessions tab) render `.wgQuickRowCurrent`; with no current
		* session — or one no listed workspace holds — nothing is marked.
		*
		* Mount discipline: the parent conditionally mounts this component, so every
		* open starts from a fresh query/selection (quick-switcher semantics). The
		* overlay portals to document.body (sidebar ancestors clip `fixed`), sizes
		* itself like a launcher (top-anchored, 640px) instead of the host Modal's
		* 380px dialog, and handles Escape / mask click by itself. Pure data shaping
		* lives in quick.ts; this file only binds hooks + actions.
		*/
		/** Basename of a host path (both separators; shortens the workspace row sub-line). */
		function pathBasename(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			const base = trimmed.split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : trimmed;
		}
		/**
		* Render the quick switch panel (portaled overlay).
		* @param props - hooks snapshots + injected verbs.
		* @returns the panel element tree.
		*/
		function QuickPanel({ onClose, list, workspaces, archivedSessionIds, categoryByWorkspace, current: currentSessionId, startSession, openSession, now, t }) {
			const [tab, setTab] = (0, react.useState)("workspaces");
			const [query, setQuery] = (0, react.useState)("");
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const inputRef = (0, react.useRef)(null);
			const activeRowRef = (0, react.useRef)(null);
			const archived = (0, react.useMemo)(() => new Set(archivedSessionIds), [archivedSessionIds]);
			const running = (0, react.useMemo)(() => runningSessions(list, archived), [list, archived]);
			const runCounts = (0, react.useMemo)(() => runningCountByWorkspace(running, workspaces), [running, workspaces]);
			const filtered = (0, react.useMemo)(() => filterWorkspaces(workspaces, query, (ws) => categoryByWorkspace.get(ws.workspaceId)), [
				workspaces,
				query,
				categoryByWorkspace
			]);
			const currentWorkspaceId = (0, react.useMemo)(() => activeWorkspaceId(workspaces, currentSessionId), [workspaces, currentSessionId]);
			const sessions = (0, react.useMemo)(() => allSessions(list, archived, currentSessionId), [
				list,
				archived,
				currentSessionId
			]);
			const workspaceTitleBySession = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!map.has(sessionId)) map.set(sessionId, workspace.title);
				return map;
			}, [workspaces]);
			const filteredSessions = (0, react.useMemo)(() => filterSessions(sessions, query, (s) => workspaceTitleBySession.get(s.id)), [
				sessions,
				query,
				workspaceTitleBySession
			]);
			const selected = selectedId === null ? void 0 : workspaces.find((w) => w.workspaceId === selectedId);
			const selectedRunningId = selected === void 0 ? void 0 : latestRunningInWorkspace(list, selected);
			(0, react.useEffect)(() => {
				inputRef.current?.focus();
			}, [tab]);
			(0, react.useEffect)(() => {
				activeRowRef.current?.scrollIntoView({ block: "nearest" });
			}, [activeIndex]);
			/** Select the workspace and close (New Session verb). */
			const launchNewSession = (workspace) => {
				startSession(workspace.workspaceId);
				onClose();
			};
			/** Open a session row and close (sessions tab click or Enter). */
			const launchSession = (sessionId) => {
				openSession(sessionId);
				onClose();
			};
			/** Switch tabs; the query carries over, the per-tab selection resets. */
			const switchTab = (next) => {
				setTab(next);
				setSelectedId(null);
				setActiveIndex(0);
			};
			/** Search-input keyboard: arrows move the active row; Enter confirms it. */
			const onSearchKeyDown = (e) => {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					const max = (tab === "workspaces" ? filtered.length : filteredSessions.length) - 1;
					setActiveIndex((i) => Math.min(i + 1, Math.max(max, 0)));
				} else if (e.key === "ArrowUp") {
					e.preventDefault();
					setActiveIndex((i) => Math.max(i - 1, 0));
				} else if (e.key === "Enter") {
					e.preventDefault();
					if (tab === "workspaces") {
						if (selected === void 0) {
							const target = filtered[activeIndex];
							if (target !== void 0) setSelectedId(target.workspaceId);
						} else launchNewSession(selected);
					} else {
						const target = filteredSessions[activeIndex];
						if (target !== void 0) launchSession(target.id);
					}
				}
			};
			/** Escape closes (capture so row buttons and the input can't swallow it). */
			const onCardKeyDown = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					onClose();
				}
			};
			/** Mask click closes; clicks inside the card never reach the mask. */
			const onOverlayMouseDown = (e) => {
				if (e.target === e.currentTarget) onClose();
			};
			const selectWorkspace = (id) => {
				setSelectedId(id);
				inputRef.current?.focus();
			};
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wgQuickOverlay",
				onMouseDown: onOverlayMouseDown,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wgQuickCard",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("quick.title"),
					onKeyDown: onCardKeyDown,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickHeader",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgQuickTitle",
								children: t("quick.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgQuickTabs",
								role: "tablist",
								"aria-label": t("quick.title"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": tab === "workspaces",
									className: `wgQuickTab${tab === "workspaces" ? " wgQuickTabActive" : ""}`,
									onClick: () => {
										switchTab("workspaces");
									},
									children: t("quick.tab.workspaces")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": tab === "sessions",
									className: `wgQuickTab${tab === "sessions" ? " wgQuickTabActive" : ""}`,
									onClick: () => {
										switchTab("sessions");
									},
									children: [t("quick.tab.sessions"), running.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgQuickTabCount",
										children: running.length
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgQuickSearchWrap",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: inputRef,
								className: "wgQuickSearch",
								value: query,
								placeholder: tab === "workspaces" ? t("quick.search.placeholder") : t("quick.search.sessions"),
								"aria-label": tab === "workspaces" ? t("quick.search.placeholder") : t("quick.search.sessions"),
								onChange: (e) => {
									setQuery(e.target.value);
									setSelectedId(null);
									setActiveIndex(0);
								},
								onKeyDown: onSearchKeyDown
							})
						}),
						tab === "workspaces" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickList",
							role: "listbox",
							"aria-label": t("quick.tab.workspaces"),
							children: [filtered.map((workspace, i) => {
								const id = workspace.workspaceId;
								const count = runCounts.get(id) ?? 0;
								const category = categoryByWorkspace.get(id);
								const isCurrent = id === currentWorkspaceId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									ref: i === activeIndex ? activeRowRef : void 0,
									type: "button",
									role: "option",
									"aria-selected": selectedId === id,
									"aria-current": isCurrent || void 0,
									className: `wgQuickRow${i === activeIndex ? " wgQuickRowActive" : ""}${selectedId === id ? " wgQuickRowSelected" : ""}${isCurrent ? " wgQuickRowCurrent" : ""}`,
									onMouseEnter: () => {
										setActiveIndex(i);
									},
									onClick: () => {
										selectWorkspace(id);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "wgQuickRowMain",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgQuickRowTitle",
											children: workspace.title
										}), count > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "wgQuickRunBadge",
											children: ["● ", count]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgQuickRowSub",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgQuickRowPath",
											children: category !== void 0 ? `${category} · ${pathBasename(workspace.path)}` : pathBasename(workspace.path)
										})
									})]
								}, id);
							}), filtered.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgQuickEmpty",
								children: t("quick.empty.workspaces")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickFooter",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgQuickSelected",
									children: selected === void 0 ? t("quick.select.hint") : selected.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: selected === void 0 || selectedRunningId === void 0,
									onClick: () => {
										if (selectedRunningId !== void 0) launchSession(selectedRunningId);
									},
									children: selectedRunningId !== void 0 ? t("quick.action.running") : t("quick.action.noneRunning")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: selected === void 0,
									onClick: () => {
										if (selected !== void 0) launchNewSession(selected);
									},
									children: t("quick.action.newSession")
								})
							]
						})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickList",
							role: "listbox",
							"aria-label": t("quick.tab.sessions"),
							children: [filteredSessions.map((session, i) => {
								const workspaceTitle = workspaceTitleBySession.get(session.id) ?? "";
								const isCurrent = session.id === currentSessionId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									ref: i === activeIndex ? activeRowRef : void 0,
									type: "button",
									role: "option",
									"aria-selected": i === activeIndex,
									"aria-current": isCurrent || void 0,
									className: `wgQuickRow${i === activeIndex ? " wgQuickRowActive" : ""}${isCurrent ? " wgQuickRowCurrent" : ""}`,
									onMouseEnter: () => {
										setActiveIndex(i);
									},
									onClick: () => {
										launchSession(session.id);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "wgQuickRowMain",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: session.running ? "ongoing" : "done" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgQuickRowTitle",
												children: session.blank ? t("newSession") : session.displayTitle
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgQuickTime",
												children: relativeTimeLabel(session.updatedAt, now)
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgQuickRowSub",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgQuickRowPath",
											children: workspaceTitle
										})
									})]
								}, session.id);
							}), filteredSessions.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgQuickEmpty",
								children: t("quick.empty.sessions")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgQuickHint",
							children: t("quick.hint")
						})
					]
				})
			}), document.body);
		}
		// src/client/tab-seat.ts
		/**
		* DOM seat for the session tab strip.
		*
		* Why this exists instead of a slot: the strip belongs at the very top of the
		* conversation column — `pI_x6G_centerCol` (ui-layout's AppFrame `.centerCol`,
		* a hashed CSS-Modules class). That column declares NO child slots: its only
		* child is the `main` slot's occupant (`renderSlot('main', …)`, the
		* Conversation or a global panel), so there is nowhere to register. The
		* shipped slot in that neighbourhood — `conversation.composer.dock` — is the
		* band UNDER the composer card, a different place entirely.
		*
		* So the strip gets a real DOM seat: this module finds the column, prepends a
		* `<div>` to it, and hands that element to a React portal. The element is
		* OURS, never React's: it is inserted outside the column's child list that
		* React reconciles, and it is re-inserted if React (or a theme/titlebar
		* re-render) ever drops it.
		*
		* Two hazards this module is built around:
		*
		* 1. `centerCol` is a hashed class name (`pI_x6G_centerCol`) that changes when
		*    the package is rebuilt. Matching is therefore done on the *structural*
		*    contract — a grid-item column that holds the `main` panel — plus a
		*    `[class*="_centerCol"]` probe, never on the exact hash.
		* 2. The column mounts after the client plugin's `apply()` runs. Discovery is
		*    therefore a MutationObserver on `document.body` plus a `requestAnimationFrame`
		*    retry, and both are torn down when the owning effect disposes.
		*/
		/** Persistent marker for the injected container (survives React re-renders). */
		const SEAT_ATTRIBUTE = "data-wg-tab-seat";
		/** Sentinel attribute on the container so discovery can skip our own node. */
		const SEAT_SELECTOR = `[${SEAT_ATTRIBUTE}]`;
		/**
		* Match the conversation column by its hashed CSS-Modules class.
		*
		* The hash prefix (`pI_x6G_`) is build-dependent, so the probe matches the
		* `_centerCol` suffix that the Modules transform always preserves. A plain
		* `class*="centerCol"` scan would risk matching unrelated utility classes, so
		* the leading underscore is required.
		* @param root - subtree to scan (normally `document`).
		* @returns the column element, or null while it has not mounted.
		*/
		function findCenterColumn(root) {
			const existing = root.querySelector(SEAT_SELECTOR);
			if (existing?.isConnected === true) return existing.parentElement;
			const column = root.querySelector("[class*=\"_centerCol\"]");
			if (column !== null) return column;
			return null;
		}
		/**
		* Ensure a seat exists as the FIRST child of the conversation column, creating
		* it if needed, and keep it there for as long as the returned handle is live.
		*
		* The seat element is created once and reused: a portal that re-mounts into a
		* fresh node on every shell re-render would drop the tab strip's React state
		* and visible focus. If React removes the node (it owns the column's child
		* list, and our node is not part of it), the observer re-inserts the SAME
		* element, so the portal's subtree moves with it.
		*
		* @param onReady - called with the host element each time it becomes attached
		*   (once immediately when the column already exists). Used to seed React
		*   state; may fire more than once if the column is remounted.
		* @returns the seat handle. `host` is null until the column appears, so the
		*   caller renders nothing meanwhile and starts rendering when `onReady`
		*   fires. Never null: a missing column must degrade to "no strip", not to a
		*   thrown error that would take the whole client plugin down.
		*/
		function mountTabSeat(onReady) {
			let host = null;
			let column = null;
			let observer = null;
			let raf = 0;
			let attempts = 0;
			let disposed = false;
			const MAX_ATTEMPTS = 300;
			/**
			* Put the seat at the head of the column, creating it on first success.
			* Idempotent: a seat already first is left untouched, so repeated calls from
			* the observer cause no DOM churn (and therefore no observer feedback loop —
			* our insertion schedules one more callback, which then takes this early
			* return instead of re-inserting).
			*/
			const place = (target) => {
				if (disposed) return;
				if (host === null) {
					host = document.createElement("div");
					host.setAttribute(SEAT_ATTRIBUTE, "");
				}
				if (target.firstChild === host) return;
				target.insertBefore(host, target.firstChild);
			};
			/** Locate the column and, on success, seat the host and notify the caller. */
			const tryMount = () => {
				if (disposed) return true;
				if (column !== null && column.isConnected) {
					place(column);
					return true;
				}
				const found = findCenterColumn(document);
				if (found === null) return false;
				const changed = found !== column;
				column = found;
				place(found);
				if (changed) onReady(host);
				return true;
			};
			const tick = () => {
				if (disposed) return;
				raf = 0;
				if (tryMount()) return;
				attempts += 1;
				if (attempts >= MAX_ATTEMPTS) return;
				raf = requestAnimationFrame(tick);
			};
			observer = new MutationObserver(() => {
				if (disposed) return;
				if (tryMount()) return;
				if (raf === 0 && attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tick);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			if (!tryMount() && raf === 0) raf = requestAnimationFrame(tick);
			return {
				get host() {
					return host;
				},
				dispose: () => {
					disposed = true;
					if (raf !== 0) cancelAnimationFrame(raf);
					raf = 0;
					observer?.disconnect();
					observer = null;
					host?.remove();
					host = null;
					column = null;
				}
			};
		}
		// src/client/SessionTabs.tsx
		/**
		* The session tab strip: one chip per opened conversation, rendered into the
		* DOM seat at the head of the conversation column (see `tab-seat.ts` for why
		* this is a DOM injection rather than a slot).
		*
		* A tab is a *view* of the open session, not a second navigation model:
		* clicking a chip navigates through `ctx.uiWorkspace.openSession`, which is the
		* one path that retains a target session; the owning component derives the
		* strip from the open session plus the tab store.
		*
		* The active chip is derived, never stored: it is the chip whose session is the
		* open one, so clicking a background chip immediately shows that chip active.
		*/
		/** Dot state for one tab (the sidebar's session rows share this vocabulary). */
		function dotState(indicator) {
			if (indicator.attention) return "warning";
			if (indicator.running) return "ongoing";
			return "done";
		}
		/**
		* Render the session tab strip into the conversation column's head seat.
		* @param props - tab store, catalog/status hooks, navigation, locale.
		* @returns the portal (or null until the column has mounted).
		*/
		function SessionTabs({ useTabs, actions, useSessions, useSessionStatus, useWorkspaces, activate, rename, t }) {
			const tabs = useTabs((s) => s.tabs);
			const list = useSessions((s) => s);
			const statuses = useSessionStatus((s) => s);
			const currentId = useSessions((s) => currentSessionId(s));
			const workspaces = useWorkspaces((s) => s.items);
			const projects = (0, react.useMemo)(() => projectIndex(workspaces), [workspaces]);
			const [seat, setSeat] = (0, react.useState)(null);
			const scrollRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const mounted = mountTabSeat(setSeat);
				if (mounted.host !== null) setSeat(mounted.host);
				return () => {
					mounted.dispose();
					setSeat(null);
				};
			}, []);
			const display = (0, react.useMemo)(() => orderedTabs(tabs, currentId), [tabs, currentId]);
			(0, react.useEffect)(() => {
				const el = scrollRef.current;
				if (el === null || currentId === void 0) return;
				el.querySelector(`[data-tab-session="${CSS.escape(currentId)}"]`)?.scrollIntoView({
					block: "nearest",
					inline: "nearest"
				});
			}, [currentId, display.length]);
			if (seat === null || display.length === 0) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wgTabs",
				role: "tablist",
				"aria-label": t("tabs.aria"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "wgTabsScroll",
					ref: scrollRef,
					onWheel: (event) => {
						const el = event.currentTarget;
						if (el.scrollWidth <= el.clientWidth) return;
						const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
						if (delta === 0) return;
						const atStart = el.scrollLeft <= 0 && delta < 0;
						const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0;
						if (atStart || atEnd) return;
						el.scrollLeft += delta;
						event.preventDefault();
					},
					children: display.map((tab) => {
						const summary = list.byId[tab.sessionId];
						const label = summary === void 0 ? tab.sessionId : summary.blank ? t("newSession") : summary.displayTitle;
						const active = tab.sessionId === currentId;
						const indicator = tabIndicator(summary, statuses.get(tab.sessionId));
						const project = projects.get(tab.sessionId);
						const tip = project === void 0 ? label : `${project.label} · ${label}\n${project.path}`;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `wgTab${active ? " wgTabActive" : ""}`,
							"data-tab-session": tab.sessionId,
							...project !== void 0 ? { "data-tab-project": project.workspaceId } : {},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								"aria-selected": active,
								className: "wgTabMain",
								title: tip,
								onClick: () => {
									activate(tab.sessionId);
								},
								onDoubleClick: () => {
									rename(tab.sessionId, label);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgTabStatus",
									"data-tab-state": indicator.attention ? "attention" : indicator.running ? "running" : indicator.unread ? "unread" : indicator.settled ? "settled" : "idle",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(indicator) })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "wgTabText",
									children: [project !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgTabProject",
										title: project.path,
										children: project.label
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgTabLabel",
										children: label
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("tabs.close"),
								side: "top",
								delayMs: 600,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgTabClose",
									"aria-label": `${t("tabs.close")} ${label}`,
									onClick: (event) => {
										event.stopPropagation();
										actions.close(tab.sessionId);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillMedium, {})
								})
							})]
						}, tab.order);
					})
				})
			}), seat);
		}
		// src/client/branch.ts
		/**
		* Plan the route: one segment per row after the first, plus the dot positions.
		*
		* Kept separate from the string assembly so the length walk and the SVG `d`
		* always describe the same geometry — measuring one path against another is how
		* a grown/ghost pair drifts out of sync.
		*
		* The stem lands on each row's OWN anchor (x) and centre (y), so uneven row
		* heights and the tree's per-row indents both stay exact. A group row's anchor
		* is pushed out by `BULGE_OFFSET`, which is what creates the kink.
		*
		* @param rows - visible rows in render order, carrying measured anchors.
		* @returns the per-row segments and dot x positions.
		*/
		function plan(rows) {
			const segments = [];
			const first = rows[0];
			const dotX = [first.x];
			let x = first.x;
			for (let i = 1; i < rows.length; i += 1) {
				const row = rows[i];
				const startY = rows[i - 1].y;
				const endY = row.y;
				const midY = startY + (endY - startY) / 2;
				const target = row.x;
				if (target === x) segments.push({
					d: `L ${x} ${endY}`,
					length: Math.abs(endY - startY),
					from: {
						x,
						y: startY
					},
					to: {
						x,
						y: endY
					}
				});
				else {
					segments.push({
						d: `C ${x} ${midY}, ${target} ${midY}, ${target} ${endY}`,
						length: Math.hypot(target - x, endY - midY),
						from: {
							x,
							y: startY
						},
						to: {
							x: target,
							y: endY
						},
						controlX: x
					});
					x = target;
				}
				dotX.push(x);
			}
			return {
				segments,
				dotX
			};
		}
		/**
		* Shorten a move so it stops `clearance` short of its end point.
		*
		* Used only on the LAST move of the grown run, which is what hides the stroke
		* behind the bloom. A straight move is trimmed along its axis; a curved move is
		* trimmed by moving its end and its control point together, which shortens the
		* curve while keeping its vertical tangents (so the kink's shape is preserved
		* rather than being flattened into a line).
		*
		* Returns the move unchanged when it is too short to trim (the stem would
		* invert), so a cramped layout degrades to "line meets flower" rather than
		* producing a backwards path.
		*
		* @param segment - the move to shorten.
		* @param clearance - distance to stop short of the end.
		* @returns the shortened move.
		*/
		function trimEnd(segment, clearance) {
			const { from, to } = segment;
			const span = Math.hypot(to.x - from.x, to.y - from.y);
			if (span <= clearance) return segment;
			if (segment.controlX === void 0) {
				const ratio = (span - clearance) / span;
				const endX = from.x + (to.x - from.x) * ratio;
				const endY = from.y + (to.y - from.y) * ratio;
				return {
					...segment,
					d: `L ${endX} ${endY}`,
					to: {
						x: endX,
						y: endY
					},
					length: span - clearance
				};
			}
			const endY = to.y - clearance;
			const controlY = from.y + (to.y - from.y) / 2 - clearance;
			const endX = to.x;
			return {
				...segment,
				d: `C ${segment.controlX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`,
				to: {
					x: endX,
					y: endY
				},
				length: Math.max(0, segment.length - clearance)
			};
		}
		/**
		* Build the branch for a list of rows.
		*
		* @param rows - visible rows in render order, each carrying its MEASURED centre.
		* @returns the branch geometry; empty strings when there are no rows.
		*/
		function buildBranch(rows) {
			const first = rows[0];
			if (first === void 0) return {
				ghostPath: "",
				grownPath: "",
				ghostLength: 0,
				grownLength: 0,
				dots: [],
				flower: null,
				height: 0
			};
			const { segments, dotX } = plan(rows);
			const head = `M ${first.x} ${first.y}`;
			const dots = rows.map((row, index) => ({
				key: row.key,
				cx: dotX[index] ?? row.x,
				cy: row.y,
				active: row.active
			}));
			const activeIndex = rows.findIndex((row) => row.active);
			const hasActive = activeIndex >= 0;
			const grownTo = hasActive ? activeIndex : 0;
			const flowerAt = dots[grownTo];
			const flower = hasActive && flowerAt !== void 0 ? {
				key: flowerAt.key,
				cx: flowerAt.cx,
				cy: flowerAt.cy
			} : null;
			const join = (list) => list.length === 0 ? head : [head, ...list.map((s) => s.d)].join(" ");
			const grownSegments = segments.slice(0, grownTo);
			const lastGrown = grownSegments[grownSegments.length - 1];
			const grownStroke = lastGrown === void 0 ? grownSegments : [...grownSegments.slice(0, -1), trimEnd(lastGrown, 7)];
			const lengthOf = (count) => segments.slice(0, count).reduce((sum, s) => sum + s.length, 0);
			const last = rows[rows.length - 1];
			const tail = rows.length > 1 ? Math.abs(last.y - rows[rows.length - 2].y) / 2 : 0;
			return {
				ghostPath: join(segments),
				grownPath: join(grownStroke),
				ghostLength: lengthOf(segments.length),
				grownLength: Math.max(0, lengthOf(grownTo) - (lastGrown === void 0 ? 0 : 7)),
				dots,
				flower,
				height: last.y + tail
			};
		}
		// src/client/FlowerBranch.tsx
		/**
		* The flower branch: an SVG overlay that draws one continuous curly stem down
		* the sidebar tree, growing to the row you are currently on.
		*
		* Ported from the RewampUI *Flower Sidebar* reference. The mechanism, verified
		* against that page's live DOM:
		*
		*   - TWO paths share one `d` prefix: a **ghost** (dashed, faded) drawing the
		*     whole route, and a **grown** solid stroke drawn only as far as the active
		*     row. The grown one is what makes the branch look like it grew to you.
		*   - A **dot per row**, sitting exactly on the curve.
		*   - A **flower at the endpoint**: the stem grows into a bloom on the row you
		*     are on, which is where the grown stroke stops. The bloom TURNS while that
		*     session is working and rests when it is idle.
		*   - The whole SVG is `pointer-events: none` and `overflow: visible`, so it is
		*     pure decoration over the real rows and never intercepts a click.
		*
		* Measurement, not layout: the rows are rendered by the tree itself (they carry
		* drag handlers, menus and hover state), so this component reads each row's
		* vertical centre from the DOM and feeds plain numbers to `buildBranch`. That
		* keeps the geometry unit-tested (`branch.ts`) while the SVG stays a dumb
		* renderer of it.
		*
		* Re-measured on: row count changes (expand/collapse, new session), the active
		* row changing, and container resize. A `ResizeObserver` on the scroll body
		* covers the last one without a window listener.
		*
		* The bloom's spin is NOT re-measured here: it arrives as the `spinning` prop
		* and is applied as a class, so a status flip never re-runs the DOM measurement
		* above (the tree is the expensive part, not the class swap).
		*/
		/**
		* Attribute the tree puts on every row the branch should connect. */
		const BRANCH_ROW_ATTRIBUTE = "data-wg-branch-row";
		/**
		* Attribute marking the row the stem should grow to.
		*
		* Only the DEEPEST row gets this (the session). Its ancestors — the project and
		* the category that contain it — deliberately do NOT, because a session belongs
		* to both and marking all three would make "which row is active?" ambiguous.
		* When several rows do carry it, the deepest (last in document order) wins.
		*/
		const BRANCH_ACTIVE_ATTRIBUTE = "data-wg-branch-active";
		/**
		* The bloom's petal outline, in the 1024-unit box the artwork was drawn in.
		*
		* This is the user's own flower glyph verbatim: an eight-petal bloom around a
		* ringed center. Kept as a path (not a component) because it is a constant.
		*/
		const FLOWER_PATH = "M375.3728 841.8432c92.96-12.5184 203.8784-71.264 299.5456-166.9248 22.6112-22.6112 43.1616-46.08 61.5232-69.952C712.7616 786.3936 621.2608 921.6 512 921.6c-51.1488 0-98.4-29.632-136.6272-79.7568z m-87.808-422.8096C311.2384 237.6064 402.7328 102.4 512 102.4c51.1488 0 98.4 29.632 136.6272 79.7568-92.96 12.5184-203.8784 71.264-299.5456 166.9248a719.1232 719.1232 0 0 0-61.5232 69.952z m-129.536 139.5648c57.3248 74.2464 163.6608 140.9344 294.336 175.9488a719.1232 719.1232 0 0 0 91.3472 18.304c-168.9664 70.208-331.808 58.5728-386.432-36.0512-25.5744-44.288-23.5456-100.032 0.7552-158.2016z m322.2592-287.4496c168.9664-70.208 331.808-58.5728 386.432 36.0512 25.5744 44.288 23.5456 100.032-0.7552 158.2016-57.3184-74.2464-163.648-140.9344-294.336-175.9488a719.1232 719.1232 0 0 0-91.3408-18.304zM294.656 228.7552c-35.6352 86.7648-40.224 212.1984-5.2032 342.8736a719.1232 719.1232 0 0 0 29.8176 88.256C173.9904 548.6592 102.6432 401.824 157.2736 307.2c25.5744-44.288 74.8608-70.4 137.3824-78.4448z m410.0736 135.36c145.28 111.2256 216.6272 258.0608 161.9968 352.6848-25.5744 44.288-74.8608 70.4-137.3824 78.4448 35.6352-86.7648 40.224-212.1984 5.2032-342.8736a719.1232 719.1232 0 0 0-29.8176-88.256zM512 678.4c-88.3648 0-160-71.6352-160-160s71.6352-160 160-160 160 71.6352 160 160-71.6352 160-160 160z m0-83.2c42.4128 0 76.8-34.3872 76.8-76.8s-34.3872-76.8-76.8-76.8-76.8 34.3872-76.8 76.8 34.3872 76.8 76.8 76.8z";
		/** Petal colour: the accent the glyph was drawn in. */
		const FLOWER_PETAL = "#fa541c";
		/**
		* Rendered size of the bloom, as a scale factor over the authored 1024 box.
		*
		* 17 / 1024 ≈ 0.0166 puts the flower at ~17px: clear of neighbouring rows (rows
		* are 28px tall) while still reading as a flower rather than a dot at the end of
		* the stem.
		*/
		const FLOWER_SCALE = 17 / 1024;
		/**
		* The bloom at the branch's endpoint.
		*
		* Anchoring is done entirely by these transforms, in this order:
		*
		*   1. `translate(cx cy)` — put the origin on the stem's tip (the endpoint of
		*      the grown stroke).
		*   2. `scale(FLOWER_SCALE)` — shrink the 1024-unit artwork about that origin.
		*   3. `translate(-512 -512)` — bring the glyph's own centre (512, 512) onto the
		*      origin, so the flower is centred on the tip.
		*
		* The spin is applied by `wgFlowerArt` in CSS as a `rotate()` composed AFTER
		* that recentring (`translate(-512 -512) rotate(...)`), so the bloom turns about
		* its own centre and the recentring never drifts as it rotates.
		*
		* Note what is deliberately NOT used here: a percentage `translate(-50%, -50%)`
		* or `transform-box: fill-box` + percentage `transform-origin`. Measured on the
		* live page, the percentage form resolved against the SVG VIEWPORT rather than
		* the path's box, translating by (-24, -409.5) instead of (-373, -409.6) and
		* parking the bloom well right of the stem. Explicit user units remove the
		* question: 512 is the measured centre, not an inferred one.
		*
		* The flower rests while the session is idle and turns while it works: one
		* animation, paused rather than removed, so a state flip resumes the turn
		* instead of snapping the petals back to 0deg.
		*
		* @param props - endpoint coordinates and whether the session is working.
		* @returns the bloom group.
		*/
		function Flower({ cx, cy, spinning }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
				className: spinning ? "wgFlower wgFlowerSpinning" : "wgFlower",
				transform: `translate(${cx} ${cy}) scale(${FLOWER_SCALE}) translate(-512 -512)`,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					className: "wgFlowerArt",
					d: FLOWER_PATH,
					fill: FLOWER_PETAL
				})
			});
		}
		/**
		* Render the branch for the rows currently inside `scope`.
		* @param props - the element to measure, and whether the open session is working.
		* @returns the SVG overlay, or null until at least one row is measured.
		*/
		function FlowerBranch({ scope, spinning }) {
			const [rows, setRows] = (0, react.useState)([]);
			const measureKey = (0, react.useRef)("");
			const [branch, setBranch] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (scope === null) {
					setRows([]);
					setBranch(null);
					return;
				}
				const measure = () => {
					const nodes = Array.from(scope.querySelectorAll(`[${BRANCH_ROW_ATTRIBUTE}]`));
					if (nodes[0] === void 0) {
						if (measureKey.current !== "") {
							measureKey.current = "";
							setRows([]);
							setBranch(null);
						}
						return;
					}
					const activeIndex = nodes.reduce((found, node, index) => node.hasAttribute("data-wg-branch-active") ? index : found, -1);
					const kinds = nodes.map((n) => n.hasAttribute("data-wg-branch-group") ? "group" : "item").join("");
					const depths = nodes.map((n) => n.getAttribute("data-wg-depth") ?? "0").join(",");
					const key = `${nodes.length}|${activeIndex}|${kinds}|${depths}|${Math.round(scope.clientWidth)}`;
					if (key === measureKey.current) return;
					measureKey.current = key;
					const measured = nodes.map((node, index) => ({
						key: `${index}`,
						y: center(node),
						x: anchorX(node),
						kind: node.hasAttribute("data-wg-branch-group") ? "group" : "item",
						active: index === activeIndex
					}));
					setRows(measured);
					setBranch(buildBranch(measured));
				};
				/** Vertical centre of a node, relative to the scope box. */
				function center(node) {
					const r = node.getBoundingClientRect();
					const s = scope.getBoundingClientRect();
					return r.top - s.top + r.height / 2;
				}
				/**
				* Horizontal anchor of a row, relative to the scope box.
				*
				* A row with a chevron anchors to that triangle's CENTRE: it is the marker
				* the user already reads as "this row opens", so the stem hangs off it
				* instead of floating beside it. A chevron-less row (a session) has no
				* marker, so it anchors to where its own content starts — the status dot's
				* centre, which is the first thing in the row.
				*/
				function anchorX(node) {
					const s = scope.getBoundingClientRect();
					const box = (node.querySelector(".wgChevron") ?? node.querySelector("[class*=\"wgStatusSlot\"]") ?? node.querySelector("[class*=\"wgCategoryIcon\"]") ?? node.querySelector("[class*=\"wgRowIcon\"]") ?? node).getBoundingClientRect();
					return box.left - s.left + box.width / 2;
				}
				measure();
				const observer = new MutationObserver(measure);
				observer.observe(scope, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: [BRANCH_ACTIVE_ATTRIBUTE, "data-wg-depth"]
				});
				const resizer = new ResizeObserver(measure);
				resizer.observe(scope);
				return () => {
					observer.disconnect();
					resizer.disconnect();
				};
			}, [scope]);
			const dots = (0, react.useMemo)(() => branch?.dots ?? [], [branch]);
			const flowerKey = branch?.flower?.key;
			if (branch === null || rows.length === 0) return null;
			const maxRowX = rows.reduce((max, row) => Math.max(max, row.x), 32);
			const svgWidth = Math.max(48, Math.ceil(maxRowX + 16));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "wgBranch",
				width: svgWidth,
				height: Math.max(1, Math.ceil(branch.height)),
				viewBox: `0 0 ${svgWidth} ${Math.max(1, Math.ceil(branch.height))}`,
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "wgBranchGhost",
						d: branch.ghostPath
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "wgBranchGrown",
						d: branch.grownPath
					}),
					dots.map((dot) => {
						if (dot.key === flowerKey) return null;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							className: dot.active ? "wgBranchDot wgBranchDotActive" : "wgBranchDot",
							cx: dot.cx,
							cy: dot.cy,
							r: dot.active ? 3.2 : 2
						}, dot.key);
					}),
					branch.flower !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Flower, {
						cx: branch.flower.cx,
						cy: branch.flower.cy,
						spinning
					})
				]
			});
		}
		// \0dsh-workspace-groups-inline-css:C:\Users\owllight\.gemini\antigravity\scratch\dsh-workspace-groups-nested\src\client\styles.css.mjs
		var styles_css_default = ".wgRoot{box-sizing:border-box;flex-direction:column;flex:1;width:100%;min-height:0;display:flex;overflow:hidden}.wgSectionHeader{flex:none;align-items:center;gap:4px;height:36px;padding:0 12px;display:flex}.wgSectionLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:45%;color:var(--dsw-fg-1,inherit);flex:none;font-size:12px;font-weight:600;overflow:hidden}.wgIconButton{width:26px;height:26px;color:var(--dsw-fg-2,inherit);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}.wgIconButton:hover{background:var(--dsw-bg-hover,#7f7f7f1f);color:var(--dsw-fg-1,inherit)}.wgIconButton:disabled{opacity:.5;cursor:default}.wgSearch{flex:1;align-items:center;min-width:0;max-width:28px;margin-left:auto;transition:max-width .18s;display:flex}.wgSearchExpanded{max-width:100%}.wgSearchInput{min-width:0;color:var(--dsw-fg-1,inherit);background:0 0;border:none;outline:none;flex:1;padding:0;font-size:12px}.wgTreeBody{flex:1;min-height:0;padding:0 8px 8px;overflow-y:auto}.wgList{flex-direction:column;gap:1px;display:flex}.wgEmpty{text-align:center;color:var(--dsw-fg-3,#7f7f7fcc);padding:16px 8px;font-size:12px}.wgCategoryRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px;display:flex;position:relative}.wgCategoryRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgCategoryRow:hover .wgRowActions,.wgCategoryRow:focus-within .wgRowActions{opacity:1}.wgDropTarget{background:var(--dsw-bg-selected,#4a90d92e);outline:1px dashed var(--dsw-accent,#4a90d9);outline-offset:-1px}.wgInsertBefore:before,.wgInsertAfter:after{content:\"\";background:var(--dsw-accent,#4a90d9);height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-accent,#4a90d9) 25%, transparent);pointer-events:none;z-index:6;border-radius:1px;position:absolute;left:2px;right:2px}.wgInsertBefore:before{top:-1px}.wgInsertAfter:after{bottom:-1px}.wgChevron{width:14px;height:14px;color:var(--dsw-fg-3,#7f7f7fcc);flex:none;justify-content:center;align-items:center;transition:transform .12s;display:inline-flex}.wgChevronOpen{transform:rotate(90deg)}.wgCategoryIcon{color:var(--dsw-fg-2,inherit);flex:none;justify-content:center;align-items:center;display:inline-flex}.wgCategoryLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-1,inherit);flex:1;font-size:12px;font-weight:600;overflow:hidden}.wgCategoryCount{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgProjectRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px 0 20px;display:flex;position:relative}.wgProjectFlat{padding-left:4px}.wgTopLevelArea{margin-top:2px;padding-bottom:10px}.wgTopLevelEmpty{border-radius:4px;height:14px;position:relative}.wgTopLevelEmptyLine{background:var(--dsw-accent,#4a90d9);height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-accent,#4a90d9) 25%, transparent);pointer-events:none;border-radius:1px;position:absolute;top:50%;left:2px;right:2px}.wgTopLevelEmptyActive{background:var(--dsw-bg-selected,#4a90d92e)}.wgProjectRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgProjectActive .wgProjectLabel{font-weight:600}.wgProjectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-size:12px;font-weight:500;font-family:var(--dsw-font-family,inherit);flex:1;overflow:hidden}.wgRowActions{opacity:0;flex:none;align-items:center;gap:2px;display:inline-flex}.wgProjectRow:hover .wgRowActions,.wgProjectRow:focus-within .wgRowActions{opacity:1}.wgTreeWrap{position:relative}.wgBranch{z-index:2;pointer-events:none;position:absolute;top:0;left:0;overflow:visible}.wgTreeWrap>.wgList{z-index:1;position:relative}.wgBranchGhost{fill:none;stroke:var(--dsw-alias-border-l2,#7f7f7f47);stroke-width:1.5px;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}.wgBranchGrown{fill:none;stroke:var(--dsw-alias-label-primary,currentColor);stroke-width:2px;stroke-linecap:round;vector-effect:non-scaling-stroke;transition:stroke .16s}.wgBranchDot{fill:var(--dsw-alias-border-l2,#7f7f7f80);transition:r .16s,fill .16s}.wgBranchDotActive{fill:var(--dsw-alias-label-primary,currentColor)}.wgFlowerArt{transform-box:fill-box;transform-origin:50%;animation:4s linear infinite paused wg-flower-spin}.wgFlowerSpinning .wgFlowerArt{animation-play-state:running}@keyframes wg-flower-spin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.wgBranchGrown,.wgBranchDot{transition:none}.wgFlowerArt{animation:none}}.wgTreeChildren{position:relative}.wgSessionRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:6px;height:28px;padding:0 4px 0 40px;display:flex}.wgSessionRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgSessionRow:hover .wgRowActions,.wgSessionRow:focus-within .wgRowActions{opacity:1}.wgSelected{background:var(--dsw-bg-selected,#4a90d92e)}.wgStatusSlot{flex:none;justify-content:center;align-items:center;width:14px;height:14px;display:inline-flex}.wgSessionTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));flex:1;font-size:12px;overflow:hidden}.wgSelected .wgSessionTitle{color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-weight:500}.wgSessionTime{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgVisuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.wgMatched{background:var(--dsw-bg-selected,#4a90d92e)}.wgSessionSnippet{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-3,#7f7f7fcc);flex:1;font-size:11px;overflow:hidden}.wgSearchStatus{color:var(--dsw-fg-3,#7f7f7fcc);text-align:center;padding:8px;font-size:11px}.wgManualError{color:var(--dsw-fg-1,inherit);text-align:left;word-break:break-word}.wgRail{flex-direction:column;align-items:center;gap:12px;padding:8px 0 0;display:flex;overflow:hidden}.wgRail .wgSectionHeader{flex-direction:column;align-self:center;align-items:center;gap:12px;width:36px;height:auto;padding:0}.wgRail .wgIconButton{border-radius:50%;width:36px;height:36px}.wgRail .wgTreeBody{display:none}.wgAddError{color:var(--dsw-fg-1,inherit);white-space:pre-wrap;word-break:break-word;max-height:200px;font-size:12px;overflow-y:auto}.wgRenameInput{border:1px solid var(--dsw-border,#7f7f7f4d);background:var(--dsw-bg-1,transparent);width:100%;color:var(--dsw-fg-1,inherit);border-radius:6px;outline:none;padding:6px 8px;font-size:13px}.wgRenameInput:focus{border-color:var(--dsw-accent,#4a90d9)}.wgQuickOverlay{z-index:1100;background:var(--dsw-alias-bg-mask-1,#00000052);backdrop-filter:var(--dsw-mask-blur,blur(2px));justify-content:center;align-items:flex-start;padding:10vh 24px 24px;display:flex;position:fixed;inset:0}.wgQuickCard{border:1px solid var(--dsw-border,#7f7f7f33);background:var(--dsw-alias-bg-layer-2,var(--dsw-bg-1,#fff));width:min(640px,100%);max-height:min(560px,90vh - 48px);box-shadow:var(--dsw-elevation-prominent,0 16px 48px #00000040);box-sizing:border-box;border-radius:12px;flex-direction:column;gap:10px;padding:14px;display:flex;overflow:hidden}.wgQuickHeader{flex:none;justify-content:space-between;align-items:center;gap:12px;display:flex}.wgQuickTitle{color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-size:13px;font-weight:600}.wgQuickTabs{gap:2px;display:flex}.wgQuickTab{color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:6px;padding:4px 12px;font-family:inherit;font-size:12px;display:inline-flex}.wgQuickTab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgQuickTabActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-selected,#4a90d92e));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-weight:600}.wgQuickTabCount{background:var(--dsw-accent,#4a90d9);color:#fff;text-align:center;border-radius:8px;min-width:16px;height:16px;padding:0 4px;font-size:10px;font-weight:600;line-height:16px}.wgQuickSearchWrap{flex:none}.wgQuickSearch{border:1px solid var(--dsw-border,#7f7f7f4d);background:var(--dsw-bg-1,transparent);width:100%;height:34px;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));box-sizing:border-box;border-radius:8px;outline:none;padding:0 10px;font-family:inherit;font-size:13px}.wgQuickSearch:focus{border-color:var(--dsw-accent,#4a90d9)}.wgQuickList{flex-direction:column;flex:auto;gap:2px;min-height:64px;padding-right:2px;display:flex;overflow-y:auto}.wgQuickRow{cursor:pointer;text-align:left;box-sizing:border-box;background:0 0;border:none;border-radius:8px;flex-direction:column;flex:none;gap:2px;width:100%;padding:7px 10px;font-family:inherit;display:flex}.wgQuickRow:hover,.wgQuickRowActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgQuickRowSelected,.wgQuickRowCurrent{background:var(--dsw-bg-selected,#4a90d92e)}.wgQuickRowMain{align-items:center;gap:8px;width:100%;min-width:0;display:flex}.wgQuickRowTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:1;font-size:13px;font-weight:500;overflow:hidden}.wgQuickRunBadge{color:var(--dsw-accent,#4a90d9);flex:none;font-size:11px}.wgQuickTime{color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:none;font-size:11px}.wgQuickRowSub{min-width:0;display:flex}.wgQuickRowPath{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:1;font-size:11px;overflow:hidden}.wgQuickEmpty{text-align:center;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));padding:24px 8px;font-size:12px}.wgQuickFooter{flex:none;align-items:center;gap:8px;padding-top:2px;display:flex}.wgQuickSelected{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:1;font-size:12px;overflow:hidden}.wgQuickHint{text-align:center;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:none;font-size:11px}.wgTabs{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2,#7f7f7f33);background:0 0;flex:none;align-items:stretch;gap:4px;min-width:0;height:56px;padding:8px 10px;display:flex}.wgTabsScroll{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;box-sizing:border-box;flex:auto;align-items:stretch;gap:6px;min-width:0;padding:1px 0;display:flex;overflow:auto hidden}.wgTabsScroll::-webkit-scrollbar{width:0;height:0;display:none}.wgTab{min-width:0;max-width:240px;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2,#7f7f7f2e);color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));border-radius:8px;flex:none;align-items:center;padding:0 6px 0 10px;transition:background .12s,box-shadow .12s;display:inline-flex}.wgTabText{flex-direction:column;flex:auto;justify-content:center;align-items:flex-start;gap:3px;min-width:0;height:100%;display:flex}.wgTabProject{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:100%;font-family:var(--dsw-font-family,inherit);letter-spacing:.02em;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,inherit));opacity:.85;flex:none;font-size:10px;line-height:13px;overflow:hidden}.wgTab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgTabActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));box-shadow:inset 0 0 0 1px var(--dsw-alias-label-secondary,#7f7f7f73);color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgTabActive .wgTabProject{opacity:1}.wgTabMain{box-sizing:border-box;min-width:0;height:100%;color:inherit;cursor:pointer;background:0 0;border:none;flex:auto;align-items:center;gap:8px;padding:6px 0;font-family:inherit;font-size:12px;display:inline-flex}.wgTabStatus{flex:none;justify-content:center;align-items:center;width:12px;height:12px;display:inline-flex}.wgTabStatus[data-tab-state=idle]{opacity:.45}.wgTabLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:100%;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:none;font-size:12px;line-height:16px;overflow:hidden}.wgTabText>.wgTabLabel:only-child{align-self:center}.wgTabClose{width:20px;height:20px;color:inherit;cursor:pointer;opacity:0;background:0 0;border:none;border-radius:5px;flex:none;justify-content:center;align-items:center;margin-left:2px;padding:0;transition:opacity .12s,background .12s;display:inline-flex}.wgTab:hover .wgTabClose,.wgTab:focus-within .wgTabClose,.wgTabActive .wgTabClose{opacity:1}.wgTabClose:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#7f7f7f33)}.wgCategoryRow{padding:0 4px 0 calc(4px + min(var(--wg-depth,0), 5) * 14px);transition:background .12s}.wgCategoryRow:not(.wgCategorySub){margin-top:2px}.wgCategorySub .wgCategoryLabel{font-weight:500}.wgCategorySub .wgCategoryIcon{opacity:.78}.wgCategoryActive>.wgCategoryIcon{color:var(--dsw-accent,#4a90d9);opacity:1}.wgCategoryCount{font-variant-numeric:tabular-nums;text-align:center;background:color-mix(in srgb, var(--dsw-fg-3,#7f7f7f) 11%, transparent);border-radius:999px;min-width:18px;height:16px;padding:0 5px;font-size:10.5px;line-height:16px}.wgCategoryManageable:hover .wgCategoryCount,.wgCategoryManageable:focus-within .wgCategoryCount{display:none}.wgProjectRow{padding:0 4px 0 calc(4px + min(var(--wg-depth,1), 6) * 14px);transition:background .12s}.wgProjectRow.wgProjectFlat{padding-left:4px}.wgSessionRow{padding:0 4px 0 calc(22px + min(var(--wg-depth,1), 6) * 14px)}.wgSubgroupChildren{position:relative}.wgSubgroupChildren:before{content:\"\";left:calc(11px + min(var(--wg-guide-depth,0), 5) * 14px);background:var(--dsw-alias-border-l2,#7f7f7f38);pointer-events:none;opacity:0;width:1px;transition:opacity .18s;position:absolute;top:2px;bottom:4px}.wgTreeWrap:hover .wgSubgroupChildren:before{opacity:.55}.wgDropTarget{background:color-mix(in srgb, var(--dsw-accent,#4a90d9) 13%, transparent);box-shadow:inset 0 0 0 1.5px var(--dsw-accent,#4a90d9);outline:none}.wgDropBadge{background:var(--dsw-accent,#4a90d9);color:#fff;border-radius:999px;flex:none;padding:1px 6px;font-size:10px;font-weight:600;line-height:14px}.wgInsertBefore:before,.wgInsertAfter:after{left:calc(4px + min(var(--wg-depth,0), 5) * 14px);right:2px}.wgDialogBreadcrumb{color:var(--dsw-fg-2,inherit);background:color-mix(in srgb, var(--dsw-fg-3,#7f7f7f) 10%, transparent);word-break:break-all;border-radius:6px;margin-bottom:8px;padding:5px 8px;font-size:11px}.wgDialogHint{color:var(--dsw-fg-3,#7f7f7fcc);margin-top:6px;font-size:11px;line-height:1.4}";
		// src/client/GroupsBrowser.tsx
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
		const SEARCH_DEBOUNCE_MS = 250;
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		const SPRING_EXPAND_DELAY_MS = 550;
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			return withoutNul.slice(0, SEARCH_QUERY_MAX_CODE_UNITS);
		}
		/** Light runtime guard for the manual overlay attached to the config fetch. */
		function isManualGroups(value) {
			if (typeof value !== "object" || value === null) return false;
			const candidate = value;
			return Array.isArray(candidate.categories) && typeof candidate.assignments === "object" && candidate.assignments !== null;
		}
		/** Minimal fetch of the grouping config + runtime overlay (no-cache revalidation). */
		async function fetchGroupsConfig() {
			const response = await fetch("/workspace-groups/config", { cache: "no-cache" });
			if (!response.ok) throw new Error(`config request failed: ${response.status}`);
			const body = await response.json();
			return {
				config: Array.isArray(body.categories) ? body : { categories: [] },
				manual: isManualGroups(body.manual) ? normalizeManual(body.manual) : EMPTY_MANUAL
			};
		}
		/** Persist the whole runtime overlay (idempotent; the host validates + writes). */
		async function saveManualOverlay(manual) {
			const response = await fetch("/workspace-groups/manual", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(manual)
			});
			if (!response.ok) {
				let message = `manual save failed: ${response.status}`;
				try {
					const text = await response.text();
					if (text !== "") message = text;
				} catch {}
				throw new Error(message);
			}
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useSessionStatus, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, pickDirectory, directoryFlow, searchSessions, searchResultLimit, openTab, useTabs, tabActions, t }) {
			(0, react.useEffect)(() => {
				const style = document.createElement("style");
				style.setAttribute("data-plugin", "dsh-workspace-groups");
				style.textContent = styles_css_default;
				document.head.append(style);
				return () => {
					style.remove();
				};
			}, []);
			const [quickOpen, setQuickOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const onKeyDown = (e) => {
					if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === "r" || e.key === "R")) {
						e.preventDefault();
						e.stopPropagation();
						setQuickOpen((v) => !v);
					}
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => window.removeEventListener("keydown", onKeyDown, true);
			}, []);
			const [config, setConfig] = (0, react.useState)({ categories: [] });
			const [manual, setManual] = (0, react.useState)(EMPTY_MANUAL);
			const [configError, setConfigError] = (0, react.useState)(null);
			const reloadConfig = () => {
				setConfigError(null);
				fetchGroupsConfig().then(({ config: nextConfig, manual: nextManual }) => {
					setConfig(nextConfig);
					setManual(nextManual);
				}).catch((reason) => {
					setConfigError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			(0, react.useEffect)(() => {
				reloadConfig();
			}, []);
			const [manualError, setManualError] = (0, react.useState)(null);
			const [manualSaving, setManualSaving] = (0, react.useState)(false);
			const workspaces = useWorkspaces((state) => state.items);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const categoryExpansion = useStore((s) => s.categoryExpansion);
			const workspaceExpansion = useStore((s) => s.workspaceExpansion);
			const list = useSessions((s) => s);
			const statuses = useSessionStatus((s) => s);
			const current = currentSessionId(list);
			const currentWorkspaceKey = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId;
			const currentRunning = current !== void 0 && ((statuses.get(current)?.running ?? false) || (list.byId[current]?.running ?? false));
			(0, react.useEffect)(() => {
				if (current === void 0 || currentWorkspaceKey === void 0) return;
				const category = categoriesForCurrent(config, workspaces, current, manual);
				if (category !== void 0) {
					for (const key of [...ancestorCategoryKeys(category), category]) if (!Object.hasOwn(categoryExpansion, key)) actions.setCategoryExpanded(key, true);
				}
				if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) actions.setWorkspaceExpanded(currentWorkspaceKey, true);
			}, [
				current,
				currentWorkspaceKey,
				config,
				workspaces,
				manual,
				categoryExpansion,
				workspaceExpansion,
				actions
			]);
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainKeys(allCategoryKeys(config, manual), workspaces.map((w) => w.workspaceId));
			}, [
				actions,
				config,
				manual,
				workspacePhase,
				workspaces
			]);
			(0, react.useEffect)(() => {
				if (current === void 0) return;
				openTab(current, statuses.get(current));
			}, [
				current,
				list,
				statuses,
				openTab
			]);
			const [query, setQuery] = (0, react.useState)("");
			const [searchExpanded, setSearchExpanded] = (0, react.useState)(false);
			const normalizedQuery = sanitizeSearchQuery(query).trim();
			const [remoteSearch, setRemoteSearch] = (0, react.useState)({
				query: "",
				status: "idle",
				items: [],
				hasMore: false
			});
			const searchInput = (0, react.useRef)(null);
			const searchRoot = (0, react.useRef)(null);
			const branchScope = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (normalizedQuery === "") {
					setRemoteSearch({
						query: "",
						status: "idle",
						items: [],
						hasMore: false
					});
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				const timer = window.setTimeout(() => {
					searchSessions(normalizedQuery, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "ready",
							items: result.items,
							hasMore: result.hasMore
						});
					}).catch(() => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "error",
							items: [],
							hasMore: false
						});
					});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [normalizedQuery, searchSessions]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded) return;
				const onClick = (event) => {
					if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
					searchInput.current?.blur();
					if (normalizedQuery !== "") return;
					setSearchExpanded(false);
				};
				document.addEventListener("click", onClick);
				return () => {
					document.removeEventListener("click", onClick);
				};
			}, [
				normalizedQuery,
				wide,
				searchExpanded
			]);
			const expandedCategories = (0, react.useMemo)(() => Object.entries(categoryExpansion).filter(([, v]) => v).map(([k]) => k), [categoryExpansion]);
			const expandedWorkspaces = (0, react.useMemo)(() => Object.entries(workspaceExpansion).filter(([, v]) => v).map(([k]) => k), [workspaceExpansion]);
			const [dragging, setDragging] = (0, react.useState)(null);
			const [draggingNestedCategory, setDraggingNestedCategory] = (0, react.useState)(false);
			const groups = (0, react.useMemo)(() => deriveGroups(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces
			}, manual, statuses), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				statuses,
				expandedCategories,
				expandedWorkspaces
			]);
			const topLevel = (0, react.useMemo)(() => deriveTopLevel(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces
			}, manual, statuses), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				statuses,
				expandedCategories,
				expandedWorkspaces
			]);
			const categoryByWorkspace = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				const visit = (nodes) => {
					for (const category of nodes) {
						const breadcrumb = formatCategoryBreadcrumb(category.key);
						for (const workspace of category.workspaces) map.set(workspace.workspaceId, breadcrumb);
						visit(category.children);
					}
				};
				visit(groups);
				return map;
			}, [groups]);
			const topLevelDropActive = topLevel.length === 0 && (dragging === "workspace" || dragging === "category" && draggingNestedCategory);
			const topLevelRef = {
				kind: "topLevel",
				key: UNCATEGORIZED_KEY
			};
			const directoryFlowEntry = useDirectoryFlowEntry(directoryFlow);
			const [flowOpen, setFlowOpen] = (0, react.useState)(false);
			const [adding, setAdding] = (0, react.useState)(false);
			const [addError, setAddError] = (0, react.useState)(null);
			const [addErrorOpen, setAddErrorOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (flowOpen && directoryFlowEntry === null) setFlowOpen(false);
			}, [flowOpen, directoryFlowEntry]);
			const adoptPickedDirectory = async (path) => {
				setAdding(true);
				setAddError(null);
				setAddErrorOpen(false);
				try {
					const workspace = await createWorkspace({ path });
					setFlowOpen(false);
					startSession(workspace.workspaceId);
				} catch (reason) {
					const message = reason instanceof Error ? reason.message : String(reason);
					setFlowOpen(false);
					setAddError(message);
					setAddErrorOpen(true);
				} finally {
					setAdding(false);
				}
			};
			const addWorkspace = async () => {
				if (adding || flowOpen) return;
				setAddError(null);
				setAddErrorOpen(false);
				if (directoryFlowEntry !== null) {
					setFlowOpen(true);
					return;
				}
				setAdding(true);
				try {
					const path = await pickDirectory();
					if (path === null) return;
					startSession((await createWorkspace({ path })).workspaceId);
				} catch (reason) {
					const message = reason instanceof Error ? reason.message : String(reason);
					setAddError(message);
					setAddErrorOpen(true);
				} finally {
					setAdding(false);
				}
			};
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
			const confirmRename = () => {
				if (renameBlocked || renameTarget === null) return;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			const confirmDelete = () => {
				if (deleting || deleteTarget === null) return;
				setDeleting(true);
				setDeleteError(null);
				deleteWorkspace(deleteTarget.workspaceId).then(() => {
					setDeleting(false);
					setDeleteTarget(null);
				}).catch((reason) => {
					setDeleting(false);
					setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [sessionRenameTarget, setSessionRenameTarget] = (0, react.useState)(null);
			const [sessionRenameDraft, setSessionRenameDraft] = (0, react.useState)("");
			const [sessionRenaming, setSessionRenaming] = (0, react.useState)(false);
			const [sessionRenameError, setSessionRenameError] = (0, react.useState)(null);
			const sessionRenameTrimmed = sessionRenameDraft.trim();
			const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === "" || sessionRenameTarget === null;
			const confirmSessionRename = () => {
				if (sessionRenameBlocked || sessionRenameTarget === null) return;
				setSessionRenaming(true);
				setSessionRenameError(null);
				renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
					setSessionRenaming(false);
					setSessionRenameTarget(null);
				}).catch((reason) => {
					setSessionRenaming(false);
					setSessionRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSessionRename = (sessionId, currentTitle) => {
				setSessionRenameTarget({
					sessionId,
					currentTitle
				});
				setSessionRenameDraft(currentTitle);
				setSessionRenameError(null);
			};
			const activateTab = (sessionId) => {
				open(sessionId);
			};
			const onSessionArchive = (sessionId) => {
				archiveSession(sessionId).catch((reason) => {
					console.warn("session archive rejected:", reason);
				});
			};
			const [folderApp, setFolderApp] = (0, react.useState)(void 0);
			const [folderError, setFolderError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				fetchOpenInApps(controller.signal).then((apps) => {
					if (controller.signal.aborted) return;
					setFolderApp(folderAppId(apps));
				}).catch(() => {});
				return () => {
					controller.abort();
				};
			}, []);
			const openInFolder = folderApp === void 0 ? void 0 : (workspaceId) => {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				openPathInApp(folderApp, workspace.path).catch((reason) => {
					const detail = reason instanceof Error ? reason.message : String(reason);
					setFolderError({
						id: Date.now(),
						text: `${t("workspace.openInFolderError")}: ${detail}`
					});
				});
			};
			const [groupDialog, setGroupDialog] = (0, react.useState)(null);
			const [groupDraft, setGroupDraft] = (0, react.useState)("");
			const [groupError, setGroupError] = (0, react.useState)(null);
			const [groupBusy, setGroupBusy] = (0, react.useState)(false);
			const [groupDeleteTarget, setGroupDeleteTarget] = (0, react.useState)(null);
			const [groupDeleting, setGroupDeleting] = (0, react.useState)(false);
			const [groupDeleteError, setGroupDeleteError] = (0, react.useState)(null);
			const takenNames = (0, react.useMemo)(() => takenCategoryNames(config, manual), [config, manual]);
			const groupTrimmed = groupDraft.trim();
			const groupParentKey = groupDialog === null ? void 0 : groupDialog.mode === "create" ? groupDialog.parentKey : parentCategoryKey(groupDialog.from);
			const candidateNormalizedPath = groupDialog !== null && groupTrimmed !== "" ? normalizeCategoryPath(joinCategoryPath(groupParentKey, groupTrimmed)) : null;
			const groupNameIssue = groupDialog !== null && groupTrimmed !== "" ? groupTrimmed === "未分类" ? t("group.nameReserved") : candidateNormalizedPath === null ? t("group.nameInvalid") : groupDialog.mode === "rename" && candidateNormalizedPath === groupDialog.from ? null : groupDialog.mode === "rename" && isSameOrDescendantCategory(candidateNormalizedPath, groupDialog.from) ? t("group.nameCycle") : takenNames.has(candidateNormalizedPath) ? t("group.nameDuplicate") : null : null;
			const groupBlocked = groupBusy || groupTrimmed === "" || candidateNormalizedPath === null || groupNameIssue !== null || groupDialog !== null && groupDialog.mode === "rename" && candidateNormalizedPath === groupDialog.from;
			const confirmGroupDialog = () => {
				if (groupBlocked || groupDialog === null || candidateNormalizedPath === null) return;
				const nextPath = candidateNormalizedPath;
				const from = groupDialog.mode === "rename" ? groupDialog.from : void 0;
				const renaming = groupDialog.mode === "rename" && from !== void 0 && from !== nextPath;
				const next = groupDialog.mode === "create" ? createCategoryInManual(config, manual, nextPath) : renameOrMoveCategoryInManual(config, manual, from, nextPath);
				setGroupBusy(true);
				setGroupError(null);
				saveManualOverlay(next).then(() => {
					setManual(next);
					setManualError(null);
					setGroupBusy(false);
					setGroupDialog(null);
					setGroupDraft("");
					if (groupDialog.mode === "create") {
						for (const key of ancestorCategoryKeys(nextPath)) actions.setCategoryExpanded(key, true);
						actions.setCategoryExpanded(nextPath, true);
					} else if (renaming && from !== void 0) {
						for (const [key, expanded] of Object.entries(categoryExpansion)) if (expanded && isSameOrDescendantCategory(key, from)) actions.setCategoryExpanded(replaceCategoryPrefix(key, from, nextPath), true);
						actions.setCategoryExpanded(nextPath, true);
					}
				}).catch((reason) => {
					setGroupBusy(false);
					setGroupError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const groupDeleteHasSubgroups = (0, react.useMemo)(() => {
				if (groupDeleteTarget === null) return false;
				return allCategoryKeys(config, manual).some((k) => k !== groupDeleteTarget && isSameOrDescendantCategory(k, groupDeleteTarget));
			}, [
				config,
				manual,
				groupDeleteTarget
			]);
			const confirmGroupDelete = () => {
				if (groupDeleting || groupDeleteTarget === null) return;
				const next = deleteCategorySubtreeInManual(config, manual, workspaces, groupDeleteTarget);
				setGroupDeleting(true);
				setGroupDeleteError(null);
				saveManualOverlay(next).then(() => {
					setManual(next);
					setManualError(null);
					setGroupDeleting(false);
					setGroupDeleteTarget(null);
				}).catch((reason) => {
					setGroupDeleting(false);
					setGroupDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [dragIndicator, setDragIndicator] = (0, react.useState)(null);
			const draggedCategoryRef = (0, react.useRef)(null);
			const springExpandTimerRef = (0, react.useRef)(null);
			const springTargetKeyRef = (0, react.useRef)(null);
			const clearSpringExpand = () => {
				if (springExpandTimerRef.current !== null) {
					window.clearTimeout(springExpandTimerRef.current);
					springExpandTimerRef.current = null;
				}
				springTargetKeyRef.current = null;
			};
			const expansionSnapshot = (0, react.useRef)(null);
			const liveExpansionRef = (0, react.useRef)({
				categoryExpansion,
				workspaceExpansion,
				actions
			});
			liveExpansionRef.current = {
				categoryExpansion,
				workspaceExpansion,
				actions
			};
			const scheduleSpringExpand = (key) => {
				if (springTargetKeyRef.current === key) return;
				clearSpringExpand();
				if (liveExpansionRef.current.categoryExpansion[key] === true) return;
				springTargetKeyRef.current = key;
				springExpandTimerRef.current = window.setTimeout(() => {
					springExpandTimerRef.current = null;
					springTargetKeyRef.current = null;
					liveExpansionRef.current.actions.setCategoryExpanded(key, true);
				}, SPRING_EXPAND_DELAY_MS);
			};
			const preserveExpandedAfterDrag = (key) => {
				if (expansionSnapshot.current !== null) expansionSnapshot.current.categories[key] = true;
				actions.setCategoryExpanded(key, true);
			};
			(0, react.useEffect)(() => {
				const clear = () => {
					clearSpringExpand();
					draggedCategoryRef.current = null;
					setDragIndicator(null);
					setDragging(null);
					setDraggingNestedCategory(false);
					const snapshot = expansionSnapshot.current;
					if (snapshot === null) return;
					expansionSnapshot.current = null;
					const { categoryExpansion: currentCategories, workspaceExpansion: currentWorkspaces, actions: currentActions } = liveExpansionRef.current;
					for (const [key, value] of Object.entries(snapshot.categories)) if (currentCategories[key] !== value) currentActions.setCategoryExpanded(key, value);
					for (const [key, value] of Object.entries(snapshot.workspaces)) if (currentWorkspaces[key] !== value) currentActions.setWorkspaceExpanded(key, value);
				};
				document.addEventListener("dragend", clear);
				return () => {
					clearSpringExpand();
					document.removeEventListener("dragend", clear);
				};
			}, []);
			/** Move a workspace into a category (or reorder inside it when `beforeWorkspaceId`/`afterWorkspaceId`). */
			const moveWorkspaceTo = async (workspaceId, categoryKey, beforeWorkspaceId, afterWorkspaceId) => {
				if (manualSaving) return;
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				if (categoryKey !== UNCATEGORIZED_KEY) for (const anc of [...ancestorCategoryKeys(categoryKey), categoryKey]) preserveExpandedAfterDrag(anc);
				setManualSaving(true);
				try {
					let next;
					if (categoryKey === UNCATEGORIZED_KEY) {
						const assignments = {
							...manual.assignments,
							[workspaceId]: null
						};
						const workspaceOrder = {};
						for (const [key, ids] of Object.entries(manual.workspaceOrder)) {
							if (key === "__topLevel__") continue;
							workspaceOrder[key] = ids.filter((id) => id !== workspaceId);
						}
						const topLevelIds = workspaces.filter((w) => w.workspaceId !== workspaceId && resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0).map((w) => w.workspaceId);
						workspaceOrder[TOP_LEVEL_ORDER_KEY] = afterWorkspaceId !== void 0 ? moveAfter(topLevelIds, workspaceId, afterWorkspaceId) : moveBefore(topLevelIds, workspaceId, beforeWorkspaceId);
						next = {
							...manual,
							assignments,
							workspaceOrder
						};
					} else {
						const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title);
						const movingAcross = currentKey !== categoryKey;
						const assignments = movingAcross ? {
							...manual.assignments,
							[workspaceId]: categoryKey
						} : manual.assignments;
						const targetOrder = afterWorkspaceId !== void 0 ? moveAfter(manual.workspaceOrder[categoryKey] ?? [], workspaceId, afterWorkspaceId) : moveBefore(manual.workspaceOrder[categoryKey] ?? [], workspaceId, beforeWorkspaceId);
						const workspaceOrder = {
							...manual.workspaceOrder,
							[categoryKey]: targetOrder
						};
						if (movingAcross && currentKey !== void 0 && workspaceOrder[currentKey] !== void 0) workspaceOrder[currentKey] = workspaceOrder[currentKey].filter((id) => id !== workspaceId);
						next = {
							...manual,
							assignments,
							workspaceOrder
						};
					}
					await saveManualOverlay(next);
					setManual(next);
					setManualError(null);
				} catch (reason) {
					setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/** Reorder or nest a category relative to `targetKey`. */
			const moveCategory = async (draggedKey, targetKey, position) => {
				if (manualSaving || draggedKey === targetKey) return;
				const result = reorderCategoryInManual(config, manual, draggedKey, targetKey, position);
				if (!result.ok) {
					if (result.reason === "duplicate") setManualError(t("group.moveDuplicateError"));
					else if (result.reason === "cycle") setManualError(t("group.moveCycleError"));
					return;
				}
				if (result.expandedParent !== void 0) for (const anc of [...ancestorCategoryKeys(result.expandedParent), result.expandedParent]) preserveExpandedAfterDrag(anc);
				if (result.newKey !== draggedKey) {
					if (expansionSnapshot.current !== null) {
						const remapped = {};
						for (const [k, v] of Object.entries(expansionSnapshot.current.categories)) remapped[replaceCategoryPrefix(k, draggedKey, result.newKey)] = v;
						expansionSnapshot.current.categories = remapped;
					}
					for (const [k, v] of Object.entries(categoryExpansion)) if (v && isSameOrDescendantCategory(k, draggedKey)) actions.setCategoryExpanded(replaceCategoryPrefix(k, draggedKey, result.newKey), true);
				}
				setManualSaving(true);
				try {
					await saveManualOverlay(result.manual);
					setManual(result.manual);
					setManualError(null);
				} catch (reason) {
					setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/** Un-nest a nested category back to root level. */
			const moveCategoryToRoot = async (draggedKey) => {
				if (manualSaving) return;
				const result = moveCategoryToRootInManual(config, manual, draggedKey);
				if (!result.ok) {
					if (result.reason === "duplicate") setManualError(t("group.moveDuplicateError"));
					return;
				}
				if (expansionSnapshot.current !== null) {
					const remapped = {};
					for (const [k, v] of Object.entries(expansionSnapshot.current.categories)) remapped[replaceCategoryPrefix(k, draggedKey, result.newKey)] = v;
					expansionSnapshot.current.categories = remapped;
				}
				for (const [k, v] of Object.entries(categoryExpansion)) if (v && isSameOrDescendantCategory(k, draggedKey)) actions.setCategoryExpanded(replaceCategoryPrefix(k, draggedKey, result.newKey), true);
				setManualSaving(true);
				try {
					await saveManualOverlay(result.manual);
					setManual(result.manual);
					setManualError(null);
				} catch (reason) {
					setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/**
			* Drop on a row. Re-derives the exact drop zone from cursor position so
			* drop always matches the last rendered visual indicator.
			*/
			const onDropRow = (categoryKey, row) => (event) => {
				event.preventDefault();
				event.stopPropagation();
				clearSpringExpand();
				const fallbackDraggedCat = draggedCategoryRef.current ?? "";
				draggedCategoryRef.current = null;
				setDragIndicator(null);
				setDragging(null);
				setDraggingNestedCategory(false);
				const draggedCategory = event.dataTransfer.getData("application/x-dsh-workspace-groups-category") || fallbackDraggedCat;
				if (draggedCategory !== "") {
					if (row.kind === "topLevel") {
						moveCategoryToRoot(draggedCategory);
						return;
					}
					if (row.kind !== "category") return;
					const rect = event.currentTarget.getBoundingClientRect();
					const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
					const position = ratio < .25 ? "before" : ratio > .75 ? "after" : "into";
					moveCategory(draggedCategory, row.key, position);
					return;
				}
				const workspaceId = event.dataTransfer.getData("application/x-dsh-workspace-groups") || event.dataTransfer.getData("text/plain");
				if (workspaceId === "") return;
				if (row.kind === "topLevel") {
					const rect = event.currentTarget.getBoundingClientRect();
					const before = event.clientY < rect.top + rect.height / 2;
					const specificKey = row.key === UNCATEGORIZED_KEY ? void 0 : row.key;
					moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY, before ? specificKey : void 0, !before ? specificKey : void 0);
					return;
				}
				const rect = event.currentTarget.getBoundingClientRect();
				const before = event.clientY < rect.top + rect.height / 2;
				const beforeWsid = row.kind === "workspace" && before ? row.key : void 0;
				const afterWsid = row.kind === "workspace" && !before ? row.key : void 0;
				moveWorkspaceTo(workspaceId, categoryKey, beforeWsid, afterWsid);
			};
			const onDragOverRow = (row) => (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				const draggingCategory = Array.from(event.dataTransfer.types).includes(DND_CATEGORY_TYPE);
				const activeCat = draggedCategoryRef.current;
				if (draggingCategory) {
					if (row.kind === "topLevel") {
						if (activeCat === null || parentCategoryKey(activeCat) === void 0) return;
						clearSpringExpand();
						event.preventDefault();
						event.stopPropagation();
						event.dataTransfer.dropEffect = "move";
						setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === false ? prev : {
							mode: "line",
							row,
							before: false
						});
						return;
					}
					if (row.kind !== "category") return;
					if (activeCat !== null && isSameOrDescendantCategory(row.key, activeCat)) {
						clearSpringExpand();
						setDragIndicator(null);
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					event.dataTransfer.dropEffect = "move";
					const rect = event.currentTarget.getBoundingClientRect();
					const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
					if (ratio < .25) {
						clearSpringExpand();
						setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === true ? prev : {
							mode: "line",
							row,
							before: true
						});
					} else if (ratio > .75) {
						clearSpringExpand();
						setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === false ? prev : {
							mode: "line",
							row,
							before: false
						});
					} else {
						scheduleSpringExpand(row.key);
						setDragIndicator((prev) => prev?.mode === "into" && prev.categoryKey === row.key ? prev : {
							mode: "into",
							categoryKey: row.key
						});
					}
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = "move";
				const rect = event.currentTarget.getBoundingClientRect();
				const before = event.clientY < rect.top + rect.height / 2;
				if (row.kind === "workspace" || row.kind === "topLevel") {
					clearSpringExpand();
					setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === before ? prev : {
						mode: "line",
						row,
						before
					});
				} else {
					scheduleSpringExpand(row.key);
					setDragIndicator((prev) => prev?.mode === "into" && prev.categoryKey === row.key ? prev : {
						mode: "into",
						categoryKey: row.key
					});
				}
			};
			const onDragLeaveRow = (event) => {
				if (event.currentTarget.contains(event.relatedTarget)) return;
				clearSpringExpand();
				setDragIndicator(null);
			};
			/**
			* Drag over the TOP-LEVEL AREA's blank space (accepts workspaces or nested
			* categories being un-nested back to root).
			*/
			const onDragOverTopLevelArea = (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				if (Array.from(event.dataTransfer.types).includes("application/x-dsh-workspace-groups-category") && (draggedCategoryRef.current === null || parentCategoryKey(draggedCategoryRef.current) === void 0)) return;
				clearSpringExpand();
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
				const last = topLevel.length > 0 ? topLevel[topLevel.length - 1] : void 0;
				if (last !== void 0) setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "topLevel" && prev.row.key === last.workspaceId && prev.before === false ? prev : {
					mode: "line",
					row: {
						kind: "topLevel",
						key: last.workspaceId
					},
					before: false
				});
				else setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "topLevel" && prev.row.key === topLevelRef.key && prev.before === false ? prev : {
					mode: "line",
					row: topLevelRef,
					before: false
				});
			};
			const onDragStartWorkspace = (_workspaceId) => () => {
				setDragging("workspace");
				setDraggingNestedCategory(false);
				expansionSnapshot.current = {
					categories: { ...categoryExpansion },
					workspaces: { ...workspaceExpansion }
				};
				for (const key of Object.keys(workspaceExpansion)) if (workspaceExpansion[key]) actions.setWorkspaceExpanded(key, false);
			};
			const onDragStartCategory = (categoryKey) => (event) => {
				event.stopPropagation();
				event.dataTransfer.setData(DND_CATEGORY_TYPE, categoryKey);
				event.dataTransfer.effectAllowed = "move";
				draggedCategoryRef.current = categoryKey;
				setDragging("category");
				setDraggingNestedCategory(parentCategoryKey(categoryKey) !== void 0);
				expansionSnapshot.current = {
					categories: { ...categoryExpansion },
					workspaces: { ...workspaceExpansion }
				};
				for (const key of Object.keys(workspaceExpansion)) if (workspaceExpansion[key]) actions.setWorkspaceExpanded(key, false);
				if (categoryExpansion[categoryKey]) actions.setCategoryExpanded(categoryKey, false);
			};
			const now = Date.now();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgRoot${wide ? "" : " wgRail"}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionTabs, {
						useSessions,
						useSessionStatus,
						useWorkspaces,
						useTabs,
						actions: tabActions,
						activate: activateTab,
						rename: onSessionRename,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgSectionHeader",
						children: [
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgSectionLabel",
								children: t("section.workspaces")
							}),
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `wgSearch${searchExpanded ? " wgSearchExpanded" : ""}`,
								ref: searchRoot,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgIconButton",
										"aria-label": t("search"),
										onClick: () => {
											setSearchExpanded(true);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 })
									}),
									searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: searchInput,
										className: "wgSearchInput",
										type: "text",
										placeholder: t("search.placeholder"),
										maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
										value: query,
										autoFocus: true,
										onChange: (e) => {
											setQuery(sanitizeSearchQuery(e.target.value));
										},
										onKeyDown: (e) => {
											if (e.key !== "Escape") return;
											setQuery("");
											setSearchExpanded(false);
										}
									}),
									searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgIconButton",
										"aria-label": t("search.clear"),
										onClick: (e) => {
											e.stopPropagation();
											setQuery("");
											setSearchExpanded(false);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillMedium, {})
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("group.create"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									"aria-label": t("group.create"),
									onClick: () => {
										setGroupDraft("");
										setGroupError(null);
										setGroupDialog({ mode: "create" });
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: wide ? 16 : 18 })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("workspace.add"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									"aria-label": t("workspace.add"),
									disabled: adding || flowOpen,
									onClick: () => {
										addWorkspace();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutlineRegular, { size: wide ? 16 : 18 })
								})
							})
						]
					}),
					!wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSectionHeader",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("search"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": t("search"),
								onClick: () => {
									setSearchExpanded(true);
									expandSidebar();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 18 })
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgTreeBody",
						children: [
							configError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgSearchStatus",
								role: "status",
								children: t("configUnavailable")
							}),
							manualError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgSearchStatus wgManualError",
								role: "alert",
								children: [
									t("manual.saveError"),
									": ",
									manualError
								]
							}),
							wide && normalizedQuery !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchBody, {
								list,
								workspaces,
								config,
								archivedSessionIds,
								statuses,
								query: normalizedQuery,
								remote: remoteSearch,
								resultLimit: searchResultLimit,
								current,
								now,
								open,
								manual,
								t
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgTreeWrap",
								ref: branchScope,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FlowerBranch, {
									scope: branchScope.current,
									spinning: currentRunning
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgList",
									role: "tree",
									"aria-label": t("section.workspaces"),
									children: [
										groups.length === 0 && topLevel.length === 0 && !topLevelDropActive && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wgEmpty",
											children: workspacePhase === "ready" ? t("empty.noWorkspaces") : t("empty.none")
										}),
										groups.map((category) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategorySection, {
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
											onToggleCategory: (key, nextExpanded) => {
												actions.setCategoryExpanded(key, nextExpanded);
											},
											onToggleWorkspace: (key) => {
												actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
											},
											onNewSession: startSession,
											onOpen: open,
											onRenameRequest: (workspaceId, title) => {
												setRenameTarget({
													workspaceId,
													currentTitle: title
												});
												setRenameDraft(title);
												setRenameError(null);
											},
											onDeleteRequest: (workspaceId, title) => {
												setDeleteTarget({
													workspaceId,
													title
												});
												setDeleteError(null);
											},
											onSessionRename,
											onSessionArchive,
											onFork: forkSession,
											onGroupCreateSubgroup: (parentKey) => {
												setGroupDraft("");
												setGroupError(null);
												setGroupDialog({
													mode: "create",
													parentKey
												});
											},
											onGroupMoveToRoot: (key) => {
												moveCategoryToRoot(key);
											},
											onGroupRename: (key) => {
												setGroupDraft(categoryLeafName(key));
												setGroupError(null);
												setGroupDialog({
													mode: "rename",
													from: key
												});
											},
											onGroupDelete: (key) => {
												setGroupDeleteTarget(key);
												setGroupDeleteError(null);
											},
											onMoveOut: (workspaceId) => {
												moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY);
											},
											onOpenInFolder: openInFolder,
											canMoveOut: (workspaceId) => {
												const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
												return workspace !== void 0 && resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title) !== void 0;
											}
										}, category.key)),
										(topLevel.length > 0 || topLevelDropActive) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TopLevelSection, {
											topLevel,
											current,
											now,
											t,
											dragging: dragging === "workspace" || dragging === "category" && draggingNestedCategory,
											dragIndicator,
											topLevelRef,
											onDragOverRow,
											onDragOverTopLevelArea,
											onDragLeaveRow,
											onDropRow,
											onDragStartWorkspace,
											onToggleWorkspace: (key) => {
												actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
											},
											onNewSession: startSession,
											onOpen: open,
											onRenameRequest: (workspaceId, title) => {
												setRenameTarget({
													workspaceId,
													currentTitle: title
												});
												setRenameDraft(title);
												setRenameError(null);
											},
											onDeleteRequest: (workspaceId, title) => {
												setDeleteTarget({
													workspaceId,
													title
												});
												setDeleteError(null);
											},
											onSessionRename,
											onSessionArchive,
											onFork: forkSession,
											onOpenInFolder: openInFolder
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: groupDialog !== null,
						onClose: () => {
							setGroupDialog(null);
						},
						closeLabel: t("close"),
						title: groupDialog?.mode === "rename" ? t("group.renameTitle") : groupDialog?.mode === "create" && groupDialog.parentKey !== void 0 ? t("group.createSubgroupTitle") : t("group.createTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setGroupDialog(null);
							},
							children: t("group.createCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: groupBlocked,
							onClick: confirmGroupDialog,
							children: groupDialog?.mode === "rename" ? t("group.renameConfirm") : t("group.createConfirm")
						})] }),
						children: [
							groupParentKey !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgDialogBreadcrumb",
								children: [
									t("group.parentLabel"),
									": ",
									formatCategoryBreadcrumb(groupParentKey)
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "wgRenameInput",
								value: groupDraft,
								"aria-label": t("group.createPlaceholder"),
								placeholder: t("group.createPlaceholder"),
								autoFocus: true,
								onChange: (e) => {
									setGroupDraft(e.target.value);
									setGroupError(null);
								},
								onKeyDown: (e) => {
									if (e.key === "Enter") confirmGroupDialog();
								}
							}),
							groupDialog?.mode === "create" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgDialogHint",
								children: t("group.pathHint")
							}),
							groupNameIssue !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: groupNameIssue
							}),
							groupError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: groupError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: groupDeleteTarget !== null,
						onClose: () => {
							setGroupDeleteTarget(null);
						},
						closeLabel: t("close"),
						title: t("group.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setGroupDeleteTarget(null);
							},
							children: t("group.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: groupDeleting,
							onClick: confirmGroupDelete,
							children: t("group.delete")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							children: groupDeleteHasSubgroups ? t("group.deleteConfirmNested") : t("group.deleteConfirm")
						}), groupDeleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: groupDeleteError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: () => {
							setRenameTarget(null);
						},
						closeLabel: t("close"),
						title: t("workspace.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setRenameTarget(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("workspace.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: renameDraft,
							"aria-label": t("workspace.renamePlaceholder"),
							autoFocus: true,
							onChange: (e) => {
								setRenameDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") confirmRename();
							}
						}), renameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: renameError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: () => {
							setDeleteTarget(null);
						},
						closeLabel: t("close"),
						title: t("workspace.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setDeleteTarget(null);
							},
							children: t("workspace.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: confirmDelete,
							children: t("workspace.delete")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							children: t("workspace.deleteConfirm")
						}), deleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: deleteError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: sessionRenameTarget !== null,
						onClose: () => {
							setSessionRenameTarget(null);
						},
						closeLabel: t("close"),
						title: t("session.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setSessionRenameTarget(null);
							},
							children: t("session.renameCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: sessionRenameBlocked,
							onClick: confirmSessionRename,
							children: t("session.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: sessionRenameDraft,
							"aria-label": t("session.renamePlaceholder"),
							autoFocus: true,
							onChange: (e) => {
								setSessionRenameDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") confirmSessionRename();
							}
						}), sessionRenameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: sessionRenameError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DirectoryFlowHost, {
						entry: directoryFlowEntry,
						resolveProps: directoryFlow.resolveProps,
						owner: {
							open: flowOpen,
							busy: adding,
							onPicked: (path) => {
								adoptPickedDirectory(path);
							},
							onCancel: () => {
								setFlowOpen(false);
							},
							onError: (message) => {
								setFlowOpen(false);
								setAddError(message);
								setAddErrorOpen(true);
							}
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: addErrorOpen,
						onClose: () => {
							setAddErrorOpen(false);
						},
						closeLabel: t("close"),
						title: t("workspace.addErrorTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setAddErrorOpen(false);
							},
							children: t("close")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: () => {
								addWorkspace();
							},
							children: t("retry")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: addError
						})
					}),
					folderError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: folderError.text,
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 16 }),
						onDone: () => {
							setFolderError(null);
						}
					}, folderError.id),
					quickOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuickPanel, {
						onClose: () => {
							setQuickOpen(false);
						},
						list,
						workspaces,
						archivedSessionIds,
						categoryByWorkspace,
						current,
						startSession,
						openSession: open,
						now,
						t
					})
				]
			});
		}
		/** Resolve the category label containing the current session (auto-expand helper). */
		function categoriesForCurrent(config, workspaces, current, manual) {
			const workspace = workspaces.find((w) => w.sessionIds.includes(current));
			if (workspace === void 0) return void 0;
			return resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
		}
		/** One recursive category section: header row + child subgroups + workspace folders. */
		function CategorySection({ category, current, now, t, dragIndicator, onDragOverRow, onDragLeaveRow, onDropRow, onDragStartCategory, onDragStartWorkspace, onToggleCategory, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, onGroupCreateSubgroup, onGroupMoveToRoot, onGroupRename, onGroupDelete, onMoveOut, canMoveOut, onOpenInFolder }) {
			const categoryLine = dragIndicator?.mode === "line" && dragIndicator.row.kind === "category" && dragIndicator.row.key === category.key ? dragIndicator.before ? "before" : "after" : void 0;
			const categoryInto = dragIndicator?.mode === "into" && dragIndicator.categoryKey === category.key;
			const childDepth = category.depth + 1;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
					node: category,
					t,
					onToggle: () => {
						onToggleCategory(category.key, !category.expanded);
					},
					onCreateSubgroup: () => {
						onGroupCreateSubgroup(category.key);
					},
					...category.depth > 0 ? { onMoveToRoot: () => {
						onGroupMoveToRoot(category.key);
					} } : {},
					onRename: () => {
						onGroupRename(category.key);
					},
					onDelete: () => {
						onGroupDelete(category.key);
					},
					dropNestLabel: t("group.dropNestBadge"),
					onDragStartCategory: onDragStartCategory(category.key),
					dropActive: categoryInto,
					...categoryLine !== void 0 ? { insertLine: categoryLine } : {},
					onRowDragOver: onDragOverRow({
						kind: "category",
						key: category.key
					}),
					onRowDragLeave: onDragLeaveRow,
					onRowDrop: onDropRow(category.key, {
						kind: "category",
						key: category.key
					})
				}), category.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wgSubgroupChildren",
					role: "group",
					style: { "--wg-guide-depth": category.depth },
					children: [category.children.map((child) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategorySection, {
						category: child,
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
						onOpenInFolder
					}, child.key)), category.workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							depth: childDepth,
							onToggle: () => {
								onToggleWorkspace(workspace.workspaceId);
							},
							onNewSession: () => {
								onNewSession(workspace.workspaceId);
							},
							onRename: () => {
								onRenameRequest(workspace.workspaceId, workspace.label);
							},
							onDelete: () => {
								onDeleteRequest(workspace.workspaceId, workspace.label);
							},
							canMoveOut: canMoveOut(workspace.workspaceId),
							onMoveOut: () => {
								onMoveOut(workspace.workspaceId);
							},
							...onOpenInFolder !== void 0 ? { onOpenInFolder: () => {
								onOpenInFolder(workspace.workspaceId);
							} } : {},
							dropActive: false,
							...dragIndicator?.mode === "line" && dragIndicator.row.kind === "workspace" && dragIndicator.row.key === workspace.workspaceId ? { insertLine: dragIndicator.before ? "before" : "after" } : {},
							onRowDragOver: onDragOverRow({
								kind: "workspace",
								key: workspace.workspaceId
							}),
							onRowDragLeave: onDragLeaveRow,
							onRowDrop: onDropRow(category.key, {
								kind: "workspace",
								key: workspace.workspaceId
							}),
							onDragStartExtra: onDragStartWorkspace(workspace.workspaceId)
						}), workspace.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeChildren, { children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
							node: session,
							currentId: current,
							now,
							t,
							workspaceDepth: childDepth,
							onOpen,
							onRename: onSessionRename,
							onFork,
							onArchive: onSessionArchive
						}, session.id)) })]
					}, workspace.workspaceId))]
				})]
			});
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
		function TopLevelSection({ topLevel, current, now, t, dragging, dragIndicator, topLevelRef, onDragOverRow, onDragOverTopLevelArea, onDragLeaveRow, onDropRow, onDragStartWorkspace, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, onOpenInFolder }) {
			const emptyLineActive = dragIndicator?.mode === "line" && dragIndicator.row.kind === "topLevel" && dragIndicator.row.key === topLevelRef.key;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				"aria-label": t("section.topLevel"),
				className: "wgTopLevelArea",
				onDragOver: onDragOverTopLevelArea,
				onDragLeave: onDragLeaveRow,
				onDrop: onDropRow(UNCATEGORIZED_KEY, topLevelRef),
				children: [topLevel.length === 0 && dragging && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `wgTopLevelEmpty${emptyLineActive ? " wgTopLevelEmptyActive" : ""}`,
					role: "treeitem",
					onDragOver: onDragOverRow(topLevelRef),
					onDragLeave: onDragLeaveRow,
					onDrop: onDropRow(UNCATEGORIZED_KEY, topLevelRef),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wgTopLevelEmptyLine" })
				}), topLevel.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "group",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
						node: workspace,
						t,
						flat: true,
						depth: 0,
						onToggle: () => {
							onToggleWorkspace(workspace.workspaceId);
						},
						onNewSession: () => {
							onNewSession(workspace.workspaceId);
						},
						onRename: () => {
							onRenameRequest(workspace.workspaceId, workspace.label);
						},
						onDelete: () => {
							onDeleteRequest(workspace.workspaceId, workspace.label);
						},
						...onOpenInFolder !== void 0 ? { onOpenInFolder: () => {
							onOpenInFolder(workspace.workspaceId);
						} } : {},
						...dragIndicator?.mode === "line" && dragIndicator.row.kind === "topLevel" && dragIndicator.row.key === workspace.workspaceId ? { insertLine: dragIndicator.before ? "before" : "after" } : {},
						onRowDragOver: onDragOverRow({
							kind: "topLevel",
							key: workspace.workspaceId
						}),
						onRowDragLeave: onDragLeaveRow,
						onRowDrop: onDropRow(UNCATEGORIZED_KEY, {
							kind: "topLevel",
							key: workspace.workspaceId
						}),
						onDragStartExtra: onDragStartWorkspace(workspace.workspaceId)
					}), workspace.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeChildren, { children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
						node: session,
						currentId: current,
						now,
						t,
						workspaceDepth: 0,
						onOpen,
						onRename: onSessionRename,
						onFork,
						onArchive: onSessionArchive
					}, session.id)) })]
				}, workspace.workspaceId))]
			});
		}
		function SearchCategorySection({ category, current, now, open, t }) {
			const childDepth = category.depth + 1;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
					node: category,
					t,
					onToggle: () => {}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wgSubgroupChildren",
					role: "group",
					style: { "--wg-guide-depth": category.depth },
					children: [category.children.map((child) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchCategorySection, {
						category: child,
						current,
						now,
						open,
						t
					}, child.key)), category.workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							depth: childDepth,
							onToggle: () => {},
							onNewSession: () => {},
							onRename: () => {},
							onDelete: () => {}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
								node: session,
								currentId: current,
								now,
								t,
								workspaceDepth: childDepth,
								onOpen: open,
								onRename: () => {},
								onFork: () => {},
								onArchive: () => {}
							}, session.id))
						})]
					}, workspace.workspaceId))]
				})]
			});
		}
		/**
		* Search body rendered as a recursive multi-level tree pruned to matched branches.
		*/
		function SearchBody({ list, workspaces, config, archivedSessionIds, statuses, query, remote, resultLimit, current, now, open, manual, t }) {
			const currentRemote = remote.query === query ? remote : {
				query,
				status: "loading",
				items: [],
				hasMore: false
			};
			const matches = (0, react.useMemo)(() => deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit), [
				list,
				workspaces,
				config,
				query,
				archivedSessionIds,
				currentRemote,
				resultLimit
			]);
			const searchTree = (0, react.useMemo)(() => deriveSearchGroups(list, workspaces, config, matches.matchedIds, archivedSessionIds, manual, matches.snippetsBySession, statuses), [
				list,
				workspaces,
				config,
				matches,
				archivedSessionIds,
				manual,
				statuses
			]);
			const groups = searchTree.categories;
			const searchTopLevel = searchTree.topLevel;
			const pending = currentRemote.status === "loading";
			const failed = currentRemote.status === "error";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wgList",
				role: "tree",
				"aria-label": t("search.results.aria"),
				children: [
					groups.map((category) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchCategorySection, {
						category,
						current,
						now,
						open,
						t
					}, category.key)),
					searchTopLevel.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							flat: true,
							depth: 0,
							onToggle: () => {},
							onNewSession: () => {},
							onRename: () => {},
							onDelete: () => {}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
								node: session,
								currentId: current,
								now,
								t,
								workspaceDepth: 0,
								onOpen: open,
								onRename: () => {},
								onFork: () => {},
								onArchive: () => {}
							}, session.id))
						})]
					}, workspace.workspaceId)),
					pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						role: "status",
						children: t("search.pending")
					}),
					failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						role: "status",
						children: t("search.unavailable")
					}),
					!pending && groups.length === 0 && searchTopLevel.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgEmpty",
						children: t("search.noMatches")
					}),
					matches.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						children: t("search.hasMore")
					})
				]
			});
		}
		// src/client/locales.ts
		/** Simplified Chinese dictionary. */
		const zh = {
			"section.workspaces": "工作区",
			"section.sessions": "会话",
			search: "搜索",
			"search.placeholder": "搜索会话…",
			"search.clear": "清除",
			"search.noMatches": "没有匹配的会话",
			"search.unavailable": "搜索不可用",
			"search.pending": "搜索中…",
			"search.hasMore": "结果过多，请细化关键词",
			"search.results.aria": "搜索结果",
			"workspace.add": "添加工作区",
			"workspace.addBusy": "正在添加…",
			"workspace.addError": "添加失败",
			"workspace.addErrorTitle": "无法添加工作区",
			"workspace.rename": "重命名",
			"workspace.delete": "删除",
			"workspace.deleteTitle": "删除工作区",
			"workspace.deleteConfirm": "仅删除注册信息，目录与会话日志保留。确定删除？",
			"workspace.deleteCancel": "取消删除",
			"workspace.renaming": "重命名中…",
			"workspace.deleting": "删除中…",
			"workspace.renameTitle": "重命名工作区",
			"workspace.renamePlaceholder": "工作区名称",
			"workspace.renameConfirm": "重命名",
			"workspace.renameCancel": "取消",
			"workspace.moveOutOfGroup": "移出分组",
			"workspace.openInFolder": "在文件夹中打开",
			"workspace.openInFolderError": "打开文件夹失败",
			"group.create": "新建分组",
			"group.createTitle": "新建分组",
			"group.createSubgroup": "新建子分组",
			"group.createSubgroupTitle": "新建子分组",
			"group.createPlaceholder": "分组名称（支持 / 创建多级）",
			"group.createConfirm": "创建",
			"group.createCancel": "取消",
			"group.parentLabel": "上级分组",
			"group.pathHint": "可用 / 分隔创建多级文件夹，例如 Windows主机/MKINSP",
			"group.moveToRoot": "移至顶层",
			"group.dropNestBadge": "移入",
			"group.rename": "重命名分组",
			"group.renameTitle": "重命名分组",
			"group.renameConfirm": "重命名",
			"group.delete": "删除分组",
			"group.deleteTitle": "删除分组",
			"group.deleteConfirm": "删除后，该分组内的所有项目将移到顶层（不归组）。确定删除？",
			"group.deleteConfirmNested": "删除后将同时移除其下所有子分组；包含的所有项目不会被删除，将全部移到顶层。确定删除？",
			"group.deleteCancel": "取消删除",
			"group.nameDuplicate": "已存在同名分组",
			"group.nameReserved": "该名称不可用",
			"group.nameInvalid": "分组路径无效（不能包含空层级或首尾 /）",
			"group.nameCycle": "不能移动到自身或子分组下",
			"group.moveDuplicateError": "目标位置已存在同名分组，无法移入",
			"group.moveCycleError": "不能将分组移入自身或子分组中",
			"section.topLevel": "顶层项目",
			"manual.saveError": "分组变更保存失败",
			"session.new": "新建会话",
			"session.rename": "重命名会话",
			"session.archive": "归档",
			"session.fork": "派生",
			"session.renameTitle": "重命名会话",
			"session.renamePlaceholder": "会话名称",
			"session.renameConfirm": "重命名",
			"session.renameCancel": "取消",
			"session.renaming": "重命名中…",
			uncategorized: "未分类",
			"empty.none": "暂无内容",
			"empty.noWorkspaces": "还没有工作区",
			close: "关闭",
			cancel: "取消",
			confirm: "确定",
			retry: "重试",
			configUnavailable: "分组配置不可用",
			collapse: "折叠",
			expandMore: "展开全部",
			newSession: "新建会话",
			"quick.title": "快速切换",
			"quick.tab.workspaces": "工作区",
			"quick.tab.sessions": "全部会话",
			"quick.search.placeholder": "搜索工作区…",
			"quick.search.sessions": "搜索会话…",
			"quick.empty.workspaces": "没有匹配的工作区",
			"quick.action.newSession": "新建会话",
			"quick.action.running": "切到运行中的会话",
			"quick.action.noneRunning": "没有正在运行的会话",
			"quick.empty.sessions": "还没有会话",
			"quick.select.hint": "在上方选择一个工作区",
			"quick.hint": "Ctrl+R 开关 · Enter 打开/新建 · Esc 关闭",
			"tabs.aria": "已打开的会话",
			"tabs.close": "关闭标签",
			"tabs.archive": "归档"
		};
		/** English dictionary. */
		const en = {
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			search: "Search",
			"search.placeholder": "Search sessions…",
			"search.clear": "Clear",
			"search.noMatches": "No matching sessions",
			"search.unavailable": "Search unavailable",
			"search.pending": "Searching…",
			"search.hasMore": "Too many results — refine the query",
			"search.results.aria": "Search results",
			"workspace.add": "Add workspace",
			"workspace.addBusy": "Adding…",
			"workspace.addError": "Add failed",
			"workspace.addErrorTitle": "Could not add workspace",
			"workspace.rename": "Rename",
			"workspace.delete": "Delete",
			"workspace.deleteTitle": "Delete workspace",
			"workspace.deleteConfirm": "Only the registration is removed; the directory and session logs stay. Delete?",
			"workspace.deleteCancel": "Cancel delete",
			"workspace.renaming": "Renaming…",
			"workspace.deleting": "Deleting…",
			"workspace.renameTitle": "Rename workspace",
			"workspace.renamePlaceholder": "Workspace name",
			"workspace.renameConfirm": "Rename",
			"workspace.renameCancel": "Cancel",
			"workspace.moveOutOfGroup": "Move out of group",
			"workspace.openInFolder": "Open in folder",
			"workspace.openInFolderError": "Could not open the folder",
			"group.create": "New group",
			"group.createTitle": "New group",
			"group.createSubgroup": "New subgroup",
			"group.createSubgroupTitle": "New subgroup",
			"group.createPlaceholder": "Group name (use / for nesting)",
			"group.createConfirm": "Create",
			"group.createCancel": "Cancel",
			"group.parentLabel": "Parent group",
			"group.pathHint": "Use / to create nested folders, e.g. Windows/MKINSP",
			"group.moveToRoot": "Move to top level",
			"group.dropNestBadge": "Nest",
			"group.rename": "Rename group",
			"group.renameTitle": "Rename group",
			"group.renameConfirm": "Rename",
			"group.delete": "Delete group",
			"group.deleteTitle": "Delete group",
			"group.deleteConfirm": "Deleting removes this group; every project inside it moves to the top level (ungrouped). Delete?",
			"group.deleteConfirmNested": "Deleting removes this group and all nested subgroups; projects inside are kept and moved to the top level. Delete?",
			"group.deleteCancel": "Cancel delete",
			"group.nameDuplicate": "A group with this name already exists",
			"group.nameReserved": "This name is not available",
			"group.nameInvalid": "Invalid group path (empty segments or leading/trailing \"/\" not allowed)",
			"group.nameCycle": "Cannot move a group inside itself or a subgroup",
			"group.moveDuplicateError": "A group with the same name already exists at the destination",
			"group.moveCycleError": "Cannot move a group into itself or its subgroup",
			"section.topLevel": "Top-level projects",
			"manual.saveError": "Could not save group changes",
			"session.new": "New Session",
			"session.rename": "Rename session",
			"session.archive": "Archive",
			"session.fork": "Fork",
			"session.renameTitle": "Rename session",
			"session.renamePlaceholder": "Session name",
			"session.renameConfirm": "Rename",
			"session.renameCancel": "Cancel",
			"session.renaming": "Renaming…",
			uncategorized: "Uncategorized",
			"empty.none": "Nothing here",
			"empty.noWorkspaces": "No workspaces yet",
			close: "Close",
			cancel: "Cancel",
			confirm: "Confirm",
			retry: "Retry",
			configUnavailable: "Grouping config unavailable",
			collapse: "Collapse",
			expandMore: "Show all",
			newSession: "New Session",
			"quick.title": "Quick switch",
			"quick.tab.workspaces": "Workspaces",
			"quick.tab.sessions": "All sessions",
			"quick.search.placeholder": "Search workspaces…",
			"quick.search.sessions": "Search sessions…",
			"quick.empty.workspaces": "No matching workspaces",
			"quick.action.newSession": "New Session",
			"quick.action.running": "Switch to running session",
			"quick.action.noneRunning": "No running session",
			"quick.empty.sessions": "No sessions yet",
			"quick.select.hint": "Pick a workspace above",
			"quick.hint": "Ctrl+R toggle · Enter open/new · Esc close",
			"tabs.aria": "Open sessions",
			"tabs.close": "Close tab",
			"tabs.archive": "Archive"
		};
		// src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspaceGroups";
		/**
		* Tab visibility policy. `auto` is the behaviour the feature was asked for —
		* opening a session that has no tab yet adds one at the front of the strip;
		* `manual` leaves the strip to callers that drive `openTab` themselves.
		*/
		const TAB_OPEN_MODE = "auto";
		/**
		* Required services (cordis fiber inject; 0.1.6 service roster). `uiWorkspace`
		* is the shipped navigation face this entry delegates selection to.
		*/
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"uiWorkspace",
			"locale"
		];
		/**
		* Register the grouped browser once the sidebar slot declaration is on the
		* ledger. Inject factory returns plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "@dsh-xhl/workspace-groups: dictionaries");
			const tabInstance = createSessionTabsStore().create();
			const tabWrites = tabInstance.actions;
			let hydrated = false;
			ctx.effect(() => {
				const stop = tabInstance.subscribe(() => {
					if (!hydrated) return;
					saveTabs({
						order: tabInstance.getSnapshot().order,
						tabs: tabInstance.getSnapshot().tabs
					});
				});
				return () => {
					stop();
				};
			}, "@dsh-xhl/workspace-groups: tab persistence");
			ctx.effect(() => {
				let cancelled = false;
				loadTabs().then((tabs) => {
					if (cancelled) return;
					if (tabs.length > 0) tabWrites.restore(tabs.map((tab) => ({
						sessionId: tab.sessionId,
						order: tab.order
					})));
					hydrated = true;
				}).catch(() => {
					if (!cancelled) hydrated = true;
				});
				return () => {
					cancelled = true;
				};
			}, "@dsh-xhl/workspace-groups: tab restore");
			const searchSessions = async (query, signal) => {
				const result = await ctx.sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const directoryFlow = createDirectoryFlowBridge(ctx.slots, ctx.locale);
			const browserInjected = () => ({
				startSession: (workspaceId) => {
					ctx.uiWorkspace.startSession(workspaceId);
				},
				open: (sessionId) => {
					ctx.uiWorkspace.openSession(sessionId);
				},
				forkSession: (sessionId) => {
					ctx.uiWorkspace.forkSession(sessionId).catch((reason) => {
						console.warn("fork session failed:", reason);
					});
				},
				archiveSession: async (sessionId) => {
					await ctx.uiWorkspace.archiveSession(sessionId);
				},
				pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
				directoryFlow,
				searchSessions,
				searchResultLimit: ctx.sessions.searchResultLimit,
				hooks: { directoryFlow: {
					getSnapshot: () => true,
					subscribe: () => () => {}
				} },
				renameSession: async (sessionId, title) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
					const result = await session.rename(title);
					if (!result.ok) throw new Error(result.error.message);
				},
				renameWorkspace: async (workspaceId, title) => {
					await ctx.workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await ctx.workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
				insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
					await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId);
				},
				createWorkspace: (input) => ctx.workspaces.create(input),
				openTab: (sessionId, status) => {
					const summary = ctx.sessions.list.getSnapshot().byId[sessionId];
					if (shouldOpenTab(TAB_OPEN_MODE, summary, status)) tabWrites.touch(sessionId);
				},
				useTabs: createStoreHook(tabInstance),
				tabActions: tabWrites
			});
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				priority: -1,
				store: createGroupsViewStore(),
				inject: browserInjected,
				locale: NS,
				registrant: "@dsh-xhl/workspace-groups"
			}, GroupsBrowser));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map