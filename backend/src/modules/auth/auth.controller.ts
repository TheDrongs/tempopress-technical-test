import { LoginDto } from './dto/login.dto.js';
import { SwitchLoginDto } from './dto/switch-login.dto.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { ActiveUser } from '../users/active-user.decorator.js';
import type { User } from '../users/user.types.js';
import {
  AuthService,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from './auth.service.js';
import { PublicRoute, sessionToken } from './auth.guard.js';
import type { AuthRequest } from './auth.guard.js';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.AUTH_COOKIE_SECURE === 'true',
    path: '/api',
  };
}
function summary(user: User) {
  return { id: user.id, name: user.name, role: user.role };
}
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @PublicRoute()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.username, input.password, {
      oldToken: sessionToken(request),
    });
    response.cookie(SESSION_COOKIE, result.token, {
      ...cookieOptions(),
      maxAge: SESSION_MAX_AGE,
    });
    response.setHeader('Cache-Control', 'no-store');
    return summary(result.user);
  }
  @Post('switch')
  @HttpCode(200)
  async switchAccount(
    @Body() input: SwitchLoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.username, input.password, {
      oldToken: request.sessionToken,
      expectedRole: input.expectedRole,
      requireOldSession: true,
    });
    response.cookie(SESSION_COOKIE, result.token, {
      ...cookieOptions(),
      maxAge: SESSION_MAX_AGE,
    });
    response.setHeader('Cache-Control', 'no-store');
    return summary(result.user);
  }
  @Get('me')
  me(@ActiveUser() user: User, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return summary(user);
  }
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.sessionToken);
    response.clearCookie(SESSION_COOKIE, cookieOptions());
  }
}
