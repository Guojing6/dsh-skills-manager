// 验证真实 hooks/事件的筛选、折叠、安装位置选择、回收站卸载和更新行为。
import assert from "node:assert/strict";
import { createRepositoryUI, repositoryLocales } from "../src/repository-ui.ts";
import { createDestinationKit, destinationLocales } from "../src/destination-picker.ts";
let values = [], cursor = 0, effects = [], dependencies = [];
const react = {
  createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter((v) => v != null && typeof v !== "boolean") }; },
  useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], (v) => { values[i] = typeof v === "function" ? v(values[i]) : v; }]; },
  useRef(initial) { const i = cursor++; return values[i] || (values[i] = { current: initial }); },
  useEffect(fn, deps) { const i = cursor++; if (!dependencies[i] || deps.some((v, n) => dependencies[i][n] !== v)) { effects.push(fn); dependencies[i] = deps; } },
};
const repos = [{ id: "one", owner: "example", name: "skills", skills: [
  { path: "skills/pdf", name: "pdf", description: "PDF 文档", status: "available", installedRoot: null, canUninstall: false },
  { path: "skills/docx", name: "docx", description: "Word 文档", status: "conflict", installedRoot: null, canUninstall: false },
] }];
// 故意使用非默认、包含空格的配置路径，防止界面重新硬编码用户目录。
const configuredRoots = [
  { key: "dsh", path: "/configured/DSH Home/skills", label: "Backend DSH", available: true },
  { key: "agents", path: "/configured/shared agent/skills", label: "Backend Shared", available: true },
  { key: "codex", path: "/configured/codex-user/skills", label: "Backend Codex", available: true },
  { key: "claude", path: "/configured/claude-user/skills", label: "Backend Claude", available: true },
  { key: "gemini", path: "/configured/unsafe-gemini/skills", label: "Gemini configured", available: false, error: { code: "error.repo.invalid", error: "Unsafe configured Gemini path" } },
  { key: "windsurf", path: "/configured/windsurf-user/skills", label: "Backend Windsurf", localeKey: "windsurf-user", available: true },
];
let installRoots = structuredClone(configuredRoots);
const calls = [];
let workspaceRows = [];
let finishInstall, finishUninstall;
let failInstall = false, failUninstall = false;
let finishRefresh, finishDetail;
let holdRefresh = false, failRefresh = false;
let installedCalls = 0, failInstalledRefresh = false;
const api = async (path, options) => {
  const body = options?.body ? JSON.parse(options.body) : undefined;
  calls.push({ path, body });
  if (path === "/workspaces") return { items: structuredClone(workspaceRows) };
  if (path.endsWith("/install")) {
    await new Promise((resolve) => { finishInstall = resolve; });
    if (failInstall) throw new Error("下载超时，请重试");
    Object.assign(repos[0].skills[0], { status: "installed", tracked: true, installedRoot: body.root, canUninstall: true });
  }
  if (path.endsWith("/uninstall")) {
    await new Promise((resolve) => { finishUninstall = resolve; });
    if (failUninstall) throw new Error("回收站写入失败");
    Object.assign(repos[0].skills[0], { status: "available", tracked: false, installedRoot: null, canUninstall: false, updateAvailable: false, canRollback: false });
  }
  if (path.endsWith("/add")) return { id: "two" };
  if (path.endsWith("/refresh")) { if (holdRefresh) await new Promise(resolve => { finishRefresh = resolve; }); if (failRefresh) throw new Error("仓库网络失败"); return { error: null }; }
  if (path.endsWith("/detail")) { await new Promise(resolve => { finishDetail = resolve; }); return { name: "pdf", body: "说明", commit: "abc", path: "skills/pdf" }; }
  if (path.endsWith("/preview")) return { token: "checked", commit: "a".repeat(40), localModified: true, changes: [{ kind: "modified", path: "SKILL.md" }] };
  if (path.endsWith("/update") || path.endsWith("/rollback")) repos[0].skills[0].status = "installed";
  // 每次返回独立快照，安装/卸载必须真正 reload 才能改变 UI。
  return structuredClone({ repositories: repos, installRoots });
};
const Input = Object.assign(() => {}, { TextArea: Symbol("官方只读说明框") });
const Button = Symbol("官方按钮");
const isAction = (node, key) => (node.type === "button" || node.type === Button) && node.children.includes(key);
const OfficialSelect = Symbol("官方筛选");
let hostLocale;
const useUI = createRepositoryUI({ react, Modal: "modal", Input, Button, SourceSelect: OfficialSelect, destination: createDestinationKit({ react, SourceSelect: OfficialSelect, translateError: (_t, error) => error.error || error.message }), api, headers: {}, getLocale: () => hostLocale, translateError: (_t, e) => e.code === "error.repo.invalid" ? "已翻译的仓库错误" : e.error || e.message });
let languagePrefix = "";
const rootTranslations = { "root.codex": "Codex", "root.claude": "Claude", "root.windsurf-user": "Windsurf User" };
const t = (key) => key === "format.locale" ? "zh-CN" : languagePrefix + (rootTranslations[key] || key);
let ui;
function render() { cursor = 0; ui = useUI({ active: true, t, onInstalled: async () => { installedCalls++; if (failInstalledRefresh) throw new Error("本地列表刷新失败"); } }); }
// 目标选择器是函数组件：带 userDestinations 的节点展开成它渲染出的子树，其余沿用原遍历。
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (typeof node.type === "function" && node.props && "userDestinations" in node.props) return nodes(node.type(node.props));
  return [node, ...node.children.flatMap(nodes)];
}
const all = () => [...nodes(ui.actions), ...nodes(ui.content)];
const find = (predicate) => all().find(predicate);
const dialog = () => find(n => n.type === "modal");
const modalNodes = () => nodes(dialog());
const modalAction = key => modalNodes().find(n => isAction(n, key));
const rowAction = key => all().filter(n => n.props.className === "dssm-repo-row").flatMap(nodes).find(n => isAction(n, key));
const countCalls = path => calls.filter(call => call.path === path).length;
const settle = async () => { await new Promise(setImmediate); render(); };
const clickNode = async node => { assert.ok(node, "必须找到可点击元素"); assert.ok(!node.props.disabled, "真实点击不能触发禁用按钮"); node.props.onClick(); await settle(); };
const click = key => clickNode(find(n => isAction(n, key)));
const clickModal = key => clickNode(modalAction(key));
// 位置是并排在范围右侧的官方下拉：label 为翻译后的「位置」，选项为后端允许的位置。
const locationSelect = () => modalNodes().find(n => n.type === OfficialSelect && n.props.label === "dest.location");
const locationOption = root => locationSelect()?.props.options.find(o => o.value === root);
// 与旧单选框同名的辅助：返回该位置的选项（不存在则 undefined），disabled 来自下拉选项
const radio = root => { const option = locationOption(root); return option && { props: { disabled: option.disabled === true || locationSelect().props.disabled === true, checked: locationSelect().props.value === root, value: root, onChange: () => locationSelect().props.onChange(root) } }; };
const chooseRoot = root => { const option = locationOption(root); assert.ok(option, "所选位置必须可见"); assert.ok(!option.disabled, "真实选择不能触发不可用位置"); locationSelect().props.onChange(root); render(); };
const checkedRoots = () => { const select = locationSelect(); return select && select.props.value ? [select.props.value] : []; };
const destinationLabels = () => locationSelect()?.props.options ?? [];
const pathLines = () => modalNodes().filter(n => n.type === "code").map(n => n.children.join(""));

