import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from './repositories/user.repository.js';
import type { UserRepository } from './repositories/user.repository.js';
import type { UserRole, UserSummary } from './user.types.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async findAll(): Promise<UserSummary[]> {
    return (await this.users.findAll()).map(({ id, name, role }) => ({
      id,
      name,
      role,
    }));
  }

  findById(id: string) {
    return this.users.findById(id);
  }

  findByRole(role: UserRole) {
    return this.users.findByRole(role);
  }
}
