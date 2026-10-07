import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import type { Issue } from './issue.entity.js';
import { CreateIssueDto, ListIssuesQuery, UpdateIssueDto } from './issues.dto.js';
import { IssuesService } from './issues.service.js';

@ApiTags('issues')
@Controller('issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Post()
  @Transactional()
  create(@Body() dto: CreateIssueDto): Promise<Issue> {
    return this.issues.create(dto);
  }

  @Get()
  list(@Query() query: ListIssuesQuery): Promise<Issue[]> {
    return this.issues.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Issue> {
    return this.issues.getById(id);
  }

  @Patch(':id')
  @Transactional()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIssueDto): Promise<Issue> {
    return this.issues.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Transactional()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.issues.delete(id);
  }
}
