import { http } from './http'
import type { User } from '../types/user.types'

export async function getUsers(): Promise<User[]> {
  return (await http.get<User[]>('/users')).data
}
