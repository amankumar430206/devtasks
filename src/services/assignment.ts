import { readStore, writeStore } from './storage';

export function assignTasks(taskIds: string[], assignee: string): number {
  const store = readStore();
  let count = 0;

  store.tasks = store.tasks.map((task) => {
    if (taskIds.includes(task.id)) {
      count++;
      return {
        ...task,
        assignedTo: assignee,
        status: 'assigned',
      };
    }
    return task;
  });

  writeStore(store);
  return count;
}

export function getAssignedTasks(assignee: string) {
  const store = readStore();
  return store.tasks.filter((t) => t.assignedTo === assignee);
}

export function getUniqueAssignees(): string[] {
  const store = readStore();
  const assignees = store.tasks
    .map((t) => t.assignedTo)
    .filter((a): a is string => !!a);
  return [...new Set(assignees)];
}
