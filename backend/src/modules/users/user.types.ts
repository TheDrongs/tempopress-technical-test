export enum UserRole {
  ADMIN = 'ADMIN',
  SPV = 'SPV',
  MECHANIC = 'MECHANIC',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserSummary = Pick<User, 'id' | 'name' | 'role'>;
