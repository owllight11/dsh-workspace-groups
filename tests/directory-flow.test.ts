import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  createDirectoryFlowBridge,
  DIRECTORY_FLOW_SLOT,
  type DirectoryFlowEntry,
} from '../src/client/directory-flow.tsx'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

function makeEntry(overrides: Partial<DirectoryFlowEntry> = {}): DirectoryFlowEntry {
  const Component = () => null
  return {
    component: Component,
    ...overrides,
  }
}

describe('directory-flow bridge', () => {
  it('returns null when slot is empty', () => {
    const bridge = createDirectoryFlowBridge({
      entriesOfSlot: () => [],
      subscribe: () => () => {},
    }, {})
    expect(bridge.getEntry()).toBeNull()
  })

  it('preserves head identity across calls and updates on dynamic takeover', () => {
    const nativeEntry = makeEntry({ options: { priority: 0 } })
    const remoteEntry = makeEntry({ options: { priority: -1000 } })
    let entries: DirectoryFlowEntry[] = [nativeEntry]
    const listeners = new Set<() => void>()

    const bridge = createDirectoryFlowBridge({
      entriesOfSlot: (key) => (key === DIRECTORY_FLOW_SLOT ? [...entries] : []),
      subscribe: (key, fn) => {
        if (key !== DIRECTORY_FLOW_SLOT) return () => {}
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
    }, {})

    const onChange = vi.fn()
    const unsubscribe = bridge.subscribe(onChange)

    const first = bridge.getEntry()
    const second = bridge.getEntry()
    expect(first).toBe(nativeEntry)
    expect(Object.is(first, second)).toBe(true)

    entries = [remoteEntry, nativeEntry]
    for (const fn of listeners) fn()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(bridge.getEntry()).toBe(remoteEntry)

    entries = [nativeEntry]
    for (const fn of listeners) fn()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(bridge.getEntry()).toBe(nativeEntry)

    unsubscribe()
  })

  it('caches entry.inject per entry identity and binds locale fallback cleanly', () => {
    const injectRemote = vi.fn(() => ({ label: 'remote', t: 'custom-t' }))
    const remoteEntry = makeEntry({ inject: injectRemote, locale: 'dsh-workspace' })

    const injectBrowse = vi.fn(() => ({ listDirectory: () => Promise.resolve([]) }))
    const browseEntry = makeEntry({ inject: injectBrowse, locale: 'browsePicker' })

    const bind = vi.fn((ns: string) => (key: string) => `${ns}:${key}`)
    const bridge = createDirectoryFlowBridge({}, { bind })

    const p1 = bridge.resolveProps(remoteEntry)
    const p2 = bridge.resolveProps(remoteEntry)
    expect(injectRemote).toHaveBeenCalledTimes(1)
    expect(p1).toBe(p2)
    expect(p1.t).toBe('custom-t')
    expect(bind).not.toHaveBeenCalled()

    const b1 = bridge.resolveProps(browseEntry)
    expect(injectBrowse).toHaveBeenCalledTimes(1)
    expect(bind).toHaveBeenCalledWith('browsePicker')
    expect(typeof b1.t).toBe('function')
    expect((b1.t as (k: string) => string)('title')).toBe('browsePicker:title')
    expect(typeof b1.listDirectory).toBe('function')
  })
})

describe('workspace font styles compatibility', () => {
  it('uses UI font variable instead of monospace for workspace and tab project labels', () => {
    const css = readFileSync(resolve(ROOT, 'src/client/styles.css'), 'utf8')
    expect(css).not.toContain('--dsw-font-mono')
    expect(css).not.toContain('ui-monospace')
    expect(css).toContain('font-family:var(--dsw-font-family,inherit)')
  })
})
