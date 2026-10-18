export interface UpdatePayload { packageName: string; currentVersion: string; updateAvailable: boolean; profileName: string; canAutoUpdate: boolean; latestCheckFailed: boolean; latestVersion?: string; installKind?: "link" | "package"; repository?: string; releaseUrl?: string; autoReload?: boolean; restartDesktop?: boolean }
type UpdatePhase = "idle" | "checking" | "updating";
type UpdateNotice = { type: "status" } | { type: "restart" } | { type: "restarting" } | { type: "error"; message: string };

const ZH = {
  check: "检查更新", update: "更新", close: "关闭", recheck: "重新检查", auto: "自动更新", updating: "正在更新…", copy: "复制命令", copied: "已复制", copyFailed: "复制失败",
  checking: "正在检查更新…", latest: "已是最新版本", found: "发现新版本", failed: "检查更新失败，请稍后重试。", current: "运行版本", latestLabel: "最新版本", profile: "目标 profile", unknown: "未知",
  manual: "手工更新", manualHint: "自动更新不可用或失败时，在当前 DSH 终端执行以下命令，完成后重启 DSH。", manualHintDesktop: "自动更新不可用或失败时，请先完全退出 DSH Desktop，再用 Desktop 自带的 dsh 执行以下命令。普通 dsh 会拒绝 desktop profile。", manualHintLink: "这是 Git 目录安装：进入插件目录执行下面的命令拉取最新版本，然后重启 DSH。", releaseNotes: "查看 Release 说明", intro: "仅检查并更新当前插件，不会联动安装其他插件。", restart: "更新完成，请重启 DSH Web。", restartDesktop: "更新完成，请完全退出并重新打开 DSH Desktop。", restarting: "更新完成，正在重启 DSH Desktop…", unavailable: "当前安装方式不支持自动更新，请按下方说明手工更新。",
};
const EN = {
  check: "Check for updates", update: "Update", close: "Close", recheck: "Check again", auto: "Update automatically", updating: "Updating…", copy: "Copy command", copied: "Copied", copyFailed: "Copy failed",
  checking: "Checking for updates…", latest: "You are up to date", found: "New version available", failed: "Could not check for updates. Try again later.", current: "Running version", latestLabel: "Latest version", profile: "Target profile", unknown: "Unknown",
  manual: "Manual update", manualHint: "If automatic update is unavailable or fails, run this command in the current DSH terminal, then restart DSH.", manualHintDesktop: "If automatic update is unavailable or fails, fully quit DSH Desktop, then run this command with Desktop's own dsh. A regular dsh rejects the desktop profile.", manualHintLink: "This copy is a Git checkout: run the command below in the plugin directory, then restart DSH.", releaseNotes: "View release notes", intro: "Only this plugin is checked and updated. Other plugins are not changed.", restart: "Update complete. Restart DSH Web.", restartDesktop: "Update complete. Fully quit and reopen DSH Desktop.", restarting: "Update complete. Restarting DSH Desktop…", unavailable: "This install cannot update itself. Follow the manual steps below.",
};
type UpdateStrings = { [Key in keyof typeof ZH]: string };

/** 只看 html lang。设置页正文里的 Settings 不能把中文界面判成英文。 */
export function pluginUpdateCopy(lang: string): UpdateStrings {
  return lang.toLowerCase().startsWith("zh") ? ZH : EN;
}

export function describePluginUpdate(lang: string, payload: UpdatePayload | undefined, phase: UpdatePhase, notice: UpdateNotice) {
  const base = pluginUpdateCopy(lang);
  const desktop = payload?.restartDesktop === true || payload?.profileName === "desktop";
  const linked = payload?.installKind === "link";
  const copy = { ...base, manualHint: linked ? base.manualHintLink : desktop ? base.manualHintDesktop : base.manualHint };
  const busy = phase !== "idle";
  let message = copy.checking;
  let kind = "";
  if (phase === "checking") message = copy.checking;
  else if (phase === "updating") message = copy.updating;
  else if (notice.type === "error") { message = notice.message || copy.failed; kind = "error"; }
  else if (notice.type === "restart") { message = desktop ? copy.restartDesktop : copy.restart; kind = "success"; }
  else if (notice.type === "restarting") { message = copy.restarting; kind = "success"; }
  else if (payload === undefined) message = copy.checking;
  else if (payload.latestCheckFailed) { message = copy.failed; kind = "error"; }
  else if (!payload.canAutoUpdate && payload.updateAvailable) { message = copy.unavailable; kind = "update"; }
  else if (payload.updateAvailable) { message = `${copy.found}: v${payload.latestVersion ?? copy.unknown}`; kind = "update"; }
  else { message = copy.latest; kind = "success"; }
  const profileRaw = payload?.profileName ?? "";
  const latestRaw = payload?.latestVersion ?? "latest";
  const spec = payload?.repository !== undefined
    ? `${payload.repository}#v${latestRaw}`
    : `${payload?.packageName ?? ""}@${latestRaw} --registry=https://registry.npmjs.org/`;
  return {
    copy, busy, message, kind, loading: phase === "updating",
    updateLabel: phase === "updating" ? copy.updating : copy.auto,
    disabled: busy || payload?.canAutoUpdate !== true || payload.updateAvailable !== true,
    currentVersion: payload === undefined ? copy.unknown : `v${payload.currentVersion}`,
    latestVersion: payload?.latestVersion === undefined ? copy.unknown : `v${payload.latestVersion}`,
    profileName: payload?.profileName ?? copy.unknown,
    profileRaw,
    latestRaw,
    manualHint: copy.manualHint,
    manualCommand: payload === undefined ? "" : linked ? "git pull" : manualPluginUpdateCommand(profileRaw, spec),
    releaseUrl: payload?.releaseUrl,
  };
}

export function createUpdateFlow(request: (method: "GET" | "POST") => Promise<UpdatePayload>, initial?: UpdatePayload, onPayload?: (value: UpdatePayload) => void) {
  let phase: UpdatePhase = "idle";
  let current = initial;
  let notice: UpdateNotice = { type: "status" };
  let posts = 0;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  const assign = (next: UpdatePayload) => { current = next; onPayload?.(next); };
  return {
    get posts() { return posts; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    view(lang: string) { return describePluginUpdate(lang, current, phase, notice); },
    async check() {
      if (phase !== "idle") return;
      phase = "checking"; notice = { type: "status" }; emit();
      try { assign(await request("GET")); notice = { type: "status" }; }
      catch (error) { notice = { type: "error", message: error instanceof Error ? error.message : "" }; }
      finally { phase = "idle"; emit(); }
    },
    async update() {
      if (phase !== "idle") return;
      phase = "updating"; notice = { type: "status" }; posts += 1; emit();
      try {
        const next = await request("POST");
        assign(next);
        notice = { type: next.autoReload === true ? "restarting" : "restart" };
      } catch (error) { notice = { type: "error", message: error instanceof Error ? error.message : "" }; }
      finally { phase = "idle"; emit(); }
    },
  };
}

export function manualPluginUpdateCommand(profileName: string, spec: string) {
  const profile = profileName.trim() === "" ? "" : ` --profile ${profileName.trim()}`;
  return `dsh plugin${profile} add ${spec}`;
}

interface PluginUpdateEscapeEvent { readonly key: string; preventDefault(): void; stopPropagation(): void; stopImmediatePropagation(): void }
export function handlePluginUpdateEscape(event: PluginUpdateEscapeEvent, close: () => void) {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  close();
  return true;
}
