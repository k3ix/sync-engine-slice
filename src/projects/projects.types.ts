export const PROJECT_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectFields = { name: string; status: ProjectStatus };
export type CreateProjectInput = { name: string; status?: ProjectStatus };
export type UpdateProjectInput = Partial<ProjectFields>;
