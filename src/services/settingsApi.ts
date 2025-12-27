/**
 * Settings API Service
 */

import { deviceAuth } from '../utils/deviceAuth';

const API_BASE = 'http://localhost:8000/api';

export interface SystemSetting {
  value: any;
  description?: string;
  type: 'string' | 'boolean' | 'number' | 'json';
}

export interface SystemSettings {
  [category: string]: {
    [key: string]: SystemSetting;
  };
}

export interface ExternalCheckTestResult {
  success: boolean;
  status?: number;
  message: string;
  responseData?: any;
  error?: string;
}

/**
 * Fetch all system settings
 */
export async function fetchSettings(): Promise<SystemSettings> {
  const token = await deviceAuth.getSessionToken();
  const response = await fetch(`${API_BASE}/settings`, {
    headers: {
      'Authorization': `Bearer ${token || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }

  const data = await response.json();
  return data.settings;
}

/**
 * Fetch settings by category
 */
export async function fetchSettingsByCategory(category: string): Promise<Record<string, any>> {
  const token = await deviceAuth.getSessionToken();
  const response = await fetch(`${API_BASE}/settings/category/${category}`, {
    headers: {
      'Authorization': `Bearer ${token || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch settings for category ${category}`);
  }

  const data = await response.json();
  return data.settings;
}

/**
 * Update a single setting
 */
export async function updateSetting(
  key: string,
  value: any,
  options?: {
    type?: string;
    category?: string;
    description?: string;
    isEncrypted?: boolean;
  }
): Promise<void> {
  const token = await deviceAuth.getSessionToken();
  const response = await fetch(`${API_BASE}/settings/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    },
    body: JSON.stringify({
      value,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update setting ${key}`);
  }
}

/**
 * Update multiple settings at once
 */
export async function updateSettingsBatch(
  settings: Array<{
    key: string;
    value: any;
    type?: string;
    category?: string;
    description?: string;
    isEncrypted?: boolean;
  }>
): Promise<void> {
  const token = await deviceAuth.getSessionToken();
  const response = await fetch(`${API_BASE}/settings/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    },
    body: JSON.stringify({ settings }),
  });

  if (!response.ok) {
    throw new Error('Failed to batch update settings');
  }
}

/**
 * Test external pre-deploy check endpoint
 */
export async function testExternalCheckEndpoint(
  endpointUrl: string,
  authHeader?: string
): Promise<ExternalCheckTestResult> {
  const token = await deviceAuth.getSessionToken();
  const response = await fetch(`${API_BASE}/settings/external-check/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    },
    body: JSON.stringify({
      endpointUrl,
      authHeader,
    }),
  });

  const data = await response.json();
  return data;
}

/**
 * Initialize default settings
 */
export async function initializeDefaultSettings(): Promise<void> {
  const token = await deviceAuth.getSessionToken();
  const response = await fetch(`${API_BASE}/settings/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to initialize default settings');
  }
}