assert.deepEqual(Object.keys(repositoryLocales.en).sort(), Object.keys(repositoryLocales.zh).sort(), "中英文词条必须同步");
const allowedDestinationKeys = ["dsh", "agents"];
for (const locale of Object.values(repositoryLocales)) {
  for (const name of ["DSH skills", "Shared Agent"]) assert.ok(locale["repo.hint"].includes(name), "全局提示必须介绍可选安装位置：" + name);
  for (const name of ["Codex", "Claude"]) assert.equal(locale["repo.hint"].includes(name), false, "安装提示不能把只读 Agent 目录说成可选位置：" + name);
  assert.ok(locale["repo.uninstallSuccess"] && locale["repo.uninstallExternalWarning"]);
  assert.equal(locale["repo.uninstallSharedWarning"], undefined, "删除仅 Shared Agent 专用的旧警告词条");
}
assert.match(repositoryLocales.en["repo.hint"], /DSH skills or Shared Agent/);
assert.match(repositoryLocales.zh["repo.hint"], /DSH skills 或 Shared Agent/);
assert.match(repositoryLocales.en["repo.hint"], /project.*\.dsh\/skills/i, "仓库提示说明项目写入边界");
assert.match(repositoryLocales.zh["repo.hint"], /项目.*\.dsh\/skills/, "中文仓库提示说明项目写入边界");
assert.match(repositoryLocales.en["repo.installLocationsHint"], /User.*DSH skills or Shared Agent/);
assert.match(repositoryLocales.en["repo.installLocationsHint"], /[Pp]roject.*only.*\.dsh\/skills/);
assert.match(repositoryLocales.en["repo.installLocationsHint"], /Missing directories are created after confirmation/);
assert.match(repositoryLocales.zh["repo.installLocationsHint"], /用户目录.*DSH skills 或 Shared Agent/);
assert.match(repositoryLocales.zh["repo.installLocationsHint"], /项目.*仅.*\.dsh\/skills/);
assert.match(repositoryLocales.zh["repo.installLocationsHint"], /缺少的目录会在确认安装后创建/);
render(); effects.splice(0).forEach((f) => f()); await settle();
assert.equal(countCalls("/repositories"), 1, "进入仓库只读取一次列表");
assert.equal(find(n => isAction(n, "repo.check")), undefined, "不再提供重复的检查更新按钮");
assert.equal(find(n => n.props["aria-label"] === "repo.search").type, Input, "仓库搜索必须使用官方输入框");
assert.equal(find(n => n.props.className === "dssm-repo-row"), undefined, "默认折叠");
find(n => n.props["aria-expanded"] === false).props.onClick(); render();
assert.equal(all().filter(n => n.props.className === "dssm-repo-row").length, 2);
assert.ok(rowAction("repo.conflict").props.disabled, "未跟踪的同名冲突不能卸载");
assert.equal(rowAction("repo.uninstall"), undefined);
// 服务端对每个技能都会返回 installations 数组；本地有同名技能但没有安装记录时是空数组，
// 界面仍要显示「同名冲突」并禁用安装，不能把空数组当成可安装。
repos[0].skills[1].installations = [];
render();
const conflictRow = all().filter(n => n.props.className === "dssm-repo-row").find(n => nodes(n).some(c => c.props.className === "dssm-name" && c.children.includes("docx")));
assert.ok(nodes(conflictRow).some(n => isAction(n, "repo.conflict") && n.props.disabled), "空 installations 的同名冲突仍显示同名冲突并禁用");
assert.equal(nodes(conflictRow).find(n => isAction(n, "repo.install")), undefined, "同名冲突行不显示可点的「安装」");
delete repos[0].skills[1].installations;
render();
find(n => n.props["aria-label"] === "repo.search").props.onChange({ target: { value: "PDF" } }); render();
assert.equal(all().filter(n => n.props.className === "dssm-repo-row").length, 1);
const listCalls = countCalls("/repositories");
await click("repo.detail");
assert.ok(dialog(), "详情应立即打开加载弹窗");
assert.equal(ui.content.props["aria-busy"], false, "读取详情不切换背景列表忙碌状态");
finishDetail(); await settle();
assert.equal(countCalls("/repositories"), listCalls, "只读详情不刷新背景列表");
assert.ok(modalNodes().some(n => n.type === Input.TextArea && n.props.readOnly && n.props.value === "说明"), "详情使用官方只读说明框");
dialog().props.onClose(); render();
holdRefresh = true;
await click("repo.refresh");
assert.ok(find(n => n.props.className === "dssm-repo-spinner"), "刷新过程中有动画图标");
assert.ok(find(n => n.props.role === "status" && n.children.some(c => typeof c === "string" && c.includes("example/skills"))), "刷新显示当前仓库");
finishRefresh(); await settle(); holdRefresh = false;
assert.equal(find(n => n.props.className === "dssm-repo-spinner"), undefined, "完成后停止动画");
await click("repo.manage");
holdRefresh = true; failRefresh = true;
await clickModal("repo.refresh");
assert.ok(modalNodes().some(n => n.props.className === "dssm-repo-spinner"), "管理弹窗中的当前仓库也显示动画");
finishRefresh(); await settle(); holdRefresh = false; failRefresh = false;
assert.equal(find(n => n.props.className === "dssm-repo-spinner"), undefined, "失败后停止动画");
assert.ok(find(n => n.props.role === "alert" && n.children.includes("仓库网络失败")), "失败提示保留");
dialog().props.onClose(); render();

