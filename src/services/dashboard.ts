import * as vscode from "vscode";
import { Task, STATUS_ORDER, STATUS_LABELS, STATUS_ICONS } from "../models/task";
import { getAllTasks, saveTask, saveTasks } from "./storage";
import { getProjectName } from "../utils/project";

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _onRefresh: () => void;

  public static createOrShow(extensionUri: vscode.Uri, onRefresh: () => void): void {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "devTasksDashboard",
      "DevTasks Dashboard",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, onRefresh);
  }

  private constructor(panel: vscode.WebviewPanel, onRefresh: () => void) {
    this._panel = panel;
    this._onRefresh = onRefresh;

    this.update();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "updateStatus": {
            const tasks = getAllTasks();
            const task = tasks.find((t) => t.id === message.taskId);
            if (task) {
              saveTask({ ...task, status: message.newStatus });
              this._onRefresh();
              this.update();
            }
            break;
          }
          case "deleteTask": {
            const tasks = getAllTasks();
            const filtered = tasks.filter((t) => t.id !== message.taskId);
            saveTasks(filtered);
            this._onRefresh();
            this.update();
            break;
          }
          case "refresh": {
            this.update();
            break;
          }
        }
      },
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public update(): void {
    const tasks = getAllTasks();
    this._panel.title = `DevTasks — ${getProjectName()}`;
    this._panel.webview.html = this._getHtml(tasks);
  }

  private _getHtml(tasks: Task[]): string {
    const projectName = getProjectName();
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const done = tasks.filter((t) => t.status === "done").length;

    // Build columns data
    const columns = STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      icon: STATUS_ICONS[status],
      tasks: tasks.filter((t) => t.status === status),
    }));

    const columnsHtml = columns
      .map(
        (col) => `
      <div class="column" data-status="${col.status}">
        <div class="column-header">
          <span class="col-icon">${col.icon}</span>
          <span class="col-title">${col.label}</span>
          <span class="col-count">${col.tasks.length}</span>
        </div>
        <div class="task-list" id="col-${col.status}" 
             ondragover="event.preventDefault()" 
             ondrop="onDrop(event, '${col.status}')">
          ${col.tasks.map((task) => this._taskCardHtml(task)).join("")}
        </div>
      </div>
    `,
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevTasks Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .project-name {
      font-size: 16px;
      font-weight: 700;
      color: var(--vscode-editor-foreground);
    }
    .header-stats { display: flex; gap: 8px; }
    .stat-pill {
      font-size: 11px;
      padding: 2px 10px;
      border-radius: 20px;
      font-weight: 600;
    }
    .stat-total   { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .stat-pending { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
    .stat-done    { background: rgba(16, 185, 129, 0.2); color: #10B981; }

    .header-right { display: flex; gap: 8px; }
    .btn {
      font-size: 12px;
      padding: 5px 12px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid var(--vscode-button-border, transparent);
      font-family: var(--vscode-font-family);
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary {
      background: transparent;
      color: var(--vscode-foreground);
      border-color: var(--vscode-panel-border);
    }
    .btn-secondary:hover { background: var(--vscode-list-hoverBackground); }

    /* ── Filter bar ── */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .filter-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .filter-input {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      width: 200px;
    }
    .filter-input:focus { outline: 1px solid var(--vscode-focusBorder); }
    .filter-btn {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      cursor: pointer;
      border: 1px solid var(--vscode-panel-border);
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-font-family);
      transition: all 0.15s;
    }
    .filter-btn.active, .filter-btn:hover {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: transparent;
    }

    /* ── Board ── */
    .board {
      display: flex;
      gap: 0;
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 16px 16px 0;
    }

    .column {
      display: flex;
      flex-direction: column;
      min-width: 220px;
      flex: 1;
      margin: 0 6px;
      background: var(--vscode-sideBar-background);
      border-radius: 8px 8px 0 0;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
      border-bottom: none;
    }

    .column-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
      flex-shrink: 0;
    }
    .col-icon  { font-size: 14px; }
    .col-title { font-size: 12px; font-weight: 600; flex: 1; }
    .col-count {
      font-size: 11px;
      padding: 1px 7px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 700;
    }

    .task-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 80px;
    }
    .task-list.drag-over { background: var(--vscode-list-hoverBackground); }

    /* ── Task Card ── */
    .task-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 10px 12px;
      cursor: grab;
      transition: transform 0.1s, box-shadow 0.1s;
      position: relative;
    }
    .task-card:hover {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .task-card.dragging {
      opacity: 0.4;
      cursor: grabbing;
    }

    .task-text {
      font-size: 12px;
      line-height: 1.5;
      color: var(--vscode-editor-foreground);
      margin-bottom: 8px;
      word-break: break-word;
    }
    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .task-file {
      font-size: 10px;
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-textBlockQuote-background);
      padding: 1px 6px;
      border-radius: 3px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .task-assignee {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .task-actions {
      position: absolute;
      top: 6px;
      right: 8px;
      display: none;
      gap: 4px;
    }
    .task-card:hover .task-actions { display: flex; }
    .task-action-btn {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 3px;
      cursor: pointer;
      border: none;
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
      line-height: 1.4;
    }
    .task-action-btn:hover { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .task-action-btn.danger:hover { background: #EF4444; color: white; }

    /* ── Empty state ── */
    .empty-col {
      text-align: center;
      padding: 20px 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      opacity: 0.6;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <span class="project-name">⚡ ${projectName}</span>
      <div class="header-stats">
        <span class="stat-pill stat-total">${total} total</span>
        <span class="stat-pill stat-pending">${pending} pending</span>
        <span class="stat-pill stat-done">${done} done</span>
      </div>
    </div>
    <div class="header-right">
      <button class="btn btn-secondary" onclick="refresh()">↻ Refresh</button>
    </div>
  </div>

  <div class="filter-bar">
    <span class="filter-label">Filter:</span>
    <input class="filter-input" type="text" id="searchInput" placeholder="Search tasks..." oninput="filterTasks()">
    <button class="filter-btn active" id="filter-all"      onclick="setFilter('all')">All</button>
    <button class="filter-btn"        id="filter-mine"     onclick="setFilter('mine')">Mine</button>
    <button class="filter-btn"        id="filter-unassigned" onclick="setFilter('unassigned')">Unassigned</button>
    <button class="filter-btn"        id="filter-linked"   onclick="setFilter('linked')">Has File</button>
  </div>

  <div class="board" id="board">
    ${columnsHtml}
  </div>

<script>
  const vscode = acquireVsCodeApi();
  let activeFilter = 'all';
  let dragTaskId = null;

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  function onDragStart(event, taskId) {
    dragTaskId = taskId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd(event) {
    event.target.classList.remove('dragging');
    document.querySelectorAll('.task-list').forEach(el => el.classList.remove('drag-over'));
  }

  function onDrop(event, newStatus) {
    event.preventDefault();
    if (!dragTaskId) return;
    document.querySelectorAll('.task-list').forEach(el => el.classList.remove('drag-over'));
    vscode.postMessage({ command: 'updateStatus', taskId: dragTaskId, newStatus });
    dragTaskId = null;
  }

  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragenter', () => list.classList.add('drag-over'));
    list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
  });

  // ── Filter ───────────────────────────────────────────────────────────────
  function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('filter-' + filter).classList.add('active');
    filterTasks();
  }

  function filterTasks() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.task-card').forEach(card => {
      const text       = (card.dataset.text || '').toLowerCase();
      const assignee   = (card.dataset.assignee || '').toLowerCase();
      const hasFile    = card.dataset.hasFile === 'true';
      const isAssigned = card.dataset.isAssigned === 'true';

      let show = true;

      if (search && !text.includes(search)) show = false;

      if (activeFilter === 'mine' && !assignee.includes('${getProjectName().toLowerCase()}')) {
        // simplified: show assigned tasks
        if (!isAssigned) show = false;
      }
      if (activeFilter === 'unassigned' && isAssigned) show = false;
      if (activeFilter === 'linked' && !hasFile) show = false;

      card.style.display = show ? '' : 'none';
    });

    // Update column counts
    document.querySelectorAll('.column').forEach(col => {
      const visible = col.querySelectorAll('.task-card:not([style*="display: none"])').length;
      col.querySelector('.col-count').textContent = visible;
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  function deleteTask(taskId) {
    vscode.postMessage({ command: 'deleteTask', taskId });
  }

  function markDone(taskId) {
    vscode.postMessage({ command: 'updateStatus', taskId, newStatus: 'done' });
  }

  function refresh() {
    vscode.postMessage({ command: 'refresh' });
  }
</script>

</body>
</html>`;
  }

  private _taskCardHtml(task: Task): string {
    const fileLabel = task.filePath ? `${task.filePath}${task.line ? ":" + task.line : ""}` : "";
    const assigneeLabel = task.assignedTo ? task.assignedTo.split(" ")[0] : "";

    return `
      <div class="task-card"
           draggable="true"
           ondragstart="onDragStart(event, '${task.id}')"
           ondragend="onDragEnd(event)"
           data-id="${task.id}"
           data-text="${task.text.replace(/"/g, "&quot;")}"
           data-assignee="${(task.assignedTo || "").replace(/"/g, "&quot;")}"
           data-has-file="${!!task.filePath}"
           data-is-assigned="${!!task.assignedTo}">

        <div class="task-actions">
          ${task.status !== "done" ? `<button class="task-action-btn" onclick="markDone('${task.id}')">✔</button>` : ""}
          <button class="task-action-btn danger" onclick="deleteTask('${task.id}')">✕</button>
        </div>

        <div class="task-text">${task.text}</div>

        <div class="task-meta">
          ${fileLabel ? `<span class="task-file" title="${fileLabel}">${fileLabel}</span>` : ""}
          ${assigneeLabel ? `<span class="task-assignee">👤 ${assigneeLabel}</span>` : ""}
        </div>
      </div>
    `;
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
  }
}
