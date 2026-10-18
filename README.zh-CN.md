# DSH Skills Manager

DSH Skills Manager 把本机上散落在各个 Agent 目录里的技能收进 DeepSeek Harness 的一个面板：已经装在 Codex、Claude Code、Copilot 等十多个目录里的技能、DSH 自己管理的技能，以及从公开 GitHub 仓库安装的技能。搜索、查看、启停、导入、安装、更新、回退都在 DSH 里完成，不用离开界面，也不用去改其他 Agent 的目录。

这是社区维护的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，并非 DeepSeek AI 官方产品。

- 版本：`1.2.2`
- 仓库：<https://github.com/Guojing6/dsh-skills-manager>
- 问题反馈：<https://github.com/Guojing6/dsh-skills-manager/issues>
- 更新日志：[中文](CHANGELOG.zh-CN.md) · [English](CHANGELOG.md)
- 许可证：[MIT](LICENSE)

## 它能做什么

- **所有来源合成一份列表。** 技能按所属 Agent 分组，支持折叠、搜索、筛选和详情查看。分类只记在来源里，不会移动磁盘上的文件。
- **全局与项目两个范围。** 项目页列出 DSH 里任一已登记工作区的技能，布局与全局技能一致。同名技能同时存在时，以项目副本为准。
- **启停不碰你的文件。** 启用或停用只改变 DSH 的解析结果，Codex、Claude Code、Copilot 等目录里的源文件原样不动。
- **创建与导入。** 可以从零新建技能，也可以导入 ZIP 压缩包、文件夹或单个 `SKILL.md`，写入用户目录（DSH skills 或公共 Agent）或某个已登记工作区。
- **从仓库安装。** 添加公开 GitHub 仓库，浏览其中的技能，安装前预览将要写入的内容，逐个安装且不覆盖本地已有文件。
- **每次改动都可先看后做。** 仓库更新以文件级差异呈现，本地修改会被识别并保护，每次替换都留一份可回退的备份。
- **先回收再删除。** 删除 DSH 技能先进回收站；恢复时连同安装位置和仓库来源一起还原。

## 环境要求

- 已安装并能正常运行 DeepSeek Harness。
- 一个用来安装插件的 DSH profile。下文示例使用 `web`，请替换成你实际使用的 profile。

## 安装

仓库里已包含可直接运行的 `lib`，以下三种方式都不需要先构建。

