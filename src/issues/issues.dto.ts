import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { IsPatch } from '../common/is-patch.decorator.js';
import { PageQuery } from '../common/page.query.js';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
} from './issues.types.js';

export class IssueFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ format: 'email' })
  @IsEmail()
  assigneeEmail: string;

  @ApiProperty({ enum: ISSUE_PRIORITIES })
  @IsIn(ISSUE_PRIORITIES)
  priority: IssuePriority;

  @ApiProperty({ enum: ISSUE_STATUSES })
  @IsIn(ISSUE_STATUSES)
  status: IssueStatus;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;
}

export class CreateIssueDto extends OmitType(IssueFieldsDto, ['priority'] as const) {
  @ApiPropertyOptional({ enum: ISSUE_PRIORITIES, default: 'normal' })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;
}

@IsPatch()
export class UpdateIssueDto extends PartialType(IssueFieldsDto) {}

export class ListIssuesQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
