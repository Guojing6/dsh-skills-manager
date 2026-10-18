# DSH Skills Manager

DSH Skills Manager collects every Agent Skill on your machine into one panel inside DeepSeek Harness: skills already installed for Codex, Claude Code, Copilot and a dozen other agents, skills kept in DSH itself, and skills you pull from public GitHub repositories. Search, read, toggle, import, install, update and roll back without leaving DSH or hand-editing another agent's folder.

This is a community-maintained plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), not an official DeepSeek AI product.

- Version: `1.2.2`
- Repository: <https://github.com/Guojing6/dsh-skills-manager>
- Issues: <https://github.com/Guojing6/dsh-skills-manager/issues>
- Changelog: [English](CHANGELOG.md) · [中文](CHANGELOG.zh-CN.md)
- License: [MIT](LICENSE)

## What it does

- **Every source in one list.** Skills are grouped by the agent that owns them, with collapsible groups, search, filters and a detail view. Categories are stored per source and never move files on disk.
- **Global and project scopes.** The project tab lists the skills of any workspace registered in DSH, using the same grouped layout as global skills. When the same skill exists in both scopes, the project copy wins.
- **Toggles that leave files alone.** Enabling or disabling a skill only changes how DSH resolves it. The file in Codex, Claude Code, Copilot or any other supported agent folder stays untouched.
- **Create and import.** Start a skill from scratch, or import a ZIP archive, a folder or a single `SKILL.md`. Write it to your user directory (DSH skills or Shared Agent) or into a registered workspace.
- **Repository installs.** Add a public GitHub repository, browse its skills, preview exactly what an install would write, and install skill by skill without overwriting local files.
- **Review before every change.** Repository updates are shown as file-level diffs, local edits are detected and protected, and each replacement keeps a backup you can restore.
- **Trash first.** Deleting a DSH skill moves it to Trash. Restoring it brings back both its destination and its repository provenance.

## Requirements

- A working DeepSeek Harness installation.
- A DSH profile to install into. The examples below use `web`; substitute the profile name you actually run.

## Installation

The repository ships a ready-to-run `lib`, so none of these routes needs a build step.

