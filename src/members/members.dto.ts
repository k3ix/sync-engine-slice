import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { IsPatch } from '../common/is-patch.decorator.js';
import { MEMBER_STATUSES, type MemberStatus } from './members.types.js';

export class MemberFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: MEMBER_STATUSES })
  @IsIn(MEMBER_STATUSES)
  status: MemberStatus;
}

export class CreateMemberDto extends OmitType(MemberFieldsDto, ['status'] as const) {
  @ApiPropertyOptional({ enum: MEMBER_STATUSES, default: 'invited' })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(MEMBER_STATUSES)
  status?: MemberStatus;
}

@IsPatch()
export class UpdateMemberDto extends PartialType(MemberFieldsDto) {}
