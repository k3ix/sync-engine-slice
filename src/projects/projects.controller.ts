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
import { PageQuery } from '../common/page.query.js';
import type { Project } from './project.entity.js';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @Transactional()
  create(@Body() dto: CreateProjectDto): Promise<Project> {
    return this.projects.create(dto);
  }

  @Get()
  list(@Query() query: PageQuery): Promise<Project[]> {
    return this.projects.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Project> {
    return this.projects.getById(id);
  }

  @Patch(':id')
  @Transactional()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto): Promise<Project> {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Transactional()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.projects.delete(id);
  }
}
