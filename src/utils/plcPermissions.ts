/**
 * PLC Pull Permissions & RBAC Integration
 * 
 * Defines granular permissions for PLC pull operations.
 * Integrates with existing RBAC system to ensure no silent pulls.
 */

export type PLCPullPermissions = {
  // Core Pull Permissions
  canPullFromPLC: boolean              // Can initiate pull from any PLC
  canPullFromProduction: boolean       // Can pull from production runtimes (requires approval)
  canPullFromStaging: boolean          // Can pull from staging runtimes
  canPullFromDevelopment: boolean      // Can pull from dev runtimes
  
  // Baseline & Clone Permissions
  canCloneImportedBaseline: boolean    // Can clone a pulled baseline
  canModifyBaseline: boolean           // Can modify baseline after pull
  canDeleteBaseline: boolean           // Can delete pulled baselines
  
  // Draft Permissions
  canCreateDraft: boolean              // Can create draft from pull
  canEditDraft: boolean                // Can edit draft versions
  canPromoteDraft: boolean             // Can promote draft to staging/production
  
  // Approval Permissions
  canApproveProductionPull: boolean    // Can approve production pulls
  canBypassApproval: boolean           // Can bypass approval workflow (admin only)
  canViewPendingApprovals: boolean     // Can see pending approval requests
  
  // Audit Permissions
  canViewAuditLog: boolean             // Can view pull audit logs
  canExportAuditLog: boolean           // Can export audit data
}

export type UserRole = 'admin' | 'engineer' | 'operator' | 'viewer'

/**
 * Default permission sets by role
 */
export const ROLE_PERMISSIONS: Record<UserRole, PLCPullPermissions> = {
  admin: {
    canPullFromPLC: true,
    canPullFromProduction: true,
    canPullFromStaging: true,
    canPullFromDevelopment: true,
    canCloneImportedBaseline: true,
    canModifyBaseline: true,
    canDeleteBaseline: true,
    canCreateDraft: true,
    canEditDraft: true,
    canPromoteDraft: true,
    canApproveProductionPull: true,
    canBypassApproval: true,
    canViewPendingApprovals: true,
    canViewAuditLog: true,
    canExportAuditLog: true
  },
  engineer: {
    canPullFromPLC: true,
    canPullFromProduction: false,      // Requires approval
    canPullFromStaging: true,
    canPullFromDevelopment: true,
    canCloneImportedBaseline: true,
    canModifyBaseline: true,
    canDeleteBaseline: false,
    canCreateDraft: true,
    canEditDraft: true,
    canPromoteDraft: false,            // Requires approval
    canApproveProductionPull: false,
    canBypassApproval: false,
    canViewPendingApprovals: true,
    canViewAuditLog: true,
    canExportAuditLog: false
  },
  operator: {
    canPullFromPLC: true,
    canPullFromProduction: false,
    canPullFromStaging: false,
    canPullFromDevelopment: true,
    canCloneImportedBaseline: false,
    canModifyBaseline: false,
    canDeleteBaseline: false,
    canCreateDraft: true,
    canEditDraft: false,
    canPromoteDraft: false,
    canApproveProductionPull: false,
    canBypassApproval: false,
    canViewPendingApprovals: false,
    canViewAuditLog: false,
    canExportAuditLog: false
  },
  viewer: {
    canPullFromPLC: false,
    canPullFromProduction: false,
    canPullFromStaging: false,
    canPullFromDevelopment: false,
    canCloneImportedBaseline: false,
    canModifyBaseline: false,
    canDeleteBaseline: false,
    canCreateDraft: false,
    canEditDraft: false,
    canPromoteDraft: false,
    canApproveProductionPull: false,
    canBypassApproval: false,
    canViewPendingApprovals: false,
    canViewAuditLog: false,
    canExportAuditLog: false
  }
}

/**
 * Get permissions for a specific user role
 */
export function getPermissionsForRole(role: UserRole): PLCPullPermissions {
  return ROLE_PERMISSIONS[role]
}

/**
 * Check if user can pull from specific runtime based on environment
 */
export function canPullFromRuntime(
  permissions: PLCPullPermissions, 
  runtimeEnvironment: 'production' | 'staging' | 'development'
): boolean {
  if (!permissions.canPullFromPLC) return false
  
  switch (runtimeEnvironment) {
    case 'production':
      return permissions.canPullFromProduction
    case 'staging':
      return permissions.canPullFromStaging
    case 'development':
      return permissions.canPullFromDevelopment
    default:
      return false
  }
}

/**
 * Check if operation requires approval
 */
export function requiresApproval(
  permissions: PLCPullPermissions,
  runtimeEnvironment: 'production' | 'staging' | 'development'
): boolean {
  // Bypass if user has admin override
  if (permissions.canBypassApproval) return false
  
  // Production always requires approval unless user can approve
  if (runtimeEnvironment === 'production') {
    return !permissions.canApproveProductionPull
  }
  
  return false
}

/**
 * Get list of restricted operations for user
 */
export function getRestrictedOperations(permissions: PLCPullPermissions): string[] {
  const restricted: string[] = []
  
  if (!permissions.canPullFromPLC) restricted.push('Pull from PLC')
  if (!permissions.canPullFromProduction) restricted.push('Pull from Production')
  if (!permissions.canCloneImportedBaseline) restricted.push('Clone Baseline')
  if (!permissions.canCreateDraft) restricted.push('Create Draft')
  if (!permissions.canApproveProductionPull) restricted.push('Approve Production Pulls')
  
  return restricted
}
