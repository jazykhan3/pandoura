// ST (Structured Text) Parser - Dynamically extracts symbols from PLC code
import type { SymbolType } from '../types'

export interface ParsedSymbol {
  name: string
  type: SymbolType
  dataType?: string
  line: number
  column: number
  scope: string
  content?: string
  children?: ParsedSymbol[]
  references?: Array<{ line: number; column: number; context: string }>
  isUsed: boolean
  description?: string
}

/**
 * Main parser function - extracts all symbols from ST code
 */
export function parseSTCode(content: string): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = []
  const lines = content.split('\n')
  let currentScope = 'global'
  let currentBlockName = ''
  let currentBlockStart = 0

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('(*')) return

    // Parse PROGRAM declarations
    const programMatch = trimmed.match(/^PROGRAM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
    if (programMatch) {
      currentScope = programMatch[1]
      currentBlockName = programMatch[1]
      currentBlockStart = lineNumber
      
      symbols.push({
        name: programMatch[1],
        type: 'program',
        line: lineNumber,
        column: trimmed.indexOf(programMatch[1]),
        scope: 'global',
        children: [],
        references: [],
        isUsed: true,
      })
      return
    }

    // Parse FUNCTION declarations
    const functionMatch = trimmed.match(/^FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/i)
    if (functionMatch) {
      currentScope = functionMatch[1]
      currentBlockName = functionMatch[1]
      currentBlockStart = lineNumber
      
      symbols.push({
        name: functionMatch[1],
        type: 'function',
        dataType: functionMatch[2],
        line: lineNumber,
        column: trimmed.indexOf(functionMatch[1]),
        scope: 'global',
        children: [],
        references: [],
        isUsed: true,
      })
      return
    }

    // Parse FUNCTION_BLOCK declarations
    const fbMatch = trimmed.match(/^FUNCTION_BLOCK\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
    if (fbMatch) {
      currentScope = fbMatch[1]
      currentBlockName = fbMatch[1]
      currentBlockStart = lineNumber
      
      symbols.push({
        name: fbMatch[1],
        type: 'function_block',
        line: lineNumber,
        column: trimmed.indexOf(fbMatch[1]),
        scope: 'global',
        children: [],
        references: [],
        isUsed: true,
      })
      return
    }

    // Parse variable declarations in VAR blocks
    if (trimmed.match(/^VAR(?:_INPUT|_OUTPUT|_IN_OUT|_GLOBAL|_TEMP)?$/i)) {
      return
    }

    if (trimmed.match(/^END_VAR$/i)) {
      return
    }

    // Parse variable declarations
    const varMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?)/i)
    if (varMatch && !trimmed.startsWith('END_')) {
      const varName = varMatch[1]
      const varType = varMatch[2]
      
      // Check if it's a UDT (contains struct-like patterns)
      const isUDT = varType.toUpperCase().includes('STRUCT') || 
                    symbols.some(s => s.type === 'udt' && s.name === varType)

      const variable: ParsedSymbol = {
        name: varName,
        type: isUDT ? 'udt' : 'variable',
        dataType: varType,
        line: lineNumber,
        column: trimmed.indexOf(varName),
        scope: currentScope,
        references: [],
        isUsed: false,
      }

      // Add as child to current block if inside one
      if (currentBlockName) {
        const parentSymbol = symbols.find(s => s.name === currentBlockName && s.line === currentBlockStart)
        if (parentSymbol && parentSymbol.children) {
          parentSymbol.children.push(variable)
        }
      } else {
        symbols.push(variable)
      }
    }

    // Parse TYPE declarations (UDTs)
    const typeMatch = trimmed.match(/^TYPE\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        type: 'udt',
        line: lineNumber,
        column: trimmed.indexOf(typeMatch[1]),
        scope: 'global',
        children: [],
        references: [],
        isUsed: false,
      })
    }

    // Reset scope on END_PROGRAM, END_FUNCTION, END_FUNCTION_BLOCK
    if (trimmed.match(/^END_(PROGRAM|FUNCTION|FUNCTION_BLOCK)$/i)) {
      currentScope = 'global'
      currentBlockName = ''
      currentBlockStart = 0
    }
  })

  // Find references for each symbol
  symbols.forEach(symbol => {
    findSymbolReferences(symbol, lines)
  })

  // Calculate usage
  symbols.forEach(symbol => {
    symbol.isUsed = (symbol.references?.length || 0) > 0 || 
                    symbol.type === 'program' || 
                    symbol.type === 'function' || 
                    symbol.type === 'function_block'
  })

  return symbols
}

/**
 * Find all references to a symbol in the code
 */
