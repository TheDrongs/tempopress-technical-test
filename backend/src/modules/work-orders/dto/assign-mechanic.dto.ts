import { IsUUID } from 'class-validator';

export class AssignMechanicDto {
  @IsUUID()
  mechanicId!: string;
}
