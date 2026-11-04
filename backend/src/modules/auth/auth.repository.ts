import type { User } from '../users/user.types.js';
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
export interface SessionReplacement {
  tokenHash: string;
  required: boolean;
}
export interface AuthRepository {
  findCredentials(
    username: string,
  ): Promise<{ user: User; passwordHash: string | null } | null>;
  createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    replacement?: SessionReplacement,
  ): Promise<boolean>;
  findSessionUser(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
}