// Install 先打开带原生单选框的无障碍 modal；取消没有写请求。
await click("repo.install");
assert.equal(dialog().props.title, "repo.install");
assert.equal(countCalls("/repositories/install"), 0, "打开安装选择框不安装");
assert.equal(radio("dsh").props.checked, true, "默认安装到 DSH");
assert.equal(radio("agents").props.checked, false);
assert.equal(locationSelect().props.label, "dest.location", "位置下拉有名称");
assert.equal(destinationLabels().length, allowedDestinationKeys.length, "后端返回的 Codex/Claude 等位置不能出现在选择器");
assert.deepEqual(destinationLabels().map(o => o.value), allowedDestinationKeys);
assert.equal(modalNodes().some(n => n.type === "input" && n.props.type === "radio"), false, "不再使用单选框");
for (const root of configuredRoots.filter(root => allowedDestinationKeys.includes(root.key))) {
  chooseRoot(root.key);
  assert.deepEqual(pathLines(), [root.path], "路径只显示所选位置的实际配置路径：" + root.key);
}
chooseRoot("dsh");
for (const key of ["codex", "claude", "gemini", "windsurf"]) assert.equal(radio(key), undefined, "只读 Agent 目录不可选：" + key);
assert.ok(!modalNodes().some(n => n.type === "code" && n.children.some(c => c === "$DSH_HOME/skills" || c === "~/.agents/skills")), "不展示硬编码默认路径");
assert.ok(modalNodes().some(n => n.children.includes("repo.installLocationsHint")));
assert.equal(countCalls("/repositories/install"), 0, "选择位置不会提交安装");
await clickModal("repo.cancel");
assert.equal(dialog(), undefined);
assert.equal(countCalls("/repositories/install"), 0);
await click("repo.install"); chooseRoot("agents");
const installConfirm = modalAction("repo.install");
const beforeInstallList = countCalls("/repositories");
await clickNode(installConfirm);
installConfirm.props.onClick(); await settle();
assert.equal(countCalls("/repositories/install"), 1, "双击确认只安装一次");
assert.equal(ui.content.props["aria-busy"], true);
assert.ok(rowAction("repo.installing").props.disabled, "当前行应立即显示安装中并禁用");
assert.ok(modalAction("repo.installing").props.disabled);
assert.ok(allowedDestinationKeys.every(key => radio(key).props.disabled), "安装期间可选位置不可改变");
radio("dsh").props.onChange(); render();
assert.deepEqual(checkedRoots(), ["agents"], "安装期间合成事件也不能改变选中位置");
assert.ok(modalNodes().some(n => n.props.role === "status" && n.children.includes("repo.installProgress")));
dialog().props.onClose(); render(); assert.ok(dialog(), "忙碌期间不能关闭弹窗");
finishInstall(); await settle();
assert.deepEqual(calls.find(c => c.path === "/repositories/install").body, { id: "one", path: "skills/pdf", root: "agents" });
assert.equal(countCalls("/repositories"), beforeInstallList + 1, "安装完成必须 reload 仓库");
assert.equal(installedCalls, 1, "安装完成刷新宿主列表");
assert.equal(dialog(), undefined);
assert.equal(rowAction("repo.installed"), undefined, "可卸载副本不再显示禁用 Installed");
assert.ok(rowAction("repo.uninstall").props.danger, "卸载按钮为红色 danger");
assert.equal(rowAction("repo.uninstall").props.disabled, false);
assert.ok(find(n => n.props.className === "dssm-repo-main").children.some(n => n.props?.role === "status" && n.children.join("").includes("repo.installSuccess")), "成功结果留在当前行");
languagePrefix = "en:"; render();
assert.ok(find(n => n.props.role === "status" && n.children.includes("en:repo.installSuccess")), "切换语言后已完成提示重新翻译");
languagePrefix = ""; render();

