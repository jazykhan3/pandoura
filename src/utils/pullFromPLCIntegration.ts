/**
 * Pull-from-PLC Integration Example
 * 
 * This file demonstrates how Import Defaults are enforced in the Pull-from-PLC workflow.
 * To integrate with existing Pull-from-PLC flow:
 * 
 * 1. Import the utility functions
 * 2. Load defaults before initiating pull
 * 3. Apply defaults to API requests
 * 4. Respect conflict resolution and warning settings
 */

import { 
  getImportDefaults, 
  getSnapshotScopePayload,
  shouldPromptForConflicts,
  shouldShowWarning 
} from '../utils/importDefaults'

/**
 * Example: Pull from PLC with Import Defaults
 */
export async function pullFromPLC(runtimeId: string, projectId: string) {
  // 1. Load user's import defaults
  const importDefaults = getImportDefaults()
  
  // 2. Build snapshot scope payload from defaults
  const snapshotScope = getSnapshotScopePayload(importDefaults)
  
  console.log('Pulling from PLC with defaults:', {
    runtimeId,
    projectId,
    scope: snapshotScope,
    conflictStrategy: importDefaults.conflictResolution,
    warnings: importDefaults.warningBehavior,
    autoShadow: importDefaults.autoShadowRuntime
  })
  
  // 3. Make API request with snapshot scope
  const response = await fetch(`http://localhost:8000/api/runtimes/${runtimeId}/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: projectId,
      snapshot_scope: snapshotScope,
      create_shadow: importDefaults.autoShadowRuntime
    })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to pull from PLC: ${response.statusText}`)
  }
  
  const result = await response.json()
  
  // 4. Handle conflicts based on strategy
  if (result.conflicts && result.conflicts.length > 0) {
    if (shouldPromptForConflicts(importDefaults)) {
      // Show conflict resolution dialog
      return handleConflictsInteractive(result.conflicts, importDefaults)
    } else {
      // Auto-resolve based on strategy
      return handleConflictsAutomatic(result.conflicts, importDefaults.conflictResolution)
    }
  }
  
  // 5. Show warnings based on behavior setting
  if (result.warnings && result.warnings.length > 0) {
    result.warnings.forEach((warning: any) => {
      const severity = warning.severity || 'warning'
      if (shouldShowWarning(importDefaults, severity)) {
        console.warn(`[${severity}] ${warning.message}`)
        // In real implementation, show toast/notification
      }
    })
  }
  
  return result
}

/**
 * Handle conflicts with user interaction
 */
function handleConflictsInteractive(conflicts: any[], _defaults: any) {
  // This would open a conflict resolution dialog
  console.log('Prompting user for conflict resolution:', conflicts)
  
  // Return promise that resolves when user makes selection
  return new Promise((resolve) => {
    // In real implementation, show modal and wait for user input
    setTimeout(() => {
      resolve({
        resolution: 'user-selected',
        conflicts: conflicts
      })
    }, 100)
  })
}

/**
 * Auto-resolve conflicts based on strategy
 */
function handleConflictsAutomatic(conflicts: any[], strategy: string) {
  console.log(`Auto-resolving ${conflicts.length} conflicts using strategy: ${strategy}`)
  
  return {
    resolution: strategy,
    conflicts: conflicts.map((conflict: any) => ({
      ...conflict,
      resolved: true,
      strategy: strategy
    }))
  }
}

/**
 * Example: Preflight check before pull
 * Validates that defaults are reasonable for the operation
 */
export function validateImportDefaults() {
  const defaults = getImportDefaults()
  const warnings = []
  
  // Check if at least one scope item is selected
  const hasAnyScope = Object.values(defaults.snapshotScope).some(v => v)
  if (!hasAnyScope) {
    warnings.push('No snapshot scope items selected - nothing will be imported')
  }
  
  // Warn about silent mode
  if (defaults.warningBehavior === 'silent') {
    warnings.push('Warning behavior is set to silent - you may miss important information')
  }
  
  // Warn about auto-merge
  if (defaults.conflictResolution === 'merge') {
    warnings.push('Auto-merge is experimental and may produce unexpected results')
  }
  
  return {
    valid: hasAnyScope,
    warnings
  }
}

/**
 * Example: Get human-readable summary of current defaults
 */
export function getDefaultsSummary() {
  const defaults = getImportDefaults()
  
  const scopeItems = Object.entries(defaults.snapshotScope)
    .filter(([_, enabled]) => enabled)
    .map(([key, _]) => key.replace('include', ''))
  
  return {
    scope: scopeItems.join(', ') || 'None',
    conflicts: defaults.conflictResolution.replace('-', ' '),
    warnings: defaults.warningBehavior.replace('-', ' '),
    autoShadow: defaults.autoShadowRuntime ? 'Enabled' : 'Disabled'
  }
}

/**
 * Example usage in a React component:
 * 
 * ```typescript
 * import { pullFromPLC, validateImportDefaults, getDefaultsSummary } from './pullFromPLCIntegration'
 * 
 * function PullButton({ runtimeId, projectId }) {
 *   const handlePull = async () => {
 *     // Validate defaults first
 *     const validation = validateImportDefaults()
 *     if (!validation.valid) {
 *       alert('Please configure import defaults first')
 *       return
 *     }
 *     
 *     // Show summary
 *     const summary = getDefaultsSummary()
 *     console.log('Using defaults:', summary)
 *     
 *     // Execute pull
 *     try {
 *       const result = await pullFromPLC(runtimeId, projectId)
 *       console.log('Pull successful:', result)
 *     } catch (error) {
 *       console.error('Pull failed:', error)
 *     }
 *   }
 *   
 *   return <button onClick={handlePull}>Pull from PLC</button>
 * }
 * ```
 */
