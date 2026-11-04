import { ForbiddenException } from '@nestjs/common';
import type { User, UserRole } from './user.types.js';

export function requireRole(actor: User, role: UserRole): void {
  if (actor.role !== role) {
    throw new ForbiddenException('This action is not available for your role.');
  }
}
