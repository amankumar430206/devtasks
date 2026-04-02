import * as vscode from "vscode";
import * as path from "path";
import { Task, TaskStatus, STATUS_ICONS, STATUS_LABELS, STATUS_ORDER } from "../models/task";
import { getAllTasks } from "../services/storage";
import { getProjectName, getWorkspaceRoot } from "../utils/project";

// ─── Filter Types ────────────────────────────────────────────────────────────
export type FilterMode = "all" | "mine" | "current-file" | "unassigned";

// ─── Tree Item Types ─────────────────────────────────────────────────────────
export class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly status: TaskStatus,
    public readonly tasks: Task[],
  ) {
    super(
      `${STATUS_ICONS[status]} ${STATUS_LABELS[status]}`,
      tasks.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.description = `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`;
    this.contextValue = "group";
  }
}
export class TaskItem extends vscode.TreeItem {
  constructor(public readonly task: Task) {
    super(task.text, vscode.TreeItemCollapsibleState.None);

    this.id = task.id;
    this.contextValue = `task-${task.status}`;
    this.tooltip = this.buildTooltip();
    this.description = this.buildDescription();
    this.iconPath = this.buildIcon();

    if (task.filePath) {
      this.command = {
        command: "todo.open",
        title: "Open Task File",
        arguments: [task],
      };
    }
  }

  private buildTooltip(): string {
    const lines: string[] = [this.task.text];
    if (this.task.filePath) {
      lines.push(`📁 ${this.task.filePath}${this.task.line != null ? `:${this.task.line}` : ""}`);
    }
    if (this.task.assignedTo) {
      lines.push(`👤 ${this.task.assignedTo}`);
    }
    if (this.task.createdBy) {
      lines.push(`✍️ ${this.task.createdBy}`);
    }
    lines.push(`🕐 ${new Date(this.task.createdAt).toLocaleString()}`);
    return lines.join("\n");
  }

  private buildDescription(): string {
    const parts: string[] = [];
    if (this.task.filePath) {
      const basename = path.basename(this.task.filePath);
      parts.push(this.task.line != null ? `${basename}:${this.task.line}` : basename);
    }
    if (this.task.assignedTo) {
      parts.push(`→ ${this.task.assignedTo.split(" ")[0]}`);
    }
    return parts.join("  ");
  }

  private buildIcon(): vscode.ThemeIcon {
    const iconMap: Record<TaskStatus, string> = {
      pending: "circle-outline",
      review: "eye",
      confirmed: "pass",
      assigned: "person",
      done: "check",
    };
    return new vscode.ThemeIcon(iconMap[this.task.status]);
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export class TodoProvider implements vscode.TreeDataProvider<GroupItem | TaskItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GroupItem | TaskItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private filterMode: FilterMode = "all";
  private currentUser: string = "";

  constructor() {
    this.loadTasks();
    this.setupFileWatcher();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  refresh(): void {
    this.loadTasks();
    this._onDidChangeTreeData.fire();
  }

  setFilter(mode: FilterMode, currentUser?: string): void {
    this.filterMode = mode;
    if (currentUser) {
      this.currentUser = currentUser;
    }
    this._onDidChangeTreeData.fire();
  }

  getFilter(): FilterMode {
    return this.filterMode;
  }

  getTreeItem(element: GroupItem | TaskItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GroupItem | TaskItem): (GroupItem | TaskItem)[] {
    if (!element) {
      return this.buildGroups();
    }
    if (element instanceof GroupItem) {
      const sorted = [...element.tasks].sort((a, b) => b.createdAt - a.createdAt);
      return sorted.map((t) => new TaskItem(t));
    }
    return [];
  }

  getSidebarTitle(): string {
    const pending = this.tasks.filter((t) => t.status === "pending").length;
    const done = this.tasks.filter((t) => t.status === "done").length;
    const project = getProjectName();
    const filterLabel = this.filterMode !== "all" ? ` [${this.filterMode}]` : "";
    return `${project}${filterLabel} — ${pending} pending / ${done} done`;
  }

  getAllTasks(): Task[] {
    return this.tasks;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private loadTasks(): void {
    this.tasks = getAllTasks();
  }

  private getFilteredTasks(): Task[] {
    switch (this.filterMode) {
      case "mine":
        return this.tasks.filter((t) => t.assignedTo && this.currentUser && t.assignedTo.includes(this.currentUser));
      case "unassigned":
        return this.tasks.filter((t) => !t.assignedTo);
      case "current-file": {
        const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!activeFile) {
          return this.tasks;
        }
        const workspaceRoot = getWorkspaceRoot();
        const relPath = workspaceRoot ? activeFile.replace(workspaceRoot + path.sep, "") : activeFile;
        return this.tasks.filter((t) => t.filePath === relPath);
      }
      default:
        return this.tasks;
    }
  }

  private buildGroups(): GroupItem[] {
    const filtered = this.getFilteredTasks();
    return STATUS_ORDER.map((status) => {
      const group = filtered.filter((t) => t.status === status);
      return new GroupItem(status, group);
    });
  }

  private setupFileWatcher(): void {
    const root = getWorkspaceRoot();
    if (!root) {
      return;
    }
    const pattern = new vscode.RelativePattern(root, ".vscode/todos.json");
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.fileWatcher.onDidChange(() => this.refresh());
    this.fileWatcher.onDidCreate(() => this.refresh());
    this.fileWatcher.onDidDelete(() => this.refresh());
  }

  dispose(): void {
    this.fileWatcher?.dispose();
    this._onDidChangeTreeData.dispose();
  }
}
