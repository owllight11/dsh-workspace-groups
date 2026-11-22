import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { dirname, isAbsolute, resolve as resolvePath } from 'node:path'
import { defineConfig, type UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Node builtins must never survive into the browser module-loader factory. */
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(id => `node:${id}`),
])

/** Module specifiers the web shell shares into the frozen module table. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

function isRequested(specifier: string): boolean {
  return (CLIENT_EXTERNALS as readonly string[]).includes(specifier)
}

const INLINE_CSS_QUERY = '?inline'
const CSS_VIRTUAL_PREFIX = '\0dsh-workspace-groups-inline-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

function sourceAssetPath(source: string, importer: string): string {
  const abs = resolvePath(dirname(importer), source)
  if (existsSync(abs)) return abs
  return source
}

function nodeConfig(): UserConfig {
  return {
    name: 'dsh-workspace-groups',
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      alwaysBundle: (specifier: string) => !NODE_BUILTINS.has(specifier),
    },
  }
}

function clientConfig(): UserConfig {
  return {
    name: 'dsh-workspace-groups/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    dts: false,
    clean: false,
    deps: {
      neverBundle: isRequested,
      alwaysBundle: (specifier: string) => !isRequested(specifier),
    },
    plugins: [
      {
        name: 'dsh-workspace-groups-client-purity',
        resolveId(source: string) {
          if (!source.startsWith('@deepseek-ai/')) return null
          if (isRequested(source)) return null
          throw new Error(
            `client bundle purity: "${source}" is not a platform module — `
            + 'cross-plugin value imports are forbidden (type-only imports are erased)',
          )
        },
      },
      {
        name: 'dsh-workspace-groups-css-inline',
        resolveId(source: string, importer: string | undefined) {
          if (!source.endsWith(`.css${INLINE_CSS_QUERY}`)) return null
          const stylesheet = source.slice(0, -INLINE_CSS_QUERY.length)
          const abs = importer !== undefined && isAbsolute(stylesheet)
            ? stylesheet
            : importer !== undefined
              ? sourceAssetPath(stylesheet, importer)
              : stylesheet
          return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
        },
        async load(virtualId: string) {
          if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
          const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
          this.addWatchFile(fileId)
          const source = await readFile(fileId)
          const { code } = transform({ filename: fileId, code: source, minify: true })
          return `export default ${JSON.stringify(code.toString())};`
        },
      },
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: "@dsh-xhl/workspace-groups", factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

export default [nodeConfig(), clientConfig()]
