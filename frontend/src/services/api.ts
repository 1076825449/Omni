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

export interface AnalysisTask {
  id: number
  task_id: string
  name: string
  description: string
  status: string
  file_count: number
  created_at: string
}

export interface AnalysisTaskDetail {
  id: number
  task_id: string
  name: string
  description: string
  status: string
  result_summary: string
  file_count: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaskCreatedResponse {
  success: boolean
  message: string
  task_id: string
}

export interface BackupRecord {
  id: number
  backup_id: string
  name: string
  type: string
  status: string
  file_size: number
  note: string
  created_at: string
  completed_at: string | null
}

export const backupApi = {
  create: (name: string, note?: string) =>
    request<{ success: boolean; message: string; backup_id: string }>('/api/platform/backup?name=' + encodeURIComponent(name) + (note ? '&note=' + encodeURIComponent(note) : ''), { method: 'POST' }),
  list: () => request<{ backups: BackupRecord[]; total: number }>('/api/platform/backups'),
  downloadUrl: (backupId: string) => 'http://localhost:3000/api/platform/backups/' + backupId + '/download',
}

export const analysisApi = {
  createTask: (name: string, description: string) =>
    request<TaskCreatedResponse>('/api/modules/analysis-workbench/tasks', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  listTasks: () =>
    request<{ tasks: AnalysisTask[]; total: number }>('/api/modules/analysis-workbench/tasks'),
  getTask: (taskId: string) =>
    request<AnalysisTaskDetail>('/api/modules/analysis-workbench/tasks/' + taskId),
  cancelTask: (taskId: string) =>
    request<{ success: boolean }>('/api/modules/analysis-workbench/tasks/' + taskId + '/cancel', { method: 'POST' }),
  runTask: (taskId: string) =>
    request<{ success: boolean }>('/api/modules/analysis-workbench/tasks/' + taskId + '/run', { method: 'POST' }),
  uploadFile: (taskId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch('http://localhost:3000/api/modules/analysis-workbench/upload?task_id=' + taskId, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(r => r.json())
  },
}

export interface RoleRecord {
  id: number
  name: string
  display_name: string
  description: string
  permissions: string[]
  is_active: boolean
}

export const rolesApi = {
  list: () => request<{ roles: RoleRecord[] }>('/api/platform/roles'),
  getPermissions: () => request<{ permissions: string[]; defaults: Record<string, string[]> }>('/api/platform/roles/permissions'),
  update: (name: string, data: { display_name: string; description: string; permissions: string[] }) =>
    request<{ success: boolean }>('/api/platform/roles/' + name, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

export interface NotificationRecord {
  id: number
  title: string
  content: string
  type: string
  is_read: boolean
  created_at: string
}

export interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string
  url: string
}

export const notificationsApi = {
  list: () => request<{ notifications: NotificationRecord[]; total: number; unread_count: number }>('/api/notifications'),
  markRead: (id: number) => request<{ success: boolean }>('/api/notifications/' + id + '/read', { method: 'POST' }),
  markAllRead: () => request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
}

export const searchApi = {
  search: (q: string) => request<{ query: string; results: SearchResult[]; total: number }>('/api/search?q=' + encodeURIComponent(q)),
}

export const platformStatsApi = {
  overview: () => request<any>('/api/platform/stats/overview'),
  taskStats: () => request<any>('/api/platform/stats/task-stats'),
  recentActivity: () => request<any>('/api/platform/stats/recent-activity'),
}

export const fileCenterApi = {
  list: (params?: { module?: string; status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.module) sp.set('module', params.module)
    if (params?.status) sp.set('status', params.status)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ files: any[]; total: number }>('/api/files?' + sp)
  },
  archive: (fileId: string) => request<{ success: boolean }>('/api/files/' + fileId + '/archive', { method: 'POST' }),
}

export interface RecordItem {
  id: number
  record_id: string
  name: string
  category: string
  assignee: string
  status: string
  tags: string
  detail: string
  import_batch: string
  owner_id: number
  created_at: string
  updated_at: string
}

export const recordsApi = {
  list: (params?: { category?: string; status?: string; assignee?: string; q?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.category) sp.set('category', params.category)
    if (params?.status) sp.set('status', params.status)
    if (params?.assignee) sp.set('assignee', params.assignee)
    if (params?.q) sp.set('q', params.q)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ records: RecordItem[]; total: number }>('/api/modules/record-operations/records?' + sp)
  },
  create: (data: { name: string; category?: string; assignee?: string; tags?: string; detail?: string }) =>
    request<RecordItem>('/api/modules/record-operations/records', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<RecordItem>('/api/modules/record-operations/records/' + id),
  update: (id: string, data: Partial<RecordItem>) =>
    request<RecordItem>('/api/modules/record-operations/records/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>('/api/modules/record-operations/records/' + id + '/delete', { method: 'POST' }),
  batchUpdate: (record_ids: string[], data: { category?: string; assignee?: string; status?: string }) =>
    request<{ success: boolean; message: string }>('/api/modules/record-operations/batch-update', { method: 'POST', body: JSON.stringify({ record_ids, ...data }) }),
  importFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch('http://localhost:3000/api/modules/record-operations/import', {
      method: 'POST', credentials: 'include', body: form,
    }).then(r => r.json())
  },
  stats: () => request<{ total: number; active: number; categories: number }>('/api/modules/record-operations/stats'),
}
