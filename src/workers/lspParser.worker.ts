// Web Worker for LSP parsing and AST generation
// This runs in a separate thread to prevent UI blocking

export type ParseRequest = {
  id: string
  code: string
  fileUri: string
  parseType: 'full' | 'lazy'
}

export type ParseResult = {
  id: string
  ast?: any
  symbols?: Symbol[]
  diagnostics?: Diagnostic[]
  error?: string
}

export type Symbol = {
  name: string
  kind: string
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

export type Diagnostic = {
  line: number
  column: number
  severity: 'ERROR' | 'WARNING' | 'INFO'
  message: string
  code?: string
}

// Basic ST parser for symbols
function parseStructuredText(code: string): { symbols: Symbol[]; diagnostics: Diagnostic[] } {
  const symbols: Symbol[] = []
  const diagnostics: Diagnostic[] = []
  const lines = code.split('\n')

  // Simple regex-based parsing for common ST structures
  const programRegex = /^\s*PROGRAM\s+(\w+)/i
  const functionRegex = /^\s*FUNCTION\s+(\w+)/i
  const functionBlockRegex = /^\s*FUNCTION_BLOCK\s+(\w+)/i
  const varRegex = /^\s*(\w+)\s*:\s*(\w+)/i

  let inVarBlock = false

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1

    // Detect PROGRAM
    const programMatch = line.match(programRegex)
    if (programMatch) {
      symbols.push({
        name: programMatch[1],
        kind: 'program',
        range: {
          start: { line: lineNumber, character: 0 },
          end: { line: lineNumber, character: line.length },
        },
      })
      return
    }

    // Detect FUNCTION
    const functionMatch = line.match(functionRegex)
    if (functionMatch) {
      symbols.push({
        name: functionMatch[1],
        kind: 'function',
        range: {
          start: { line: lineNumber, character: 0 },
          end: { line: lineNumber, character: line.length },
        },
      })
      return
    }

    // Detect FUNCTION_BLOCK
    const fbMatch = line.match(functionBlockRegex)
    if (fbMatch) {
      symbols.push({
        name: fbMatch[1],
        kind: 'function_block',
        range: {
          start: { line: lineNumber, character: 0 },
          end: { line: lineNumber, character: line.length },
        },
      })
      return
    }

    // Detect VAR blocks
    if (/^\s*VAR(_INPUT|_OUTPUT|_IN_OUT|_GLOBAL)?/i.test(line)) {
      inVarBlock = true
      return
    }

    if (/^\s*END_VAR/i.test(line)) {
      inVarBlock = false
      return
    }

    // Parse variables
    if (inVarBlock) {
      const varMatch = line.match(varRegex)
      if (varMatch) {
        symbols.push({
          name: varMatch[1],
          kind: 'variable',
          range: {
            start: { line: lineNumber, character: 0 },
            end: { line: lineNumber, character: line.length },
          },
        })
      }
    }
  })

  return { symbols, diagnostics }
}

// Lazy parsing - only parse top-level symbols
function lazyParse(code: string): Symbol[] {
  const symbols: Symbol[] = []
  const lines = code.split('\n')

  // Only look for top-level declarations
  const topLevelRegex = /^\s*(PROGRAM|FUNCTION|FUNCTION_BLOCK)\s+(\w+)/i

  lines.forEach((line, idx) => {
    const match = line.match(topLevelRegex)
    if (match) {
      symbols.push({
        name: match[2],
        kind: match[1].toLowerCase().replace('_', ' '),
        range: {
          start: { line: idx + 1, character: 0 },
          end: { line: idx + 1, character: line.length },
        },
      })
    }
  })

  return symbols
}

// Handle messages from main thread
self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const { id, code, parseType } = e.data

  try {
    if (parseType === 'lazy') {
      const symbols = lazyParse(code)
      const result: ParseResult = {
        id,
        symbols,
      }
      self.postMessage(result)
    } else {
      const { symbols, diagnostics } = parseStructuredText(code)
      const result: ParseResult = {
        id,
        symbols,
        diagnostics,
      }
      self.postMessage(result)
    }
  } catch (error) {
    const result: ParseResult = {
      id,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    }
    self.postMessage(result)
  }
}

// Required for TypeScript
export {}
