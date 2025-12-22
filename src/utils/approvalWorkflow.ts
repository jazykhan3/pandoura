/**
 * Approval Workflow System for Production PLC Pulls
 * 
 * Manages approval requests, status tracking, and decision auditing.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

export type ApprovalRequest = {
  id: string
  type: 'production-pull' | 'baseline-clone' | 'draft-promote'
  requestedBy: {
    userId: string
    username: string
    role: string
  }
  requestedAt: string
  
  // Target details
  runtime: {
    id: string
    name: string
    environment: string
    ipAddress: string
  }
  
  // Request details
  reason: string
  snapshotScope: {
    programs: boolean
    tags: boolean
    dataTypes: boolean
    routines: boolean
    aois: boolean
  }
  
  // Approval tracking
  status: ApprovalStatus
  approvedBy?: {
    userId: string
    username: string
    role: string
  }
  approvedAt?: string
  rejectedBy?: {
    userId: string
    username: string
    role: string
  }
  rejectedAt?: string
  rejectionReason?: string
  
  // Metadata
  expiresAt: string
  projectId?: string
  tags?: string[]
}

export type ApprovalDecision = {
  requestId: string
  decision: 'approve' | 'reject'
  decidedBy: {
    userId: string
    username: string
    role: string
  }
  decidedAt: string
  reason?: string
  notes?: string
}

const APPROVAL_EXPIRY_HOURS = 24

/**
 * Create a new approval request
 */
export function createApprovalRequest(params: {
  type: ApprovalRequest['type']
  requestedBy: ApprovalRequest['requestedBy']
  runtime: ApprovalRequest['runtime']
  reason: string
  snapshotScope: ApprovalRequest['snapshotScope']
  projectId?: string
}): ApprovalRequest {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000)
  
  return {
    id: generateApprovalId(),
    type: params.type,
    requestedBy: params.requestedBy,
    requestedAt: now.toISOString(),
    runtime: params.runtime,
    reason: params.reason,
    snapshotScope: params.snapshotScope,
    status: 'pending',
    expiresAt: expiresAt.toISOString(),
    projectId: params.projectId
  }
}

/**
 * Submit approval request to backend
 */
export async function submitApprovalRequest(request: ApprovalRequest): Promise<{ success: boolean; requestId: string }> {
  try {
    const response = await fetch('http://localhost:8000/api/approvals/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to submit approval request: ${response.statusText}`)
    }
    
    const result = await response.json()
    return { success: true, requestId: result.request_id || request.id }
  } catch (error) {
    console.error('Failed to submit approval request:', error)
    throw error
  }
}

/**
 * Get pending approval requests
 */
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  try {
    const response = await fetch('http://localhost:8000/api/approvals/pending')
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pending approvals: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.requests || []
  } catch (error) {
    console.error('Failed to fetch pending approvals:', error)
    return []
  }
}

/**
 * Get approval requests for current user
 */
export async function getMyApprovalRequests(userId: string): Promise<ApprovalRequest[]> {
  try {
    const response = await fetch(`http://localhost:8000/api/approvals/my-requests?user_id=${userId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user approvals: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.requests || []
  } catch (error) {
    console.error('Failed to fetch user approval requests:', error)
    return []
  }
}

/**
 * Approve an approval request
 */
export async function approveRequest(
  requestId: string,
  approver: ApprovalDecision['decidedBy'],
  notes?: string
): Promise<boolean> {
  try {
    const decision: ApprovalDecision = {
      requestId,
      decision: 'approve',
      decidedBy: approver,
      decidedAt: new Date().toISOString(),
      notes
    }
    
    const response = await fetch(`http://localhost:8000/api/approvals/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(decision)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to approve request: ${response.statusText}`)
    }
    
    return true
  } catch (error) {
    console.error('Failed to approve request:', error)
    return false
  }
}

/**
 * Reject an approval request
 */
export async function rejectRequest(
  requestId: string,
  rejector: ApprovalDecision['decidedBy'],
  reason: string,
  notes?: string
): Promise<boolean> {
  try {
    const decision: ApprovalDecision = {
      requestId,
      decision: 'reject',
      decidedBy: rejector,
      decidedAt: new Date().toISOString(),
      reason,
      notes
    }
    
    const response = await fetch(`http://localhost:8000/api/approvals/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(decision)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to reject request: ${response.statusText}`)
    }
    
    return true
  } catch (error) {
    console.error('Failed to reject request:', error)
    return false
  }
}

/**
 * Cancel an approval request (by requester)
 */
export async function cancelRequest(requestId: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:8000/api/approvals/${requestId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: userId })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to cancel request: ${response.statusText}`)
    }
    
    return true
  } catch (error) {
    console.error('Failed to cancel request:', error)
    return false
  }
}

/**
 * Check if approval request is expired
 */
export function isApprovalExpired(request: ApprovalRequest): boolean {
  const now = new Date()
  const expiresAt = new Date(request.expiresAt)
  return now > expiresAt && request.status === 'pending'
}

/**
 * Get human-readable time until expiry
 */
export function getExpiryTimeRemaining(request: ApprovalRequest): string {
  if (request.status !== 'pending') return 'N/A'
  
  const now = new Date()
  const expiresAt = new Date(request.expiresAt)
  const diff = expiresAt.getTime() - now.getTime()
  
  if (diff <= 0) return 'Expired'
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * Generate unique approval request ID
 */
function generateApprovalId(): string {
  return `APR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
}

/**
 * Get status badge color
 */
export function getApprovalStatusColor(status: ApprovalStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    case 'expired':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  }
}
