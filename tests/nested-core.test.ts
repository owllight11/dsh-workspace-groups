import { describe, expect, it } from 'vitest'
import {
  allCategoryKeys,
  createCategoryInManual,
  deleteCategorySubtreeInManual,
  moveCategoryToRootInManual,
  renameOrMoveCategoryInManual,
  reorderCategoryInManual,
  resolveCategory,
  takenCategoryNames,
} from '../src/core/matcher.ts'
import {
  ancestorCategoryKeys,
  categoryLeafName,
  EMPTY_MANUAL,
  formatCategoryBreadcrumb,
  isSameOrDescendantCategory,
  joinCategoryPath,
  normalizeCategoryPath,
  parentCategoryKey,
  replaceCategoryPrefix,
  splitCategoryPath,
  type GroupsConfig,
} from '../src/core/types.ts'
import { parseGroupsConfig } from '../src/host-config.ts'
import { parseManualGroups, validateManualGroups } from '../src/host-manual.ts'

describe('category path utilities', () => {
  it('normalizes valid paths and rejects malformed or reserved paths', () => {
    expect(normalizeCategoryPath(' Windows主机 / MKINSP / V3 ')).toBe('Windows主机/MKINSP/V3')
    expect(normalizeCategoryPath('单层分组')).toBe('单层分组')
    expect(normalizeCategoryPath('')).toBeNull()
    expect(normalizeCategoryPath('   ')).toBeNull()
    expect(normalizeCategoryPath('/')).toBeNull()
    expect(normalizeCategoryPath('/Leading')).toBeNull()
    expect(normalizeCategoryPath('Trailing/')).toBeNull()
    expect(normalizeCategoryPath('A//B')).toBeNull()
    expect(normalizeCategoryPath('未分类')).toBeNull()
    expect(normalizeCategoryPath('A/未分类/B')).toBeNull()
    expect(normalizeCategoryPath('A/__topLevel__')).toBeNull()
  })

  it('extracts parent, leaf, ancestors, prefix replacement, and breadcrumb', () => {
    expect(splitCategoryPath('A/B/C')).toEqual(['A', 'B', 'C'])
    expect(parentCategoryKey('A')).toBeUndefined()
    expect(parentCategoryKey('A/B/C')).toBe('A/B')
    expect(categoryLeafName('A')).toBe('A')
    expect(categoryLeafName('A/B/C')).toBe('C')
    expect(joinCategoryPath(undefined, 'Root')).toBe('Root')
    expect(joinCategoryPath('A/B', 'C')).toBe('A/B/C')
    expect(ancestorCategoryKeys('A')).toEqual([])
    expect(ancestorCategoryKeys('A/B/C')).toEqual(['A', 'A/B'])
    expect(isSameOrDescendantCategory('A/B/C', 'A')).toBe(true)
    expect(isSameOrDescendantCategory('A/B', 'A/B')).toBe(true)
    expect(isSameOrDescendantCategory('AB', 'A')).toBe(false)
    expect(replaceCategoryPrefix('A/B/C', 'A/B', 'X')).toBe('X/C')
    expect(replaceCategoryPrefix('A/B', 'A/B', 'X')).toBe('X')
    expect(replaceCategoryPrefix('A/BC', 'A/B', 'X')).toBe('A/BC')
    expect(formatCategoryBreadcrumb('Windows主机/MKINSP')).toBe('Windows主机 › MKINSP')
  })
})

