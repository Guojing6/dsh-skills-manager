import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { handlePluginUpdateEscape, manualPluginUpdateCommand } from '../src/plugin-update-model.ts'
import { isDshCliEntry, isNewerVersion, isTrustedUpdateRequest, PLUGIN_UPDATE_HEADER, registerPluginUpdater, repositorySlug, resolveUpdateRuntime, shouldNotifyParent } from '../src/plugin-updater.ts'

test('技能管理器独立更新只接受同源专用请求', () => {
  assert.equal(isNewerVersion('0.1.40', '0.1.41'), true)
  assert.equal(isNewerVersion('0.1.40', '0.1.40'), false)
  assert.equal(isNewerVersion('0.1.0-rc.2', '0.1.0-rc.10'), true)
  assert.equal(isNewerVersion('0.1.0-rc.10', '0.1.0-rc.2'), false)
  assert.equal(isTrustedUpdateRequest({ headers: { [PLUGIN_UPDATE_HEADER]: '1', origin: 'http://localhost:3000', host: 'localhost:3000' }, socket: { remoteAddress: '::1' } }), true)
  assert.equal(isTrustedUpdateRequest({ headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } }), false)
  assert.equal(isTrustedUpdateRequest({ headers: { [PLUGIN_UPDATE_HEADER]: '1', host: '127.0.0.1:19387' }, socket: { remoteAddress: '::1' } }), true)
  assert.equal(isTrustedUpdateRequest({ headers: { [PLUGIN_UPDATE_HEADER]: '1', origin: 'http://localhost:3000', host: 'localhost:3000' }, socket: { remoteAddress: '192.168.1.8' } }), false)
  assert.equal(manualPluginUpdateCommand('web', 'https://github.com/Guojing6/dsh-skills-manager.git#v1.2.3'), 'dsh plugin --profile web add https://github.com/Guojing6/dsh-skills-manager.git#v1.2.3')
  assert.deepEqual(repositorySlug('git+https://github.com/Guojing6/dsh-skills-manager.git'), { owner: 'Guojing6', repo: 'dsh-skills-manager' })
  assert.deepEqual(repositorySlug('https://github.com/MichengAI/dsh-skills-manager'), { owner: 'MichengAI', repo: 'dsh-skills-manager' })
  assert.deepEqual(repositorySlug('github:Guojing6/dsh-skills-manager#v1.2.3'), { owner: 'Guojing6', repo: 'dsh-skills-manager' })
  assert.equal(repositorySlug('https://gitlab.com/owner/repo'), undefined)
  assert.equal(repositorySlug(''), undefined)
  assert.equal(isDshCliEntry('C:/tools/dsh/lib/bin.js', { name: '@deepseek-ai/dsh', bin: { dsh: 'lib/bin.js' } }, 'C:/tools/dsh'), true)
  assert.equal(isDshCliEntry('C:/tools/dsh/lib/bin.js', { name: '@deepseek-ai/dsh', bin: { dsh: 'lib/other.js' } }, 'C:/tools/dsh'), false)
  assert.equal(isDshCliEntry('C:/tools/dsh/lib/bin.js', { name: 'other-cli', bin: { dsh: 'lib/bin.js' } }, 'C:/tools/dsh'), false)
})

