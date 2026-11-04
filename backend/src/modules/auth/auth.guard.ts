import { ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { User } from '../users/user.types.js';
import { AuthService, SESSION_COOKIE } from './auth.service.js';
const PUBLIC_ROUTE = 'auth:public';
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE, true);
export interface AuthRequest extends Request {
  actor: User;
  sessionToken: string;
}
export function sessionToken(request: Request): string | undefined {
  const cookies = request.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim());
  return cookies
    ?.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      let originAllowed = true;
      try {
        if (request.get('origin'))
          originAllowed =
            new URL(request.get('origin')!).host === request.get('host');
      } catch {
        originAllowed = false;
      }
      if (request.get('sec-fetch-site') === 'cross-site' || !originAllowed)
        throw new ForbiddenException('Cross-origin request is not allowed.');
    }
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const token = sessionToken(request);
    request.actor = await this.auth.authenticate(token);
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    request.sessionToken = token!;
    return true;
  }
}
