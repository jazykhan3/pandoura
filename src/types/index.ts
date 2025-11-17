export type ActivityLog = {
  id: string
  message: string
  timestamp: Date
}

export type Connection = {
  id: string
  name: string
  ip: string
  status: 'online' | 'warning' | 'offline'
}

export type Tag = {
  id: string
  name: string
  type: 'BOOL' | 'INT' | 'REAL' | 'STRING' | 'TIME'
  value: string | number | boolean | null
  address: string
  lastUpdate: Date
  persist?: boolean
  source?: 'live' | 'shadow' | 'simulator'
  metadata?: {
    description?: string
    units?: string
  }
}

export type DeploymentLog = {
  id: string
  timestamp: Date
  version: string
  status: 'success' | 'failed' | 'pending'
  changes: number
}

// Milestone 2 types

export type LogicFile = {
  id: string
  name: string
  content: string
  vendor: 'neutral' | 'rockwell' | 'siemens' | 'beckhoff'
  lastModified: string
  author: string
  snapshot?: string
}

export type SyncEventType = 
  | 'TAG_UPDATE' 
  | 'LOGIC_PUSH' 
  | 'HEARTBEAT' 
  | 'CONFLICT'
  | 'CONNECT'
  | 'DISCONNECT'

export type SyncEvent = {
  id: string
  type: SyncEventType
  timestamp: string
  payload: Record<string, unknown>
  source?: 'live' | 'shadow'
}

export type ValidationError = {
  line: number
  column: number
  severity: 'error' | 'warning' | 'info'
  message: string
}

export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

export type SimulatorState = {
  isRunning: boolean
  isPaused: boolean
  speed: number
  logs: SimulatorLog[]
  ioValues: Record<string, number | boolean>
  breakpoints: number[]
  currentLine?: number
}

export type SimulatorLog = {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'warning' | 'error' | 'tag_change'
  data?: Record<string, unknown>
}

export type SyncStatus = {
  connected: boolean
  shadowOk: boolean
  liveOk: boolean
  lastSync: string | null
  latency: number
  conflicts: SyncConflict[]
  executionMode?: 'interpreter' | 'stopped'
}

export type SyncConflict = {
  id: string
  tagName: string
  shadowValue: unknown
  liveValue: unknown
  timestamp: string
  resolved: boolean
  type?: 'VALUE_CONFLICT' | 'TYPE_CONFLICT' | 'ACCESS_CONFLICT'
  description?: string
}

export type ChangePreview = {
  type: 'addition' | 'modification' | 'deletion'
  line: number
  oldContent?: string
  newContent?: string
}

// Milestone 3: Versioning Center types

export type BranchStage = 'main' | 'dev' | 'qa' | 'staging' | 'prod'

export type Branch = {
  id: string
  name: string
  stage: BranchStage
  createdAt: string
  createdBy: string
  parentBranch?: string
  isDefault: boolean
}

export type VersionStatus = 'draft' | 'staged' | 'released'

export type Version = {
  id: string
  version: string
  author: string
  timestamp: string
  filesChanged: number
  checksum: string
  status: VersionStatus
  signed: boolean
  approvals: number
  approvalsRequired: number
  linkedDeploys: number
  branch: string
  stage: BranchStage
  message?: string
  tags?: string[]
}

export type FileChange = {
  id: string
  path: string
  type: 'added' | 'modified' | 'deleted'
  linesAdded: number
  linesDeleted: number
  diff?: string
}

export type VersionDetail = Version & {
  files: FileChange[]
  signature?: string
  signedBy?: string
  signedAt?: string
  metadata?: Record<string, unknown>
}

export type Snapshot = {
  id: string
  name: string
  versionId: string
  createdAt: string
  createdBy: string
  description?: string
  tags?: string[]
}

export type Release = {
  id: string
  name: string
  version: string
  snapshotId: string
  createdAt: string
  createdBy: string
  signed: boolean
  signature?: string
  metadata?: Record<string, unknown>
  bundle?: string
  status: 'active' | 'deprecated' | 'archived'
  tags?: string[]
}

// Enhanced Logic Editor types

export type SymbolType = 'function' | 'program' | 'function_block' | 'variable' | 'udt' | 'constant'

export type Symbol = {
  id: string
  name: string
  type: SymbolType
  dataType?: string
  line: number
  scope: string
  references: number
  children?: Symbol[]
  description?: string
  isUsed: boolean
}

export type LocalHistoryEntry = {
  id: string
  timestamp: string
  content: string
  message?: string
  author: string
}

export type CodeAction = {
  id: string
  title: string
  kind: 'refactor' | 'quickfix' | 'source'
  command: string
  description?: string
}

export type TestCase = {
  id: string
  name: string
  routine: string
  inputs: Record<string, unknown>
  expectedOutputs: Record<string, unknown>
  status: 'pending' | 'running' | 'passed' | 'failed'
  actualOutputs?: Record<string, unknown>
  error?: string
  executionTime?: number
  coverage?: number
  trace?: string[]
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

export type SemanticDiagnostic = {
  id: string
  severity: DiagnosticSeverity
  message: string
  line: number
  column: number
  category: 'resource' | 'race_condition' | 'uninitialized' | 'unsafe_io' | 'performance'
  suggestion?: string
}

export type SafetyRule = {
  id: string
  name: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  violations: Array<{
    line: number
    message: string
    canOverride: boolean
    approved: boolean
  }>
}

export type ReplaceScope = 'current_file' | 'open_files' | 'project'

export type ReplaceMatch = {
  file: string
  line: number
  column: number
  matchText: string
  contextBefore: string
  contextAfter: string
  selected: boolean
}

export type CodeLens = {
  line: number
  command: string
  title: string
  args?: unknown[]
}


