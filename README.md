# DevTasks — Code-Native Task Management

> "Tasks should live where the work happens."

DevTasks is a VS Code extension that lets developers create, review, and assign tasks **directly in the editor** — no context switching, no external tools.

---

## Features

### ⚡ Fast Task Creation
- **`Ctrl+Shift+T`** — Add a task anywhere
- **`Ctrl+Shift+T`** (with selection) — Create a task linked to the selected code, capturing file path and line number
- Right-click any selection → **"DevTasks: Add Task from Selection"**

### 📋 Sidebar Task View
- Grouped by status: Pending → Review → Confirmed → Assigned → Done
- Click any task to jump directly to its linked file + line
- Live count: `3 pending / 5 done`
- Auto-refreshes when `todos.json` changes (Git pull-safe)

### 🔍 Review Workflow
1. Select pending tasks → **`Ctrl+Shift+R`** → sends to Review Queue
2. Review grouped by batch ID
3. Run **DevTasks: Confirm Review Batch** → moves to Confirmed

### 👤 Bulk Assignment
- Select multiple tasks → assign to any team member
- Picks up Git identity automatically (`git config user.name/email`)
- Previous assignees surfaced as quick picks

### 📁 File Navigation
- Click task in sidebar → opens file, moves cursor, centers view
- Handles missing files gracefully

### 🔎 TODO Comment Import
- **DevTasks: Import TODO Comments from File**
- Scans active file for `// TODO:` patterns
- Preview and selectively import as tracked tasks

---

## Installation

### From Source

```bash
git clone https://github.com/your-org/devtasks
cd devtasks
npm install
npm run compile
```

Then press **F5** in VS Code to launch the Extension Development Host.

### Package as VSIX

```bash
npm run package
# Produces devtasks-1.0.0.vsix
```

Install via: `Extensions` panel → `...` → `Install from VSIX`

---

## Storage

Tasks are stored in `.vscode/todos.json` — commit this file to sync tasks across the team via Git.

```json
{
  "tasks": [
    {
      "id": "uuid",
      "text": "Fix API bug",
      "status": "pending",
      "filePath": "src/api.ts",
      "line": 47,
      "createdBy": "Vish Kumar <vish@remitx.io>",
      "assignedTo": null,
      "reviewBatchId": null,
      "createdAt": 1710000000000
    }
  ],
  "version": 1
}
```

---

## Task State Machine

```
pending → review → confirmed → assigned → done
```

| Status    | Icon | Meaning                          |
|-----------|------|----------------------------------|
| pending   | ⏳   | New task, unreviewed             |
| review    | 🔍   | In review queue (batched)        |
| confirmed | ✅   | Review passed, ready to assign   |
| assigned  | 👤   | Assigned to a team member        |
| done      | ✔️   | Completed                        |

---

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `todo.add` | `Ctrl+Shift+T` | Add a manual task |
| `todo.addFromSelection` | `Ctrl+Shift+T` (selection) | Add task from selected code |
| `todo.open` | — | Navigate to task's file/line |
| `todo.markForReview` | `Ctrl+Shift+R` | Send tasks to review queue |
| `todo.confirmReview` | — | Confirm a review batch |
| `todo.assignBatch` | — | Bulk assign tasks |
| `todo.markDone` | — | Mark task(s) as done |
| `todo.delete` | — | Delete task(s) |
| `todo.refresh` | — | Force refresh sidebar |
| `todo.parseComments` | — | Import `// TODO:` from file |

---

## Configuration

```json
{
  "devtasks.defaultAssignee": "",
  "devtasks.autoParseOnOpen": false
}
```

---

## Project Structure

```
src/
  extension.ts           # Entry point, command registration
  providers/
    TodoProvider.ts      # TreeDataProvider for sidebar
  services/
    storage.ts           # Safe read/write to todos.json
    review.ts            # Review batch logic
    assignment.ts        # Assignee management
  models/
    task.ts              # Task type + state definitions
  utils/
    project.ts           # Workspace detection, git identity
```

---

## Contributing

1. `npm install`
2. `npm run watch` — TypeScript in watch mode
3. Press `F5` → Extension Development Host
4. Make changes, reload with `Ctrl+R`

---

## Roadmap

- [ ] Tagging system
- [ ] Due dates with calendar picker
- [ ] Git blame → auto-assign
- [ ] Webview dashboard for rich task management
- [ ] Export to GitHub Issues / Linear

---

## License

MIT
