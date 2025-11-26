// Semantic Analyzer - Detects advanced issues in ST code
import type { SemanticDiagnostic } from '../types'

export interface SemanticAnalysisResult {
  diagnostics: SemanticDiagnostic[]
  resourceUsage: {
    estimatedCPU: number // percentage
    memoryBytes: number
    scanTime: number // ms
  }
}

/**
 * Perform semantic analysis on ST code
 */
export function analyzeSemantics(content: string): SemanticAnalysisResult {
  const diagnostics: SemanticDiagnostic[] = []
  const lines = content.split('\n')
  
  // Track variables
  const declaredVariables = new Set<string>()
  const initializedVariables = new Set<string>()
  const usedVariables = new Set<string>()
  const writtenVariables = new Set<string>()
  
  let inVarBlock = false
  let estimatedCPU = 0
  let memoryBytes = 0
  let scanTime = 0
  let loopDepth = 0

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('(*')) return

    // Track VAR blocks
    if (trimmed.match(/^VAR(?:_INPUT|_OUTPUT|_IN_OUT|_GLOBAL|_TEMP)?$/i)) {
      inVarBlock = true
      return
    }
    
    if (trimmed.match(/^END_VAR$/i)) {
      inVarBlock = false
      return
    }

    // Parse variable declarations
    if (inVarBlock) {
      const varMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\\([^)]*\\))?)\s*(?::=\s*(.+))?/i)
      if (varMatch) {
        const varName = varMatch[1]
        const varType = varMatch[2]
        const initValue = varMatch[3]
        
        declaredVariables.add(varName)
        
        if (initValue) {
          initializedVariables.add(varName)
        }
        
        // Estimate memory usage
        memoryBytes += estimateTypeSize(varType)
      }
    }

    // Detect loops (increases scan time and CPU)
    if (trimmed.match(/^(FOR|WHILE|REPEAT)/i)) {
      loopDepth++
      estimatedCPU += 5
      scanTime += 0.5
    }
    
    if (trimmed.match(/^END_(FOR|WHILE|REPEAT)/i)) {
      loopDepth = Math.max(0, loopDepth - 1)
    }

    // Warn about deeply nested loops
    if (loopDepth > 2) {
      diagnostics.push({
        id: `loop-depth-${lineNumber}`,
        severity: 'warning',
        message: `Deeply nested loops (depth: ${loopDepth}) may cause performance issues`,
        line: lineNumber,
        column: 1,
        category: 'performance',
        suggestion: 'Consider refactoring to reduce loop nesting',
      })
    }

    // Detect variable usage
    declaredVariables.forEach(varName => {
      const varRegex = new RegExp(`\\b${varName}\\b`, 'g')
      if (varRegex.test(trimmed)) {
        usedVariables.add(varName)
        
        // Check if variable is being written to (assignment)
        const assignmentRegex = new RegExp(`${varName}\\s*:=`, 'g')
        if (assignmentRegex.test(trimmed)) {
          writtenVariables.add(varName)
          
          // Check if used before initialization
          if (!initializedVariables.has(varName) && !writtenVariables.has(varName)) {
            diagnostics.push({
              id: `uninit-${varName}-${lineNumber}`,
              severity: 'warning',
              message: `Variable '${varName}' may be used before initialization`,
              line: lineNumber,
              column: trimmed.indexOf(varName),
              category: 'uninitialized',
              suggestion: `Initialize '${varName}' in VAR block or before first use`,
            })
          }
        }
      }
    })

    // Detect potential race conditions (same variable written in multiple places)
    const multiWritePattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/g
    let match
    while ((match = multiWritePattern.exec(trimmed)) !== null) {
      const varName = match[1]
      if (writtenVariables.has(varName)) {
        // Variable written multiple times - potential race condition
        diagnostics.push({
          id: `race-${varName}-${lineNumber}`,
          severity: 'warning',
          message: `Variable '${varName}' written in multiple locations - potential race condition`,
          line: lineNumber,
          column: match.index,
          category: 'race_condition',
          suggestion: 'Consider using mutex or ensuring sequential execution',
        })
      }
    }

    // Detect direct I/O access without validation
    if (trimmed.match(/(%[IQM][XBW]*\d+)/i)) {
      diagnostics.push({
        id: `unsafe-io-${lineNumber}`,
        severity: 'error',
        message: 'Direct I/O access without validation detected',
        line: lineNumber,
        column: trimmed.search(/%[IQM]/i),
        category: 'unsafe_io',
        suggestion: 'Use mapped tags instead of direct I/O addresses',
      })
    }

    // Detect resource-intensive operations
    if (trimmed.match(/\b(SIN|COS|TAN|SQRT|EXP|LOG|POW)\b/i)) {
      estimatedCPU += 2
      scanTime += 0.1
      diagnostics.push({
        id: `heavy-math-${lineNumber}`,
        severity: 'info',
        message: 'Resource-intensive mathematical operation detected',
        line: lineNumber,
        column: 1,
        category: 'performance',
        suggestion: 'Consider caching results if called frequently',
      })
    }

    // Detect string operations (can be slow)
    if (trimmed.match(/\b(CONCAT|INSERT|DELETE|FIND|REPLACE)\b/i)) {
      estimatedCPU += 1
      scanTime += 0.05
      diagnostics.push({
        id: `string-op-${lineNumber}`,
        severity: 'info',
        message: 'String operations can impact scan time',
        line: lineNumber,
        column: 1,
        category: 'performance',
      })
    }
  })

  // Check for unused variables
  declaredVariables.forEach(varName => {
    if (!usedVariables.has(varName)) {
      diagnostics.push({
        id: `unused-${varName}`,
        severity: 'hint',
        message: `Variable '${varName}' declared but never used`,
        line: 1, // Would need line tracking for exact location
        column: 1,
        category: 'resource',
        suggestion: `Remove unused variable '${varName}' to save memory`,
      })
    }
  })

  return {
    diagnostics,
    resourceUsage: {
      estimatedCPU: Math.min(100, estimatedCPU),
      memoryBytes,
      scanTime,
    },
  }
}

/**
 * Estimate memory size of a data type
 */
function estimateTypeSize(type: string): number {
  const upperType = type.toUpperCase()
  
  if (upperType.includes('BOOL')) return 1
  if (upperType.includes('BYTE') || upperType.includes('SINT') || upperType.includes('USINT')) return 1
  if (upperType.includes('INT') || upperType.includes('UINT') || upperType.includes('WORD')) return 2
  if (upperType.includes('DINT') || upperType.includes('UDINT') || upperType.includes('DWORD') || upperType.includes('REAL')) return 4
  if (upperType.includes('LINT') || upperType.includes('ULINT') || upperType.includes('LWORD') || upperType.includes('LREAL')) return 8
  if (upperType.includes('STRING')) {
    const match = type.match(/STRING\((\d+)\)/)
    return match ? parseInt(match[1]) : 80 // Default string size
  }
  if (upperType.includes('TIME') || upperType.includes('DATE')) return 4
  
  // Arrays
  const arrayMatch = type.match(/ARRAY\[.*\]\s*OF/i)
  if (arrayMatch) {
    // Simplified - would need full parsing
    return 100
  }
  
  return 4 // Default
}