test('更新状态对比 GitHub Release，而不是未发布的 npm 包', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const requested = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    requested.push(String(url))
    return new Response(JSON.stringify({ tag_name: 'v9.9.9', html_url: 'https://github.com/Guojing6/dsh-skills-manager/releases/tag/v9.9.9' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    let handler
    registerPluginUpdater({
      webServer: { register: (route) => { handler = route.handler; return () => {} } },
      logger: { warn() {} },
    }, {
      endpoint: '/api/dsh-skills-manager/update',
      packageName: '@guojing6/dsh-skills-manager',
      manifestUrl: new URL('../package.json', import.meta.url),
    })
    const response = { writeHead() {}, end(body) { this.body = body } }
    await handler({ method: 'GET', url: '/api/dsh-skills-manager/update', headers: {} }, response)
    const payload = JSON.parse(response.body)
    assert.equal(requested.length, 1)
    assert.match(requested[0], /^https:\/\/api\.github\.com\/repos\/Guojing6\/dsh-skills-manager\/releases\/latest$/)
    assert.equal(payload.currentVersion, manifest.version)
    assert.equal(payload.latestVersion, '9.9.9')
    assert.equal(payload.releaseUrl, 'https://github.com/Guojing6/dsh-skills-manager/releases/tag/v9.9.9')
    assert.equal(payload.repository, 'https://github.com/Guojing6/dsh-skills-manager.git')
    assert.equal(payload.updateAvailable, true)
    assert.equal(payload.latestCheckFailed, false)
    assert.equal(payload.installKind, 'package', '工作区目录不是符号链接，按包安装对待')
    assert.equal(typeof payload.canAutoUpdate, 'boolean')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('技能更新弹窗消费 ESC，避免继续关闭底层设置页', () => {
  const calls = []
  assert.equal(handlePluginUpdateEscape({
    key: 'Escape',
    preventDefault: () => calls.push('prevent'),
    stopPropagation: () => calls.push('stop'),
    stopImmediatePropagation: () => calls.push('stopImmediate'),
  }, () => calls.push('close')), true)
  assert.deepEqual(calls, ['prevent', 'stop', 'stopImmediate', 'close'])
})

test('技能客户端与 Host 绑定自身更新入口', async () => {
  const client = await readFile(new URL('../src/client.ts', import.meta.url), 'utf8')
  const updateUi = await readFile(new URL('../src/plugin-update-ui.ts', import.meta.url), 'utf8')
  const updateModel = await readFile(new URL('../src/plugin-update-model.ts', import.meta.url), 'utf8')
  const host = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
  assert.match(client, /packageName: "@guojing6\/dsh-skills-manager"/)
  assert.match(client, /titleRowSelector: "\.dssm-title-row"/)
  assert.match(client, /createIcon: createPluginUpdateIcon/)
  assert.match(client, /UPDATE_ICON_PATHS/)
  assert.match(client, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "svg"\)/)
  assert.doesNotMatch(client, /react-dom\/client/)
  assert.match(updateUi, /data-mpi-label/)
  assert.match(updateUi, /document\.addEventListener\("keydown", onKey, true\)/)
  assert.match(updateUi, /keyboard: false/)
  assert.match(updateUi, /zIndex: 1200/)
  assert.doesNotMatch(updateUi, /centered:\s*true/)
  assert.match(updateUi, /overflow-wrap:anywhere/)
  assert.match(updateUi, /className: "mpi-dialog"/)
  assert.match(updateUi, /className: "mpi-status"/)
  assert.match(updateUi, /className: "mpi-manual"/)
  assert.match(updateModel, /loading: phase === "updating"/)
  assert.doesNotMatch(updateUi, /mpi-overlay/)
  assert.doesNotMatch(updateModel, /settings\.includes\("Settings"\)/)
  assert.match(updateUi, /if \(version\.textContent !== versionLabel\)/)
  assert.match(updateUi, /color: "#e8b15a"/)
  assert.match(updateModel, /payload\.latestCheckFailed/)
  assert.match(host, /endpoint: "\/api\/dsh-skills-manager\/update"/)
  assert.match(await readFile(new URL('../src/plugin-updater.ts', import.meta.url), 'utf8'), /const notifyParent = shouldNotifyParent\(target\)/)
  assert.match(await readFile(new URL('../src/plugin-updater.ts', import.meta.url), 'utf8'), /isDshCliEntry/)
})

test('官方 Desktop 在线更新指向 desktop profile，且不通知父进程', () => {
  const runtime = resolveUpdateRuntime({
    get(name) {
      if (name === 'profileContext') return {
        name: 'desktop',
        dir: 'D:\\profile\\desktop',
        packageManager: { command: 'D:\\Tools\\DeepSeek Harness\\DeepSeek Harness.exe', args: ['--expose-internals', 'D:\\runtime\\pnpm.mjs'], env: { ELECTRON_RUN_AS_NODE: '1' } },
      }
      return undefined
    },
  }, {
    argv: ['node', 'D:\\app\\dsh\\node_modules\\@deepseek-ai\\dsh-desktop-host\\lib\\index.js'],
    env: {},
    cwd: 'D:\\profile\\desktop',
    homeDir: 'C:\\Users\\YUJIYU',
  })
  assert.equal(runtime.profileName, 'desktop')
  assert.equal(runtime.canAutoUpdate, true)
  assert.equal(runtime.officialDesktop, true)
  assert.equal(shouldNotifyParent(runtime, () => {}), false)
})
