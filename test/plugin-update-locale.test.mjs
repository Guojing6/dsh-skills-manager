// 语言只跟 html lang 走。更新进行中切换语言要改文案，不能再发一次更新请求。
import assert from "node:assert/strict";
import { createUpdateFlow, describePluginUpdate, pluginUpdateCopy } from "../src/plugin-update-model.ts";

const payload = { packageName: "test-plugin", currentVersion: "1.0.0", latestVersion: "1.0.1", updateAvailable: true, profileName: "web", canAutoUpdate: true, latestCheckFailed: false };
let resolveUpdate;
let posts = 0;
const flow = createUpdateFlow(async (method) => {
  if (method === "POST") {
    posts += 1;
    await new Promise((resolve) => { resolveUpdate = resolve; });
  }
  return payload;
});

assert.equal(pluginUpdateCopy("zh-CN").check, "检查更新", "页面里的 Settings 字样不能覆盖宿主明确选择的中文");
assert.equal(pluginUpdateCopy("en-US").check, "Check for updates");

await flow.check();
assert.match(flow.view("zh-CN").message, /发现新版本/);
assert.match(flow.view("en-US").message, /New version available/);
assert.equal(flow.view("zh-CN").disabled, false);

const pending = flow.update();
assert.equal(flow.view("zh-CN").updateLabel, "正在更新…");
assert.equal(flow.view("zh-CN").message, "正在更新…");
assert.equal(flow.view("zh-CN").loading, true);
assert.equal(flow.view("en-US").updateLabel, "Updating…");
assert.equal(flow.view("en-US").message, "Updating…");
assert.equal(flow.posts, 1, "语言切换不会重新提交更新");
assert.equal(posts, 1);
void flow.update();
assert.equal(flow.posts, 1);
assert.equal(posts, 1);
resolveUpdate();
await pending;
assert.equal(flow.view("zh-CN").message, "更新完成，请重启 DSH Web。");
assert.equal(flow.view("en").message, "Update complete. Restart DSH Web.");
assert.equal(flow.view("en").updateLabel, "Update automatically");
assert.equal(flow.view("zh-CN").loading, false);

const linkPayload = { ...payload, installKind: "link", canAutoUpdate: false, repository: "https://github.com/Guojing6/dsh-skills-manager.git", releaseUrl: "https://github.com/Guojing6/dsh-skills-manager/releases/tag/v1.0.1" };
const link = describePluginUpdate("zh-CN", linkPayload, "idle", { type: "status" });
assert.match(link.message, /不支持自动更新/, "链接安装明确说明不能自动更新");
assert.equal(link.manualCommand, "git pull", "链接安装给的是 git pull");
assert.match(link.manualHint, /Git 目录安装/);
assert.match(link.manualHint.replace(/\n/g, ""), /进入插件目录/);
assert.equal(link.releaseUrl, linkPayload.releaseUrl);
assert.equal(link.disabled, true, "不能自动更新时更新按钮禁用");
assert.match(describePluginUpdate("en", linkPayload, "idle", { type: "status" }).message, /cannot update itself/);

const packagePayload = { ...payload, canAutoUpdate: true, repository: "https://github.com/Guojing6/dsh-skills-manager.git" };
const packaged = describePluginUpdate("en", packagePayload, "idle", { type: "status" });
assert.equal(packaged.manualCommand, "dsh plugin --profile web add https://github.com/Guojing6/dsh-skills-manager.git#v1.0.1", "包安装给出 Release tag 安装命令");
assert.equal(packaged.disabled, false);
console.log("plugin update locale regression passed");
