import { create } from 'zustand'
import { notificationsApi } from '../services/api'

interface NotificationState {
  unreadCount: number
  total: number
  lastFetched: number | null
  fetch: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  total: 0,
  lastFetched: null,

  fetch: async () => {
    try {
      const data = await notificationsApi.list()
      set({
        unreadCount: data.unread_count,
        total: data.total,
        lastFetched: Date.now(),
      })
    } catch {
      // ignore
    }
  },

  markRead: async (id: number) => {
    await notificationsApi.markRead(id)
    set(s => ({ unreadCount: Math.max(0, s.unreadCount - 1) }))
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead()
    set({ unreadCount: 0 })
  },
}))
