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

export interface Task {
  id: number
  task_id: string
  name: string
  type: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  module: string
  creator_id: number
  result_summary: string
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface FileRecord {
  id: number
  file_id: string
  name: string
  original_name: string
  module: string
  owner_id: number
  size: number
  mime_type: string
  status: 'active' | 'archived' | 'deleted'
  created_at: string
}

export interface OperationLog {
  id: number
  action: string
  target_type: string
  target_id: string
  module: string
  operator_id: number
  detail: string
  result: 'success' | 'failed'
  created_at: string
}

export const modulesApi = {
  list: () => request<{ modules: Module[] }>('/api/modules'),
}

export const tasksApi = {
  list: (params?: { status?: string; module?: string; type?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.module) sp.set('module', params.module)
    if (params?.type) sp.set('type', params.type)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ tasks: Task[]; total: number }>(`/api/tasks?${sp}`)
  },
}

export const filesApi = {
  list: (params?: { module?: string; status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.module) sp.set('module', params.module)
    if (params?.status) sp.set('status', params.status)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ files: FileRecord[]; total: number }>(`/api/files?${sp}`)
  },
}

export const logsApi = {
  list: (params?: { action?: string; module?: string; result?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.action) sp.set('action', params.action)
    if (params?.module) sp.set('module', params.module)
    if (params?.result) sp.set('result', params.result)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ logs: OperationLog[]; total: number }>(`/api/logs?${sp}`)
  },
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
