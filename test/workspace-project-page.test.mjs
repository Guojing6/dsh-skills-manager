// 项目页按已登记工作区折叠展示：不依赖当前会话，展开才取技能，操作带上所选工作区。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let definition, component, cursor = 0, state = [];
const effects = [], outerState = [];
let innerState = [], mountedKey;
const react = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter((child) => child != null && typeof child !== "boolean") }),
  useState(initial) { const index = cursor++, store = state; if (!(index in store)) store[index] = initial; return [store[index], (next) => { store[index] = typeof next === "function" ? next(store[index]) : next; }]; },
  useRef(value) { const index = cursor++; return state[index] || (state[index] = { current: value }); },
  useEffect(effect) { const index = cursor++; if (!(index in state)) { state[index] = true; effects.push(effect); } },
  useLayoutEffect() { cursor++; },
  forwardRef(render) { return render; },
  createContext() { return { Provider() {}, Consumer() {} }; },
  useMemo(fn) { return fn(); }, useCallback(fn) { return fn; }, useContext() { return {}; }, useId() { return "id"; }, memo(c) { return c; },
  Fragment: Symbol.for("react.fragment"), version: "18.3.1",
  Children: { map(children, fn) { return [].concat(children ?? []).filter((c) => c != null).map(fn); }, forEach() {}, count: () => 0, toArray: (c) => [].concat(c ?? []), only: (c) => c },
  isValidElement: (v) => !!v && typeof v === "object", cloneElement: (e) => e, createRef: () => ({ current: null }),
  Component: class { constructor(props) { this.props = props; } }, PureComponent: class { constructor(props) { this.props = props; } },
};

const skill = (name) => ({ name, description: "DESC_" + name, enabled: true, loadable: true });
const globalData = { projects: [], trash: [], roots: [{ key: "dsh", mutable: true, path: "C:/u/.dsh/skills", skills: [skill("global-one")] }] };
const workspaces = [
  { name: "alpha", path: "D:/work/alpha", projectRoot: "D:/work/alpha", registeredPaths: ["D:/work/alpha/packages/web", "D:/work/alpha"], available: true, skillCount: 2 },
  { name: "beta", path: "D:/work/beta", projectRoot: "D:/work/beta", registeredPaths: ["D:/work/beta"], available: true, skillCount: 0 },
  { name: "ghost", path: "D:/work/ghost", registeredPaths: ["D:/work/ghost"], available: false, skillCount: 0 },
];
const details = {
  "D:/work/alpha": { project: { root: "D:/work/alpha", name: "alpha" }, warnings: [], roots: [
    { key: "project-dsh:a", scope: "project", kind: "project-dsh", localeKey: "projectDsh", label: "Project DSH", mutable: true, path: "D:/work/alpha/.dsh/skills", projectRoot: "D:/work/alpha", skills: [skill("alpha-one")] },
    { key: "project-claude:a", scope: "project", kind: "project-claude", localeKey: "claude", label: "Claude", exists: true, toggleable: true, enabled: true, path: "D:/work/alpha/.claude/skills", projectRoot: "D:/work/alpha", skills: [skill("alpha-two")] },
  ] },
  "D:/work/beta": { project: { root: "D:/work/beta", name: "beta" }, warnings: [], roots: [
    { key: "project-dsh:b", scope: "project", kind: "project-dsh", localeKey: "projectDsh", label: "Project DSH", mutable: true, path: "D:/work/beta/.dsh/skills", projectRoot: "D:/work/beta", skills: [] },
  ] },
};
const calls = [];
let holdDetails = false;
const detailResponses = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : undefined;
  calls.push({ url: String(url), method: options.method || "GET", body, headers: options.headers });
  const path = String(url).replace("/api/dsh-skills-manager", "");
  let data;
  if (path === "/state") data = globalData;
  else if (path === "/workspaces") data = { items: workspaces };
  else if (path === "/workspace-skills") {
    if (holdDetails) return new Promise(resolve => detailResponses.push({ workspace: body.workspace, resolve }));
    if (body.workspace === "D:/work/ghost") return { ok: false, status: 400, json: async () => ({ ok: false, code: "error.workspace.unavailable", error: "工作区目录不可用", params: { path: body.workspace } }) };
    if (!["D:/work/alpha/packages/web", "D:/work/alpha", "D:/work/beta"].includes(body.workspace)) return { ok: false, status: 400, json: async () => ({ ok: false, code: "error.workspace.unregistered", error: "请选择已登记的工作区" }) };
    data = details[body.workspace === "D:/work/alpha/packages/web" ? "D:/work/alpha" : body.workspace];
  } else data = { name: "ok" };
  return { ok: true, json: async () => ({ ok: true, data }) };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

