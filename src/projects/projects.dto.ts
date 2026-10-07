import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { IsPatch } from '../common/is-patch.decorator.js';
import { PROJECT_STATUSES, type ProjectStatus } from './project.entity.js';

export class ProjectFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PROJECT_STATUSES })
  @IsIn(PROJECT_STATUSES)
  status: ProjectStatus;
}

export class CreateProjectDto extends OmitType(ProjectFieldsDto, ['status'] as const) {
  @ApiPropertyOptional({ enum: PROJECT_STATUSES, default: 'draft' })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;
}

@IsPatch()
export class UpdateProjectDto extends PartialType(ProjectFieldsDto) {}
