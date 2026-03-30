# Contributing to DevTasks

Thanks for taking the time to contribute. This guide covers everything you need to go from zero to a working pull request.

---

## Prerequisites

- Node.js 18+
- VS Code 1.85+
- Git

---

## Local Setup

```bash
git clone https://github.com/your-org/devtasks
cd devtasks
npm install
```

---

## Development Loop

```bash
# Start the TypeScript compiler in watch mode
npm run watch
```

Then press **F5** in VS Code. This opens an **Extension Development Host** — a second VS Code window with DevTasks loaded live.

| Action                             | Result                |
| ---------------------------------- | --------------------- |
| Save a `.ts` file                  | Recompiles in ~1s     |
| `Ctrl+Shift+F5` in the host window | Reloads the extension |
| Set a breakpoint in any `.ts` file | Full debugger support |

> **Note:** If you change `package.json` (new command, keybinding, menu), close and re-launch with **F5** — a hot reload won't pick up manifest changes.

---

## Project Structure

```
src/
  extension.ts          # Entry point — all command registrations
  providers/
    TodoProvider.ts     # Sidebar tree view
  services/
    storage.ts          # Read/write .vscode/todos.json
    review.ts           # Review batch logic
    assignment.ts       # Bulk assignment
  models/
    task.ts             # Task interface + state machine types
  utils/
    project.ts          # Workspace detection, Git identity
```

---

## Before Submitting a PR

```bash
npm run compile      # must pass with zero errors
npm run lint         # must pass with zero warnings
```

- Keep PRs focused — one feature or fix per PR
- Update `README.md` if you add a command or change behaviour
- Don't edit `.vscode/todos.json` — that's runtime data, not source

---

## Commit Style

```
feat: add due date field to Task model
fix: handle missing .vscode directory on first run
chore: bump vsce to 2.23.0
docs: update keybindings table in README
```

---

## Reporting a Bug

Open an issue with:

1. VS Code version
2. OS
3. Steps to reproduce
4. What you expected vs what happened

---

## Questions

Open a GitHub Discussion or drop a comment on the relevant issue.
