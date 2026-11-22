import { describe, expect, it } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveGroups, deriveSearchGroups } from '../src/client/tree.ts'
import { EMPTY_MANUAL, type GroupsConfig } from '../src/core/types.ts'

function ws(id: string, title: string, path: string, sessionIds: string[]): WorkspaceView {
  return {
    workspaceId: id as WorkspaceId,
    title,
    path,
    createdAt: '2026-10-01T00:00:00.000Z',
    sessionIds: sessionIds as SessionId[],
  } as unknown as WorkspaceView
}

function sessionList(activeId: string | undefined, entries: Array<{ id: string; title: string }>): SessionListState {
  const byId: Record<string, SessionListState['byId'][SessionId]> = {}
  const ids: SessionId[] = []
  for (const e of entries) {
    const sid = e.id as SessionId
    ids.push(sid)
    byId[sid] = {
      id: sid,
      displayTitle: e.title,
      blank: false,
      origin: 'user',
      running: false,
      updatedAt: 1000,
      retainedBy: e.id === activeId ? { mainView: 1 } : {},
    } as unknown as SessionListState['byId'][SessionId]
  }
  return { ids, byId } as unknown as SessionListState
}

describe('recursive tree & search derivation', () => {
  const config: GroupsConfig = {
    categories: [
      { name: 'Windows主机/RuleOnly', rules: [{ pathPrefix: '/win/rule' }] },
      { name: 'EmptyRule/Sub', rules: [{ pathPrefix: '/never-matches' }] },
    ],
  }

  const manual = {
    ...EMPTY_MANUAL,
    categories: [
      'Windows主机',
      'Windows主机/MKINSP',
      'Windows主机/MKINSP/V3',
      'Windows主机/EmptyManual',
      '32服务器',
      '32服务器/MKINSP',
    ],
    assignments: {
      ws1: 'Windows主机/MKINSP/V3',
      ws2: '32服务器/MKINSP',
    },
  }

  const workspaces = [
    ws('ws1', 'mkinsp-v3', '/win/mkinsp/v3', ['s1']),
    ws('ws2', 'mkinsp-32', '/srv32/mkinsp', ['s2']),
    ws('ws3', 'rule-proj', '/win/rule/proj', ['s3']),
    ws('ws4', 'top-proj', '/top/proj', ['s4']),
  ]

  const list = sessionList('s1', [
    { id: 's1', title: 'Fix DSP align' },
    { id: 's2', title: 'Build V3' },
    { id: 's3', title: 'Check CUDA' },
    { id: 's4', title: 'Top task' },
  ])

  it('builds nested hierarchy with duplicate leaf names, roll-up counts, and active bubbling', () => {
    const tree = deriveGroups(
      list,
      workspaces,
      [],
      config,
      {
        expandedCategories: ['Windows主机', 'Windows主机/MKINSP', 'Windows主机/MKINSP/V3'],
        expandedWorkspaces: ['ws1'],
      },
      manual,
    )

    expect(tree.map(c => c.key)).toEqual(['Windows主机', '32服务器'])
    const win = tree[0]!
    expect(win.label).toBe('Windows主机')
    expect(win.depth).toBe(0)
    expect(win.containsCurrent).toBe(true)
    expect(win.totalWorkspaceCount).toBe(2) // ws1 in V3 + ws3 in RuleOnly

    expect(win.children.map(c => c.key)).toEqual([
      'Windows主机/RuleOnly',
      'Windows主机/MKINSP',
      'Windows主机/EmptyManual',
    ])
    const mkinspWin = win.children[1]!
    expect(mkinspWin.label).toBe('MKINSP')
    expect(mkinspWin.depth).toBe(1)
    expect(mkinspWin.containsCurrent).toBe(true)
    expect(mkinspWin.totalWorkspaceCount).toBe(1)

    const v3 = mkinspWin.children[0]!
    expect(v3.label).toBe('V3')
    expect(v3.depth).toBe(2)
    expect(v3.containsCurrent).toBe(true)
    expect(v3.workspaces[0]?.workspaceId).toBe('ws1')
    expect(v3.workspaces[0]?.sessions[0]?.id).toBe('s1')

    // Empty manual folder stays visible; empty rule branch EmptyRule/Sub is pruned
    expect(win.children[2]?.key).toBe('Windows主机/EmptyManual')
    expect(tree.some(c => c.key === 'EmptyRule')).toBe(false)

    // Duplicate subfolder name under another parent remains distinct
    const srv32 = tree[1]!
    expect(srv32.children[0]?.key).toBe('32服务器/MKINSP')
    expect(srv32.children[0]?.label).toBe('MKINSP')
    expect(srv32.containsCurrent).toBe(false)
  })

  it('prunes search tree recursively while keeping matching ancestor chains', () => {
    const search = deriveSearchGroups(
      list,
      workspaces,
      config,
      new Set(['s1' as SessionId, 's4' as SessionId]),
      [],
      manual,
    )

    expect(search.topLevel.map(w => w.workspaceId)).toEqual(['ws4'])
    expect(search.categories.map(c => c.key)).toEqual(['Windows主机'])
    const win = search.categories[0]!
    expect(win.expanded).toBe(true)
    expect(win.children.map(c => c.key)).toEqual(['Windows主机/MKINSP'])
    expect(win.children[0]!.children.map(c => c.key)).toEqual(['Windows主机/MKINSP/V3'])
    expect(win.children[0]!.children[0]!.workspaces[0]?.sessions[0]?.matched).toBe(true)
  })
})
