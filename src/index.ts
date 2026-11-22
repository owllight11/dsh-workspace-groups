import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GroupsContext } from './context-types.ts'
import { defaultConfigPath, readGroupsConfig } from './host-config.ts'
import { defaultManualPath, parseManualGroups, readManualGroups, validateManualGroups, writeManualGroups } from './host-manual.ts'
import { defaultTabsPath, documentForTabs, parseTabsDocument, readTabsDocument, writeTabsDocument, type PersistedTab } from './host-tabs.ts'

/** Plugin identity for cordis.yml rows. */
export const name = '@dsh-xhl/workspace-groups'

/** Services required before mounting: the webserver route. */
export const inject = ['webServer']

/** Cap on the PUT body: the overlay is tiny; anything bigger is a client bug. */
const MAX_MANUAL_BODY_BYTES = 65536

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function parseTabsPayload(raw: unknown): { order: number; tabs: PersistedTab[] } | null {
  const doc = parseTabsDocument({ ...(typeof raw === 'object' && raw !== null ? raw : {}), version: 1 })
  if (doc === null) return null
  return { order: doc.order, tabs: [...doc.tabs] }
}

function writeError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new HttpError(413, 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new HttpError(400, 'empty request body')
  return Buffer.concat(chunks).toString('utf8')
}

/** Plugin body: mount the config snapshot route and the overlay write route. */
export function apply(ctx: GroupsContext): void {
  const configPath = defaultConfigPath()
  const manualPath = defaultManualPath()
  const tabsPath = defaultTabsPath()

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/config',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let config
      let manual
      try {
        [config, manual] = await Promise.all([readGroupsConfig(configPath), readManualGroups(manualPath)])
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to read config: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ...config, manual })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/config route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/tabs',
    handler: async (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        let stored
        try {
          stored = await readTabsDocument(tabsPath)
        } catch (error) {
          writeError(res, 500, `workspace-groups: failed to read tabs: ${error instanceof Error ? error.message : String(error)}`)
          return
        }
        const body = JSON.stringify({ tabs: stored?.tabs ?? [] })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(req.method === 'HEAD' ? undefined : body)
        return
      }
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        writeError(res, error instanceof HttpError ? error.status : 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const parsed = parseTabsPayload(raw)
      if (parsed === null) {
        writeError(res, 400, 'workspace-groups: malformed tabs payload')
        return
      }
      try {
        await writeTabsDocument(tabsPath, documentForTabs(parsed))
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write tabs: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ok: true })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/tabs route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/manual',
    handler: async (req, res) => {
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        writeError(res, error instanceof HttpError ? error.status : 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      let manual
      try {
        manual = parseManualGroups(raw)
        const ruleConfig = (await readGroupsConfig(configPath)).categories
        validateManualGroups(manual, ruleConfig.map(category => category.name))
      } catch (error) {
        writeError(res, 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      try {
        await writeManualGroups(manualPath, manual)
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write manual overlay: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ok: true })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/manual route')
}
