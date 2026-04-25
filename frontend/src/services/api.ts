const DEFAULT_API_HOST =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : '127.0.0.1'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${DEFAULT_API_HOST}:3000`

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

async function requestText(path: string, options?: RequestInit): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export interface Module {
  id: number
  key: string
  name: string
  description: string
  type: 'workflow' | 'list' | 'interactive' | 'dashboard'
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

export interface TaskDetail extends Task {
  file_count: number
  log_count: number
  related_record_count: number
  source_url: string | null
  source_label: string | null
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

export interface FilePreview {
  file_id: string
  original_name: string
  mime_type: string
  preview_type: string
  content?: string | null
  preview_url?: string | null
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
  list: (params?: { q?: string; status?: string; module?: string; type?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.status) sp.set('status', params.status)
    if (params?.module) sp.set('module', params.module)
    if (params?.type) sp.set('type', params.type)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ tasks: Task[]; total: number }>(`/api/tasks?${sp}`)
  },
  get: (taskId: string) => request<TaskDetail>('/api/tasks/' + taskId),
}

export const filesApi = {
  list: (params?: { q?: string; module?: string; status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.module) sp.set('module', params.module)
    if (params?.status) sp.set('status', params.status)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ files: FileRecord[]; total: number }>(`/api/files?${sp}`)
  },
  archive: (fileId: string) => request<{ success: boolean; message: string }>('/api/files/' + fileId + '/archive', { method: 'POST' }),
  preview: (fileId: string) => request<FilePreview>('/api/files/' + fileId + '/preview'),
}

export const logsApi = {
  list: (params?: { q?: string; action?: string; module?: string; result?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
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
  files: string[]
  related_record_count: number
  related_record_ids: string[]
  log_count: number
  company_name: string
  taxpayer_id: string
  periods: string[]
  risk_count: number
  risks: AnalysisRisk[]
  material_gap_list: string[]
  taxpayer_profile?: TaxpayerProfile | null
  data_warnings: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaxpayerProfile {
  taxpayer_id: string
  company_name: string
  legal_person?: string
  taxpayer_type?: string
  registration_status?: string
  industry: string
  region: string
  tax_bureau: string
  manager_department: string
  tax_officer: string
  credit_rating: string
  risk_level: string
  address?: string
  phone?: string
  business_scope?: string
  source_batch?: string
  created_at?: string
  updated_at?: string
}

export interface AnalysisRisk {
  risk_type: string
  severity: string
  period: string
  issue: string
  evidence: string[]
  confidence: number
  metrics: Record<string, number>
  rectify_advice: string
  notice_basis_data: string
  verification_focus: string
  required_materials: string[]
  judgment_rule: string
  review_record_id?: string | null
  review_status?: string
}

export interface UploadProfile {
  dataset_kind: string
  source_type: string
  row_count: number
  headers: string[]
  required_fields: string[]
  missing_required_fields: string[]
  warnings: string[]
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
  downloadUrl: (backupId: string) => API_BASE + '/api/platform/backups/' + backupId + '/download',
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
  rerunTask: (taskId: string) =>
    request<TaskCreatedResponse>('/api/modules/analysis-workbench/tasks/' + taskId + '/rerun', { method: 'POST' }),
  cancelTask: (taskId: string) =>
    request<{ success: boolean }>('/api/modules/analysis-workbench/tasks/' + taskId + '/cancel', { method: 'POST' }),
  runTask: (taskId: string) =>
    request<{ success: boolean }>('/api/modules/analysis-workbench/tasks/' + taskId + '/run', { method: 'POST' }),
  uploadFile: (taskId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(API_BASE + '/api/modules/analysis-workbench/upload?task_id=' + taskId, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(r => r.json() as Promise<{ success: boolean; message: string; file_id: string; profile: UploadProfile }>)
  },
  addManualData: (taskId: string, dataKind: 'vat_return' | 'cit_return' | 'pit_return', row: Record<string, string | number>) =>
    request<{ success: boolean; message: string; file_id: string; profile: UploadProfile }>(
      '/api/modules/analysis-workbench/tasks/' + taskId + '/manual-data',
      {
        method: 'POST',
        body: JSON.stringify({ data_kind: dataKind, rows: [row] }),
      },
    ),
  updateRiskReview: (taskId: string, recordId: string, status: string, note = '') =>
    request<{ success: boolean; record_id: string; status: string }>(
      '/api/modules/analysis-workbench/tasks/' + taskId + '/risks/' + recordId + '/review',
      { method: 'POST', body: JSON.stringify({ status, note }) },
    ),
  reportUrl: (taskId: string, format: 'json' | 'txt', docType: 'analysis' | 'notice' = 'analysis') =>
    `${API_BASE}/api/modules/analysis-workbench/tasks/${taskId}/report?format=${format}&doc_type=${docType}`,
  reportText: (taskId: string, docType: 'analysis' | 'notice' = 'analysis') =>
    requestText(`/api/modules/analysis-workbench/tasks/${taskId}/report?format=txt&doc_type=${docType}`),
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
  target_url?: string | null
  target_label?: string | null
}

export interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string
  url: string
}

export interface PlatformStatsOverview {
  task_total: number
  task_done: number
  task_failed: number
  task_success_rate: number
  file_total: number
  file_active: number
  record_total: number
  log_total: number
  module_active: number
}

export interface PlatformRecentActivity {
  action: string
  target_type: string
  target_id: string
  module: string
  result: string
  created_at: string
}

export const notificationsApi = {
  list: (params?: { q?: string; type?: string }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.type) sp.set('type', params.type)
    const query = sp.toString()
    return request<{ notifications: NotificationRecord[]; total: number; unread_count: number }>('/api/notifications' + (query ? `?${query}` : ''))
  },
  markRead: (id: number) => request<{ success: boolean }>('/api/notifications/' + id + '/read', { method: 'POST' }),
  markAllRead: () => request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
}

export const searchApi = {
  search: (q: string) => request<{ query: string; results: SearchResult[]; total: number }>('/api/search?q=' + encodeURIComponent(q)),
}

export const platformStatsApi = {
  overview: () => request<PlatformStatsOverview>('/api/platform/stats/overview'),
  taskStats: () => request<Record<string, { total: number; succeeded: number }>>('/api/platform/stats/task-stats'),
  recentActivity: () => request<PlatformRecentActivity[]>('/api/platform/stats/recent-activity'),
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

export interface RecordRelationLog {
  id: number
  action: string
  detail: string
  result: string
  module: string
  created_at: string
}

export interface RecordRelationFile {
  file_id: string
  original_name: string
  module: string
  created_at: string
}

export interface RecordRelations {
  source_module: string | null
  source_task_id: string | null
  source_batch: string | null
  logs: RecordRelationLog[]
  files: RecordRelationFile[]
}

export const recordsApi = {
  list: (params?: { category?: string; status?: string; assignee?: string; tags?: string; batch?: string; q?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.category) sp.set('category', params.category)
    if (params?.status) sp.set('status', params.status)
    if (params?.assignee) sp.set('assignee', params.assignee)
    if (params?.tags) sp.set('tags', params.tags)
    if (params?.batch) sp.set('batch', params.batch)
    if (params?.q) sp.set('q', params.q)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ records: RecordItem[]; total: number }>('/api/modules/record-operations/records?' + sp)
  },
  create: (data: { name: string; category?: string; assignee?: string; tags?: string; detail?: string }) =>
    request<RecordItem>('/api/modules/record-operations/records', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<RecordItem>('/api/modules/record-operations/records/' + id),
  relations: (id: string) => request<RecordRelations>('/api/modules/record-operations/records/' + id + '/relations'),
  update: (id: string, data: Partial<RecordItem>) =>
    request<RecordItem>('/api/modules/record-operations/records/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  updateTags: (id: string, tags: string) =>
    request<{ success: boolean; message: string; tags: string }>(
      '/api/modules/record-operations/records/' + id + '/tags',
      { method: 'POST', body: JSON.stringify({ tags }) },
    ),
  delete: (id: string) => request<{ success: boolean }>('/api/modules/record-operations/records/' + id + '/delete', { method: 'POST' }),
  batchDelete: (record_ids: string[]) =>
    request<{ success: boolean; message: string }>('/api/modules/record-operations/records/batch-delete', { method: 'POST', body: JSON.stringify({ record_ids }) }),
  batchUpdate: (record_ids: string[], data: { category?: string; assignee?: string; status?: string }) =>
    request<{ success: boolean; message: string }>('/api/modules/record-operations/batch-update', { method: 'POST', body: JSON.stringify({ record_ids, ...data }) }),
  importFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(API_BASE + '/api/modules/record-operations/import', {
      method: 'POST', credentials: 'include', body: form,
    }).then(r => r.json())
  },
  tagSuggestions: (q?: string) =>
    request<{ tags: string[] }>('/api/modules/record-operations/records/tags/suggestions' + (q ? '?q=' + encodeURIComponent(q) : '')),
  stats: () => request<{ total: number; active: number; categories: number }>('/api/modules/record-operations/stats'),
}

export const infoQueryApi = {
  importFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(API_BASE + '/api/modules/info-query/import', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(r => r.json() as Promise<{ success: boolean; message: string; batch: string; imported: number; updated: number; skipped: number; headers: string[] }>)
  },
  list: (params?: { q?: string; tax_officer?: string; manager_department?: string; industry?: string; region?: string; risk_level?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.tax_officer) sp.set('tax_officer', params.tax_officer)
    if (params?.manager_department) sp.set('manager_department', params.manager_department)
    if (params?.industry) sp.set('industry', params.industry)
    if (params?.region) sp.set('region', params.region)
    if (params?.risk_level) sp.set('risk_level', params.risk_level)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ taxpayers: TaxpayerProfile[]; total: number }>('/api/modules/info-query/taxpayers?' + sp)
  },
  get: (taxpayerId: string) => request<TaxpayerProfile>('/api/modules/info-query/taxpayers/' + encodeURIComponent(taxpayerId)),
  assignmentStats: () => request<{ by_officer: Record<string, number>; by_department: Record<string, number>; by_risk_level: Record<string, number>; total: number }>('/api/modules/info-query/assignment-stats'),
}

export interface RiskDossier {
  id: number
  taxpayer_id: string
  company_name: string
  registration_status: string
  tax_officer: string
  address: string
  is_temporary: boolean
  source: string
  owner_id: number
  created_at: string
  updated_at: string
  latest_recorded_at: string | null
  latest_content: string
  latest_entry_status: string
  entry_count: number
}

export interface RiskLedgerEntry {
  id: number
  entry_id: string
  dossier_id: number
  taxpayer_id: string
  recorded_at: string
  content: string
  entry_status: string
  note: string
  owner_id: number
  created_by: number
  created_at: string
}

export interface RiskLedgerStats {
  dossier_total: number
  entry_total: number
  pending_count: number
  rectifying_count: number
  excluded_count: number
  rectified_count: number
  temporary_count: number
}

export interface RiskLedgerBatchResult {
  success: boolean
  message: string
  created: number
  failed: number
  failures: Array<Record<string, string>>
}

export const riskLedgerApi = {
  list: (params?: { q?: string; tax_officer?: string; registration_status?: string; entry_status?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.tax_officer) sp.set('tax_officer', params.tax_officer)
    if (params?.registration_status) sp.set('registration_status', params.registration_status)
    if (params?.entry_status) sp.set('entry_status', params.entry_status)
    if (params?.date_from) sp.set('date_from', params.date_from)
    if (params?.date_to) sp.set('date_to', params.date_to)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ dossiers: RiskDossier[]; total: number }>('/api/modules/risk-ledger/dossiers?' + sp)
  },
  get: (taxpayerId: string) =>
    request<{ dossier: RiskDossier; entries: RiskLedgerEntry[] }>('/api/modules/risk-ledger/dossiers/' + encodeURIComponent(taxpayerId)),
  createEntry: (data: {
    taxpayer_id: string
    recorded_at: string
    content: string
    entry_status: string
    company_name?: string
    registration_status?: string
    tax_officer?: string
    address?: string
    note?: string
  }) => request<RiskLedgerEntry>('/api/modules/risk-ledger/entries', { method: 'POST', body: JSON.stringify(data) }),
  batchText: (data: { taxpayer_ids: string[]; recorded_at: string; content: string; entry_status: string; note?: string }) =>
    request<RiskLedgerBatchResult>('/api/modules/risk-ledger/entries/batch-text', { method: 'POST', body: JSON.stringify(data) }),
  importFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(API_BASE + '/api/modules/risk-ledger/entries/import', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(r => r.json() as Promise<RiskLedgerBatchResult>)
  },
  stats: () => request<RiskLedgerStats>('/api/modules/risk-ledger/stats'),
}

export interface TrainingSet {
  id: number
  set_id: string
  name: string
  description: string
  category: string
  difficulty: string
  question_count: number
  tags: string
  is_active: boolean
}

export interface PracticeSession {
  session_id: string
  set_id: string
  set_name: string
  status: string
  total_count: number
  correct_count: number
  score: number
  questions: Question[]
  started_at: string
  completed_at: string | null
}

export interface Question {
  id: string
  question: string
  options: string[]
  answer: string
  user_answer?: string
  is_correct?: boolean
}

export interface FavoriteItem {
  id: number
  session_id: string
  question_id: string
  question_text: string
  user_answer: string
  correct_answer: string
  created_at: string
}

export interface LearningStats {
  total_sessions: number
  total_correct: number
  total_questions: number
  avg_score: number
  streak_days: number
  last_practice_at: string | null
  recent_sessions: any[]
}

export const learningLabApi = {
  listSets: () => request<TrainingSet[]>('/api/modules/learning-lab/sets'),
  getSet: (setId: string) => request<TrainingSet>('/api/modules/learning-lab/sets/' + setId),
  continueLast: () => request<PracticeSession>('/api/modules/learning-lab/practice/continue'),
  startPractice: (setId: string) => request<PracticeSession>('/api/modules/learning-lab/practice/start?set_id=' + setId, { method: 'POST' }),
  getPractice: (sessionId: string) => request<PracticeSession>('/api/modules/learning-lab/practice/' + sessionId),
  answer: (sessionId: string, questionId: string, userAnswer: string) =>
    request<{ success: boolean; all_answered: boolean; is_correct: boolean }>(
      '/api/modules/learning-lab/practice/' + sessionId + '/answer?question_id=' + questionId + '&user_answer=' + encodeURIComponent(userAnswer),
      { method: 'POST' },
    ),
  toggleFavorite: (sessionId: string, questionId: string) =>
    request<{ favorited: boolean }>('/api/modules/learning-lab/practice/' + sessionId + '/favorite/' + questionId, { method: 'POST' }),
  listFavorites: () => request<FavoriteItem[]>('/api/modules/learning-lab/favorites'),
  removeFavorite: (id: number) => request<{ success: boolean }>('/api/modules/learning-lab/favorites/' + id, { method: 'DELETE' }),
  getStats: () => request<LearningStats>('/api/modules/learning-lab/stats'),
}

export interface DashboardData {
  stat_cards: { label: string; value: number; change?: number }[]
  task_trend: { date: string; count: number }[]
  module_stats: { module: string; total: number; succeeded: number; failed: number }[]
  recent_activity: {
    action: string; target_type: string; detail: string; module: string; result: string; created_at: string; target_url?: string | null
  }[]
}

export const dashboardApi = {
  overview: (days = 7) => request<DashboardData>('/api/modules/dashboard-workbench/overview?days=' + days),
}

export interface ScheduleTask {
  id: number
  name: string
  description?: string
  cron_expression: string
  task_type: string
  task_params?: string
  is_active: boolean
  last_run_at?: string
  next_run_at?: string
  last_result?: string
  created_at: string
}

export interface ScheduleExecutionLog {
  id: number
  action: string
  detail: string
  result: string
  created_at: string
}

export const scheduleApi = {
  list: () => request<{ tasks: ScheduleTask[]; total: number }>('/api/modules/schedule-workbench/tasks'),
  create: (data: any) => request<ScheduleTask>('/api/modules/schedule-workbench/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<ScheduleTask>('/api/modules/schedule-workbench/tasks/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request('/api/modules/schedule-workbench/tasks/' + id, { method: 'DELETE' }),
  runNow: (id: number) => request<{ success: boolean; message: string }>('/api/modules/schedule-workbench/tasks/' + id + '/run', { method: 'POST' }),
  history: (id: number) => request<{ task_id: number; history: ScheduleExecutionLog[] }>('/api/modules/schedule-workbench/tasks/' + id + '/history'),
}
