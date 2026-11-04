import type { DatabaseService } from '../database.service.js';
import { UserRole } from '../../modules/users/user.types.js';
import { hashPassword } from '../../modules/auth/password.js';

export const DEMO_ACCOUNTS = {
  ADMIN: { username: 'admin', password: 'admin123' },
  SPV: { username: 'spv', password: 'spv123' },
  MECHANIC: { username: 'mekanik', password: 'mekanik123' },
};

export const DEMO_USERS = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Admin Demo',
    role: UserRole.ADMIN,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'SPV Demo',
    role: UserRole.SPV,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Mechanic Demo',
    role: UserRole.MECHANIC,
  },
] as const;

export async function seedDemoUsers(
  database: DatabaseService,
  includeCredentials = true,
): Promise<number> {
  return database.withTransaction(async () => {
    await database.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [1413827920, 1397048644],
    );
    let inserted = 0;

    for (const user of DEMO_USERS) {
      const result = await database.query(
        `INSERT INTO users (id, name, role) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [user.id, user.name, user.role],
      );
      inserted += result.rowCount ?? 0;

      const existing = await database.query<{ role: UserRole }>(
        'SELECT role FROM users WHERE id = $1',
        [user.id],
      );
      if (existing.rows[0]?.role !== user.role) {
        throw new Error(
          `Demo user ID ${user.id} is already used by a different role. No user data was overwritten.`,
        );
      }
      if (includeCredentials) {
        const credentials = await database.query<{ missing: boolean }>(
          'SELECT (username IS NULL OR username = $2) AND password_hash IS NULL AS missing FROM users WHERE id = $1',
          [user.id, DEMO_ACCOUNTS[user.role].username],
        );
        if (credentials.rows[0]?.missing) {
          await database.query(
            'UPDATE users SET username = $1, password_hash = $2 WHERE id = $3',
            [
              DEMO_ACCOUNTS[user.role].username,
              await hashPassword(DEMO_ACCOUNTS[user.role].password),
              user.id,
            ],
          );
        }
      }
    }
    return inserted;
  });
}
