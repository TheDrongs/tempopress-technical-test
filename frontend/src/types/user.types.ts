export type UserRole = 'ADMIN' | 'SPV' | 'MECHANIC'

export interface User {
  id: string
  name: string
  role: UserRole
}

export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  SPV: 'SPV',
  MECHANIC: 'Mechanic',
}
