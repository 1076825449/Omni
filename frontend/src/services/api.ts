const API_BASE = 'http://localhost:3000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export interface Module {
  id: number
  key: string
  name: string
  description: string
  type: 'workflow' | 'list' | 'interactive'
  priority: 'high' | 'medium' | 'low'
  status: 'active' | 'developing' | 'offline'
  icon: string
  is_active: boolean
}

export const modulesApi = {
  list: () => request<{ modules: Module[] }>('/api/modules'),
}

export const authApi = {
  login: (username: string, password: string) =>
    request<{ success: boolean; message: string; user?: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    request<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<any>('/api/auth/me'),
}