function findSymbolReferences(symbol: ParsedSymbol, lines: string[]) {
  const references: Array<{ line: number; column: number; context: string }> = []
  
  // Escape special regex characters
  const escapedName = symbol.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escapedName}\\b`, 'g')

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    
    // Skip the declaration line
    if (lineNumber === symbol.line) return
    
    // Skip comments
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('(*')) return

    // Find all matches in this line
    let match
    // Reset regex for each line
    regex.lastIndex = 0
    while ((match = regex.exec(line)) !== null) {
      references.push({
        line: lineNumber,
        column: match.index,
        context: line.trim(),
      })
    }
  })

  symbol.references = references
}

/**
 * Extract only routines (programs, functions, function blocks) for code lenses
 */
export function extractRoutines(content: string): Array<{
  name: string
  type: 'program' | 'function' | 'function_block'
  line: number
  endLine: number
}> {
  const routines: Array<{
    name: string
    type: 'program' | 'function' | 'function_block'
    line: number
    endLine: number
  }> = []
  
  const lines = content.split('\n')
  let currentRoutine: typeof routines[0] | null = null

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()

    // Start of routine
    const programMatch = trimmed.match(/^PROGRAM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
    const functionMatch = trimmed.match(/^FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
    const fbMatch = trimmed.match(/^FUNCTION_BLOCK\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)

    if (programMatch) {
      currentRoutine = { name: programMatch[1], type: 'program', line: lineNumber, endLine: lineNumber }
    } else if (functionMatch) {
      currentRoutine = { name: functionMatch[1], type: 'function', line: lineNumber, endLine: lineNumber }
    } else if (fbMatch) {
      currentRoutine = { name: fbMatch[1], type: 'function_block', line: lineNumber, endLine: lineNumber }
    }

    // End of routine
    if (currentRoutine && trimmed.match(/^END_(PROGRAM|FUNCTION|FUNCTION_BLOCK)$/i)) {
      currentRoutine.endLine = lineNumber
      routines.push(currentRoutine)
      currentRoutine = null
    }
  })

  return routines
}

/**
 * Rename a symbol across the entire code
 */
export function renameSymbol(content: string, oldName: string, newName: string): {
  content: string
  changes: number
  affectedLines: number[]
} {
  console.log('=== renameSymbol called ===')
  console.log('oldName:', oldName)
  console.log('newName:', newName)
  console.log('content length:', content.length)
  
  const lines = content.split('\n')
  console.log('Total lines:', lines.length)
  
  const affectedLines: number[] = []
  let changes = 0

  // Escape special regex characters in oldName
  const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  console.log('Escaped old name:', escapedOldName)
  
  const newLines = lines.map((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()
    
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('(*')) return line

    // Create a new regex for each line to avoid lastIndex issues
    const regex = new RegExp(`\\b${escapedOldName}\\b`, 'g')
    
    // Check if line contains the symbol
    const matches = line.match(regex)
    if (matches && matches.length > 0) {
      console.log(`Line ${lineNumber}: Found ${matches.length} match(es) - "${line.trim()}"`)
      affectedLines.push(lineNumber)
      changes += matches.length
      const newLine = line.replace(regex, newName)
      console.log(`  -> Replaced: "${newLine.trim()}"`)
      return newLine
    }
    
    return line
  })

  console.log('=== renameSymbol result ===')
  console.log('Total changes:', changes)
  console.log('Affected lines:', affectedLines)

  return {
    content: newLines.join('\n'),
    changes,
    affectedLines,
  }
}

/**
 * Extract a function from selected code
 */
export function extractFunction(
  content: string, 
  startLine: number, 
  endLine: number, 
  functionName: string,
  returnType: string = 'VOID'
): {
  newContent: string
  extractedCode: string
  functionDeclaration: string
} {
  const lines = content.split('\n')
  
  // Extract the selected lines
  const extractedLines = lines.slice(startLine - 1, endLine)
  const extractedCode = extractedLines.join('\n')

  // Create function declaration
  const functionDeclaration = `
FUNCTION ${functionName} : ${returnType}
VAR
  (* Add variables here *)
END_VAR

${extractedCode}

END_FUNCTION
`

  // Replace selected code with function call
  const beforeLines = lines.slice(0, startLine - 1)
  const afterLines = lines.slice(endLine)
  const functionCall = `${functionName}();`
  
  const newContent = [
    ...beforeLines,
    functionCall,
    ...afterLines,
    '',
    functionDeclaration
  ].join('\n')

  return {
    newContent,
    extractedCode,
    functionDeclaration,
  }
}

/**
 * Analyze code complexity for a routine
 */
export function analyzeRoutineComplexity(content: string, routineName: string): {
  cyclomaticComplexity: number
  linesOfCode: number
  numberOfVariables: number
  numberOfBranches: number
} {
  const lines = content.split('\n')
  let inRoutine = false
  let linesOfCode = 0
  let numberOfBranches = 0
  let numberOfVariables = 0

  const branchKeywords = ['IF', 'ELSIF', 'CASE', 'FOR', 'WHILE', 'REPEAT', 'AND', 'OR']

  lines.forEach(line => {
    const trimmed = line.trim()

    if (trimmed.match(new RegExp(`^(PROGRAM|FUNCTION|FUNCTION_BLOCK)\\s+${routineName}`, 'i'))) {
      inRoutine = true
      return
    }

    if (inRoutine) {
      if (trimmed.match(/^END_(PROGRAM|FUNCTION|FUNCTION_BLOCK)$/i)) {
        inRoutine = false
        return
      }

      // Count lines of code (excluding comments and empty lines)
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('(*')) {
        linesOfCode++
      }

      // Count branches
      branchKeywords.forEach(keyword => {
        if (trimmed.toUpperCase().includes(keyword)) {
          numberOfBranches++
        }
      })

      // Count variable declarations
      if (trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*:/)) {
        numberOfVariables++
      }
    }
  })

  // Cyclomatic complexity = branches + 1
  const cyclomaticComplexity = numberOfBranches + 1

  return {
    cyclomaticComplexity,
    linesOfCode,
    numberOfVariables,
    numberOfBranches,
  }
}
