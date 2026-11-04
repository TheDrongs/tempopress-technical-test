import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { User } from '../users/user.types.js';
import type { AuthRepository, SessionReplacement } from './auth.repository.js';
const COLUMNS =
  'u.id, u.name, u.role, u.created_at AS "createdAt", u.updated_at AS "updatedAt"';
@Injectable()
export class PgAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabaseService) {}
  async findCredentials(username: string) {
    const result = await this.database.query<
      User & { passwordHash: string | null }
    >(
      `SELECT ${COLUMNS}, u.password_hash AS "passwordHash" FROM users u WHERE u.username = $1`,
      [username],
    );
    const record = result.rows[0];
    if (!record) return null;
    const { passwordHash, ...user } = record;
    return { user, passwordHash };
  }
  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    replacement?: SessionReplacement,
  ) {
    return this.database.withTransaction(async () => {
      await this.database.query(
        'DELETE FROM auth_sessions WHERE expires_at <= NOW()',
      );
      if (replacement) {
        const removed = await this.database.query(
          'DELETE FROM auth_sessions WHERE token_hash = $1 RETURNING id',
          [replacement.tokenHash],
        );
        if (replacement.required && removed.rowCount !== 1) return false;
      }
      await this.database.query(
        'INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt],
      );
      return true;
    });
  }
  async findSessionUser(tokenHash: string): Promise<User | null> {
    const result = await this.database.query<User>(
      `SELECT ${COLUMNS} FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }
  async deleteSession(tokenHash: string) {
    await this.database.query(
      'DELETE FROM auth_sessions WHERE token_hash = $1',
      [tokenHash],
    );
  }
}
