// 分类只记在管理器状态里，按来源分开，不移动技能文件。
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const temporary = await mkdtemp(join(tmpdir(), "dssm-cat-"));
process.env.DSH_HOME = join(temporary, "dsh");
process.env.DSH_AGENTS_HOME = join(temporary, "agents");
process.env.DSH_CODEX_HOME = join(temporary, "codex");
process.env.HOME = process.env.USERPROFILE = join(temporary, "user");
const { createCategory, renameCategory, deleteCategory, assignSkillCategory, setCategoryEnabled, readManagerState, state } = await import("../lib/core.js");

const skillText = (name) => `---\nname: ${name}\ndescription: 测试技能\n---\n正文\n`;
const writeSkill = async (root, name, text = skillText(name)) => {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), text);
  return join(dir, "SKILL.md");
};

const dsh = join(process.env.DSH_HOME, "skills");
const codex = join(process.env.DSH_CODEX_HOME, "skills");
const kept = await writeSkill(dsh, "kept-skill");
await writeSkill(dsh, "broken-skill", "没有 frontmatter\n");
await writeSkill(codex, "codex-skill");
const before = await readFile(kept, "utf8");

const created = await createCategory("dsh", "工作");
assert.equal(created.ok, undefined);
assert.equal(created.root, "dsh");
assert.equal(created.category.name, "工作");
const assigned = await assignSkillCategory("dsh", "kept-skill", created.category.id);
assert.equal(assigned.ok, undefined);
assert.equal(await readFile(kept, "utf8"), before, "归类不改技能文件");

const view = await state();
const dshRoot = view.roots.find((root) => root.key === "dsh");
const codexRoot = view.roots.find((root) => root.key === "codex");
assert.deepEqual(dshRoot.categories.map((item) => item.name), ["工作"]);
assert.equal(dshRoot.skills.find((item) => item.name === "kept-skill").categoryId, created.category.id);
assert.equal(codexRoot.categories.length, 0, "分类不跨来源");
assert.equal(codexRoot.skills.find((item) => item.name === "codex-skill").categoryId, null);

const duplicate = await createCategory("dsh", "工作");
assert.equal(duplicate.ok, false);
assert.equal(duplicate.code, "error.category.duplicate");

const toggled = await setCategoryEnabled("dsh", created.category.id, false);
assert.equal(toggled.changed, 1);
assert.deepEqual(toggled.skipped, []);
assert.equal(await readFile(kept, "utf8"), before, "整组启停不改技能文件");
const disabled = (await state()).roots.find((root) => root.key === "dsh").skills.find((item) => item.name === "kept-skill");
assert.equal(disabled.enabled, false);

const broken = await assignSkillCategory("dsh", "broken-skill", created.category.id);
assert.equal(broken.ok, undefined);
const skipped = await setCategoryEnabled("dsh", created.category.id, true);
assert.equal(skipped.skipped.includes("broken-skill"), true, "结构不完整的技能被跳过");
assert.equal((await state()).roots.find((root) => root.key === "dsh").skills.find((item) => item.name === "kept-skill").enabled, true);

await writeSkill(dsh, "loose-skill");
const looseOff = await setCategoryEnabled("dsh", "", false);
assert.equal(looseOff.changed, 1, "未分类开关只动未归类技能");
const afterLoose = (await state()).roots.find((root) => root.key === "dsh");
assert.equal(afterLoose.skills.find((item) => item.name === "loose-skill").enabled, false);
assert.equal(afterLoose.skills.find((item) => item.name === "kept-skill").enabled, true, "未分类开关不动已归类技能");
const allOff = await setCategoryEnabled("dsh", "*", false);
assert.equal(allOff.changed >= 1, true, "全部关闭才动这个来源里的可调用技能");
assert.equal((await state()).roots.find((root) => root.key === "dsh").skills.find((item) => item.name === "kept-skill").enabled, false);

const renamed = await renameCategory("dsh", created.category.id, "科研");
assert.equal(renamed.category.name, "科研");
const removed = await deleteCategory("dsh", created.category.id);
assert.equal(removed.ok, undefined);
const afterDelete = (await state()).roots.find((root) => root.key === "dsh");
assert.equal(afterDelete.categories.length, 0);
assert.equal(afterDelete.skills.find((item) => item.name === "kept-skill").categoryId, null);
assert.equal(await readFile(kept, "utf8"), before, "删除分类不搬文件");

const stored = await readManagerState();
assert.equal(stored.writable, true, "旧状态形状之外的分类字段不能把状态判坏");

await rm(temporary, { recursive: true, force: true });
console.log("categories ok");
