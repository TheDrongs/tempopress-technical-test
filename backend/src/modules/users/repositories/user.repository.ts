import type { User, UserRole } from '../user.types.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByRole(role: UserRole): Promise<User[]>;
}
