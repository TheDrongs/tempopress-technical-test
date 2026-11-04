import { IsEnum } from 'class-validator';
import { UserRole } from '../../users/user.types.js';
import { LoginDto } from './login.dto.js';
export class SwitchLoginDto extends LoginDto {
  @IsEnum(UserRole)
  expectedRole!: UserRole;
}
