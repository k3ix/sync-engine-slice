import { Module } from '@nestjs/common';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';

@Module({
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
