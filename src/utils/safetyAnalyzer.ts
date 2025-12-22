// Safety Analyzer - Static analysis for safety-critical PLC code
import type { SafetyRule } from '../types'

export interface SafetyAnalysisResult {
  rules: SafetyRule[]
  overallSafetyLevel: 'safe' | 'warning' | 'critical'
  blockingIssues: number
}

/**
 * Analyze code for safety violations
 */
export function analyzeSafety(content: string): SafetyAnalysisResult {
  const rules: SafetyRule[] = []
  const lines = content.split('\n')
  
  let inProgram = false
  let hasEmergencyStopCheck = false
  let emergencyStopCheckInterval = 0
  let lastEStopCheckLine = 0

  // Rule 1: Emergency Stop Validation
  const eStopViolations: Array<{ line: number; message: string; canOverride: boolean; approved: boolean }> = []
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()
    
    // Track program boundaries
    if (trimmed.match(/^PROGRAM\s+/i)) {
      inProgram = true
      hasEmergencyStopCheck = false
      return
    }
    
    if (trimmed.match(/^END_PROGRAM$/i)) {
      // Check if E-stop was verified in this program
      if (inProgram && !hasEmergencyStopCheck) {
        eStopViolations.push({
          line: lineNumber,
          message: 'Emergency stop not checked in program cycle',
          canOverride: false,
          approved: false,
        })
      }
      inProgram = false
      return
    }

    // Detect E-stop checks
    if (trimmed.match(/\b(ESTOP|E_STOP|EMERGENCY_STOP|EmergencyStop)\b/i)) {
      hasEmergencyStopCheck = true
      emergencyStopCheckInterval = lineNumber - lastEStopCheckLine
      lastEStopCheckLine = lineNumber
      
      // Warn if E-stop check interval is too large
      if (emergencyStopCheckInterval > 50) {
        eStopViolations.push({
          line: lineNumber,
          message: `E-stop check interval too large (${emergencyStopCheckInterval} lines)`,
          canOverride: true,
          approved: false,
        })
      }
    }
  })

  if (eStopViolations.length > 0) {
    rules.push({
      id: 'safety-estop',
      name: 'Emergency Stop Validation',
      severity: 'critical',
      category: 'Safety',
      description: 'Emergency stop must be checked on every scan cycle',
      violations: eStopViolations,
    })
  }

  // Rule 2: Output Validation
  const outputViolations: Array<{ line: number; message: string; canOverride: boolean; approved: boolean }> = []
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()
    
    // Detect output writes without validation
    const outputMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*_(?:OUT|OUTPUT))\s*:=/i)
    if (outputMatch) {
      const outputName = outputMatch[1]
      
      // Look backwards to see if there's validation
      let hasValidation = false
      for (let i = Math.max(0, index - 5); i < index; i++) {
        const prevLine = lines[i].trim()
        if (prevLine.match(/\bIF\b/i) && prevLine.includes(outputName.replace(/_OUT.*$/, ''))) {
          hasValidation = true
          break
        }
      }
      
      if (!hasValidation) {
        outputViolations.push({
          line: lineNumber,
          message: `Output '${outputName}' activated without safety validation`,
          canOverride: true,
          approved: false,
        })
      }
    }
  })

  if (outputViolations.length > 0) {
    rules.push({
      id: 'safety-output',
      name: 'Output Validation',
      severity: 'high',
      category: 'Safety',
      description: 'All outputs must be validated before activation',
      violations: outputViolations,
    })
  }

  // Rule 3: Watchdog Timer
  const watchdogViolations: Array<{ line: number; message: string; canOverride: boolean; approved: boolean }> = []
  let hasWatchdog = false
  
  lines.forEach((line) => {
    const trimmed = line.trim()
    
    if (trimmed.match(/\b(WATCHDOG|WDT|WDOG)\b/i)) {
      hasWatchdog = true
    }
  })

  if (!hasWatchdog && lines.length > 100) {
    watchdogViolations.push({
      line: 1,
      message: 'No watchdog timer detected in safety-critical program',
      canOverride: false,
      approved: false,
    })
    
    rules.push({
      id: 'safety-watchdog',
      name: 'Watchdog Timer Required',
      severity: 'critical',
      category: 'Safety',
      description: 'Watchdog timer must be implemented for safety-critical programs',
      violations: watchdogViolations,
    })
  }

  // Rule 4: Two-Hand Control
  const twoHandViolations: Array<{ line: number; message: string; canOverride: boolean; approved: boolean }> = []
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()
    
    // Detect dangerous operations that should require two-hand control
    if (trimmed.match(/\b(PRESS|CRUSH|CLAMP|ACTUATE).*OUTPUT/i)) {
      // Check if two inputs are required
      const hasTwoInputs = trimmed.match(/\bAND\b/i) && 
                          (trimmed.match(/BUTTON/gi) || []).length >= 2
      
      if (!hasTwoInputs) {
        twoHandViolations.push({
          line: lineNumber,
          message: 'Dangerous operation should require two-hand control',
          canOverride: true,
          approved: false,
        })
      }
    }
  })

  if (twoHandViolations.length > 0) {
    rules.push({
      id: 'safety-twohand',
      name: 'Two-Hand Control',
      severity: 'high',
      category: 'Safety',
      description: 'Dangerous operations should require simultaneous two-hand control',
      violations: twoHandViolations,
    })
  }

  // Rule 5: Redundancy Check
  const redundancyViolations: Array<{ line: number; message: string; canOverride: boolean; approved: boolean }> = []
  const criticalVariables = new Set<string>()
  
  lines.forEach((line) => {
    const trimmed = line.trim()
    
    // Identify critical variables
    if (trimmed.match(/\b(SAFETY|CRITICAL|EMERGENCY|LIMIT)\b/i)) {
      const varMatch = trimmed.match(/([a-zA-Z_][a-zA-Z0-9_]*)/i)
      if (varMatch) {
        criticalVariables.add(varMatch[1])
      }
    }
  })

  // Check for redundant checks on critical variables
  criticalVariables.forEach(varName => {
    let checkCount = 0
    lines.forEach((line) => {
      if (line.includes(varName)) {
        checkCount++
      }
    })
    
    if (checkCount < 2) {
      redundancyViolations.push({
        line: 1,
        message: `Critical variable '${varName}' lacks redundant checking`,
        canOverride: false,
        approved: false,
      })
    }
  })

  if (redundancyViolations.length > 0) {
    rules.push({
      id: 'safety-redundancy',
      name: 'Redundancy Check',
      severity: 'critical',
      category: 'Safety',
      description: 'Critical safety variables must have redundant checks',
      violations: redundancyViolations,
    })
  }

  // Calculate overall safety level
  const criticalCount = rules.filter(r => r.severity === 'critical').length
  const highCount = rules.filter(r => r.severity === 'high').length
  const blockingIssues = rules.reduce((sum, rule) => 
    sum + rule.violations.filter(v => !v.canOverride && !v.approved).length, 0
  )

  let overallSafetyLevel: 'safe' | 'warning' | 'critical'
  if (criticalCount > 0) {
    overallSafetyLevel = 'critical'
  } else if (highCount > 0) {
    overallSafetyLevel = 'warning'
  } else {
    overallSafetyLevel = 'safe'
  }

  return {
    rules,
    overallSafetyLevel,
    blockingIssues,
  }
}

/**
 * Get default safety rules configuration
 */
export function getDefaultSafetyRules(): Array<{
  id: string
  name: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  enabled: boolean
  category: string
}> {
  return [
    {
      id: 'safety-estop',
      name: 'Emergency Stop Validation',
      description: 'Emergency stop must be checked on every scan cycle',
      severity: 'critical',
      enabled: true,
      category: 'Safety',
    },
    {
      id: 'safety-output',
      name: 'Output Validation',
      description: 'All outputs must be validated before activation',
      severity: 'high',
      enabled: true,
      category: 'Safety',
    },
    {
      id: 'safety-watchdog',
      name: 'Watchdog Timer Required',
      description: 'Watchdog timer must be implemented',
      severity: 'critical',
      enabled: true,
      category: 'Safety',
    },
    {
      id: 'safety-twohand',
      name: 'Two-Hand Control',
      description: 'Dangerous operations require two-hand control',
      severity: 'high',
      enabled: true,
      category: 'Safety',
    },
    {
      id: 'safety-redundancy',
      name: 'Redundancy Check',
      description: 'Critical safety variables must have redundant checks',
      severity: 'critical',
      enabled: true,
      category: 'Safety',
    },
  ]
}
