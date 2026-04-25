import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE } from '../services/api'

interface User {
  id: number
  username: string
  nickname: string
  role: string
}

interface AuthState {
  user: User | null
  permissions: string[]
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      permissions: [],
      isAuthenticated: false,

      login: async (username: string, password: string): Promise<boolean> => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
          })
          const data = await res.json()
          if (data.success) {
            set({ user: data.user, isAuthenticated: true, permissions: [] })
            // fetch permissions
            get().checkSession()
            return true
          }
          return false
        } catch {
          return false
        }
      },

      logout: async () => {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        })
        set({ user: null, permissions: [], isAuthenticated: false })
      },

      checkSession: async () => {
        try {
          const [meRes, permRes] = await Promise.all([
            fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' }),
            fetch(`${API_BASE}/api/auth/me/permissions`, { credentials: 'include' }),
          ])
          if (meRes.ok && permRes.ok) {
            const user = await meRes.json()
            const permData = await permRes.json()
            if (user) {
              set({
                user,
                permissions: permData.permissions || [],
                isAuthenticated: true,
              })
            }
          }
        } catch {
          // ignore
        }
      },

      hasPermission: (permission: string) => {
        const { permissions } = get()
        // admin role has all permissions via the backend
        return permissions.includes(permission)
      },
    }),
    {
      name: 'omni-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
      }),
    }
  )
)
