import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../../common/validation/trim-string.js';
import { PHOTO_KEY_PATTERN } from '../photos/photo.constants.js';
import { TEXT_LIMITS } from '../../../common/validation/text-limits.js';

export class SparepartItemDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEXT_LIMITS.sparepartName)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  qty!: number;

  // A client-side correlation key, never a storage path or database ID.
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(PHOTO_KEY_PATTERN)
  photoKey?: string;
}