// Shared Agent 卸载须确认，告知跨 Agent 影响和回收站恢复。
await click("repo.uninstall");
assert.equal(countCalls("/repositories/uninstall"), 0, "打开卸载确认不删除");
assert.equal(dialog().props.title, "repo.uninstall");
assert.ok(modalNodes().some(n => n.props.className === "dssm-repo-metadata" && n.children.includes("repo.rootAgents")), "共享位置元数据显示正确名称");
assert.ok(modalNodes().some(n => n.props.role === "alert" && n.children.includes("repo.uninstallExternalWarning")));
assert.ok(modalNodes().some(n => n.children.includes("repo.uninstallHint")), "提示仅删除跟踪副本且可以恢复");
assert.ok(modalAction("repo.confirmUninstall").props.danger);
await clickModal("repo.cancel");
assert.equal(countCalls("/repositories/uninstall"), 0);
await click("repo.uninstall");
const uninstallConfirm = modalAction("repo.confirmUninstall");
const beforeUninstallList = countCalls("/repositories");
await clickNode(uninstallConfirm);
uninstallConfirm.props.onClick(); await settle();
assert.equal(countCalls("/repositories/uninstall"), 1, "双击确认只卸载一次");
assert.equal(ui.content.props["aria-busy"], true);
assert.ok(rowAction("repo.uninstalling").props.disabled && rowAction("repo.uninstalling").props.danger);
assert.ok(modalAction("repo.uninstalling").props.disabled);
assert.ok(modalNodes().some(n => n.props.role === "status" && n.children.includes("repo.uninstallProgress")));
dialog().props.onClose(); render(); assert.ok(dialog(), "卸载期间不能关闭弹窗");
finishUninstall(); await settle();
assert.deepEqual(calls.find(c => c.path === "/repositories/uninstall").body, { id: "one", path: "skills/pdf", root: "agents" }, "卸载显式指向确认的用户副本");
assert.equal(countCalls("/repositories"), beforeUninstallList + 1, "卸载完成必须 reload 仓库");
assert.equal(installedCalls, 2, "卸载完成刷新宿主列表及回收站");
assert.equal(dialog(), undefined);
assert.equal(rowAction("repo.uninstall"), undefined);
assert.equal(rowAction("repo.install").props.disabled, false, "卸载后 Install 立即恢复，无需手工刷新");
assert.ok(find(n => n.props.role === "status" && n.children.includes("repo.uninstallSuccess")));

