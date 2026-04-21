import { create } from 'zustand'
import { useAuthStore } from './auth'

interface WsState {
  connected: boolean
  reconnectAttempts: number
  maxReconnectAttempts: number
  connect: () => void
  disconnect: () => void
  onMessage: (handler: (data: any) => void) => void
}

let ws: WebSocket | null = null
let messageHandler: ((data: any) => void) | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export const useWsStore = create<WsState>((set, get) => ({
  connected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,

  connect: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated || ws?.readyState === WebSocket.OPEN) return

    // Build WS URL matching current page location for cookie scope
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`
    const wsUrl = `${host}/ws`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        set({ connected: true, reconnectAttempts: 0 })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            // initial ack, already handled in onopen
          } else if (messageHandler) {
            messageHandler(data)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        set({ connected: false })
        ws = null

        // Exponential backoff reconnect (max 5 attempts)
        const attempts = get().reconnectAttempts
        if (attempts < get().maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
          reconnectTimer = setTimeout(() => {
            set(s => ({ reconnectAttempts: s.reconnectAttempts + 1 }))
            get().connect()
          }, delay)
        }
      }

      ws.onerror = () => {
        // onerror is always followed by onclose, let onclose handle reconnect
        set({ connected: false })
      }
    } catch {
      set({ connected: false })
    }
  },

  disconnect: () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) {
      ws.onclose = null  // prevent reconnect on intentional close
      ws.close()
      ws = null
    }
    set({ connected: false, reconnectAttempts: 0 })
  },

  onMessage: (handler) => {
    messageHandler = handler
  },
}))

// Auto-connect when auth state becomes authenticated
let prevAuth = false
const pollAuth = setInterval(() => {
  const { isAuthenticated } = useAuthStore.getState()
  if (isAuthenticated && !prevAuth) {
    useWsStore.getState().connect()
  } else if (!isAuthenticated && prevAuth) {
    useWsStore.getState().disconnect()
  }
  prevAuth = isAuthenticated
}, 2000)

export function cleanupWsPoll() {
  clearInterval(pollAuth)
}