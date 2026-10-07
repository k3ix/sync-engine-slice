import type { DataSourceOptions, MixedList } from 'typeorm';
import { Issue } from '../issues/issue.entity.js';
import { Member } from '../members/member.entity.js';
import { Project } from '../projects/project.entity.js';
import { Change } from '../sync/change.entity.js';
import { CreateProjects1791400000001 } from './migrations/1791400000001-CreateProjects.js';
import { CreateMembers1791400000002 } from './migrations/1791400000002-CreateMembers.js';
import { CreateIssues1791400000003 } from './migrations/1791400000003-CreateIssues.js';
import { CreateChanges1791400000004 } from './migrations/1791400000004-CreateChanges.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

type ClassList = MixedList<new (...args: never[]) => object>;

export const ENTITIES: ClassList = [Project, Member, Issue, Change];
export const MIGRATIONS: ClassList = [
  CreateProjects1791400000001,
  CreateMembers1791400000002,
  CreateIssues1791400000003,
  CreateChanges1791400000004,
];

export function databaseOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  };
}
