import type { IncomingMessage, ServerResponse } from "node:http";
import type { HostContext, UpdateOptions, UpdateTarget } from "./host-types.js";
import type { CodedError } from "./types.js";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile, lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const PLUGIN_UPDATE_HEADER = "x-dsh-skills-manager-plugin-update";
const PLUGIN_UPDATE_IPC = "apply-plugin-updates";
function header(request: IncomingMessage, name: string) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
function isLoopbackAddress(value?: string) {
  const address = value?.toLowerCase().replace(/^\[|\]$/g, "");
  return address === "localhost" || address === "localhost." || address === "::1" || address?.startsWith("127.") === true || address?.startsWith("::ffff:127.") === true;
}
function isTrustedUpdateRequest(request: IncomingMessage) {
  if (header(request, PLUGIN_UPDATE_HEADER) !== "1") return false;
  if (!isLoopbackAddress(request.socket?.remoteAddress)) return false;
  const site = header(request, "sec-fetch-site");
  if (site !== void 0 && site !== "same-origin") return false;
  const host = header(request, "host");
  if (host === void 0 || host === "") return false;
  const origin = header(request, "origin");
  // 官方 Desktop 从 dsh-app://app 转发时会去掉 origin。只接受本机 Host，浏览器带来的跨源 origin 仍然拒绝。
  if (origin === void 0 || origin === "") {
    try {
      return isLoopbackAddress(new URL(`http://${host}`).hostname);
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && isLoopbackAddress(url.hostname) && url.host === host;
  } catch {
    return false;
  }
}
function validProfileName(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\") && !/[\0-\x1f\x7f]/.test(value);
}
function profileNameFromArgv(argv: readonly string[]) {
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--profile") return argv[index + 1];
    if (argv[index]?.startsWith("--profile=")) return argv[index].slice("--profile=".length);
  }
  return argv[2] === "web" ? "web" : void 0;
}
function isDshCliEntry(entry: string, manifest: {name?: string; bin?: string | {dsh?: string}}, packageRoot: string) {
  if (typeof manifest !== "object" || manifest === null) return false;
  if (manifest.name !== "@deepseek-ai/dsh") return false;
  const bin = typeof manifest.bin === "string" ? manifest.bin : typeof manifest.bin === "object" && manifest.bin !== null ? manifest.bin.dsh : void 0;
  return typeof bin === "string" && bin !== "" && !isAbsolute(bin) && resolve(packageRoot, bin) === resolve(entry);
}
function cliEntry(argv: readonly string[] = process.argv, cwd = process.cwd(), exists: (path: string) => boolean = existsSync) {
  const value = argv[1];
  if (value === void 0 || value === "") return void 0;
  const entry = value.startsWith("file:") ? fileURLToPath(value) : resolve(cwd, value);
  if (!exists(entry)) return void 0;
  for (let directory = dirname(entry); ; ) {
    const manifestPath = resolve(directory, "package.json");
    if (exists(manifestPath)) {
      try {
        if (isDshCliEntry(entry, JSON.parse(readFileSync(manifestPath, "utf8")), directory)) return entry;
      } catch {
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return void 0;
    directory = parent;
  }
}
function optionalService(ctx: { get?: (name: string) => unknown }, name: string) {
  try {
    return typeof ctx.get === "function" ? ctx.get(name) : void 0;
  } catch {
    return void 0;
  }
}
function isOfficialDesktopHostEntry(entry: string | undefined) {
  if (entry === void 0 || entry === "") return false;
  return entry.replaceAll("\\", "/").includes("/dsh-desktop-host/");
}
function stringEnvironment(value: unknown) {
  if (value === null || typeof value !== "object") return void 0;
  const env: NodeJS.ProcessEnv = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") env[key] = item;
  }
  return Object.keys(env).length === 0 ? void 0 : env;
}
function packageManagerFrom(value: unknown): UpdateTarget["packageManager"] {
  if (value === null || typeof value !== "object") return void 0;
  const item = value as { command?: unknown; args?: unknown; env?: unknown };
  if (typeof item.command !== "string" || item.command === "") return void 0;
  if (!Array.isArray(item.args) || !item.args.every((arg) => typeof arg === "string")) return void 0;
  const env = stringEnvironment(item.env);
  return { command: item.command, args: item.args, ...env === void 0 ? {} : { env } };
}
function packageManagerFromArgv(argv: readonly string[], exists: (path: string) => boolean, execPath: string, pathEnv: string | undefined): UpdateTarget["packageManager"] {
  if (!isOfficialDesktopHostEntry(argv[1])) return void 0;
  const pnpm = argv[5];
  if (typeof pnpm !== "string" || !isAbsolute(pnpm) || !exists(pnpm)) return void 0;
  const bin = argv[6];
  const path = typeof bin === "string" && bin !== "" ? `${bin}${delimiter}${pathEnv ?? ""}` : pathEnv;
  return { command: execPath, args: ["--expose-internals", pnpm], env: { ELECTRON_RUN_AS_NODE: "1", ...typeof path === "string" && path !== "" ? { PATH: path } : {} } };
}
function pluginManagerFrom(value: unknown): UpdateTarget["pluginManager"] {
  if (value === null || typeof value !== "object" || typeof (value as { installBundle?: unknown }).installBundle !== "function") return void 0;
  return value as UpdateTarget["pluginManager"];
}
export function resolveUpdateRuntime(ctx: { get?: (name: string) => unknown }, options: { argv?: readonly string[]; env?: NodeJS.ProcessEnv; cwd?: string; homeDir?: string; exists?: (path: string) => boolean; execPath?: string } = {}): UpdateTarget {
  const argv = options.argv ?? process.argv;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();
  const exists = options.exists ?? existsSync;
  const execPath = options.execPath ?? process.execPath;
  const profiles = optionalService(ctx, "desktopProfiles") as { current?: { name?: unknown; dir?: unknown } } | undefined;
  const desktopPnpm = optionalService(ctx, "desktopPnpm") as UpdateTarget["desktopPnpm"];
  if (profiles?.current !== void 0) {
    const current = profiles.current;
    if (!validProfileName(current?.name) || typeof current.dir !== "string" || !isAbsolute(current.dir)) {
      throw new Error("当前 Desktop Profile 信息无效，请重启后重试。");
    }
    const runnable = typeof desktopPnpm?.runPlugin === "function";
    return { profileName: current.name, profileDir: resolve(current.dir), officialDesktop: false, canAutoUpdate: runnable, ...runnable ? { desktopPnpm } : {} };
  }
  const launched = optionalService(ctx, "profileContext") as { name?: unknown; dir?: unknown; packageManager?: unknown } | undefined;
  const official = isOfficialDesktopHostEntry(argv[1]) || launched?.name === "desktop";
  const launchedDir = typeof launched?.dir === "string" && isAbsolute(launched.dir) ? resolve(launched.dir) : void 0;
  const projectDir = official && typeof argv[3] === "string" && isAbsolute(argv[3]) ? resolve(argv[3]) : void 0;
  const cwdProfile = official && exists(resolve(cwd, "package.json")) ? resolve(cwd) : void 0;
  const profileDir = launchedDir ?? projectDir ?? cwdProfile ?? resolve(env.DSH_PROFILE_DIR ?? resolve(home, ".dsh", "profiles", "web"));
  const selected = profileNameFromArgv(argv);
  const profileName = validProfileName(launched?.name) ? launched.name : official ? "desktop" : validProfileName(selected) ? selected : validProfileName(basename(profileDir)) ? basename(profileDir) : "web";
  const packageManager = official ? packageManagerFrom(launched?.packageManager) ?? packageManagerFromArgv(argv, exists, execPath, env.PATH) : void 0;
  const pluginManager = official && packageManager === void 0 ? pluginManagerFrom(optionalService(ctx, "pluginManager")) : void 0;
  const entry = official ? void 0 : cliEntry(argv, cwd, exists);
  return { profileName, profileDir, officialDesktop: official, canAutoUpdate: packageManager !== void 0 || pluginManager !== void 0 || entry !== void 0, ...packageManager === void 0 ? {} : { packageManager }, ...pluginManager === void 0 ? {} : { pluginManager }, ...entry === void 0 ? {} : { cliEntry: entry } };
}
export function shouldNotifyParent(target: UpdateTarget, send: NodeJS.Process["send"] = process.send) {
  return target.officialDesktop !== true && target.desktopPnpm === void 0 && target.packageManager === void 0 && typeof send === "function";
}
function runtime(ctx: HostContext): UpdateTarget {
  return resolveUpdateRuntime(ctx as { get?: (name: string) => unknown });
}
function parseSemver(value: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (match === null) return void 0;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4]?.split(".") ?? [] };
}
function isNewerVersion(currentValue: string, candidateValue: string) {
  const current = parseSemver(currentValue);
  const candidate = parseSemver(candidateValue);
  if (current === void 0 || candidate === void 0) return false;
  for (let index = 0; index < 3; index += 1) {
    if (candidate.core[index] !== current.core[index]) return candidate.core[index] > current.core[index];
  }
  return comparePrerelease(candidate.prerelease, current.prerelease) > 0;
}
function comparePrerelease(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === void 0 || b === void 0) return a === b ? 0 : a === void 0 ? -1 : 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) {
      const aNumber = BigInt(a);
      const bNumber = BigInt(b);
      if (aNumber !== bNumber) return aNumber > bNumber ? 1 : -1;
      continue;
    }
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a > b ? 1 : -1;
  }
  return 0;
}
let latestCache: {key: string; expiresAt: number; release: LatestRelease | null} | undefined;
interface LatestRelease {
  version: string;
  url?: string;
}
const LATEST_CACHE_MS = 5 * 60e3;
/**
 * 本分发只通过 Git / 本地目录发布，没有 npm 包：最新版本看 GitHub Releases。
 * 仓库地址取自插件清单，缺失或不是 GitHub 时只报告"检查失败"，不回退到猜测。
 */
