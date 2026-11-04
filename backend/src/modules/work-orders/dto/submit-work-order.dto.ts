import { IsUUID, ValidateIf } from 'class-validator';

export class SubmitWorkOrderDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  spvId?: string;
}
