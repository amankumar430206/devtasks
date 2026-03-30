import * as vscode from 'vscode';
import { TodoProvider, TaskItem, GroupItem } from './providers/TodoProvider';
import { Task, TaskStatus } from './models/task';
import {
  saveTask,
  saveTasks,
  deleteTask,
  generateId,
  getAllTasks,
} from './services/storage';
import {
  markTasksForReview,
  confirmReviewBatch,
  getReviewQueue,
} from './services/review';
import { assignTasks, getUniqueAssignees } from './services/assignment';
import {
  getWorkspaceRoot,
  getGitUser,
  formatCreatedBy,
  getRelativePath,
} from './utils/project';

// ─── Activation ─────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  // Guard: warn if no workspace
  if (!getWorkspaceRoot()) {
    vscode.window.showWarningMessage(
      'DevTasks: Open a workspace folder to enable task storage.'
    );
  }

  // ── Tree View ──────────────────────────────────────────────────────────
  const provider = new TodoProvider();

  const treeView = vscode.window.createTreeView('devTasksView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: true,
  });

  // Update sidebar title on refresh
  function updateTitle() {
    treeView.title = provider.getSidebarTitle();
  }
  updateTitle();
  provider.onDidChangeTreeData(() => updateTitle());

  // ── Commands ────────────────────────────────────────────────────────────

  // 1. Add task manually
  const addCmd = vscode.commands.registerCommand('todo.add', async () => {
    const text = await vscode.window.showInputBox({
      prompt: 'New task',
      placeHolder: 'Describe the task...',
      validateInput: (v) => (v.trim() ? null : 'Task text cannot be empty'),
    });
    if (!text) return;

    const user = getGitUser();
    const task: Task = {
      id: generateId(),
      text: text.trim(),
      status: 'pending',
      filePath: null,
      line: null,
      createdBy: formatCreatedBy(user),
      assignedTo: null,
      reviewBatchId: null,
      createdAt: Date.now(),
    };

    saveTask(task);
    provider.refresh();
    vscode.window.showInformationMessage(`DevTasks: Task added — "${text.trim()}"`);
  });

  // 2. Add task from code selection
  const addFromSelectionCmd = vscode.commands.registerCommand(
    'todo.addFromSelection',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('DevTasks: No active editor.');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection).trim();
      const filePath = getRelativePath(editor.document.uri.fsPath);
      const line = selection.start.line + 1; // 1-indexed

      const defaultText = selectedText
        ? `Fix: ${selectedText.slice(0, 80).replace(/\n/g, ' ')}`
        : '';

      const text = await vscode.window.showInputBox({
        prompt: `Task for ${filePath}:${line}`,
        value: defaultText,
        placeHolder: 'Describe the task...',
        validateInput: (v) => (v.trim() ? null : 'Task text cannot be empty'),
      });
      if (!text) return;

      const user = getGitUser();
      const task: Task = {
        id: generateId(),
        text: text.trim(),
        status: 'pending',
        filePath,
        line,
        createdBy: formatCreatedBy(user),
        assignedTo: null,
        reviewBatchId: null,
        createdAt: Date.now(),
      };

      saveTask(task);
      provider.refresh();
      vscode.window.showInformationMessage(
        `DevTasks: Task linked to ${filePath}:${line}`
      );
    }
  );

  // 3. Open file at task line
  const openCmd = vscode.commands.registerCommand(
    'todo.open',
    async (taskOrItem: Task | TaskItem) => {
      const task =
        taskOrItem instanceof TaskItem ? taskOrItem.task : taskOrItem;

      if (!task.filePath) {
        vscode.window.showWarningMessage('DevTasks: This task has no linked file.');
        return;
      }

      const root = getWorkspaceRoot();
      if (!root) return;

      const absolutePath = require('path').isAbsolute(task.filePath)
        ? task.filePath
        : require('path').join(root, task.filePath);

      const uri = vscode.Uri.file(absolutePath);

      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);

        if (task.line != null) {
          const lineIndex = Math.max(0, task.line - 1);
          const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
          editor.selection = new vscode.Selection(lineIndex, 0, lineIndex, 0);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
      } catch {
        vscode.window.showErrorMessage(
          `DevTasks: Could not open file "${task.filePath}". It may have been moved or deleted.`
        );
      }
    }
  );

  // 4. Mark tasks for review
  const markForReviewCmd = vscode.commands.registerCommand(
    'todo.markForReview',
    async (item?: TaskItem) => {
      const tasks = getAllTasks().filter((t) => t.status === 'pending');

      if (tasks.length === 0) {
        vscode.window.showInformationMessage('DevTasks: No pending tasks to review.');
        return;
      }

      // If called from context menu on a single item
      if (item instanceof TaskItem) {
        const batchId = markTasksForReview([item.task.id]);
        provider.refresh();
        vscode.window.showInformationMessage(
          `DevTasks: Task sent to review (batch ${batchId.slice(-5)})`
        );
        return;
      }

      // Multi-select from quick pick
      const picks = tasks.map((t) => ({
        label: t.text,
        description: t.filePath
          ? `${t.filePath}${t.line ? ':' + t.line : ''}`
          : undefined,
        picked: false,
        task: t,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Select tasks to send to review queue...',
        title: 'Mark for Review',
      });

      if (!selected || selected.length === 0) return;

      const batchId = markTasksForReview(selected.map((s) => s.task.id));
      provider.refresh();
      vscode.window.showInformationMessage(
        `DevTasks: ${selected.length} task(s) sent to review (batch ${batchId.slice(-5)})`
      );
    }
  );

  // 5. Confirm review batch
  const confirmReviewCmd = vscode.commands.registerCommand(
    'todo.confirmReview',
    async () => {
      const queue = getReviewQueue();

      if (queue.length === 0) {
        vscode.window.showInformationMessage('DevTasks: Review queue is empty.');
        return;
      }

      // Group by batch
      const batches = new Map<string, Task[]>();
      for (const task of queue) {
        if (!task.reviewBatchId) continue;
        if (!batches.has(task.reviewBatchId)) {
          batches.set(task.reviewBatchId, []);
        }
        batches.get(task.reviewBatchId)!.push(task);
      }

      const batchPicks = Array.from(batches.entries()).map(([id, tasks]) => ({
        label: `Batch ${id.slice(-5)}`,
        description: `${tasks.length} task(s)`,
        detail: tasks.map((t) => `  • ${t.text}`).join('\n'),
        batchId: id,
      }));

      const selected = await vscode.window.showQuickPick(batchPicks, {
        canPickMany: false,
        placeHolder: 'Select a review batch to confirm...',
        title: 'Confirm Review Batch',
      });

      if (!selected) return;

      const count = confirmReviewBatch(selected.batchId);
      provider.refresh();
      vscode.window.showInformationMessage(
        `DevTasks: ${count} task(s) confirmed ✅`
      );
    }
  );

  // 6. Bulk assign tasks
  const assignBatchCmd = vscode.commands.registerCommand(
    'todo.assignBatch',
    async (item?: TaskItem) => {
      const assignable = getAllTasks().filter(
        (t) => t.status === 'confirmed' || t.status === 'pending' || t.status === 'review'
      );

      if (assignable.length === 0) {
        vscode.window.showInformationMessage(
          'DevTasks: No tasks available to assign. Confirm reviewed tasks first.'
        );
        return;
      }

      // Pick tasks
      const taskPicks = assignable.map((t) => ({
        label: t.text,
        description: `[${t.status}] ${t.filePath ?? ''}`,
        picked: item instanceof TaskItem && item.task.id === t.id,
        task: t,
      }));

      const selectedTasks = await vscode.window.showQuickPick(taskPicks, {
        canPickMany: true,
        placeHolder: 'Select tasks to assign...',
        title: 'Bulk Assign',
      });

      if (!selectedTasks || selectedTasks.length === 0) return;

      // Known assignees from history + git user
      const gitUser = getGitUser();
      const existing = getUniqueAssignees();
      const suggestions = [
        formatCreatedBy(gitUser),
        ...existing.filter((a) => a !== formatCreatedBy(gitUser)),
      ];

      // Show input with suggestions
      const assignee = await vscode.window.showQuickPick(
        [
          ...suggestions.map((s) => ({ label: s })),
          { label: '$(add) Enter custom name...', isCustom: true } as any,
        ],
        {
          placeHolder: 'Choose assignee...',
          title: `Assign ${selectedTasks.length} task(s)`,
        }
      );

      if (!assignee) return;

      let finalAssignee: string;
      if ((assignee as any).isCustom) {
        const custom = await vscode.window.showInputBox({
          prompt: 'Enter assignee name or email',
          placeHolder: 'e.g. john@company.com',
        });
        if (!custom) return;
        finalAssignee = custom.trim();
      } else {
        finalAssignee = assignee.label;
      }

      const count = assignTasks(
        selectedTasks.map((s) => s.task.id),
        finalAssignee
      );
      provider.refresh();
      vscode.window.showInformationMessage(
        `DevTasks: ${count} task(s) assigned to ${finalAssignee} 👤`
      );
    }
  );

  // 7. Mark task as done
  const markDoneCmd = vscode.commands.registerCommand(
    'todo.markDone',
    async (item?: TaskItem) => {
      if (item instanceof TaskItem) {
        const updated: Task = { ...item.task, status: 'done' };
        saveTask(updated);
        provider.refresh();
        vscode.window.showInformationMessage(`DevTasks: "${item.task.text}" marked done ✔️`);
        return;
      }

      const tasks = getAllTasks().filter((t) => t.status !== 'done');
      if (tasks.length === 0) {
        vscode.window.showInformationMessage('DevTasks: All tasks are already done!');
        return;
      }

      const picks = tasks.map((t) => ({
        label: t.text,
        description: `[${t.status}]`,
        task: t,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Mark tasks as done...',
        title: 'Complete Tasks',
      });

      if (!selected || selected.length === 0) return;

      saveTasks(selected.map((s) => ({ ...s.task, status: 'done' as TaskStatus })));
      provider.refresh();
      vscode.window.showInformationMessage(
        `DevTasks: ${selected.length} task(s) marked done ✔️`
      );
    }
  );

  // 8. Delete task
  const deleteCmd = vscode.commands.registerCommand(
    'todo.delete',
    async (item?: TaskItem) => {
      if (item instanceof TaskItem) {
        const confirm = await vscode.window.showWarningMessage(
          `Delete task: "${item.task.text}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm !== 'Delete') return;
        deleteTask(item.task.id);
        provider.refresh();
        return;
      }

      const tasks = getAllTasks();
      const picks = tasks.map((t) => ({
        label: t.text,
        description: `[${t.status}]`,
        task: t,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Select tasks to delete...',
        title: 'Delete Tasks',
      });

      if (!selected || selected.length === 0) return;

      const confirm = await vscode.window.showWarningMessage(
        `Delete ${selected.length} task(s)?`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') return;

      for (const s of selected) deleteTask(s.task.id);
      provider.refresh();
    }
  );

  // 9. Refresh
  const refreshCmd = vscode.commands.registerCommand('todo.refresh', () => {
    provider.refresh();
  });

  // 10. Parse TODO comments from active file
  const parseTodosCmd = vscode.commands.registerCommand(
    'todo.parseComments',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('DevTasks: No active file.');
        return;
      }

      const doc = editor.document;
      const text = doc.getText();
      const lines = text.split('\n');
      const filePath = getRelativePath(doc.uri.fsPath);
      const user = getGitUser();

      const todoPattern = /\/\/\s*TODO[:\s]+(.+)/i;
      const found: Task[] = [];

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(todoPattern);
        if (match) {
          found.push({
            id: generateId(),
            text: match[1].trim(),
            status: 'pending',
            filePath,
            line: i + 1,
            createdBy: formatCreatedBy(user),
            assignedTo: null,
            reviewBatchId: null,
            createdAt: Date.now(),
          });
        }
      }

      if (found.length === 0) {
        vscode.window.showInformationMessage(
          `DevTasks: No // TODO: comments found in ${filePath}`
        );
        return;
      }

      const picks = found.map((t) => ({
        label: t.text,
        description: `Line ${t.line}`,
        picked: true,
        task: t,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: `Found ${found.length} TODO comment(s) — select to import`,
        title: 'Import TODO Comments',
      });

      if (!selected || selected.length === 0) return;

      saveTasks(selected.map((s) => s.task));
      provider.refresh();
      vscode.window.showInformationMessage(
        `DevTasks: Imported ${selected.length} task(s) from ${filePath}`
      );
    }
  );

  // ── Register All ───────────────────────────────────────────────────────
  context.subscriptions.push(
    provider,
    treeView,
    addCmd,
    addFromSelectionCmd,
    openCmd,
    markForReviewCmd,
    confirmReviewCmd,
    assignBatchCmd,
    markDoneCmd,
    deleteCmd,
    refreshCmd,
    parseTodosCmd
  );
}

export function deactivate() {}
