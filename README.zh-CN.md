<p align="center">
  <img src="assets/branding/dsh-banner-zh-CN.webp" alt="DSH Skills Manager" width="100%">
</p>

<div align="center">

# DSH Skills Manager

  **统一管理本机与项目技能，从 GitHub 安装、预览更新并备份回退**

  [English](README.md) · [更新日志](CHANGELOG.zh-CN.md) · [MIT](LICENSE)

  [![许可证：MIT](https://img.shields.io/badge/许可证-MIT-green.svg)](LICENSE)
  [![GitHub](https://img.shields.io/badge/GitHub-Guojing6%2Fdsh--skills--manager-181717.svg)](https://github.com/Guojing6/dsh-skills-manager)
  [![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/Guojing6/dsh-skills-manager)
  [![DSH 支持至 0.2.1-alpha.2](https://img.shields.io/badge/DSH-%E6%94%AF%E6%8C%81%E8%87%B3%200.2.1--alpha.2-2563eb.svg)](#安装)
</div>

> DSH Skills Manager 是社区维护的 DeepSeek Harness（DSH）插件，并非 DeepSeek AI 官方产品。

本文描述 **1.2.1**。已发布变更见[更新日志](CHANGELOG.zh-CN.md)。

## 功能概览

把散落在本机和项目中的技能集中到 DSH，无需在多个 Agent 目录间来回查找。

- **统一管理**：按来源分组，搜索技能、查看正文，一键启用或停用。分类记在来源里，不移动文件。
- **区分全局与项目**：项目页在顶部下拉选择已登记工作区，下方按来源显示该工作区的技能，列表样式与全局技能一致；同名技能优先使用项目副本。
- **复用已有技能**：支持 Codex、Claude Code、Copilot 等常见 Agent，启停不会修改它们的源文件。
- **创建与导入**：新建技能，或导入 ZIP、技能文件夹和 `SKILL.md`，保存到用户目录（默认）或已登记工作区。用户目录支持 DSH skills 与 Shared Agent。
- **回收与恢复**：删除 DSH 技能后先进入回收站，误删可找回。
- **技能仓库**：添加公开 GitHub 仓库，按来源折叠浏览、搜索、查看详情并逐项安装；同名不覆盖，刷新不自动更新本地。


- **来源追踪与更新**：区分本机和仓库安装，预览文件差异，保护本地修改，确认后备份更新并可恢复上一版。

## 界面预览

技能管理：

![技能管理完整界面](assets/screenshots/skills-manager-v2-preview.webp)

技能仓库：

![技能仓库浏览与安装](assets/screenshots/skill-repositories.webp)

*截图来自 1.0.0 发布前的 0.1.54 本地测试版，展示全局技能和技能仓库；最终版补充了刷新动画及进度提示。截图仅保留功能面板，已裁去背景中的真实文件名与项目目录，采用无损 WebP。*

## 安装

需要已安装并能正常运行 DeepSeek Harness。以下命令使用 `web` profile，请按实际环境替换。

支持从本仓库的 Git 地址、本地检出目录或本地构建的 `.tgz` 包安装。仓库里已包含可直接运行的 `lib`，用 Git 安装无需构建。改动源码后，提交前请先运行构建。

### 让 Agent 帮你安装

把这段话发给能够操作本机终端的 Agent：

```text
请把 https://github.com/Guojing6/dsh-skills-manager 这个插件安装到我的 DSH web profile，安装后确认生效并告诉我如何重新加载。
```

### 手动安装

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add git+https://github.com/Guojing6/dsh-skills-manager.git
```

安装后重启 DSH 并刷新页面，点击侧栏的「技能」（在「插件」下方）即可使用。

`dsh plugin` 会把参数转发给 pnpm，因此本地检出目录或打包好的 `.tgz` 也可以同样安装：

```powershell
dsh plugin --profile web add E:\path\to\dsh-skills-manager
dsh plugin --profile web add .\dsh-skills-manager-1.2.1.tgz
```

更新时重新拉取仓库并再次执行安装命令。标题区的「检查更新」依赖 npm 包，本仓库不发布 npm 包，因此检测不到新版本。

- `1.2.1` 已验证兼容 DeepSeek Harness `0.1.2-rc.1`、`0.1.5-rc.1`、`0.1.5-rc.2`、`0.1.5-rc.3`、`0.1.7-rc.1`、`0.1.7-rc.2`、`0.2.0-rc.1`、`0.2.0-rc.2`、`0.2.1-alpha.2`。

## 使用说明

| 你想做什么 | 如何操作 |
| --- | --- |
| 查找技能 | 选择全局或项目页签，展开来源分组，或使用搜索和筛选。 |
| 查看内容 | 点击「查看详情」，阅读技能正文及来源信息。 |
| 控制启停 | 切换技能开关；只影响 DSH，不改动源文件。 |
| 添加技能 | 点击「创建技能」或「导入技能」，左侧下拉选择「用户目录」（默认）或「指定工作区」，右侧下拉选择位置或已登记工作区，并核对下方路径。工作区副本会写进该项目的 `.dsh/skills`，可能被提交到仓库。 |
| 从仓库安装 | 打开「技能仓库 → 添加仓库」，填写公开 GitHub 地址，扫描后点击「安装」，使用同一组并排下拉选择范围及位置或工作区，核对下方实际路径并确认。 |
| 卸载仓库技能 | 点击红色「卸载」并确认。已登记工作区里的副本也同样可以卸载。已安装的文件夹及本地修改移入「回收站」，随后可以重新安装。 |
| 更新仓库技能 | 点击「刷新并检查更新」，再「查看更新」预览文件差异，确认备份后更新。 |
| 恢复更新前版本 | 对有备份的技能点击「恢复上一版」，预览并确认。 |
| 找回误删 | 打开「回收站」恢复。 |

- **按已登记工作区查看**：项目页顶部下拉列出 DSH 里已登记的工作区，选中后只读取并显示这一项的技能，搜索也只针对所选工作区。Git 仓库使用最近的 Git 根目录；普通文件夹使用工作区目录，无需 `git init`。没有技能的工作区也可选择，失效目录不可选。
- **同名技能独立启停**：停用项目副本后，其他已启用副本仍可接管，页面会提示实际来源。要完全关闭该技能，需停用全部副本。
- **文件管理范围**：DSH 来源的技能可从管理页移入回收站；从仓库安装到 DSH、公共 Agent 或已登记工作区的副本也可从「技能仓库」卸载。Codex、Claude 等其他外部技能仍只读。创建、文件导入和仓库安装可以写入用户目录下的 DSH skills 或公共 Agent（Shared Agent），也可以写入某个已登记工作区的 `.dsh/skills`。创建、导入和安装时，工作区不会被预先选中，也不能选 Shared Agent；项目页的只读查看选择不作为写入目标。
- **恢复**：已卸载副本的仓库来源绑定到具体回收站条目；仅显式恢复后重新启用来源、安装位置和更新/恢复历史。其他同名技能不会继承仓库管理权限。卸载公共 Agent 副本会影响使用该目录的所有 Agent。

### 仓库使用边界

- 标题区「检查更新」更新插件自身；仓库区「刷新并检查更新」检查技能内容，不自动安装或替换。刷新时显示当前仓库、数量和动画。
- 仓库安装可以写入用户目录下的 DSH skills 或公共 Agent（`~/.agents/skills`，可用 `DSH_AGENTS_HOME` 覆盖），也可以写入已登记工作区的 `<项目根>/.dsh/skills`。选择器显示实际配置路径，并禁用不安全路径；缺少的目录仅在确认安装后创建。不能安装到 Codex、Claude 等其他 Agent 目录，也不允许任意路径、未登记项目目录或插件托管缓存写入。旧安装记录未指定位置时默认使用 DSH；更新与恢复上一版沿用记录的位置。仅支持公开 GitHub，不提供私有凭证或自动更新。移除订阅保留已安装技能。
- 归档上限 32 MiB，指定子目录也需下载整库。扫描失败保留上次目录；缓存损坏时重新刷新。
- 更新前检测本地修改，覆盖必须明确确认；历史备份不自动清理，磁盘用量会增加。

## 支持的 Agent 目录

`~` 表示用户主目录，`<project>` 表示已登记工作区的项目根。表中为默认路径；设置了对应 DSH 目录变量时，以配置为准。

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

不扫描普通项目根目录的 `<project>/skills`，避免把仓库的发布资源当作 Agent 技能。OpenClaw / Clawdbot 仅保留上表中的用户级来源。Qoder CN CLI 的项目技能在 `<project>/.qoder/skills`，显示为 Qoder。Qoder CN IDE 使用 Lingma 目录。不存在的外部来源目录不会显示。

## 来源声明

本项目基于 [MichengAI/dsh-skills-manager](https://github.com/MichengAI/dsh-skills-manager) 二次开发，现独立维护。

## 反馈与贡献

遇到问题或有建议，欢迎[提交 Issue](https://github.com/Guojing6/dsh-skills-manager/issues)。请附上 DSH 与插件版本、复现步骤；界面问题可附完整截图。

源码位于 `src`，使用严格 TypeScript，保留现有插件架构。开发时执行 `npm run typecheck` 检查类型，`npm run build` 生成运行产物，`npm run verify` 执行完整回归与打包验证。仓库里已包含可直接运行的 `lib`。改动源码后，提交前请先运行构建。打包前仍会自动检查类型并构建，打包产物仍包含所需 JavaScript 产物。CI 在 Node.js 22.19.0 和 24 上执行完整验证，代码改动也会自动触发受支持宿主兼容矩阵。欢迎提交改进。

从源码制作测试包时，使用项目固定版本的 pnpm 安装依赖，执行 `npm run verify`，再执行 `npm pack`。用 `dsh plugin --profile web add <package.tgz>` 安装生成的 `.tgz`，重启 DSH 并刷新页面。打包时不要使用 `--ignore-scripts`，否则会跳过构建钩子。

## 许可证

[MIT License](LICENSE)
