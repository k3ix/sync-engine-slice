import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateNested,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { IssueFieldsDto, UpdateIssueDto } from '../issues/issues.dto.js';
import { MemberFieldsDto, UpdateMemberDto } from '../members/members.dto.js';
import { ProjectFieldsDto, UpdateProjectDto } from '../projects/projects.dto.js';
import { ACTIONS, type Action, type Fields, isModel, MODELS, type Model } from './sync.types.js';

export const MAX_BATCH = 100;

type DtoClass = new () => object;

export const DATA_DTOS: Record<Model, { create: DtoClass; update: DtoClass }> = {
  projects: { create: ProjectFieldsDto, update: UpdateProjectDto },
  issues: { create: IssueFieldsDto, update: UpdateIssueDto },
  members: { create: MemberFieldsDto, update: UpdateMemberDto },
};

function dataDtoFor({ model, action }: Record<string, unknown>): DtoClass {
  if (!isModel(model)) {
    return Object;
  }
  return action === 'update' ? DATA_DTOS[model].update : DATA_DTOS[model].create;
}

@ValidatorConstraint({ name: 'dataMatchesAction' })
class DataMatchesAction implements ValidatorConstraintInterface {
  validate(action: unknown, { object }: ValidationArguments): boolean {
    const hasData = 'data' in object && object.data !== undefined && object.data !== null;
    return action === 'delete' ? !hasData : hasData;
  }

  defaultMessage(): string {
    return 'data is required for create and update and not allowed for delete';
  }
}

const DATA_DTO_CLASSES = Object.values(DATA_DTOS).flatMap(({ create, update }) => [create, update]);

@ApiExtraModels(...DATA_DTO_CLASSES)
export class ChangeDto {
  @ApiProperty({ enum: MODELS })
  @IsIn(MODELS)
  model: Model;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recordId: string;

  @ApiProperty({ enum: ACTIONS })
  @IsIn(ACTIONS)
  @Validate(DataMatchesAction)
  action: Action;

  @ApiPropertyOptional({ oneOf: DATA_DTO_CLASSES.map((dto) => ({ $ref: getSchemaPath(dto) })) })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type((options) => dataDtoFor(options?.object ?? {}))
  data?: Fields;

  @ApiProperty({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  clientTimestamp: number;
}

export class PushChangesDto {
  @ApiProperty({ type: [ChangeDto], minItems: 1, maxItems: MAX_BATCH })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => ChangeDto)
  changes: ChangeDto[];
}
