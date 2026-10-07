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
import type { Member } from './member.entity.js';
import { CreateMemberDto, UpdateMemberDto } from './members.dto.js';
import { MembersService } from './members.service.js';

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Post()
  @Transactional()
  create(@Body() dto: CreateMemberDto): Promise<Member> {
    return this.members.create(dto);
  }

  @Get()
  list(@Query() query: PageQuery): Promise<Member[]> {
    return this.members.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Member> {
    return this.members.getById(id);
  }

  @Patch(':id')
  @Transactional()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto): Promise<Member> {
    return this.members.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Transactional()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.members.delete(id);
  }
}