// 记住选择；错误显示在弹窗/当前行，失败后可重试。
await click("repo.install");
assert.equal(radio("agents").props.checked, true, "后续安装记住最近位置");
chooseRoot("dsh"); failInstall = true;
const beforeFailedInstallList = countCalls("/repositories");
await clickModal("repo.install"); finishInstall(); await settle();
assert.ok(dialog(), "失败后弹窗保持打开");
assert.ok(modalNodes().some(n => n.props.role === "alert" && n.children.includes("下载超时，请重试")));
assert.ok(find(n => n.props.className === "dssm-repo-main").children.some(n => n.props?.role === "alert" && n.children.includes("下载超时，请重试")), "失败在当前行明确提示");
assert.equal(modalAction("repo.install").props.disabled, false, "失败后可以重试");
assert.equal(countCalls("/repositories"), beforeFailedInstallList);
assert.equal(installedCalls, 2, "失败的安装不报告安装完成");
failInstall = false; failInstalledRefresh = true;
await clickModal("repo.install"); finishInstall(); await settle();
assert.deepEqual(calls.filter(c => c.path === "/repositories/install").at(-1).body, { id: "one", path: "skills/pdf", root: "dsh" });
assert.equal(countCalls("/repositories"), beforeFailedInstallList + 1, "宿主刷新失败不能阻止仓库 reload");
assert.equal(rowAction("repo.uninstall").props.disabled, false);
assert.ok(find(n => n.props.role === "alert" && n.children.includes("本地列表刷新失败")));
assert.ok(find(n => n.props.className === "dssm-repo-main").children.some(n => n.props?.role === "status" && n.children.includes("repo.installSuccess")), "刷新错误不误报安装失败");
failInstalledRefresh = false;
await click("repo.uninstall");
assert.ok(!modalNodes().some(n => n.children.includes("repo.uninstallExternalWarning")), "DSH 卸载不误报共享目录影响");
failUninstall = true;
const beforeFailedUninstallList = countCalls("/repositories");
const beforeFailedUninstallCallback = installedCalls;
await clickModal("repo.confirmUninstall"); finishUninstall(); await settle();
assert.ok(modalNodes().some(n => n.props.role === "alert" && n.children.includes("回收站写入失败")));
assert.ok(find(n => n.props.className === "dssm-repo-main").children.some(n => n.props?.role === "alert" && n.children.includes("回收站写入失败")));
assert.equal(modalAction("repo.confirmUninstall").props.disabled, false);
assert.equal(rowAction("repo.uninstall").props.disabled, false);
assert.equal(countCalls("/repositories"), beforeFailedUninstallList);
assert.equal(installedCalls, beforeFailedUninstallCallback);
failUninstall = false; failInstalledRefresh = true;
await clickModal("repo.confirmUninstall"); finishUninstall(); await settle();
assert.equal(countCalls("/repositories"), beforeFailedUninstallList + 1, "宿主刷新失败也不能阻止卸载后 reload");
assert.equal(rowAction("repo.install").props.disabled, false);
assert.ok(find(n => n.props.className === "dssm-repo-main").children.some(n => n.props?.role === "status" && n.children.includes("repo.uninstallSuccess")));
failInstalledRefresh = false;

