import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.guard.js';

// Populated only by the authenticated session guard; client headers are ignored.
export const ActiveUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown =>
    context.switchToHttp().getRequest<AuthRequest>().actor,
);
