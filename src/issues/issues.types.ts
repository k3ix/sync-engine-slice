import type { Page } from '../common/page.types.js';

export const ISSUE_PRIORITIES = ['normal', 'urgent'] as const;
export const ISSUE_STATUSES = ['backlog', 'in_progress', 'done', 'cancelled'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export type IssueFields = {
  title: string;
  description: string;
  assigneeEmail: string;
  priority: IssuePriority;
  status: IssueStatus;
  projectId: string;
};
export type CreateIssueInput = Omit<IssueFields, 'priority'> & { priority?: IssuePriority };
export type UpdateIssueInput = Partial<IssueFields>;
export type ListIssues = Page & { projectId?: string };