// 后端多返回的只读目录不能安装，也不能在刷新后变成可选项。
await click("repo.install");
assert.equal(radio("codex"), undefined, "刷新后 Codex 仍然不可见");
installRoots = configuredRoots.filter(root => root.key !== "agents").map(root => ({ ...root, available: root.key === "dsh" ? false : root.available }));
await click("repo.refresh");
assert.equal(radio("agents"), undefined, "reload 后消失的公共 Agent 不再可见");
assert.equal(radio("codex"), undefined, "消失的公共 Agent 不能改选 Codex");
assert.equal(destinationLabels().length, 1);
assert.equal(modalAction("repo.install").props.disabled, true, "剩余位置不可用时不能确认");
await clickModal("repo.cancel");
installRoots = structuredClone(configuredRoots); await click("repo.refresh");

// 已选公共 Agent 变为不可用时必须重置到 DSH，不能改选只读目录。
await click("repo.install"); chooseRoot("agents");
installRoots = configuredRoots.map(root => ({ ...root,
  available: root.key === "agents" ? false : root.key === "dsh" ? true : root.available,
  ...(root.key === "agents" ? { path: "/configured/rejected-agents/skills", error: { error: "Shared Agent root became unsafe" } } : {}),
}));
await click("repo.refresh");
assert.deepEqual(checkedRoots(), ["dsh"], "公共 Agent 不可用后重置到 DSH");
assert.equal(radio("agents").props.disabled, true);
assert.equal(radio("claude"), undefined);
const unavailableText = modalNodes().flatMap(n => n.children.filter(c => typeof c === "string"));
assert.ok(unavailableText.includes("Shared Agent root became unsafe"), "不可用原因写在下方");
assert.ok(pathLines().includes("/configured/rejected-agents/skills"), "不可用位置的路径写在下方");
locationSelect().props.onChange("agents"); render();
assert.deepEqual(checkedRoots(), ["dsh"], "合成事件不能重新选择变为不可用的位置");
await clickModal("repo.install");
assert.equal(calls.filter(c => c.path === "/repositories/install").at(-1).body.root, "dsh", "不提交已经不可用的公共 Agent");
finishInstall(); await settle();
await click("repo.uninstall");
assert.ok(!modalNodes().some(n => n.children.includes("repo.uninstallExternalWarning")), "回到 DSH 后不误报外部目录影响");
await clickModal("repo.confirmUninstall"); finishUninstall(); await settle();
installRoots = structuredClone(configuredRoots); await click("repo.refresh");

await click("repo.add");
find(n => n.props["aria-label"] === "repo.url").props.onChange({ target: { value: "a/b" } }); render();
await clickModal("repo.save");
assert.ok(calls.some(c => c.path.endsWith("/add") && c.body.url === "a/b"));
assert.ok(calls.some(c => c.path.endsWith("/refresh") && c.body.id === "two"));
Object.assign(repos[0].skills[0], { status: "update", tracked: true, updateAvailable: true, canRollback: true, canUninstall: true, installedRoot: "dsh" });
await click("repo.refresh");
assert.equal(rowAction("repo.uninstall").props.disabled, false, "有更新的已跟踪副本仍可卸载");
assert.ok(rowAction("repo.rollback"), "卸载按钮不替代 rollback");
await click("repo.review");
assert.ok(find(n => n.props.role === "alert" && n.children.includes("repo.modified")), "预览必须提示本地修改");
assert.ok(!calls.some(c => c.path.endsWith("/update")), "打开预览不执行更新");
await clickModal("repo.overwrite");
assert.deepEqual(calls.find(c => c.path.endsWith("/update")).body, { id: "one", path: "skills/pdf", root: "dsh", token: "checked", overwrite: true });
assert.ok(find(n => n.props.role === "status" && n.children.includes("repo.updateSuccess")), "更新后显示完成提示");
assert.equal(rowAction("repo.uninstall").props.disabled, false);
await click("repo.rollback");
assert.equal(calls.filter(c => c.path.endsWith("/preview")).at(-1).body.rollback, true);
await clickModal("repo.overwrite");
assert.ok(find(n => n.props.role === "status" && n.children.includes("repo.rollbackSuccess")), "恢复上一版保持可用");
Object.assign(repos[0].skills[0], { status: "conflict", updateAvailable: false });
await click("repo.refresh");
assert.equal(rowAction("repo.uninstall").props.disabled, false, "含本地修改的完整跟踪副本仍可卸载");
assert.ok(rowAction("repo.review"), "本地修改仍可预览更新");
await click("repo.uninstall");
assert.ok(modalNodes().some(n => n.children.includes("repo.uninstallHint")));
await clickModal("repo.cancel");
Object.assign(repos[0].skills[0], { status: "installed", canUninstall: false, installedRoot: null, canRollback: false });
await click("repo.refresh");
assert.equal(rowAction("repo.uninstall"), undefined, "缺失/不完整跟踪副本没有卸载操作");
assert.ok(rowAction("repo.installed").props.disabled);

