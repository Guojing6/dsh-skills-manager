// 用真实 DSH scope 合并与 skill.execute 回归；仅使用临时用户目录。
// DSH_RUNTIME_DIR 指向含原生 @deepseek-ai/* 依赖的 dsh 包目录。
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const req = createRequire(join(resolve(process.env.DSH_RUNTIME_DIR || "."), "package.json"));
const load = (name) => import(pathToFileURL(req.resolve(name)).href);
const qa = await mkdtemp(join(tmpdir(), "dssm-disabled-external-"));
process.env.USERPROFILE = process.env.HOME = join(qa, "user");
process.env.DSH_HOME = join(qa, "home");
process.env.DSH_AGENTS_HOME = join(qa, "user", ".agents");
const skill = "bundled-regression";
const bundled = join(qa, "bundled");
const core = await import("../lib/core.js");
async function fixture(root, body) {
  const dir = join(root, skill);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), `---\nname: ${skill}\ndescription: fixture\n---\n${body}`);
  return dir;
}
const roots = core.userRoots();
const cc = roots.find((r) => r.key === "ccswitch");
const wb = roots.find((r) => r.key === "workbuddy");
await fixture(bundled, "plugin fixture");
const ccDir = await fixture(cc.path, "ccswitch fixture");
await fixture(wb.path, "workbuddy fixture");
await core.setSourceEnabled("ccswitch", false);
await core.setSourceEnabled("workbuddy", false);
const { Context } = await load("@deepseek-ai/cordis");
const { SkillRegistry, isUserInvocable } = await load("@deepseek-ai/dsh-skill");
const { createScope } = await load("@deepseek-ai/dsh-scope");
const { FileSystemSkillProvider } = await load("@deepseek-ai/dsh-skill-filesystem");
const toolmod = await load("@deepseek-ai/dsh-tool-skill");
const ctx = new Context();
const registry = ctx.plugin(SkillRegistry);
await registry.await();
let scope;
let runRegression;
const harness = ctx.plugin({ name: "regression-harness", inject: ["skills"], apply(host) {
  host.skills.registerProvider((control) => new FileSystemSkillProvider(host, control, {
    providerName: "bundled-plugin", includeDefaultRoots: true, bundledSkillDir: bundled, watch: false,
  }));
  const agent = { session: { header: { cwd: qa } } };
  scope = createScope(host, agent);
  let invalidate;
  scope.ctx.skills.registerProvider((control) => {
    invalidate = control.invalidate;
    return { name: "dsh-skills-manager-external", list: core.listProviderCandidates, get: core.getProviderSkill };
  });
  let tool;
  toolmod.apply({ skills: host.skills, tools: { register(t) { tool = t; } }, on() {} });
  runRegression = async () => {
    const selected = async () => {
      invalidate();
      return (await host.skills.list({ cwd: qa, scope: agent })).find((s) => s.name === skill);
    };
    const execute = () => tool.execute({ name: skill }, { agent, signal: new AbortController().signal });
    const chosen = await selected();
    assert.equal(chosen.provider, "bundled-plugin", "关闭的外部来源不遮蔽全局插件");
    assert.ok(isUserInvocable(chosen), "斜杠入口可用");
    await execute();
    console.log("PASS disabled external sources: bundled catalog and skill.execute");
    await core.setSourceEnabled("ccswitch", true);
    assert.equal((await selected()).source, "agent-ccswitch");
    await execute();
    assert.equal((await core.readManagerState()).state.sources.workbuddy, false);
    console.log("PASS re-enable CC Switch; WorkBuddy remains disabled");
    await core.setSourceEnabled("ccswitch", false);
    const agentsRoot = join(process.env.DSH_AGENTS_HOME, "skills");
    await fixture(agentsRoot, "native fixture");
    await core.setSourceEnabled("agents", false);
    assert.equal(isUserInvocable(await selected()), false);
    await assert.rejects(execute, /not available for model invocation/);
    console.log("PASS native disabled policy still blocks invocation");
    const projectSkills = join(qa, ".codex", "skills");
    await fixture(projectSkills, "project external fixture");
    const projectCodex = (await core.projectRoots([qa])).find((r) => r.kind === "project-codex");
    await core.setSourceEnabled(projectCodex.key, false, undefined, { projectCwds: [qa] });
    assert.equal(isUserInvocable(await selected()), false);
    await assert.rejects(execute, /not available for model invocation/);
    console.log("PASS disabled project external source preserves native user blocking");
    await core.setSourceEnabled("agents", true);
    assert.equal((await selected()).source, "agent-agents");
    await execute();
    await core.setSourceEnabled("agents", false);
    console.log("PASS native user source re-enables with project external source disabled");
    await rm(join(agentsRoot, skill), { recursive: true });
    await symlink(ccDir, join(agentsRoot, skill), process.platform === "win32" ? "junction" : "dir");
    assert.equal(isUserInvocable(await selected()), false);
    await assert.rejects(execute, /not available for model invocation/);
    console.log("PASS disabled project external source preserves native link blocking");
    await rm(join(projectSkills, skill), { recursive: true });
    assert.equal(isUserInvocable(await selected()), false);
    await assert.rejects(execute, /not available for model invocation/);
    console.log("PASS external copy linked into native root stays disabled");
  };
} });
await harness.await();
try {
  await runRegression();
} finally {
  await scope?.dispose();
  await harness.dispose();
  await registry.dispose();
  await rm(qa, { recursive: true, force: true });
}
