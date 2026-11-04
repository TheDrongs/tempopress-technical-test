import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TEXT_LIMITS } from '../../../common/validation/text-limits.js';

export class ApproveSparepartRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_LIMITS.approvalNote)
  approvalNote?: string | null;
}