// 从本地来源跳回仓库时，真实 hooks 同步来源、搜索及展开状态。
ui.focusSource({ id: "one" }, "docx"); render();
assert.equal(find(n => n.props.label === "repo.all").props.value, "one");
assert.equal(find(n => n.props["aria-label"] === "repo.search").props.value, "docx");
assert.equal(find(n => n.props.label === "repo.states").props.value, "");
assert.equal(all().filter(n => n.props.className === "dssm-repo-row").length, 1);
assert.ok(find(n => n.props.className === "dssm-name" && n.children.includes("docx")));
assert.equal(find(n => n.props["aria-expanded"] !== undefined).props["aria-expanded"], true);
ui.focusSource({ id: "one" }, "pdf"); render();

// 仓库提供的名称必须作为文本呈现，而不是 HTML。
Object.assign(repos[0].skills[0], { status: "available", name: '<img src=x onerror="alert(1)">', description: "PDF 文档", tracked: false });
await click("repo.refresh"); await click("repo.install");
assert.ok(modalNodes().some(n => n.props.className === "dssm-name" && n.children.includes(repos[0].skills[0].name)));
assert.ok(!all().some(n => n.type === "img" || n.props.dangerouslySetInnerHTML), "不使用危险 HTML 渲染仓库文本");
await clickModal("repo.cancel");

// 全新 mount：缺少目的地字段、空列表或全部不可用时不能确认安装。
for (const roots of [undefined, [], configuredRoots.map(root => ({ ...root, available: false, error: { error: "Root unavailable" } }))]) {
  installRoots = roots;
  values = []; cursor = 0; effects = []; dependencies = [];
  render(); effects.splice(0).forEach(f => f()); await settle();
  find(n => n.props["aria-expanded"] === false).props.onClick(); render();
  const beforeInstall = countCalls("/repositories/install");
  await click("repo.install");
  const allowed = (roots || []).filter(root => allowedDestinationKeys.includes(root.key));
  assert.equal(destinationLabels().length, allowed.length, "没有允许的后端位置时不制造默认目录，也不展示只读目录");
  assert.equal(modalAction("repo.install").props.disabled, true, "没有可用位置时确认按钮禁用");
  modalAction("repo.install").props.onClick(); await settle();
  assert.equal(countCalls("/repositories/install"), beforeInstall, "合成确认也不能提交不可用目的地");
  assert.ok(!modalNodes().some(n => n.type === "input" && n.props.type === "radio" && n.props.checked && !n.props.disabled));
  if (allowed.length) {
    assert.ok(allowed.every(root => radio(root.key).props.disabled));
    for (const root of allowed) radio(root.key).props.onChange();
    render();
    assert.equal(modalAction("repo.install").props.disabled, true, "合成选择不能绕过全部位置禁用");
  }
  assert.equal(radio("codex"), undefined);
  await clickModal("repo.cancel");
  assert.equal(countCalls("/repositories/install"), beforeInstall, "无可用目的地不发出写请求");
}
repos[0].error = { code: "error.repo.invalid", params: { path: "C:/bad" }, error: "EACCES: permission denied, open C:/bad" };
installRoots = structuredClone(configuredRoots);
await click("repo.refresh");
assert.ok(all().some(n => n.props.role === "alert" && n.children.includes("已翻译的仓库错误 · C:/bad")), "中文 invalid 诊断也必须走统一翻译并保留有用参数");
assert.equal(all().some(n => n.children.includes(repos[0].error.error)), false, "不能用英文系统原文覆盖中文翻译");
delete repos[0].error;
hostLocale = "en-GB";
repos[0].refreshedAt = "2026-09-12T13:04:05Z";
await click("repo.refresh"); await click("repo.manage");
assert.ok(modalNodes().some(n => n.children.includes("repo.updated · " + new Date(repos[0].refreshedAt).toLocaleString("en-GB"))), "仓库刷新日期使用有效宿主 en-GB，不被词典区域覆盖");
dialog().props.onClose(); render();

