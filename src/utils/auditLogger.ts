/**
 * PLC Pull Audit Logger
 * 
 * Comprehensive audit logging for all PLC pull operations and approval decisions.
 * Ensures no silent pulls and full traceability.
 */

import { deviceAuth } from './deviceAuth'

export type AuditAction = 
  | 'pull-initiated'
  | 'pull-completed'
  | 'pull-failed'
  | 'approval-requested'
  | 'approval-granted'
  | 'approval-rejected'
  | 'approval-cancelled'
  | 'baseline-cloned'
  | 'draft-created'
  | 'draft-promoted'
  | 'permission-denied'

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

export type AuditEntry = {
  id: string
  timestamp: string
  action: AuditAction
  severity: AuditSeverity
  
  // Actor
  userId: string
  username: string
  userRole: string
  ipAddress?: string
  
  // Target
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  
  // Details
  projectId?: string
  approvalRequestId?: string
  snapshotId?: string
  baselineId?: string
  draftId?: string
  
  // Context
  details: Record<string, any>
  success: boolean
  errorMessage?: string
  
  // Metadata
  sessionId?: string
  requestId?: string
  tags?: string[]
}

const API_BASE = 'http://localhost:8000/api'

/**
 * Log a pull operation initiation
 */
export async function logPullInitiated(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  projectId?: string
  snapshotScope: Record<string, boolean>
  requiresApproval: boolean
  approvalRequestId?: string
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'pull-initiated',
    severity: params.runtimeEnvironment === 'production' ? 'warning' : 'info',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    projectId: params.projectId,
    approvalRequestId: params.approvalRequestId,
    details: {
      snapshot_scope: params.snapshotScope,
      requires_approval: params.requiresApproval
    },
    success: true
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log a successful pull completion
 */
export async function logPullCompleted(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  projectId?: string
  snapshotId: string
  itemsPulled: number
  duration: number
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'pull-completed',
    severity: 'info',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    projectId: params.projectId,
    snapshotId: params.snapshotId,
    details: {
      items_pulled: params.itemsPulled,
      duration_ms: params.duration
    },
    success: true
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log a failed pull operation
 */
export async function logPullFailed(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  projectId?: string
  error: string
  errorDetails?: Record<string, any>
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'pull-failed',
    severity: params.runtimeEnvironment === 'production' ? 'critical' : 'error',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    projectId: params.projectId,
    details: params.errorDetails || {},
    success: false,
    errorMessage: params.error
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log approval request creation
 */
export async function logApprovalRequested(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  approvalRequestId: string
  reason: string
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'approval-requested',
    severity: 'warning',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    approvalRequestId: params.approvalRequestId,
    details: {
      reason: params.reason
    },
    success: true
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log approval decision
 */
export async function logApprovalDecision(params: {
  approverId: string
  approverName: string
  approverRole: string
  requesterId: string
  requesterName: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  approvalRequestId: string
  decision: 'approved' | 'rejected'
  reason?: string
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: params.decision === 'approved' ? 'approval-granted' : 'approval-rejected',
    severity: params.decision === 'approved' ? 'warning' : 'info',
    userId: params.approverId,
    username: params.approverName,
    userRole: params.approverRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    approvalRequestId: params.approvalRequestId,
    details: {
      requester_id: params.requesterId,
      requester_name: params.requesterName,
      decision: params.decision,
      reason: params.reason
    },
    success: true
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log permission denied
 */
export async function logPermissionDenied(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  attemptedAction: string
  missingPermission: string
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'permission-denied',
    severity: 'warning',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    details: {
      attempted_action: params.attemptedAction,
      missing_permission: params.missingPermission
    },
    success: false,
    errorMessage: `Permission denied: ${params.missingPermission}`
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log baseline clone operation
 */
export async function logBaselineCloned(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  baselineId: string
  newBaselineId: string
  projectId?: string
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'baseline-cloned',
    severity: 'info',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    projectId: params.projectId,
    baselineId: params.baselineId,
    details: {
      source_baseline_id: params.baselineId,
      new_baseline_id: params.newBaselineId
    },
    success: true
  }
  
  await sendAuditEntry(entry)
}

/**
 * Log draft creation
 */
export async function logDraftCreated(params: {
  userId: string
  username: string
  userRole: string
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  draftId: string
  baselineId?: string
  projectId?: string
}): Promise<void> {
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action: 'draft-created',
    severity: 'info',
    userId: params.userId,
    username: params.username,
    userRole: params.userRole,
    runtimeId: params.runtimeId,
    runtimeName: params.runtimeName,
    runtimeEnvironment: params.runtimeEnvironment,
    projectId: params.projectId,
    draftId: params.draftId,
    baselineId: params.baselineId,
    details: {
      draft_id: params.draftId,
      source_baseline: params.baselineId
    },
    success: true
  }
  
  await sendAuditEntry(entry)
}

/**
 * Send audit entry to backend
 */
async function sendAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    // Get session token for authentication
    const sessionToken = await deviceAuth.getSessionToken()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`
    }
    
    const response = await fetch(`${API_BASE}/audit/plc-pull`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry)
    })
    
    if (!response.ok) {
      console.error('Failed to send audit entry:', response.statusText)
    }
  } catch (error) {
    console.error('Failed to send audit entry:', error)
    // Store locally as fallback
    storeAuditLocally(entry)
  }
}

/**
 * Store audit entry locally as fallback
 */
function storeAuditLocally(entry: AuditEntry): void {
  try {
    const stored = localStorage.getItem('pandaura_audit_fallback') || '[]'
    const entries = JSON.parse(stored)
    entries.push(entry)
    
    // Keep only last 100 entries
    if (entries.length > 100) {
      entries.shift()
    }
    
    localStorage.setItem('pandaura_audit_fallback', JSON.stringify(entries))
  } catch (error) {
    console.error('Failed to store audit locally:', error)
  }
}

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
}

/**
 * Query audit log
 */
export async function queryAuditLog(params: {
  userId?: string
  runtimeId?: string
  action?: AuditAction
  startDate?: string
  endDate?: string
  limit?: number
}): Promise<AuditEntry[]> {
  try {
    // Get session token for authentication
    const sessionToken = await deviceAuth.getSessionToken()
    
    const headers: Record<string, string> = {}
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`
    }
    
    const queryParams = new URLSearchParams()
    if (params.userId) queryParams.set('user_id', params.userId)
    if (params.runtimeId) queryParams.set('runtime_id', params.runtimeId)
    if (params.action) queryParams.set('action', params.action)
    if (params.startDate) queryParams.set('start_date', params.startDate)
    if (params.endDate) queryParams.set('end_date', params.endDate)
    if (params.limit) queryParams.set('limit', params.limit.toString())
    
    const response = await fetch(`${API_BASE}/audit/plc-pull?${queryParams}`, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to query audit log: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.entries || []
  } catch (error) {
    console.error('Failed to query audit log:', error)
    return []
  }
}
