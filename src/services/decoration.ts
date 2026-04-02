import * as vscode from "vscode";
import * as path from "path";
import { getAllTasks } from "./storage";
import { getWorkspaceRoot } from "../utils/project";

// ─── Decoration Types ────────────────────────────────────────────────────────

const pendingDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor("diffEditor.insertedLineBackground"),
  isWholeLine: true,
  overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    margin: "0 0 0 2em",
    color: new vscode.ThemeColor("editorWarning.foreground"),
  },
});

const reviewDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(14, 124, 123, 0.08)",
  isWholeLine: true,
  overviewRulerColor: "#0E7C7B",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    margin: "0 0 0 2em",
    color: "#0E7C7B",
  },
});

const assignedDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(99, 102, 241, 0.08)",
  isWholeLine: true,
  overviewRulerColor: "#6366F1",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    margin: "0 0 0 2em",
    color: "#6366F1",
  },
});

const doneDecoration = vscode.window.createTextEditorDecorationType({
  opacity: "0.5",
  isWholeLine: true,
  after: {
    margin: "0 0 0 2em",
    color: new vscode.ThemeColor("editorHint.foreground"),
  },
});

// ─── Decoration Manager ──────────────────────────────────────────────────────

export class DecorationManager {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.decorate(editor);
        }
      }),
    );
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        editors.forEach((e) => this.decorate(e));
      }),
    );
    vscode.window.visibleTextEditors.forEach((e) => this.decorate(e));
  }

  refresh(): void {
    vscode.window.visibleTextEditors.forEach((e) => this.decorate(e));
  }

  private decorate(editor: vscode.TextEditor): void {
    const root = getWorkspaceRoot();
    if (!root) {
      return;
    }

    const editorRelPath = editor.document.uri.fsPath.replace(root + path.sep, "").replace(root + "/", "");

    const tasks = getAllTasks().filter((t) => t.filePath && t.line != null && t.filePath === editorRelPath);

    const pendingRanges: vscode.DecorationOptions[] = [];
    const reviewRanges: vscode.DecorationOptions[] = [];
    const assignedRanges: vscode.DecorationOptions[] = [];
    const doneRanges: vscode.DecorationOptions[] = [];

    for (const task of tasks) {
      if (task.line == null) {
        continue;
      }

      // ── Key fix: use lineEnd for multi-line range ──────────────────────
      const startLine = Math.max(0, task.line - 1); // 0-indexed
      const endLine =
        task.lineEnd != null
          ? Math.max(startLine, task.lineEnd - 1) // 0-indexed end
          : startLine; // fallback: same line

      // Build a range spanning ALL selected lines
      // Character 0 to end-of-line on the last line
      const lastLineLength = editor.document.lineAt(Math.min(endLine, editor.document.lineCount - 1)).text.length;

      const range = new vscode.Range(startLine, 0, endLine, lastLineLength);

      // Inline annotation only on the first line (after text)
      const decoration: vscode.DecorationOptions = {
        range,
        renderOptions: {
          after: {
            contentText: `  ◀  ${task.text.slice(0, 48)}${task.text.length > 48 ? "…" : ""}`,
            fontStyle: "italic",
          },
        },
        hoverMessage: new vscode.MarkdownString(
          `**DevTask** — ${task.text}\n\n` +
            `**Status:** \`${task.status}\`  \n` +
            `**Lines:** ${task.line}${task.lineEnd && task.lineEnd !== task.line ? `–${task.lineEnd}` : ""}  \n` +
            `**Created by:** ${task.createdBy}` +
            (task.assignedTo ? `\n\n**Assigned to:** ${task.assignedTo}` : ""),
        ),
      };

      if (task.status === "pending") {
        pendingRanges.push(decoration);
      } else if (task.status === "review" || task.status === "confirmed") {
        reviewRanges.push(decoration);
      } else if (task.status === "assigned") {
        assignedRanges.push(decoration);
      } else if (task.status === "done") {
        doneRanges.push(decoration);
      }
    }

    editor.setDecorations(pendingDecoration, pendingRanges);
    editor.setDecorations(reviewDecoration, reviewRanges);
    editor.setDecorations(assignedDecoration, assignedRanges);
    editor.setDecorations(doneDecoration, doneRanges);
  }

  dispose(): void {
    pendingDecoration.dispose();
    reviewDecoration.dispose();
    assignedDecoration.dispose();
    doneDecoration.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