function repositorySlug(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const text = value.trim().replace(/^git\+/, "");
  const match = /(?:^|[/@])github\.com[:/]([^/:#]+)\/([^/#]+?)(?:\.git)?(?:[#?].*)?$/.exec(text)
    ?? /^github[:/]([^/:#]+)\/([^/#]+?)(?:\.git)?(?:[#?].*)?$/.exec(text);
  if (match === null) return undefined;
  return { owner: match[1], repo: match[2] };
}
function manifestRepository(value: unknown) {
  if (typeof value === "string") return repositorySlug(value);
  if (value !== null && typeof value === "object" && typeof (value as { url?: unknown }).url === "string") return repositorySlug((value as { url: string }).url);
  return undefined;
}
interface PluginManifest {
  version: string;
  repository?: { owner: string; repo: string };
}
async function readManifest(manifestUrl: URL): Promise<PluginManifest> {
  const value: {version?: unknown; repository?: unknown} = JSON.parse(await readFile(manifestUrl, "utf8"));
  if (typeof value.version !== "string" || value.version === "") throw new Error("\u65E0\u6CD5\u8BFB\u53D6\u5F53\u524D\u63D2\u4EF6\u7248\u672C\u3002");
  const repository = manifestRepository(value.repository);
  return { version: value.version, ...repository === undefined ? {} : { repository } };
}
async function latestRelease(repository: { owner: string; repo: string }): Promise<LatestRelease | undefined> {
  const key = `${repository.owner}/${repository.repo}`;
  if (latestCache?.key === key && Date.now() < latestCache.expiresAt) return latestCache.release ?? void 0;
  let release: LatestRelease | undefined;
  try {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "dsh-skills-manager" },
      signal: AbortSignal.timeout(8e3),
    });
    if (response.ok) {
      const value: {tag_name?: unknown; html_url?: unknown; draft?: unknown} = await response.json();
      const tag = typeof value.tag_name === "string" ? value.tag_name : "";
      const version = tag.replace(/^v/, "");
      if (version !== "" && value.draft !== true) release = { version, ...typeof value.html_url === "string" ? { url: value.html_url } : {} };
    }
  } catch {
    /* 网络或限流失败只表示本次检查失败，不阻止面板其他功能 */
  }
  latestCache = { key, expiresAt: Date.now() + LATEST_CACHE_MS, release: release ?? null };
  return release;
}
type InstallKind = "link" | "package";
/** 目录安装（pnpm link / 本地路径）与包安装分开：链接安装只能由用户 git pull 后重启。 */
async function installKind(manifestUrl: URL): Promise<InstallKind> {
  const directory = dirname(fileURLToPath(manifestUrl));
  try {
    if ((await lstat(directory)).isSymbolicLink()) return "link";
    return (await realpath(directory)) === resolve(directory) ? "package" : "link";
  } catch {
    return "package";
  }
}
function repositorySpec(repository: { owner: string; repo: string } | undefined, version: string) {
  return repository === undefined ? void 0 : `https://github.com/${repository.owner}/${repository.repo}.git#v${version}`;
}
async function status(options: UpdateOptions, target: UpdateTarget) {
  const manifest = await readManifest(options.manifestUrl);
  const release = manifest.repository === undefined ? void 0 : await latestRelease(manifest.repository);
  const kind = await installKind(options.manifestUrl);
  return {
    packageName: options.packageName,
    currentVersion: manifest.version,
    ...release === undefined ? {} : { latestVersion: release.version, ...release.url === undefined ? {} : { releaseUrl: release.url } },
    ...manifest.repository === undefined ? {} : { repository: `https://github.com/${manifest.repository.owner}/${manifest.repository.repo}.git` },
    installKind: kind,
    latestCheckFailed: release === undefined,
    updateAvailable: release !== undefined && isNewerVersion(manifest.version, release.version),
    profileName: target.profileName,
    canAutoUpdate: target.canAutoUpdate && kind !== "link"
  };
}
async function runCliInstall(target: UpdateTarget, packageSpec: string) {
  if (target.cliEntry === void 0) throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u81EA\u52A8\u66F4\u65B0\uFF0C\u8BF7\u4F7F\u7528\u624B\u5DE5\u66F4\u65B0\u547D\u4EE4\u3002");
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [target.cliEntry!, "plugin", "--profile", target.profileName, "add", "--config.minimumReleaseAge=0", packageSpec, "--registry=https://registry.npmjs.org/"], {
      cwd: target.profileDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" }
    });
    let detail = "";
    child.stdout?.on("data", (chunk) => {
      detail = (detail + String(chunk)).slice(-4e3);
    });
    child.stderr?.on("data", (chunk) => {
      detail = (detail + String(chunk)).slice(-4e3);
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("\u66F4\u65B0\u8D85\u65F6\uFF0C\u8BF7\u6539\u7528\u624B\u5DE5\u66F4\u65B0\u3002"));
    }, 10 * 6e4);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(detail.trim() || `\u66F4\u65B0\u8FDB\u7A0B\u9000\u51FA\u7801 ${String(code)}`));
    });
  });
}
async function install(target: UpdateTarget, packageSpec: string) {
  if (target.desktopPnpm !== void 0) {
    const handle = target.desktopPnpm.runPlugin(["add", "--config.minimumReleaseAge=0", packageSpec, "--registry=https://registry.npmjs.org/"], target.profileDir);
    const result = await handle.done;
    if (result.exitCode !== 0) throw new Error(`更新进程退出码 ${String(result.exitCode)}。`);
    return;
  }
  if (target.packageManager !== void 0) {
    const manager = target.packageManager;
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(manager.command, [...manager.args, "add", "--config.minimumReleaseAge=0", packageSpec, "--registry=https://registry.npmjs.org/"], {
        cwd: target.profileDir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...manager.env, NO_COLOR: "1" },
      });
      let detail = "";
      child.stdout?.on("data", (chunk) => { detail = (detail + String(chunk)).slice(-4e3); });
      child.stderr?.on("data", (chunk) => { detail = (detail + String(chunk)).slice(-4e3); });
      const timer = setTimeout(() => { child.kill(); reject(new Error("更新超时，请改用手工更新。")); }, 10 * 6e4);
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", (code) => { clearTimeout(timer); if (code === 0) resolvePromise(); else reject(new Error(detail.trim() || `更新进程退出码 ${String(code)}`)); });
    });
    return;
  }
  if (target.pluginManager !== void 0) {
    const result = await target.pluginManager.installBundle(packageSpec);
    if (result.application === "applied" || result.application === "restart-required" || result.application === "overridden") return;
    throw new Error(result.error?.message || result.packageResult?.output || "更新失败，请查看服务端日志。");
  }
  return runCliInstall(target, packageSpec);
}
function json(response: ServerResponse, statusCode: number, value: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}
function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "\u66F4\u65B0\u6682\u4E0D\u53EF\u7528\u3002";
  return /[A-Za-z]:[\\/]|\/(?:home|root|Users|var|tmp)\//.test(message) ? "\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u670D\u52A1\u7AEF\u65E5\u5FD7\u3002" : message;
}
function registerPluginUpdater(ctx: HostContext, options: UpdateOptions) {
  const host = ctx;
  let installing = false;
  return host.webServer.register({
    kind: "exact",
    path: options.endpoint,
    handler: async (request, response) => {
      try {
        const target = runtime(host);
        if (request.method === "GET" || request.method === "HEAD") {
          const payload = await status(options, target);
          response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          response.end(request.method === "HEAD" ? void 0 : JSON.stringify(payload));
          return;
        }
        if (request.method !== "POST") {
          response.writeHead(405, { allow: "GET, HEAD, POST" });
          response.end();
          return;
        }
        if (!isTrustedUpdateRequest(request)) {
          json(response, 403, { error: "\u5DF2\u62D2\u7EDD\u975E\u672C\u673A\u540C\u6E90\u66F4\u65B0\u8BF7\u6C42\u3002" });
          return;
        }
        if (installing) {
          json(response, 409, { error: "\u5F53\u524D\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u5019\u3002" });
          return;
        }
        const before = await status(options, target);
        if (before.latestVersion === void 0) {
          json(response, 503, { error: "\u6682\u65F6\u65E0\u6CD5\u83B7\u53D6\u6700\u65B0\u7248\u672C\u3002" });
          return;
        }
        if (!before.updateAvailable) {
          json(response, 200, before);
          return;
        }
        if (!before.canAutoUpdate) {
          json(response, 409, { error: "\u5F53\u524D\u662F Git \u76EE\u5F55\u5B89\u88C5\uFF0C\u65E0\u6CD5\u81EA\u52A8\u66F4\u65B0\uFF1A\u8BF7\u5728\u63D2\u4EF6\u76EE\u5F55\u6267\u884C git pull\uFF0C\u7136\u540E\u91CD\u542F DSH\u3002" });
          return;
        }
        const repository = (await readManifest(options.manifestUrl)).repository;
        const spec = repositorySpec(repository, before.latestVersion);
        if (spec === undefined) {
          json(response, 503, { error: "\u63D2\u4EF6\u6E05\u5355\u7F3A\u5C11 GitHub \u4ED3\u5E93\u5730\u5740\uFF0C\u65E0\u6CD5\u81EA\u52A8\u66F4\u65B0\u3002" });
          return;
        }
        installing = true;
        try {
          await install(target, spec);
        } finally {
          installing = false;
        }
        const notifyParent = shouldNotifyParent(target);
        const autoReload = target.desktopPnpm !== void 0 || notifyParent;
        json(response, 200, { ...before, updatedVersion: before.latestVersion, restartRequired: true, autoReload, ...target.officialDesktop ? { restartDesktop: true } : {} });
        if (notifyParent) setTimeout(() => {
          process.send?.(PLUGIN_UPDATE_IPC);
        }, 150).unref?.();
      } catch (caught) { const error = caught as CodedError;
        ctx.logger.warn(`plugin updater failed: ${String(error)}`);
        json(response, 503, { error: publicError(error) });
      }
    }
  });
}
export {
  PLUGIN_UPDATE_HEADER,
  PLUGIN_UPDATE_IPC,
  isDshCliEntry,
  isNewerVersion,
  isTrustedUpdateRequest,
  registerPluginUpdater,
  repositorySlug
};
