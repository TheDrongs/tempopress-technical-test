import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TEXT_LIMITS } from '../../../common/validation/text-limits.js';
import { trimString } from '../../../common/validation/trim-string.js';

export class CreateWorkOrderDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEXT_LIMITS.title)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_LIMITS.description)
  description?: string | null;
}
