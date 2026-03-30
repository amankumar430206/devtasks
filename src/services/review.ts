import { Task } from '../models/task';
import { readStore, writeStore } from './storage';

export function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function markTasksForReview(taskIds: string[]): string {
  const batchId = generateBatchId();
  const store = readStore();

  store.tasks = store.tasks.map((task) => {
    if (taskIds.includes(task.id) && task.status === 'pending') {
      return { ...task, status: 'review', reviewBatchId: batchId };
    }
    return task;
  });

  writeStore(store);
  return batchId;
}

export function confirmReviewBatch(batchId: string): number {
  const store = readStore();
  let count = 0;

  store.tasks = store.tasks.map((task) => {
    if (task.reviewBatchId === batchId && task.status === 'review') {
      count++;
      return { ...task, status: 'confirmed' };
    }
    return task;
  });

  writeStore(store);
  return count;
}

export function getReviewQueue(): Task[] {
  const store = readStore();
  return store.tasks.filter((t) => t.status === 'review');
}

export function getTasksByBatch(batchId: string): Task[] {
  const store = readStore();
  return store.tasks.filter((t) => t.reviewBatchId === batchId);
}
