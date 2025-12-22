/**
 * PLC Pull Middleware
 * 
 * Enforces RBAC permissions and approval requirements before PLC operations.
 * All pull operations must pass through this middleware.
 */

import { type PLCPullPermissions, canPullFromRuntime, requiresApproval } from './plcPermissions'
import { createApprovalRequest, submitApprovalRequest } from './approvalWorkflow'
import { logPermissionDenied, logPullInitiated, logApprovalRequested } from './auditLogger'

export type PullRequest = {
  runtimeId: string
  runtimeName: string
  runtimeEnvironment: 'production' | 'staging' | 'development'
  projectId?: string
  snapshotScope: {
    includePrograms: boolean
    includeTags: boolean
    includeDataTypes: boolean
    includeRoutines: boolean
    includeAOIs: boolean
  }
  user: {
    userId: string
    username: string
    role: string
  }
  reason?: string
}

export type MiddlewareResult = {
  allowed: boolean
  requiresApproval: boolean
  approvalRequestId?: string
  denialReason?: string
  warning?: string
}

/**
 * Main middleware function - checks all permissions and approval requirements
 */
export async function enforcePullPermissions(
  request: PullRequest,
  permissions: PLCPullPermissions
): Promise<MiddlewareResult> {
  
  // 1. Check basic pull permission
  if (!permissions.canPullFromPLC) {
    await logPermissionDenied({
      userId: request.user.userId,
      username: request.user.username,
      userRole: request.user.role,
      runtimeId: request.runtimeId,
      runtimeName: request.runtimeName,
      runtimeEnvironment: request.runtimeEnvironment,
      attemptedAction: 'pull-from-plc',
      missingPermission: 'canPullFromPLC'
    })
    
    return {
      allowed: false,
      requiresApproval: false,
      denialReason: 'User does not have permission to pull from PLC'
    }
  }
  
  // 2. Check environment-specific permission
  const canPull = canPullFromRuntime(permissions, request.runtimeEnvironment)
  if (!canPull) {
    await logPermissionDenied({
      userId: request.user.userId,
      username: request.user.username,
      userRole: request.user.role,
      runtimeId: request.runtimeId,
      runtimeName: request.runtimeName,
      runtimeEnvironment: request.runtimeEnvironment,
      attemptedAction: `pull-from-${request.runtimeEnvironment}`,
      missingPermission: `canPullFrom${capitalize(request.runtimeEnvironment)}`
    })
    
    return {
      allowed: false,
      requiresApproval: false,
      denialReason: `User does not have permission to pull from ${request.runtimeEnvironment} runtimes`
    }
  }
  
  // 3. Check if approval is required
  const needsApproval = requiresApproval(permissions, request.runtimeEnvironment)
  
  if (needsApproval) {
    // Create approval request
    const approvalRequest = createApprovalRequest({
      type: 'production-pull',
      requestedBy: {
        userId: request.user.userId,
        username: request.user.username,
        role: request.user.role
      },
      runtime: {
        id: request.runtimeId,
        name: request.runtimeName,
        environment: request.runtimeEnvironment,
        ipAddress: 'Unknown' // Would come from runtime data
      },
      reason: request.reason || 'Pull from production runtime',
      snapshotScope: {
        programs: request.snapshotScope.includePrograms,
        tags: request.snapshotScope.includeTags,
        dataTypes: request.snapshotScope.includeDataTypes,
        routines: request.snapshotScope.includeRoutines,
        aois: request.snapshotScope.includeAOIs
      },
      projectId: request.projectId
    })
    
    try {
      // Submit approval request
      const result = await submitApprovalRequest(approvalRequest)
      
      // Log approval request
      await logApprovalRequested({
        userId: request.user.userId,
        username: request.user.username,
        userRole: request.user.role,
        runtimeId: request.runtimeId,
        runtimeName: request.runtimeName,
        runtimeEnvironment: request.runtimeEnvironment,
        approvalRequestId: result.requestId,
        reason: approvalRequest.reason
      })
      
      return {
        allowed: false,
        requiresApproval: true,
        approvalRequestId: result.requestId,
        warning: 'Production pull requires approval. Request has been submitted.'
      }
    } catch (error) {
      return {
        allowed: false,
        requiresApproval: true,
        denialReason: 'Failed to submit approval request. Please try again.'
      }
    }
  }
  
  // 4. Permission granted - log initiation
  await logPullInitiated({
    userId: request.user.userId,
    username: request.user.username,
    userRole: request.user.role,
    runtimeId: request.runtimeId,
    runtimeName: request.runtimeName,
    runtimeEnvironment: request.runtimeEnvironment,
    projectId: request.projectId,
    snapshotScope: {
      programs: request.snapshotScope.includePrograms,
      tags: request.snapshotScope.includeTags,
      dataTypes: request.snapshotScope.includeDataTypes,
      routines: request.snapshotScope.includeRoutines,
      aois: request.snapshotScope.includeAOIs
    },
    requiresApproval: false
  })
  
  return {
    allowed: true,
    requiresApproval: false
  }
}

/**
 * Check baseline clone permission
 */
export async function enforceBaselineClonePermissions(
  _baselineId: string,
  permissions: PLCPullPermissions,
  user: PullRequest['user']
): Promise<MiddlewareResult> {
  
  if (!permissions.canCloneImportedBaseline) {
    await logPermissionDenied({
      userId: user.userId,
      username: user.username,
      userRole: user.role,
      runtimeId: 'N/A',
      runtimeName: 'N/A',
      runtimeEnvironment: 'development',
      attemptedAction: 'clone-baseline',
      missingPermission: 'canCloneImportedBaseline'
    })
    
    return {
      allowed: false,
      requiresApproval: false,
      denialReason: 'User does not have permission to clone baselines'
    }
  }
  
  return {
    allowed: true,
    requiresApproval: false
  }
}

/**
 * Check draft creation permission
 */
export async function enforceDraftCreationPermissions(
  permissions: PLCPullPermissions,
  user: PullRequest['user']
): Promise<MiddlewareResult> {
  
  if (!permissions.canCreateDraft) {
    await logPermissionDenied({
      userId: user.userId,
      username: user.username,
      userRole: user.role,
      runtimeId: 'N/A',
      runtimeName: 'N/A',
      runtimeEnvironment: 'development',
      attemptedAction: 'create-draft',
      missingPermission: 'canCreateDraft'
    })
    
    return {
      allowed: false,
      requiresApproval: false,
      denialReason: 'User does not have permission to create drafts'
    }
  }
  
  return {
    allowed: true,
    requiresApproval: false
  }
}

/**
 * Utility: Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Validate approval before executing pull
 */
export async function validateApprovalBeforePull(
  approvalRequestId: string,
  runtimeId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const response = await fetch(`http://localhost:8000/api/approvals/${approvalRequestId}/validate?runtime_id=${runtimeId}`)
    
    if (!response.ok) {
      return { valid: false, reason: 'Approval validation failed' }
    }
    
    const data = await response.json()
    
    if (!data.approved) {
      return { valid: false, reason: data.reason || 'Approval not granted' }
    }
    
    if (data.expired) {
      return { valid: false, reason: 'Approval has expired' }
    }
    
    return { valid: true }
  } catch (error) {
    return { valid: false, reason: 'Failed to validate approval' }
  }
}