try {
  new Function("window", await readFile(process.env.DSH_CLIENT_TEST_BUNDLE || new URL("../lib/client.js", import.meta.url), "utf8"))({ __ModuleLoader__: { load(value) { definition = value; } } });
  const client = definition.factory((id) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx: react.createElement, jsxs: react.createElement, Fragment: react.Fragment };
    if (id.startsWith("react-dom")) return { createPortal: (node) => node };
    throw new Error("unexpected require: " + id);
  });
  client.apply({ effect() {}, slots: { inject(name, fn) { fn(); }, register(options, fn) { component = fn; } } });
  const t = (key, params = {}) => (client.DICT.zh[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? "{" + name + "}"));
  let tree, currentSession = undefined;
  function render() {
    state = outerState; cursor = 0;
    const view = component({ t, useSessions: (selector) => selector({ current: currentSession }) });
    if (mountedKey !== view.props.key) { mountedKey = view.props.key; innerState = []; }
    state = innerState; cursor = 0; tree = view.type(view.props);
  }
  function linkedNodes(value, out = []) {
    if (value == null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") return out;
    if (Array.isArray(value)) { value.forEach((item) => linkedNodes(item, out)); return out; }
    out.push(value); return out;
  }
  function nodes(node = tree) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return [];
    if (typeof node.type === "function" && Array.isArray(node.props?.options) && node.props.label && node.props.onChange) return [{ type: "select-fixture", props: { "aria-label": node.props.label, options: node.props.options, onChange: (event) => node.props.onChange(event.target.value) }, children: [] }];
    if (node.type?.name === "SkillSwitch" || node.props?.closeLabel || (typeof node.type === "function" && node.props && "on" in node.props && typeof node.props.label === "string")) return nodes(node.type({ ...node.props, children: node.children }));
    // 目标选择器是普通函数组件：渲染出它的子树，才能断言其中的控件。
    if (typeof node.type === "function" && node.props && "userDestinations" in node.props) return nodes(node.type(node.props));
    const nested = linkedNodes(node.children);
    if (typeof node.type === "function") {
      for (const key of ["header", "extra", "actions", "title", "description"]) linkedNodes(node.props?.[key], nested);
      if (Array.isArray(node.props?.items)) node.props.items.forEach((item) => { linkedNodes(item?.label, nested); linkedNodes(item?.extra, nested); linkedNodes(item?.children, nested); });
    }
    return [node, ...nested.flatMap((child) => nodes(child))];
  }
  const find = (predicate) => nodes().find(predicate);
  const rows = () => nodes().filter((node) => node.props.className === "dssm-name").map((node) => node.children[0]);
  const settle = async () => { render(); effects.splice(0).forEach((effect) => effect()); await tick(); await tick(); render(); };
  const tab = async (name) => {
    const tabs = find((node) => node.props?.block === true && Array.isArray(node.props.options));
    const option = tabs.props.options.find((item) => item.label === name || (Array.isArray(item.label) && item.label.includes(name)));
    tabs.props.onChange(option.value); await settle();
  };
  const workspaceGroups = () => nodes().filter((node) => node.props.className === "dssm-workspace" && Array.isArray(node.props.items));
  const open = async (group) => { group.props.onChange([group.props.items[0].key]); await settle(); };
  const textOf = (node) => JSON.stringify(nodes(node).flatMap((n) => n.children.filter((c) => typeof c === "string")));

  await settle();
  await tab("项目技能");

  // 1. 不管当前会话有没有，都列出全部登记工作区；默认折叠，只有名称、路径、数量。
  assert.equal(currentSession, undefined);
  let groups = workspaceGroups();
  assert.equal(groups.length, 3, "按登记列表逐个工作区一行，没有当前会话也一样");
  assert.deepEqual(rows(), [], "折叠时不平铺技能");
  assert.ok(textOf(groups[0]).includes("alpha") && textOf(groups[0]).includes("D:/work/alpha"), "折叠行显示名称与路径");
  assert.ok(textOf(groups[0]).includes("2 个技能"), "折叠行显示数量");
  assert.equal(calls.some((c) => c.url.endsWith("/workspace-skills")), false, "折叠时不扫描项目");
  assert.equal(find((node) => node.children.includes(t("project.empty"))), undefined, "不再有「当前会话没有工作区」空状态");

  // 2. 失效路径标出来，且不可展开取数。
  assert.ok(textOf(groups[2]).includes(t("workspace.unavailable")), "不可用路径带标记");

  // 3. 展开：只请求这个工作区，带登记路径；返回的来源与技能显示出来。
  await open(groups[0]);
  const scans = calls.filter((c) => c.url.endsWith("/workspace-skills"));
  assert.equal(scans.length, 1);
  assert.deepEqual(scans[0].body, { workspace: "D:/work/alpha/packages/web" }, "请求带的是第一个登记路径，不是推导出来的项目根");
  assert.deepEqual(rows(), ["alpha-one", "alpha-two"], "展开后显示该项目的全部来源技能");
  assert.equal(rows().includes("beta-one"), false);
  assert.equal(calls.filter((c) => c.url.endsWith("/workspace-skills")).length, 1, "只扫描展开的那一个");

  // 4. 重新收起再展开不重复请求（已有缓存），刷新才重新取。
  groups = workspaceGroups(); groups[0].props.onChange([]); await settle();
  assert.deepEqual(rows(), []);
  await open(workspaceGroups()[0]);
  assert.equal(calls.filter((c) => c.url.endsWith("/workspace-skills")).length, 1, "展开缓存不重复扫描");

  // 刷新已展开的项目：重新取详情，不清缓存后永远停在 loading。
  const beforeRefresh = calls.filter(c => c.url.endsWith("/workspace-skills")).length;
  details["D:/work/alpha"].roots[0].skills.push(skill("alpha-new"));
  find(node => node.children.includes(t("btn.refresh")) && node.props.onClick).props.onClick();
  await settle();
  assert.equal(calls.filter(c => c.url.endsWith("/workspace-skills")).length, beforeRefresh + 1, "刷新重新读取已展开的工作区");
  assert.ok(rows().includes("alpha-new"), "刷新后展开行显示新详情");
  assert.ok(workspaceGroups()[0].props.activeKey.length, "保持展开状态");
  details["D:/work/alpha"].roots[0].skills.pop();

  // 5. 空项目展开显示空提示，不报错。
  await open(workspaceGroups()[1]);
  assert.ok(find((node) => node.props.className === "dssm-empty" && node.children.includes(t("workspace.noSkills"))), "没有技能时给出空提示");

  // 连续刷新：最新响应获胜；旧失败不能覆盖新成功，展开保持 loading/error 可见。
  holdDetails = true;
  const refreshProjects = async () => { find(node => node.children.includes(t("btn.refresh")) && node.props.onClick).props.onClick(); await settle(); };
  await refreshProjects();
  assert.ok(find(node => node.children.includes(t("workspace.loading"))), "刷新时展开项目有 loading 提示");
  assert.equal(detailResponses.length, 2, "两个已展开项目都重读");
  await refreshProjects();
  assert.equal(detailResponses.length, 4, "再次刷新为两个项目发起新请求");
  const response = (roots) => ({ ok: true, json: async () => ({ ok: true, data: { roots } }) });
  detailResponses[2].resolve(response(details["D:/work/alpha"].roots));
  detailResponses[3].resolve(response(details["D:/work/beta"].roots));
  await settle();
  assert.ok(rows().includes("alpha-one"), "最新详情返回后正常显示");
  for (const stale of detailResponses.slice(0, 2)) stale.resolve({ ok: false, status: 400, json: async () => ({ ok: false, error: "stale failure" }) });
  await settle();
  assert.equal(find(node => JSON.stringify(node.children).includes("stale failure")), undefined, "过期错误不能覆盖最新成功");
  await refreshProjects();
  detailResponses[4].resolve({ ok: false, status: 400, json: async () => ({ ok: false, error: "fresh failure" }) });
  detailResponses[5].resolve(response(details["D:/work/beta"].roots));
  await settle();
  assert.ok(find(node => node.props.role === "alert" && JSON.stringify(node.children).includes("fresh failure")), "最新错误可见且不永远 loading");
  holdDetails = false;
  await refreshProjects();
  assert.ok(rows().includes("alpha-one"), "错误后刷新可恢复");

  // 6. 启停带 workspace，只改所选工作区的副本；完成后只刷新这个工作区。
  const sw = find((node) => node.props["aria-label"] === t("skill.toggle") + " alpha-one");
  sw.props.onChange(); await tick(); await tick(); render();
  const toggle = calls.filter((c) => c.method === "POST" && c.url.endsWith("/disable")).at(-1);
  assert.deepEqual(toggle.body, { root: "project-dsh:a", name: "alpha-one", workspace: "D:/work/alpha/packages/web" }, "启停请求带所选工作区的登记路径");
  assert.ok(calls.filter((c) => c.url.endsWith("/workspace-skills")).length >= 2, "操作后重新读取该工作区");

  // 7. 来源总开关同样带 workspace。
  const sourceSwitch = find((node) => String(node.props["aria-label"] || "").includes(t("source.toggle")));
  sourceSwitch.props.onChange(); await tick(); await tick(); render();
  const sourceCall = calls.filter((c) => c.method === "POST" && /\/source-(en|dis)able$/.test(c.url)).at(-1);
  assert.equal(sourceCall.body.workspace, "D:/work/alpha/packages/web");
  assert.equal(sourceCall.body.root, "project-claude:a");

  // 被覆盖副本仍可独立启停；项目停用后显示由谁接管；提示只在发起操作的页签出现。
  const alphaClaude = details["D:/work/alpha"].roots.find((r) => r.kind === "project-claude").skills[0];
  alphaClaude.shadowedBy = { root: "project-dsh:a", name: "alpha-two" };
  await settle();
  const shadowedSwitch = find((node) => node.props["aria-label"] === t("skill.toggle") + " alpha-two");
  assert.equal(shadowedSwitch.props.disabled, false, "被覆盖副本仍允许独立设置启停");
  delete alphaClaude.shadowedBy;
  alphaClaude.enabled = false;
  alphaClaude.fallbackTo = { root: "dsh", name: "alpha-two", scope: "user" };
  await settle();
  details["D:/work/alpha"].roots.find((r) => r.kind === "project-claude").skills[0] = alphaClaude;
  workspaceGroups()[0].props.onChange([]); await settle();
  // 重新读取以拿到被修改后的详情
  await tab("全局技能"); await tab("项目技能");
  await open(workspaceGroups()[0]);
  const fallbackNote = find((node) => node.props.className === "dssm-note dssm-fallback");
  assert.ok(fallbackNote, "项目停用行显示接管来源");
  assert.ok(String(fallbackNote.children[0]).startsWith("当前使用全局 ") && String(fallbackNote.children[0]).endsWith(" 副本。"), "文案来自翻译，指向用户级来源");
  assert.equal(find((node) => node.props["aria-label"] === t("skill.toggle") + " alpha-two").props.checked, false, "提示不改变副本的停用状态");

  const feedback = () => find((node) => node.props.className === "dssm-feedback" && node.children.includes(t("result.updated")));
  find((node) => node.props["aria-label"] === t("skill.toggle") + " alpha-one").props.onChange(); await tick(); await tick(); render();
  assert.ok(feedback(), "操作结果显示在发起操作的页面");
  await tab("技能仓库");
  assert.equal(feedback(), undefined, "仓库页不显示项目页的操作结果");
  await tab("回收站");
  assert.equal(feedback(), undefined, "回收站不显示项目页的操作结果");
  await tab("项目技能");

  // 8. 搜索：命中技能的工作区自动展开，其余只剩名称匹配的。
  const search = find((node) => node.props["aria-label"] === t("search"));
  search.props.onChange({ target: { value: "alpha-two" } }); await settle();
  assert.deepEqual(rows(), ["alpha-two"], "搜索只留命中的技能");
  search.props.onChange({ target: { value: "" } }); await settle();

  // 8b. 回收站里的项目条目：恢复请求带上该项目的登记路径，不依赖当前会话。
  globalData.trash = [
    { id: "trash-proj", name: "removed-proj", deletedAt: "2026-09-12T00:00:00Z", root: { scope: "project", projectName: "alpha", projectRoot: "D:/work/alpha" } },
    { id: "trash-orphan", name: "removed-orphan", deletedAt: "2026-09-12T00:00:00Z", root: { scope: "project", projectName: "gone", projectRoot: "D:/work/gone" } },
    { id: "trash-user", name: "removed-user", deletedAt: "2026-09-12T00:00:00Z", root: { scope: "user" } },
  ];
  await tab("项目技能"); await tab("回收站");
  // 回收站条目有独立容器与信息层级，操作区成组，不改变恢复请求的授权范围。
  const trashCards = nodes().filter((node) => node.props.className === "dssm-trash-item");
  assert.equal(trashCards.length, 3);
  assert.equal(trashCards[0].props.role, "group", "每个回收站条目独立成组");
  assert.equal(trashCards[0].props["aria-label"], "removed-proj");
  const trashMeta = nodes(trashCards[0]).find((node) => node.props.className === "dssm-trash-meta");
  assert.ok(trashMeta, "名称与次级信息分层");
  const trashTime = nodes(trashMeta).find((node) => node.type === "time");
  assert.equal(trashTime?.props.dateTime, globalData.trash[0].deletedAt, "删除时间保留机器可读值");
  assert.ok(nodes(trashMeta).some((node) => node.props.className === "dssm-trash-source"), "来源单独显示为次级标签");
  const trashActions = nodes(trashCards[0]).find((node) => node.props.className === "dssm-trash-actions");
  assert.ok(trashActions, "恢复与删除集中在独立操作区");
  assert.equal(nodes(trashActions).filter((node) => node.children.includes(t("btn.restore"))).length, 1);
  assert.equal(nodes(trashActions).filter((node) => node.props.danger === true).length, 1, "永久删除保持危险操作样式");
  const css = nodes().filter((node) => node.type === "style").map((node) => node.children.join("")).join("");
  assert.match(css, /\.dssm-trash-item\{[^}]*border:1px solid var\(--dsw-alias-border-l2/, "回收站条目有宿主主题细边框");
  assert.match(css, /\.dssm-trash-item\{[^}]*background:var\(--dsw-alias-bg-layer-1/, "回收站条目有主题背景层次，不硬编码白色");
  assert.match(css, /\.dssm-trash-meta\{[^}]*color:var\(--dsw-alias-label-tertiary/, "时间等次级信息降低亮度");
  assert.match(css, /@container\(max-width:520px\)\{\.dssm-trash-item\{grid-template-columns:minmax\(0,1fr\)\}/, "窄面板操作区换行");
  const restoreButtons = () => nodes().filter((node) => node.children.includes(t("btn.restore")));
  assert.equal(restoreButtons().length, 3);
  const callsBefore = calls.length;
  restoreButtons()[0].props.onClick(); await tick(); await tick(); render();
  const restoreProj = calls.slice(callsBefore).find((c) => c.url.endsWith("/trash-restore"));
  assert.deepEqual(restoreProj.body, { id: "trash-proj", workspace: "D:/work/alpha/packages/web" }, "项目条目带原项目的登记路径");
  const afterFirst = calls.length;
  nodes().filter((node) => node.children.includes(t("btn.restore")))[1].props.onClick(); await tick(); await tick(); render();
  const restoreOrphan = calls.slice(afterFirst).find((c) => c.url.endsWith("/trash-restore"));
  assert.deepEqual(restoreOrphan.body, { id: "trash-orphan" }, "找不到登记路径时不编造 workspace，交给服务端按当前会话判断并报错");
  const afterSecond = calls.length;
  nodes().filter((node) => node.children.includes(t("btn.restore")))[2].props.onClick(); await tick(); await tick(); render();
  const restoreUser = calls.slice(afterSecond).find((c) => c.url.endsWith("/trash-restore"));
  assert.deepEqual(restoreUser.body, { id: "trash-user" }, "用户级条目不带 workspace");

  // 9. 全局页不受影响，仍是用户级来源。
  await tab("全局技能");
  assert.equal(workspaceGroups().length, 0);
  assert.equal(find((node) => node.props.className === "dssm-source" && Array.isArray(node.props.items)) !== undefined, true);

  // 10. 登记列表读取失败：项目页提示，不抛错、不回退到当前会话。
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, options) => String(url).endsWith("/workspaces") ? { ok: false, status: 500, json: async () => ({ ok: false, error: "boom" }) } : previous(url, options);
  outerState.length = 0; innerState = []; mountedKey = undefined;
  await settle(); await tab("项目技能");
  assert.equal(workspaceGroups().length, 0);
  assert.ok(find((node) => node.props.className === "dssm-empty" || String(node.props.className || "").includes("dssm-error")), "失败时有明确提示");
  globalThis.fetch = previous;

  console.log("项目页：按登记工作区折叠、展开才取数、带工作区操作、搜索与失败处理均通过");
} finally { globalThis.fetch = originalFetch; }
