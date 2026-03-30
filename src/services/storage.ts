import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Task, TodoStore } from "../models/task";
import { getWorkspaceRoot } from "../utils/project";
import { randomUUID } from "crypto";

const STORE_FILENAME = "todos.json";
const STORE_VERSION = 1;

function getStorePath(): string | null {
  const root = getWorkspaceRoot();
  if (!root) return null;
  return path.join(root, ".vscode", STORE_FILENAME);
}

function ensureVscodeDirExists(storePath: string): void {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readStore(): TodoStore {
  const storePath = getStorePath();
  if (!storePath) {
    return { tasks: [], version: STORE_VERSION };
  }

  if (!fs.existsSync(storePath)) {
    return { tasks: [], version: STORE_VERSION };
  }

  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as TodoStore;

    // Validate structure
    if (!Array.isArray(parsed.tasks)) {
      return { tasks: [], version: STORE_VERSION };
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const deduped = parsed.tasks.filter((t) => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return { tasks: deduped, version: parsed.version ?? STORE_VERSION };
  } catch {
    vscode.window.showWarningMessage("DevTasks: Could not parse todos.json — starting fresh.");
    return { tasks: [], version: STORE_VERSION };
  }
}

export function writeStore(store: TodoStore): void {
  const storePath = getStorePath();
  if (!storePath) {
    vscode.window.showErrorMessage("DevTasks: No workspace open. Open a folder to save tasks.");
    return;
  }

  try {
    ensureVscodeDirExists(storePath);
    // Atomic write via temp file
    const tempPath = storePath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tempPath, storePath);
  } catch (err) {
    vscode.window.showErrorMessage(`DevTasks: Failed to save tasks — ${err}`);
  }
}

export function generateId(): string {
  // Use uuid v4 if available, otherwise fallback
  try {
    // return uuidv4();
    return randomUUID();
  } catch {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function getAllTasks(): Task[] {
  return readStore().tasks;
}

export function saveTask(task: Task): void {
  const store = readStore();
  const idx = store.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    store.tasks[idx] = task;
  } else {
    store.tasks.push(task);
  }
  writeStore(store);
}

export function saveTasks(tasks: Task[]): void {
  const store = readStore();
  for (const task of tasks) {
    const idx = store.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      store.tasks[idx] = task;
    } else {
      store.tasks.push(task);
    }
  }
  writeStore(store);
}

export function deleteTask(id: string): void {
  const store = readStore();
  store.tasks = store.tasks.filter((t) => t.id !== id);
  writeStore(store);
}