### 从 Git 安装

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add git+https://github.com/Guojing6/dsh-skills-manager.git
```

### 从本地检出目录或打包好的 tarball 安装

`dsh plugin` 会把参数原样交给 pnpm，因此 pnpm 能识别的来源都可以：

```powershell
dsh plugin --profile web add E:\path\to\dsh-skills-manager
dsh plugin --profile web add .\dsh-skills-manager-1.2.2.tgz
```

### 交给 Agent 安装

把下面这段话发给能操作本机命令的 Agent：

```text
请把 https://github.com/Guojing6/dsh-skills-manager 这个插件安装到我的 DSH web profile，安装后确认生效并告诉我如何重新加载。
```

安装完成后重启 DSH、刷新页面，在侧栏点击「技能」即可——它就在「插件」正下方。

- `1.2.4` 已验证兼容 DeepSeek Harness `0.1.2-rc.1`、`0.1.5-rc.1`、`0.1.5-rc.2`、`0.1.5-rc.3`、`0.1.7-rc.1`、`0.1.7-rc.2`、`0.2.0-rc.1`、`0.2.0-rc.2`、`0.2.1-alpha.2`、`0.2.1-rc.2`。

### 更新

重新拉取仓库后再执行一次安装命令即可。标题区的「检查更新」会把当前版本和本仓库最新的 GitHub Release 对比：Git 目录安装会提示你在插件目录执行 `git pull` 后重启，包安装则可以直接按该 Release 的 tag 更新。

## 面板怎么用

| 你想做什么 | 怎么操作 |
| --- | --- |
| 浏览和搜索 | 选择全局或项目页签，展开来源分组，或使用搜索与筛选。 |
| 查看某个技能 | 点击「查看详情」，查看技能正文及其来源。 |
| 启用或停用 | 切换技能开关。只改变 DSH 的解析结果，不改动任何源文件。 |
| 创建或导入技能 | 点击「创建技能」或「导入技能」，再用左右两个并排下拉：左侧选「用户目录」（默认）或「指定工作区」，右侧选具体位置或已登记工作区。确认前先核对下方显示的写入路径。写入工作区时会落到 `<项目根>/.dsh/skills`，有可能被提交进该项目仓库。 |
| 从仓库安装技能 | 打开「技能仓库 → 添加仓库」，填入公开 GitHub 地址，扫描后点击「安装」，用同一组下拉选择范围与位置，核对路径后确认。 |
| 卸载仓库技能 | 点击红色「卸载」。已登记工作区里的副本同样可以这样卸载。文件夹及本地修改会移入回收站，「安装」按钮重新可用。 |
| 更新仓库技能 | 点击「刷新并检查更新」，再点「查看更新」查看差异，然后确认备份与替换。 |
| 回退某次更新 | 对留有备份的技能点击「恢复上一版」，预览后确认。 |
| 找回误删的技能 | 打开「回收站」恢复。 |

几条规则决定了面板显示什么、又能写到哪里：

- **工作区。** 项目页下拉列出 DSH 里已登记的工作区，只有选中的那个会被扫描、显示和搜索。Git 仓库解析到最近的 Git 根目录，普通文件夹直接用工作区目录，因此不需要 `git init`。没有技能的工作区仍可选，已失效的目录会被禁用。
- **同名副本。** 停用项目副本后，其他已启用的副本会接管，面板会标明实际生效的来源。要彻底关闭某个技能，需要停用它的全部副本。
- **写入范围。** 创建、导入和仓库安装可以写入用户目录下的 DSH skills、公共 Agent，或某个已登记工作区的 `<项目根>/.dsh/skills`。这两类操作都不会预先选中工作区，工作区也不能选公共 Agent。在项目页选择工作区只影响你正在看的内容，不是写入目标。
- **回收站与来源。** 已卸载副本的仓库来源绑定在具体的回收站条目上，只有显式恢复才会连同安装位置、更新/回退历史一起恢复。另一个同名技能不会继承这份仓库管理关系。
- **公共 Agent。** 卸载公共 Agent 里的副本会影响所有读取该目录的 Agent。
- **外部 Agent。** 下方表格中 Codex、Claude Code、Copilot 等目录里的技能在本插件里都是只读的。

## 仓库安装的边界

- 标题区的「检查更新」更新的是插件本身，对比的是本仓库最新的 GitHub Release；仓库区的「刷新并检查更新」只检查技能内容，不会自动安装或替换，扫描过程中会显示当前仓库和进度。
- 安装目标是用户目录下的 DSH skills 或公共 Agent（`~/.agents/skills`，可用 `DSH_AGENTS_HOME` 覆盖），或已登记工作区的 `<项目根>/.dsh/skills`。选择器会显示解析后的路径并禁用不安全的路径，目录不存在时也只在你确认后才创建。不能选择 Codex、Claude Code 等其他 Agent 目录，也不允许任意路径、未登记的项目目录或插件托管的缓存。旧版本留下、未记录安装位置的条目按 DSH 处理，更新和回退沿用记录中的位置。
- 只支持公开 GitHub 仓库，不提供私有凭证，也没有自动更新。移除订阅不会删除已安装的技能。
- 压缩包上限 32 MiB，按子目录筛选时同样适用。扫描失败会保留上一次的目录；缓存损坏需要重新刷新。
- 替换前一定会检测本地修改并要求明确确认。历史备份不会自动清理，会额外占用磁盘空间。

## 支持的 Agent 目录

`~` 表示用户主目录，`<project>` 表示已登记工作区的项目根。表中为默认路径；设置了对应的 DSH 目录变量时以配置为准。不存在的外部目录不会显示。

| 来源 | 全局目录 | 项目目录 |
| --- | --- | --- |
| DSH | `~/.dsh/skills` | `<project>/.dsh/skills` |
| 公共 Agent | `~/.agents/skills` | `<project>/.agents/skills` |
| CC Switch | `~/.cc-switch/skills` | — |
| Codex | `~/.codex/skills` | `<project>/.codex/skills` |
| Claude Code | `~/.claude/skills` | `<project>/.claude/skills` |
| Gemini | `~/.gemini/skills` | `<project>/.gemini/skills` |
| OpenCode | `~/.config/opencode/skills` | `<project>/.opencode/skills` |
| Cursor | `~/.cursor/skills` | `<project>/.cursor/skills` |
| Copilot | `~/.copilot/skills` | `<project>/.github/skills` |
| Windsurf | `~/.codeium/windsurf/skills`<br>`~/.windsurf/skills` | `<project>/.windsurf/skills` |
| Trae | `~/.trae/skills` | `<project>/.trae/skills` |
| Trae CN | `~/.trae-cn/skills` | `<project>/.trae-cn/skills` |
| OpenClaw / Clawdbot | `~/.openclaw/skills`<br>`~/.clawdbot/skills` | — |
| Roo | `~/.roo/skills` | `<project>/.roo/skills` |
| CodeBuddy | `~/.codebuddy/skills` | `<project>/.codebuddy/skills` |
| WorkBuddy | `~/.workbuddy/skills` | `<project>/.workbuddy/skills` |
| Qoder | `~/.qoder/skills` | `<project>/.qoder/skills` |
| Qoder CN CLI | `~/.qoder-cn/skills` | — |
| Qoder CN | `~/.lingma/skills` | `<project>/.lingma/skills` |

项目根下普通的 `<project>/skills` 目录不会被扫描，避免把仓库自己的发布资源当成 Agent 技能。OpenClaw / Clawdbot 只支持上表中的用户级来源。Qoder CN CLI 的项目技能位于 `<project>/.qoder/skills`，显示为 Qoder；Qoder CN IDE 使用 Lingma 目录。

## 开发

`src` 中是严格 TypeScript，插件架构未改动。

- `npm run typecheck`——只做类型检查。
- `npm run build`——重新生成 `lib` 下的运行产物（这些产物会入库）。
- `npm run verify`——宿主元数据同步检查、完整回归、发包检查和干净目录打包测试。

由于 `lib` 已入库，用 Git 安装时无需构建。改过 `src` 后请在提交前运行构建；打包时也会先检查类型并生成运行产物。CI 在 Node.js 22.19.0 和 24 上执行完整验证，源码改动还会触发受支持宿主的兼容矩阵。欢迎提交改进。

想在自己机器上试跑源码：用项目固定版本的 pnpm 安装依赖，执行 `npm run verify`，再执行 `npm pack`；用 `dsh plugin --profile web add <package.tgz>` 安装生成的 `.tgz`，重启 DSH 并刷新页面。打包时不要加 `--ignore-scripts`，否则会跳过构建钩子。

有问题或建议请[提交 Issue](https://github.com/Guojing6/dsh-skills-manager/issues)，并附上 DSH 与插件版本、复现步骤；界面问题请附完整截图。

## 来源声明

本项目基于 [MichengAI/dsh-skills-manager](https://github.com/MichengAI/dsh-skills-manager) 二次开发，现独立维护。

## 许可证

[MIT](LICENSE)