// 多副本同一技能：两个用户目标、两个项目和未登记项目分别有独立管理动作。
workspaceRows = [
  { name: "alpha", path: "D:/work/alpha", projectRoot: "D:/work/alpha", registeredPaths: ["D:/work/alpha/packages/web"], available: true, skillCount: 1 },
  { name: "beta", path: "D:/work/beta", projectRoot: "D:/work/beta", registeredPaths: ["D:/work/beta/sub"], available: true, skillCount: 1 },
];
const copy = (installedRoot, installedWorkspace) => ({ installedRoot, ...(installedWorkspace ? { installedWorkspace } : {}), tracked: true, status: "update", updateAvailable: true, canRollback: true, canUninstall: true });
Object.assign(repos[0].skills[0], { name: "pdf", status: "update", installedRoot: "dsh", tracked: true, canUninstall: true, installations: [copy("dsh"), copy("agents"), copy("dsh", "d:/WORK/alpha/"), copy("dsh", "D:/work/beta"), copy("dsh", "D:/gone")] });
await click("repo.refresh");
const copies = () => all().filter(n => n.props.className === "dssm-repo-copy");
assert.equal(copies().length, 5, "必须展示每个安装副本，不只取第一条");
const copyCss = all().filter(n => n.type === "style").map(n => n.children.join("")).join("");
assert.match(copyCss, /\.dssm-repo-copy\{[^}]*border:1px solid var\(--dsw-alias-border-l2/, "副本容器沿用宿主主题边框");
assert.match(copyCss, /\.dssm-repo-copy\{[^}]*background:var\(--dsw-alias-bg-layer-1/, "副本容器沿用宿主主题背景");
assert.match(copyCss, /\.dssm-repo-copy-actions\{[^}]*flex-wrap:wrap/, "独立按钮在窄容器可换行");
for (const node of copies().slice(0, 4)) {
  for (const action of ["repo.review", "repo.rollback", "repo.uninstall"]) assert.equal(nodes(node).find(n => isAction(n, action)).props.disabled, false, "每个目标都有独立按钮");
}
for (const action of ["repo.review", "repo.rollback", "repo.uninstall"]) {
  const orphanAction = nodes(copies()[4]).find(n => isAction(n, action));
  assert.equal(orphanAction.props.disabled, true, "没有登记路径的项目不能管理");
  const before = calls.length;
  orphanAction.props.onClick(); await settle();
  assert.equal(calls.length, before, "合成事件也不允许退回用户级管理");
}
assert.ok(nodes(copies()[4]).some(n => n.children.includes("repo.destinationUnavailable")), "无法管理的原因必须有双语提示");
const copyAction = (index, key) => nodes(copies()[index]).find(n => isAction(n, key));
const targets = [{ root: "dsh" }, { root: "agents" }, { workspace: "D:/work/alpha/packages/web" }, { workspace: "D:/work/beta/sub" }];
for (let index = 0; index < targets.length; index++) {
  await clickNode(copyAction(index, "repo.review"));
  assert.deepEqual(calls.filter(c => c.path === "/repositories/preview").at(-1).body, { id: "one", path: "skills/pdf", ...targets[index], rollback: false });
  await clickModal("repo.overwrite");
  assert.deepEqual(calls.filter(c => c.path === "/repositories/update").at(-1).body, { id: "one", path: "skills/pdf", ...targets[index], token: "checked", overwrite: true });
  await clickNode(copyAction(index, "repo.rollback"));
  assert.deepEqual(calls.filter(c => c.path === "/repositories/preview").at(-1).body, { id: "one", path: "skills/pdf", ...targets[index], rollback: true });
  await clickModal("repo.overwrite");
  assert.deepEqual(calls.filter(c => c.path === "/repositories/rollback").at(-1).body, { id: "one", path: "skills/pdf", ...targets[index], token: "checked", overwrite: true });
  await clickNode(copyAction(index, "repo.uninstall")); await clickModal("repo.confirmUninstall");
  assert.deepEqual(calls.filter(c => c.path === "/repositories/uninstall").at(-1).body, { id: "one", path: "skills/pdf", ...targets[index] });
  finishUninstall(); await settle();
}
await click("repo.installElsewhere");
const scopeSelect = modalNodes().find(n => n.props.label === "dest.scope");
scopeSelect.props.onChange("workspace"); render();
assert.equal(modalAction("repo.install").props.disabled, true, "另一位置安装仍不预选项目");
const workspaceSelect = modalNodes().find(n => n.props.label === "dest.workspace");
workspaceSelect.props.onChange("D:/work/beta/sub"); render();
await clickModal("repo.install");
assert.deepEqual(calls.filter(c => c.path === "/repositories/install").at(-1).body, { id: "one", path: "skills/pdf", workspace: "D:/work/beta/sub" }, "已安装技能还能指定另一项目，冲突由服务端处理");
finishInstall(); await settle();
console.log("仓库界面折叠、搜索、DSH/公共 Agent 安装位置、回收站卸载、错误重试、更新与恢复测试通过");