describe('nested manual overlay mutations', () => {
  const ruleConfig: GroupsConfig = {
    categories: [
      { name: 'RuleGroup', rules: [{ pathPrefix: '/srv/rule' }] },
    ],
  }

  it('materializes missing ancestor groups when creating nested path', () => {
    const next = createCategoryInManual(ruleConfig, EMPTY_MANUAL, 'Windows主机/MKINSP/V3')
    expect(next.categories).toEqual(['Windows主机', 'Windows主机/MKINSP', 'Windows主机/MKINSP/V3'])
    expect(takenCategoryNames(ruleConfig, next).has('Windows主机')).toBe(true)
    expect(takenCategoryNames(ruleConfig, next).has('Windows主机/MKINSP/V3')).toBe(true)
  })

  it('renames and reparents whole subtree across categories, assignments, orders, and rule renames', () => {
    const manual = {
      ...EMPTY_MANUAL,
      categories: ['Windows主机', 'Windows主机/MKINSP', 'Windows主机/MKINSP/Sub'],
      assignments: {
        ws1: 'Windows主机/MKINSP',
        ws2: 'Windows主机/MKINSP/Sub',
        ws3: 'RuleGroup',
      },
      workspaceOrder: {
        'Windows主机/MKINSP': ['ws1'],
        'Windows主机/MKINSP/Sub': ['ws2'],
        __topLevel__: ['ws4'],
      },
      categoryOrder: ['Windows主机', 'Windows主机/MKINSP', 'Windows主机/MKINSP/Sub', 'RuleGroup'],
    }
    const renamed = renameOrMoveCategoryInManual(ruleConfig, manual, 'Windows主机/MKINSP', 'Windows主机/NewMK')
    expect(renamed.categories).toEqual(['Windows主机', 'Windows主机/NewMK', 'Windows主机/NewMK/Sub'])
    expect(renamed.assignments).toEqual({
      ws1: 'Windows主机/NewMK',
      ws2: 'Windows主机/NewMK/Sub',
      ws3: 'RuleGroup',
    })
    expect(renamed.workspaceOrder).toEqual({
      'Windows主机/NewMK': ['ws1'],
      'Windows主机/NewMK/Sub': ['ws2'],
      __topLevel__: ['ws4'],
    })
    expect(renamed.categoryOrder).toEqual([
      'Windows主机',
      'Windows主机/NewMK',
      'Windows主机/NewMK/Sub',
      'RuleGroup',
    ])

    // Reparent YAML rule category into Windows主机
    const movedRule = reorderCategoryInManual(ruleConfig, renamed, 'RuleGroup', 'Windows主机', 'into')
    expect(movedRule.ok).toBe(true)
    if (movedRule.ok) {
      expect(movedRule.newKey).toBe('Windows主机/RuleGroup')
      expect(movedRule.manual.renamed).toEqual({ RuleGroup: 'Windows主机/RuleGroup' })
      expect(movedRule.manual.assignments.ws3).toBe('Windows主机/RuleGroup')
      expect(resolveCategory(ruleConfig, movedRule.manual, 'wsRuleAuto', '/srv/rule/app', 'app')).toBe('Windows主机/RuleGroup')
    }
  })

  it('reorders before/after sibling at nested depth, nests into folder, blocks cycles & duplicates, and un-nests to root', () => {
    const manual = {
      ...EMPTY_MANUAL,
      categories: ['Host', 'Host/A', 'Host/B', 'Other', 'Other/A'],
    }

    // Nest Other into Host -> Host/Other
    const nested = reorderCategoryInManual(ruleConfig, manual, 'Other', 'Host', 'into')
    expect(nested.ok).toBe(true)
    if (!nested.ok) return
    expect(nested.newKey).toBe('Host/Other')
    expect(nested.manual.categories).toContain('Host/Other/A')

    // Cycle blocked: cannot move Host into Host/Other/A
    const cycle = reorderCategoryInManual(ruleConfig, nested.manual, 'Host', 'Host/Other/A', 'into')
    expect(cycle).toEqual({ ok: false, reason: 'cycle' })

    // Duplicate blocked: Host/Other/A cannot move into Host because Host/A already exists
    const dup = reorderCategoryInManual(ruleConfig, nested.manual, 'Host/Other/A', 'Host/B', 'before')
    expect(dup).toEqual({ ok: false, reason: 'duplicate' })

    // Move Host/B before RuleGroup at root -> un-nests Host/B -> B
    const toRootTarget = reorderCategoryInManual(ruleConfig, nested.manual, 'Host/B', 'RuleGroup', 'before')
    expect(toRootTarget.ok).toBe(true)
    if (toRootTarget.ok) {
      expect(toRootTarget.newKey).toBe('B')
      expect(toRootTarget.manual.categories).toContain('B')
      expect(toRootTarget.manual.categories).not.toContain('Host/B')
    }

    // Explicit moveCategoryToRootInManual
    const unnested = moveCategoryToRootInManual(ruleConfig, nested.manual, 'Host/Other')
    expect(unnested.ok).toBe(true)
    if (unnested.ok) {
      expect(unnested.newKey).toBe('Other')
      expect(unnested.manual.categories).toContain('Other/A')
    }
  })

  it('deletes entire subtree and moves affected workspaces (manual + rule) to uncategorized null', () => {
    const manual = {
      ...EMPTY_MANUAL,
      categories: ['Windows主机', 'Windows主机/MKINSP', 'Windows主机/MKINSP/V3'],
      assignments: { ws1: 'Windows主机/MKINSP/V3' },
      renamed: { RuleGroup: 'Windows主机/RuleSub' },
      workspaceOrder: { 'Windows主机/MKINSP': ['ws1'] },
      categoryOrder: ['Windows主机', 'Windows主机/MKINSP', 'Windows主机/MKINSP/V3', 'Windows主机/RuleSub'],
    }
    const workspaces = [
      { workspaceId: 'ws1', path: '/a', title: 'ws1' },
      { workspaceId: 'ws2', path: '/srv/rule/p', title: 'p' },
      { workspaceId: 'ws3', path: '/other', title: 'other' },
    ]
    const deleted = deleteCategorySubtreeInManual(ruleConfig, manual, workspaces, 'Windows主机')
    expect(deleted.categories).toEqual([])
    expect(deleted.assignments).toEqual({ ws1: null, ws2: null })
    expect(deleted.hidden).toEqual(['RuleGroup'])
    expect(deleted.renamed).toEqual({})
    expect(deleted.workspaceOrder).toEqual({})
    expect(deleted.categoryOrder).toEqual([])
  })
})

describe('host config and manual validation for nested paths', () => {
  it('accepts valid slash-delimited paths and implicit ancestors, rejects bad paths', () => {
    const cfg = parseGroupsConfig({
      categories: [
        { name: 'Windows主机/MKINSP', rules: [{ pathPrefix: 'D:/mkinsp' }] },
      ],
    })
    expect(cfg.categories[0]?.name).toBe('Windows主机/MKINSP')
    expect(allCategoryKeys(cfg, EMPTY_MANUAL)).toEqual(['Windows主机', 'Windows主机/MKINSP'])

    const parsedManual = parseManualGroups({
      categories: ['32服务器/MKINSP'],
      assignments: { ws1: 'Windows主机/MKINSP' },
      categoryOrder: ['Windows主机', 'Windows主机/MKINSP', '32服务器', '32服务器/MKINSP'],
    })
    expect(() => validateManualGroups(parsedManual, cfg.categories.map(c => c.name))).not.toThrow()

    expect(() => parseGroupsConfig({
      categories: [{ name: 'Bad//Path', rules: [{ pathPrefix: '/a' }] }],
    })).toThrow()

    expect(() => parseManualGroups({
      categories: ['Bad/'],
      assignments: {},
    })).toThrow()
  })
})
