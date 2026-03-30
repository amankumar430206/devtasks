import * as vscode from 'vscode';
import { execSync } from 'child_process';

export function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  return folders[0].uri.fsPath;
}

export function getProjectName(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return 'No Workspace';
  }
  return folders[0].name;
}

export function getGitUser(): { name: string; email: string } {
  const root = getWorkspaceRoot();
  const cwd = root ?? process.cwd();

  let name = 'Unknown';
  let email = '';

  try {
    name = execSync('git config user.name', { cwd, encoding: 'utf8' }).trim();
  } catch {
    // fallback
  }

  try {
    email = execSync('git config user.email', { cwd, encoding: 'utf8' }).trim();
  } catch {
    // fallback
  }

  return { name, email };
}

export function formatCreatedBy(user: { name: string; email: string }): string {
  if (user.email) {
    return `${user.name} <${user.email}>`;
  }
  return user.name;
}

export function getRelativePath(absolutePath: string): string {
  const root = getWorkspaceRoot();
  if (!root) return absolutePath;
  return absolutePath.replace(root + require('path').sep, '');
}
