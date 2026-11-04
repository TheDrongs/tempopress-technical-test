import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type { User, UserRole } from '../user.types.js';
import type { UserRepository } from './user.repository.js';

const COLUMNS =
  'id, name, role, created_at AS "createdAt", updated_at AS "updatedAt"';

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAll(): Promise<User[]> {
    const result = await this.database.query<User>(`
      SELECT ${COLUMNS} FROM users
      ORDER BY CASE role WHEN 'ADMIN' THEN 0 WHEN 'SPV' THEN 1 ELSE 2 END, name, id
    `);
    return result.rows;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.database.query<User>(
      `SELECT ${COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const result = await this.database.query<User>(
      `SELECT ${COLUMNS} FROM users WHERE role = $1 ORDER BY name, id`,
      [role],
    );
    return result.rows;
  }
}
