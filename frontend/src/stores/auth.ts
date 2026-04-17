import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  username: string
  nickname: string
  role: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

const API_BASE = 'http://localhost:3000'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
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
            set({ user: data.user, isAuthenticated: true })
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
        set({ user: null, isAuthenticated: false })
      },

      checkSession: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            credentials: 'include',
          })
          if (res.ok) {
            const user = await res.json()
            if (user) {
              set({ user, isAuthenticated: true })
            }
          }
        } catch {
          // ignore
        }
      },
    }),
    {
      name: 'omni-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