### From Git

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add git+https://github.com/Guojing6/dsh-skills-manager.git
```

### From a local checkout or a packed tarball

`dsh plugin` hands its arguments straight to pnpm, so any source pnpm understands works:

```powershell
dsh plugin --profile web add E:\path\to\dsh-skills-manager
dsh plugin --profile web add .\dsh-skills-manager-1.2.2.tgz
```

### By asking an agent

Paste this into an agent that can run commands on this machine:

```text
Install the DSH Skills Manager plugin from https://github.com/Guojing6/dsh-skills-manager into my DSH web profile, then confirm it is active and explain how to reload DSH.
```

Then restart DSH, refresh the page, and open **Skills** in the sidebar — it sits directly below **Plugins**.

- Plugin `1.2.2` is tested with DeepSeek Harness `0.1.2-rc.1`, `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.5-rc.3`, `0.1.7-rc.1`, `0.1.7-rc.2`, `0.2.0-rc.1`, `0.2.0-rc.2`, `0.2.1-alpha.2`, `0.2.1-rc.2`.

### Updating

Pull the repository again and re-run the install command. The update entry in the panel header looks for a package of the same name on the npm registry; this distribution is Git-only and publishes nothing there, so that entry will not find a newer version.

## Using the panel

| What you want to do | How |
| --- | --- |
| Browse and search | Pick Global or Project, expand a source group, or use search and filters. |
| Read a skill | Open **View details** for the skill body and where it came from. |
| Turn a skill on or off | Flip its switch. Only DSH resolution changes; no source file is edited. |
| Create or import a skill | Choose **Create skill** or **Import skill**, then use the two side-by-side dropdowns: **User directory** (default) or **Specific workspace** on the left, and the location or registered workspace on the right. Check the destination path shown below before you confirm. A workspace copy goes to `<project>/.dsh/skills` and may end up committed to that project. |
| Install from a repository | Open **Repositories → Add repository**, paste a public GitHub URL, scan, press **Install**, choose the scope and destination with the same dropdowns, verify the path, confirm. |
| Uninstall a repository skill | Press the red **Uninstall** button. Copies inside registered workspaces can be uninstalled the same way. The folder and any local edits move to Trash, and **Install** becomes available again. |
| Update from a repository | Press **Refresh & check updates**, then **Review update** to inspect the diff before backup and replacement. |
| Roll an update back | Press **Restore previous version** on any skill that has a backup, preview it, confirm. |
| Recover a deletion | Open **Trash** and restore. |

A few rules decide what the panel shows and what it is allowed to write:

- **Workspaces.** The project tab dropdown lists the workspaces registered in DSH. Only the selected one is scanned, displayed and searched. Git repositories resolve to their nearest Git root; plain folders use the workspace directory itself, so `git init` is not required. Workspaces without skills stay selectable, and directories that no longer exist are disabled.
- **Same-name copies.** Disabling a project copy lets another enabled copy take over, and the panel names the source that is actually active. Disabling every copy is what turns the skill off completely.
- **Write destinations.** Creation, import and repository install can target user-level DSH skills, Shared Agent, or `<project>/.dsh/skills` of a registered workspace. Neither flow preselects a workspace, and Shared Agent is not offered for workspaces. Selecting a workspace on the project tab only affects what you are viewing.
- **Trash and provenance.** A retired repository source sticks to the individual Trash entry and comes back only through an explicit restore, together with its destination and its update/rollback history. A different skill that happens to share the name does not inherit repository management.
- **Shared Agent.** Uninstalling a Shared Agent copy affects every agent that reads that directory.
- **External agents.** Skills discovered in Codex, Claude Code, Copilot and the other agent folders listed below are read-only here.

## Repository installs: the limits

- The header **Check for updates** updates the plugin itself. The repository **Refresh & check updates** only inspects skill contents: it never installs or replaces anything, and during a scan it shows the current repository and progress.
- Installations go to user-level DSH skills or Shared Agent (`~/.agents/skills`, overridable with `DSH_AGENTS_HOME`), or to `<project>/.dsh/skills` of a registered workspace. The chooser displays the resolved path and disables unsafe ones; a missing directory is created only after you confirm. Codex, Claude Code and other agent directories cannot be selected, and neither can arbitrary paths, unregistered project destinations or plugin-managed caches. Records from older versions that carry no destination fall back to DSH, and updates and rollbacks follow the recorded destination.
- Only public GitHub repositories are supported. There are no private credentials and no automatic updates. Removing a subscription keeps the skills it installed.
- Archives are capped at 32 MiB, which also applies when you filter by subdirectory. A failed scan keeps the previous catalog; a corrupt cache needs a refresh.
- Local edits always require explicit confirmation before they are replaced. Historical backups are never cleaned up automatically and take extra disk space.

## Supported agent directories

`~` is your home directory and `<project>` is the project root of a registered workspace. The paths below are defaults; configured DSH directory variables take precedence. External directories that do not exist are not shown.

| Source | Global directory | Project directory |
| --- | --- | --- |
| DSH | `~/.dsh/skills` | `<project>/.dsh/skills` |
| Shared Agent | `~/.agents/skills` | `<project>/.agents/skills` |
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

A plain `<project>/skills` directory at the project root is deliberately not scanned, so a repository's own release assets never show up as Agent skills. OpenClaw / Clawdbot support covers the user-level sources only. Qoder CN CLI keeps its project skills in `<project>/.qoder/skills` and appears as Qoder; the Qoder CN IDE uses the Lingma directories.

## Development

`src` holds strict TypeScript and the plugin architecture is unchanged.

- `npm run typecheck` — type checks only.
- `npm run build` — regenerates the runtime files in `lib`, which are committed.
- `npm run verify` — host metadata sync check, the full regression suite, the package check and a clean-directory pack test.

Because `lib` is committed, a Git install runs without building. After changing `src`, run the build before committing; packing checks types and builds the runtime files too. CI runs full verification on Node.js 22.19.0 and 24, and source changes also run the supported-host compatibility matrix. Contributions are welcome.

To try a source checkout: install dependencies with the pinned pnpm version, run `npm run verify`, then `npm pack`. Install the resulting `.tgz` with `dsh plugin --profile web add <package.tgz>`, restart DSH and refresh the page. Do not pass `--ignore-scripts` when packing — it skips the build hook.

Report bugs and suggestions in the [issue tracker](https://github.com/Guojing6/dsh-skills-manager/issues); include your DSH and plugin versions, the steps to reproduce, and a full screenshot for UI problems.

## Attribution

This project is a derivative of [MichengAI/dsh-skills-manager](https://github.com/MichengAI/dsh-skills-manager) and is now independently maintained.

## License

[MIT](LICENSE)
