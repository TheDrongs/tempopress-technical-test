import { createHash, randomBytes } from 'node:crypto';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { UserRole } from '../users/user.types.js';
import { AUTH_REPOSITORY } from './auth.repository.js';
import type { AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'tempopress_session';
export const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
const dummyPassword = hashPassword('unused-account-password');
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
  ) {}
  async login(
    username: string,
    password: string,
    options: {
      oldToken?: string;
      expectedRole?: UserRole;
      requireOldSession?: boolean;
    } = {},
  ) {
    const credentials = await this.repository.findCredentials(username);
    const matches = await verifyPassword(
      password,
      credentials?.passwordHash ?? (await dummyPassword),
    );
    if (!credentials?.passwordHash || !matches)
      throw new UnauthorizedException('Username atau password tidak sesuai.');
    if (options.expectedRole && credentials.user.role !== options.expectedRole)
      throw new ForbiddenException('Akun tidak sesuai role yang dipilih.');
    if (options.requireOldSession && !options.oldToken)
      throw new UnauthorizedException('Sesi berakhir. Silakan login kembali.');
    const token = randomBytes(32).toString('hex');
    const created = await this.repository.createSession(
      credentials.user.id,
      tokenHash(token),
      new Date(Date.now() + SESSION_MAX_AGE),
      options.oldToken
        ? {
            tokenHash: tokenHash(options.oldToken),
            required: Boolean(options.requireOldSession),
          }
        : undefined,
    );
    if (!created)
      throw new UnauthorizedException('Sesi berakhir. Silakan login kembali.');
    return { user: credentials.user, token };
  }
  async authenticate(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Silakan login terlebih dahulu.');
    const user = await this.repository.findSessionUser(tokenHash(token));
    if (!user)
      throw new UnauthorizedException('Sesi berakhir. Silakan login kembali.');
    return user;
  }
  async logout(token: string) {
    await this.repository.deleteSession(tokenHash(token));
  }
}
