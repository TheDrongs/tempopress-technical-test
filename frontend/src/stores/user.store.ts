import axios from 'axios'
import { create } from 'zustand'
import { getUsers } from '../api/users.api'
import * as auth from '../api/auth.api'
import { apiError, advanceSessionEpoch } from '../api/http'
import { useWorkOrderStore } from '../work-orders/stores/work-order.store'
import type { User, UserRole } from '../types/user.types'
interface UserState {
  users: User[]
  user: User | null
  activeUserId: string
  initialized: boolean
  loading: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchAccount: (
    username: string,
    password: string,
    expectedRole: UserRole,
  ) => Promise<boolean>
  clearError: () => void
  expire: () => void
}
let version = 0
export const useUserStore = create<UserState>((set, get) => {
  async function loadUsers(user: User, requestVersion: number) {
    try {
      const users = await getUsers()
      if (requestVersion === version) set({ users })
    } catch (error) {
      if (requestVersion === version)
        set({ users: [user], error: apiError(error) })
    }
  }
  return {
    users: [],
    user: null,
    activeUserId: '',
    initialized: false,
    loading: false,
    error: null,
    clearError: () => set({ error: null }),
    switchAccount: async (username, password, expectedRole) => {
      if (get().loading || !get().user) return false
      const previous = get().user!
      advanceSessionEpoch()
      const requestVersion = ++version
      set({ loading: true, error: null })
      try {
        const user = await auth.switchAccount(
          username.trim().toLowerCase(),
          password,
          expectedRole,
        )
        if (requestVersion !== version) return false
        useWorkOrderStore.getState().reset()
        set({ user, activeUserId: user.id, users: [user] })
        await loadUsers(user, requestVersion)
        return requestVersion === version
      } catch (error) {
        if (requestVersion !== version) return false
        // Wrong credentials leave the old session valid; reconcile before changing identity.
        try {
          const current = await auth.getSessionUser()
          if (requestVersion !== version) return false
          if (current.id !== previous.id) {
            useWorkOrderStore.getState().reset()
            set({ user: current, activeUserId: current.id, users: [current] })
            await loadUsers(current, requestVersion)
            if (current.role === expectedRole) return true
          }
          set({ error: apiError(error) })
        } catch (sessionError) {
          if (requestVersion !== version) return false
          if (
            axios.isAxiosError(sessionError) &&
            sessionError.response?.status === 401
          )
            get().expire()
          else set({ error: apiError(error) })
        }
        return false
      } finally {
        if (requestVersion === version) set({ loading: false })
      }
    },
    initialize: async () => {
      if (get().loading) return
      const requestVersion = ++version
      set({ loading: true, error: null })
      try {
        const user = await auth.getSessionUser()
        if (requestVersion !== version) return
        set({ user, activeUserId: user.id, users: [user] })
        await loadUsers(user, requestVersion)
      } catch (error) {
        if (requestVersion === version)
          set({
            user: null,
            activeUserId: '',
            users: [],
            error:
              axios.isAxiosError(error) && error.response?.status === 401
                ? null
                : apiError(error),
          })
      } finally {
        if (requestVersion === version)
          set({ initialized: true, loading: false })
      }
    },
    login: async (username, password) => {
      if (get().loading) return
      advanceSessionEpoch()
      const requestVersion = ++version
      set({ loading: true, error: null })
      try {
        const user = await auth.login(username.trim().toLowerCase(), password)
        if (requestVersion !== version) return
        useWorkOrderStore.getState().reset()
        set({ user, activeUserId: user.id, users: [user], initialized: true })
        await loadUsers(user, requestVersion)
      } catch (error) {
        if (requestVersion === version) set({ error: apiError(error) })
      } finally {
        if (requestVersion === version) set({ loading: false })
      }
    },
    logout: async () => {
      if (get().loading) return
      advanceSessionEpoch()
      set({ loading: true, error: null })
      try {
        await auth.logout()
        get().expire()
        set({ error: null })
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          get().expire()
          set({ error: null })
        } else set({ loading: false, error: apiError(error) })
      }
    },
    expire: () => {
      advanceSessionEpoch()
      ++version
      useWorkOrderStore.getState().reset()
      set({
        user: null,
        users: [],
        activeUserId: '',
        initialized: true,
        loading: false,
        error: 'Sesi Anda telah berakhir. Silakan login kembali.',
      })
    },
  }
})
