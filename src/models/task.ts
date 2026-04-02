export type TaskStatus = "pending" | "review" | "confirmed" | "assigned" | "done";

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  filePath: string | null;
  line: number | null; // 1-indexed start line
  lineEnd: number | null; // 1-indexed end line (equals line if single-line selection)
  createdBy: string;
  assignedTo: string | null;
  reviewBatchId: string | null;
  createdAt: number;
  tags?: string[];
}

export interface TodoStore {
  tasks: Task[];
  version: number;
}

export const STATUS_ORDER: TaskStatus[] = ["pending", "review", "confirmed", "assigned", "done"];

export const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: "⏳",
  review: "🔍",
  confirmed: "✅",
  assigned: "👤",
  done: "✔️",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  review: "In Review",
  confirmed: "Confirmed",
  assigned: "Assigned",
  done: "Done",
};
