/**
 * Import Defaults Configuration Utility
 * 
 * Manages workspace-specific import defaults for Pull-from-PLC operations.
 * These settings control snapshot scope, conflict resolution, and runtime behavior.
 */

export type ImportDefaults = {
  snapshotScope: {
    includePrograms: boolean
    includeTags: boolean
    includeDataTypes: boolean
    includeRoutines: boolean
    includeAOIs: boolean
  }
  conflictResolution: 'ask' | 'keep-existing' | 'use-incoming' | 'merge'
  warningBehavior: 'show-all' | 'show-critical' | 'silent'
  autoShadowRuntime: boolean
}

export const DEFAULT_IMPORT_SETTINGS: ImportDefaults = {
  snapshotScope: {
    includePrograms: true,
    includeTags: true,
    includeDataTypes: true,
    includeRoutines: true,
    includeAOIs: true
  },
  conflictResolution: 'ask',
  warningBehavior: 'show-all',
  autoShadowRuntime: true
}

const STORAGE_KEY = 'pandaura_import_defaults'

/**
 * Load import defaults from localStorage
 * Returns default settings if not found or on error
 */
export function getImportDefaults(): ImportDefaults {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as ImportDefaults
      // Validate structure
      if (parsed.snapshotScope && parsed.conflictResolution && parsed.warningBehavior !== undefined) {
        return parsed
      }
    }
  } catch (error) {
    console.error('Failed to load import defaults:', error)
  }
  return DEFAULT_IMPORT_SETTINGS
}

/**
 * Save import defaults to localStorage
 */
export function saveImportDefaults(defaults: ImportDefaults): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
    return true
  } catch (error) {
    console.error('Failed to save import defaults:', error)
    return false
  }
}

/**
 * Reset import defaults to factory settings
 */
export function resetImportDefaults(): boolean {
  return saveImportDefaults(DEFAULT_IMPORT_SETTINGS)
}

/**
 * Get snapshot scope as API payload
 */
export function getSnapshotScopePayload(defaults: ImportDefaults) {
  return {
    include_programs: defaults.snapshotScope.includePrograms,
    include_tags: defaults.snapshotScope.includeTags,
    include_data_types: defaults.snapshotScope.includeDataTypes,
    include_routines: defaults.snapshotScope.includeRoutines,
    include_aois: defaults.snapshotScope.includeAOIs
  }
}

/**
 * Check if user should be prompted for conflicts
 */
export function shouldPromptForConflicts(defaults: ImportDefaults): boolean {
  return defaults.conflictResolution === 'ask'
}

/**
 * Check if warnings should be shown
 */
export function shouldShowWarning(defaults: ImportDefaults, severity: 'critical' | 'warning' | 'info'): boolean {
  switch (defaults.warningBehavior) {
    case 'silent':
      return false
    case 'show-critical':
      return severity === 'critical'
    case 'show-all':
      return true
    default:
      return true
  }
}
