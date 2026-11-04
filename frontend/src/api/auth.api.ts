import { http } from './http'
import type { User, UserRole } from '../types/user.types'
export async function switchAccount(
  username: string,
  password: string,
  expectedRole: UserRole,
): Promise<User> {
  return (
    await http.post<User>('/auth/switch', { username, password, expectedRole })
  ).data
}
export async function getSessionUser(): Promise<User> {
  return (await http.get<User>('/auth/me')).data
}
export async function login(username: string, password: string): Promise<User> {
  return (await http.post<User>('/auth/login', { username, password })).data
}
export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
