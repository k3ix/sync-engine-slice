import { Module } from '@nestjs/common';
import { IssuesModule } from '../issues/issues.module.js';
import { IssuesService } from '../issues/issues.service.js';
import { MembersModule } from '../members/members.module.js';
import { MembersService } from '../members/members.service.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ChangesService } from './changes.service.js';
import { SyncController } from './sync.controller.js';
import { type Model, SYNC_TARGETS, type SyncTarget } from './sync.types.js';
import { SyncWorker } from './sync.worker.js';

@Module({
  imports: [ProjectsModule, IssuesModule, MembersModule],
  controllers: [SyncController],
  providers: [
    ChangesService,
    SyncWorker,
    {
      provide: SYNC_TARGETS,
      inject: [ProjectsService, IssuesService, MembersService],
      useFactory: (
        projects: ProjectsService,
        issues: IssuesService,
        members: MembersService,
      ): Record<Model, SyncTarget> => ({ projects, issues, members }),
    },
  ],
})
export class SyncModule {}
