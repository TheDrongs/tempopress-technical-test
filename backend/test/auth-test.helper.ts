import { createHash } from 'node:crypto';
import type { DatabaseService } from '../src/database/database.service.js';
import { SESSION_COOKIE, tokenHash } from '../src/modules/auth/auth.service.js';
export function testCookie(id: string): string {
  return `${SESSION_COOKIE}=${createHash('sha256').update(`test-session:${id}`).digest('hex')}`;
}
export async function seedTestSessions(
  database: DatabaseService,
): Promise<void> {
  for (const { id } of (
    await database.query<{ id: string }>('SELECT id FROM users')
  ).rows) {
    const token = testCookie(id).split('=')[1];
    await database.query(
      "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour') ON CONFLICT (token_hash) DO NOTHING",
      [id, tokenHash(token)],
    );
  }
}
