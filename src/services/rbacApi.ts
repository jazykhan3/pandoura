/**
 * RBAC Settings API Service
 */

import { deviceAuth } from '../utils/deviceAuth'

const API_BASE = 'http://localhost:8000/api';

export interface RBACConfig {
  rbacEnabled: boolean;
  approvalEnabled: boolean;
  minApprovers: number;
  requireDeployApproval: boolean;
  requireRollbackApproval: boolean;
  requireCriticalTagApproval: boolean;
  approverRoles: string[];
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  description: string;
}

/**
 * Helper to get authenticated headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const sessionToken = await deviceAuth.getSessionToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }
  return headers
}

/**
 * Get current RBAC configuration
 */
export async function getRBACConfig(): Promise<RBACConfig> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/rbac/config`, {
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch RBAC configuration');
  }

  return response.json();
}

/**
 * Update RBAC configuration
 */
export async function updateRBACConfig(config: Partial<RBACConfig>): Promise<RBACConfig> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/rbac/config`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorData.details || errorData.error || 'Failed to update RBAC configuration';
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.config;
}

/**
 * Get all role definitions
 */
export async function getRoles(): Promise<Role[]> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/rbac/roles`, {
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }

  const data = await response.json();
  return data.roles;
}

/**
 * Get specific role definition
 */
export async function getRole(roleId: string): Promise<Role> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/rbac/roles/${roleId}`, {
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch role');
  }

  const data = await response.json();
  return data.role;
}

/**
 * Get all available permissions
 */
export async function getPermissions(): Promise<string[]> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/rbac/permissions`, {
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch permissions');
  }

  const data = await response.json();
  return data.permissions;
}

/**
 * Check if user has specific permission
 */
export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}/rbac/check-permission`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ userId, permission })
  });

  if (!response.ok) {
    throw new Error('Failed to check permission');
  }

  const data = await response.json();
  return data.hasPermission;
}
