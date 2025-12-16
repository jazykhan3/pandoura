import type { LogicFile, Tag, ValidationResult, SimulatorLog } from '../types'

const API_BASE = 'http://localhost:8000/api'

// Switch to false to use real backend
const DUMMY_MODE = false

// Helper to simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper for dummy responses
async function dummyFetch<T>(data: T, delayMs = 300): Promise<T> {
  await delay(delayMs)
  return data
}

// Logic File APIs
export const logicApi = {
  async getAll(projectId?: string): Promise<LogicFile[]> {
    if (DUMMY_MODE) {
      return dummyFetch([
        {
          id: '1',
          name: 'Temperature_Control.st',
          content: mockSTContent,
          vendor: 'neutral' as const,
          lastModified: new Date().toISOString(),
          author: 'Engineer',
        },
        {
          id: '2',
          name: 'Pump_Control.st',
          content: mockPumpLogic,
          vendor: 'neutral' as const,
          lastModified: new Date(Date.now() - 3600000).toISOString(),
          author: 'Engineer',
        },
      ])
    }
    const url = projectId ? `${API_BASE}/logic?projectId=${projectId}` : `${API_BASE}/logic`;
    const res = await fetch(url)
    return res.json()
  },

  async getById(id: string): Promise<LogicFile> {
    if (DUMMY_MODE) {
      return dummyFetch({
        id,
        name: 'Temperature_Control.st',
        content: mockSTContent,
        vendor: 'neutral' as const,
        lastModified: new Date().toISOString(),
        author: 'Engineer',
      })
    }
    const res = await fetch(`${API_BASE}/logic/${id}`)
    return res.json()
  },

  async create(logic: Partial<LogicFile>): Promise<LogicFile> {
    if (DUMMY_MODE) {
      return dummyFetch({
        id: Math.random().toString(36).substr(2, 9),
        name: logic.name || 'New_Logic.st',
        content: logic.content || '',
        vendor: logic.vendor || 'neutral',
        lastModified: new Date().toISOString(),
        author: 'Engineer',
      })
    }
    const res = await fetch(`${API_BASE}/logic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logic),
    })
    return res.json()
  },

  async update(id: string, logic: Partial<LogicFile>): Promise<LogicFile> {
    if (DUMMY_MODE) {
      return dummyFetch({
        id,
        name: logic.name || 'Temperature_Control.st',
        content: logic.content || mockSTContent,
        vendor: logic.vendor || 'neutral',
        lastModified: new Date().toISOString(),
        author: 'Engineer',
      })
    }
    const res = await fetch(`${API_BASE}/logic/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logic),
    })
    return res.json()
  },

  async validate(content: string, vendor: string = 'neutral'): Promise<ValidationResult> {
    if (DUMMY_MODE) {
      await delay(500)
      const errors: Array<{
        line: number
        column: number
        severity: 'error' | 'warning' | 'info'
        message: string
      }> = []
      
      // Enhanced validation rules with scope awareness
      const lines = content.split('\n')
      const variables = new Set<string>()
      const keywords = new Set(['PROGRAM', 'END_PROGRAM', 'FUNCTION', 'END_FUNCTION', 'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK', 'VAR', 'END_VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_GLOBAL', 'VAR_TEMP', 'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'FOR', 'TO', 'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT', 'CASE', 'OF', 'END_CASE', 'RETURN', 'EXIT', 'AND', 'OR', 'NOT', 'XOR', 'MOD', 'TRUE', 'FALSE'])
      
      let inVarSection = false
      let varSectionCount = 0
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Track VAR sections
        if (line.toUpperCase().startsWith('VAR')) {
          inVarSection = true
          varSectionCount++
        } else if (line.toUpperCase() === 'END_VAR') {
          inVarSection = false
        }
        
        // Collect variable declarations
        if (inVarSection && line.includes(':')) {
          const match = line.match(/^\s*(\w+)\s*:/)
          if (match) {
            variables.add(match[1])
          }
        }
        
        // Check for missing semicolons
        if (line.length > 0 && !line.startsWith('(*') && !line.endsWith(';') && 
            !line.endsWith('THEN') && !line.endsWith('VAR') && !line.endsWith('END_VAR') &&
            !line.includes('PROGRAM') && !line.includes('END_PROGRAM') && 
            !line.includes('END_IF') && line !== ')') {
          errors.push({
            line: i + 1,
            column: line.length,
            severity: 'warning',
            message: 'Statement may be missing semicolon',
          })
        }
        
        // Enhanced undefined variable detection
        if (line.includes(':=') && !inVarSection) {
          const match = line.match(/(\w+)\s*:=/)
          if (match && !variables.has(match[1]) && !keywords.has(match[1].toUpperCase())) {
            errors.push({
              line: i + 1,
              column: 0,
              severity: 'error',
              message: `Undeclared variable '${match[1]}' - not found in any VAR section`,
            })
          }
        }
      }
      
      // Check for multiple VAR sections (warning)
      if (varSectionCount > 1) {
        errors.push({
          line: 1,
          column: 0,
          severity: 'info',
          message: `Found ${varSectionCount} VAR sections - consider consolidating for better readability`,
        })
      }
      
      return {
        isValid: !errors.some(e => e.severity === 'error'),
        errors,
      }
    }
    const res = await fetch(`${API_BASE}/logic/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, vendor }),
    })
    return res.json()
  },

  async loadSamples(): Promise<{
    samples: Array<{
      id: string;
      name: string;
      content: string;
      vendor: string;
      author: string;
      lastModified: string;
      isSample: boolean;
    }>;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        samples: [
          {
            id: 'sample-samplepumplogic',
            name: 'SamplePumpLogic.st',
            content: '(* Sample Pump Logic *)\nPROGRAM PumpControl\nVAR\n  Tank_Level : REAL := 50.0;\nEND_VAR\nEND_PROGRAM',
            vendor: 'neutral',
            author: 'System',
            lastModified: new Date().toISOString(),
            isSample: true
          }
        ]
      }, 200)
    }
    const res = await fetch(`${API_BASE}/logic/samples`)
    return res.json()
  },

  async loadSample(sampleId: string): Promise<{
    success: boolean;
    logicFile?: any;
    message?: string;
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Sample loaded successfully'
      }, 200)
    }
    const res = await fetch(`${API_BASE}/logic/load-sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleId }),
    })
    return res.json()
  },

  async format(content: string, options: any = {}): Promise<{ success: boolean; formatted: string }> {
    if (DUMMY_MODE) {
      // Client-side formatting for dummy mode
      await delay(200)
      const lines = content.split('\n')
      const formatted = []
      let indentLevel = 0
      const indentSize = options.tabSize || 2
      const indent = ' '.repeat(indentSize)
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine === '') {
          formatted.push('')
          continue
        }
        
        if (trimmedLine.toUpperCase().includes('END_')) {
          indentLevel = Math.max(0, indentLevel - 1)
        }
        
        formatted.push(indent.repeat(indentLevel) + trimmedLine)
        
        if (trimmedLine.toUpperCase().includes('VAR') || 
            trimmedLine.toUpperCase().includes('IF') ||
            trimmedLine.toUpperCase().includes('FOR') ||
            trimmedLine.toUpperCase().includes('WHILE') ||
            trimmedLine.toUpperCase().includes('PROGRAM') ||
            trimmedLine.toUpperCase().includes('FUNCTION')) {
          indentLevel++
        }
      }
      
      return {
        success: true,
        formatted: formatted.join('\n')
      }
    }
    
    const res = await fetch(`${API_BASE}/logic/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, options }),
    })
    return res.json()
  },
}

// Sync APIs
export const syncApi = {
  async pushToShadow(logicId: string): Promise<{ success: boolean; message: string }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Logic pushed to shadow runtime successfully',
      }, 800)
    }
    const res = await fetch(`${API_BASE}/logic/${logicId}/push-to-shadow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return res.json()
  },

  async pushToLive(logicId: string): Promise<{ success: boolean; message: string; warnings?: string[] }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Logic deployed to live runtime successfully',
        warnings: ['Some tags were auto-mapped'],
      }, 1200)
    }
    const res = await fetch(`${API_BASE}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logicId, target: 'live' }),
    })
    return res.json()
  },

  async syncTags(): Promise<{ success: boolean; synced: number }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        synced: 10,
      }, 600)
    }
    const res = await fetch(`${API_BASE}/sync/tags`, {
      method: 'POST',
    })
    return res.json()
  },

  async generateConflicts(): Promise<{ success: boolean; conflicts: any[] }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        conflicts: [],
      }, 400)
    }
    const res = await fetch(`${API_BASE}/sync/generate-conflicts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return res.json()
  },

  async resolveConflict(conflictId: string, resolution: 'shadow' | 'live'): Promise<{ success: boolean; message: string }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Conflict resolved',
      }, 300)
    }
    const res = await fetch(`${API_BASE}/sync/resolve-conflict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflictId, resolution }),
    })
    return res.json()
  },
}

// Simulator APIs
export const simulatorApi = {
  async run(logicContent: string, options?: {
    cycleTime?: number;
    initialValues?: Record<string, any>;
  }): Promise<{ 
    success: boolean; 
    message: string;
    executionMode?: string;
    variableCount?: number;
    logicSource?: string;
    logicName?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Simulator started with ST interpreter',
        executionMode: 'interpreter',
        variableCount: 8,
        logicSource: 'direct',
        logicName: 'Unknown'
      }, 400)
    }
    const res = await fetch(`${API_BASE}/simulate/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        logic: logicContent,
        ...options
      }),
    })
    return res.json()
  },

  async step(): Promise<{ 
    success: boolean;
    cycleCount?: number;
    isPaused?: boolean;
    ioValues?: Record<string, any>;
    variables?: Array<{ name: string; value: any }>;
    executionMode?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({ 
        success: true,
        cycleCount: 142,
        isPaused: false,
        ioValues: {
          Tank_Level: 55.3,
          Temperature_PV: 74.1,
          Pump_Motor: true
        },
        executionMode: 'interpreter'
      }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/step`, {
      method: 'POST',
    })
    return res.json()
  },

  async stop(): Promise<{ success: boolean }> {
    if (DUMMY_MODE) {
      return dummyFetch({ success: true }, 200)
    }
    const res = await fetch(`${API_BASE}/simulate/stop`, {
      method: 'POST',
    })
    return res.json()
  },

  async getLogs(): Promise<SimulatorLog[]> {
    if (DUMMY_MODE) {
      return dummyFetch([
        {
          id: '1',
          timestamp: new Date().toISOString(),
          message: 'Simulator initialized',
          type: 'info' as const,
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          message: 'Temperature_PV changed: 72.5 → 73.2',
          type: 'tag_change' as const,
          data: { tag: 'Temperature_PV', oldValue: 72.5, newValue: 73.2 },
        },
      ])
    }
    const res = await fetch(`${API_BASE}/simulate/logs`)
    return res.json()
  },

  async pause(): Promise<{ 
    success: boolean; 
    isPaused?: boolean; 
    message?: string; 
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({ 
        success: true, 
        isPaused: true, 
        message: 'Simulator paused' 
      }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/pause`, {
      method: 'POST',
    })
    return res.json()
  },

  async getStatus(): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    currentLine?: number;
    executionMode?: string;
    cycleCount?: number;
    ioValues?: Record<string, any>;
    breakpoints?: number[];
    variables?: Array<{ name: string; value: any }>;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        isRunning: false,
        isPaused: false,
        currentLine: 1,
        executionMode: 'interpreter',
        cycleCount: 0,
        ioValues: {},  // Empty for completely dynamic behavior
        breakpoints: [],
        variables: []
      }, 200)
    }
    // Make actual backend call - no static fallbacks for completely dynamic behavior
    const res = await fetch(`${API_BASE}/simulate/status`)
    return res.json()
  },

  async reset(): Promise<{ success: boolean; message?: string }> {
    if (DUMMY_MODE) {
      return dummyFetch({ success: true, message: 'Runtime reset' }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/reset`, {
      method: 'POST',
    })
    return res.json()
  },

  async getVariables(): Promise<{ success: boolean; variables: Record<string, any> }> {
    if (DUMMY_MODE) {
      return dummyFetch({ 
        success: true,
        variables: {}  // Empty for completely dynamic behavior
      }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/variables`)
    return res.json()
  },

  async getVariable(name: string): Promise<{ success: boolean; variable: string; value: any }> {
    if (DUMMY_MODE) {
      return dummyFetch({ 
        success: true,
        variable: name,
        value: 72.5
      }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/variables/${name}`)
    return res.json()
  },

  async setVariable(name: string, value: any): Promise<{ success: boolean; variable: string; value: any }> {
    if (DUMMY_MODE) {
      return dummyFetch({ 
        success: true,
        variable: name,
        value
      }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/variables/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    return res.json()
  },

  async setBreakpoints(breakpoints: number[]): Promise<{ 
    success: boolean; 
    breakpoints?: number[];
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({ 
        success: true, 
        breakpoints 
      }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/breakpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ breakpoints }),
    })
    return res.json()
  },

  async setIOValue(name: string, value: number | boolean): Promise<{ success: boolean }> {
    if (DUMMY_MODE) {
      return dummyFetch({ success: true }, 100)
    }
    const res = await fetch(`${API_BASE}/simulate/io`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value }),
    })
    return res.json()
  },
}

// Tag APIs
export const tagApi = {
  async getAll(): Promise<Tag[]> {
    if (DUMMY_MODE) {
      return dummyFetch([
        { 
          id: '1', 
          name: 'Temperature_PV', 
          type: 'REAL' as const, 
          value: 72.5, 
          address: 'DB1.DBD0', 
          lastUpdate: new Date(),
          source: 'live' as const,
          metadata: { description: 'Process Variable', units: '°C' },
        },
        { 
          id: '2', 
          name: 'Temperature_SP', 
          type: 'REAL' as const, 
          value: 75.0, 
          address: 'DB1.DBD4', 
          lastUpdate: new Date(),
          source: 'shadow' as const,
          metadata: { description: 'Setpoint', units: '°C' },
        },
        { 
          id: '3', 
          name: 'Heater_Output', 
          type: 'REAL' as const, 
          value: 45.2, 
          address: 'DB1.DBD8', 
          lastUpdate: new Date(),
          source: 'shadow' as const,
          metadata: { description: 'Control Output', units: '%' },
        },
        { 
          id: '4', 
          name: 'Pump_Run', 
          type: 'BOOL' as const, 
          value: true, 
          address: 'DB1.DBX12.0', 
          lastUpdate: new Date(),
          source: 'live' as const,
        },
        { 
          id: '5', 
          name: 'Tank_Level', 
          type: 'REAL' as const, 
          value: 50.0, 
          address: 'DB1.DBD12', 
          lastUpdate: new Date(),
          source: 'live' as const,
          metadata: { description: 'Tank Level', units: '%' },
        },
        { 
          id: '6', 
          name: 'Emergency_Stop', 
          type: 'BOOL' as const, 
          value: false, 
          address: 'DB1.DBX12.1', 
          lastUpdate: new Date(),
          source: 'live' as const,
        },
        { 
          id: '7', 
          name: 'Error', 
          type: 'REAL' as const, 
          value: 2.5, 
          address: 'DB1.DBD16', 
          lastUpdate: new Date(),
          source: 'shadow' as const,
        },
        { 
          id: '8', 
          name: 'Kp', 
          type: 'REAL' as const, 
          value: 2.5, 
          address: 'DB1.DBD20', 
          lastUpdate: new Date(),
          source: 'shadow' as const,
          metadata: { description: 'Proportional Gain' },
        },
        { 
          id: '9', 
          name: 'Ki', 
          type: 'REAL' as const, 
          value: 0.1, 
          address: 'DB1.DBD24', 
          lastUpdate: new Date(),
          source: 'shadow' as const,
          metadata: { description: 'Integral Gain' },
        },
        { 
          id: '10', 
          name: 'Kd', 
          type: 'REAL' as const, 
          value: 0.5, 
          address: 'DB1.DBD28', 
          lastUpdate: new Date(),
          source: 'shadow' as const,
          metadata: { description: 'Derivative Gain' },
        },
      ])
    }
    const res = await fetch(`${API_BASE}/tags`)
    return res.json()
  },

  async create(tag: Partial<Tag>): Promise<Tag> {
    if (DUMMY_MODE) {
      return dummyFetch({
        id: Math.random().toString(36).substr(2, 9),
        name: tag.name || 'NewTag',
        type: tag.type || 'BOOL',
        value: tag.value ?? false,
        address: tag.address || 'DB1.DBX0.0',
        lastUpdate: new Date(),
        source: 'shadow' as const,
      })
    }
    const res = await fetch(`${API_BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tag),
    })
    return res.json()
  },

  async update(id: string, tag: Partial<Tag>): Promise<Tag> {
    if (DUMMY_MODE) {
      return dummyFetch({
        id,
        name: tag.name || 'UpdatedTag',
        type: tag.type || 'BOOL',
        value: tag.value ?? false,
        address: tag.address || 'DB1.DBX0.0',
        lastUpdate: new Date(),
        source: tag.source || 'shadow',
      })
    }
    const res = await fetch(`${API_BASE}/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tag),
    })
    return res.json()
  },

  async exportTags(): Promise<Blob> {
    const res = await fetch(`${API_BASE}/tags/export`)
    return res.blob()
  },

  async importTags(file: File, replaceExisting: boolean = false): Promise<{
    success: boolean
    created: number
    updated: number
    skipped: number
    errors?: Array<{ tag: string; error: string }>
  }> {
    const text = await file.text()
    const data = JSON.parse(text)
    
    const res = await fetch(`${API_BASE}/tags/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: data.tags,
        replaceExisting
      }),
    })
    return res.json()
  },

  async syncFromSimulator(): Promise<{
    success: boolean
    created: number
    updated: number
  }> {
    const res = await fetch(`${API_BASE}/tags/sync-from-simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    return res.json()
  },

  // Enhanced Tag Database Features
  async getUDTs(projectId?: string): Promise<any[]> {
    const params = projectId ? `?projectId=${projectId}` : ''
    const res = await fetch(`${API_BASE}/tags/udts${params}`)
    return res.json()
  },

  async createUDT(udtData: any, projectId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/udts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...udtData, projectId }),
    })
    return res.json()
  },

  async getHierarchy(projectId?: string): Promise<any[]> {
    const params = projectId ? `?projectId=${projectId}` : ''
    const res = await fetch(`${API_BASE}/tags/hierarchy${params}`)
    return res.json()
  },

  async bulkOperation(operation: {
    operation: string
    params?: any
    tagIds: string[]
    dryRun: boolean
    projectId?: string
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operation),
    })
    return res.json()
  },

  async getRefactoringPreview(tagId: string, newName: string, projectId?: string): Promise<any> {
    const params = new URLSearchParams({ newName })
    if (projectId) params.append('projectId', projectId)
    const res = await fetch(`${API_BASE}/tags/${tagId}/refactor-preview?${params}`)
    return res.json()
  },

  async applyRefactoring(preview: any, projectId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/refactor-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...preview, projectId }),
    })
    return res.json()
  },

  async previewImport(file: File, vendor: string, projectId?: string): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('vendor', vendor)
    if (projectId) formData.append('projectId', projectId)
    
    const res = await fetch(`${API_BASE}/tags/import-preview`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  async getDependencies(tagId: string, projectId?: string): Promise<any> {
    const params = projectId ? `?projectId=${projectId}` : ''
    const res = await fetch(`${API_BASE}/tags/${tagId}/dependencies${params}`)
    return res.json()
  },

  async getTagDependencies(tagId: string, projectId?: string): Promise<any[]> {
    return this.getDependencies(tagId, projectId)
  },

  async saveTagAliases(tagId: string, aliases: any[], projectId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/${tagId}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aliases, projectId }),
    })
    return res.json()
  },

  async getTagAliases(tagId: string, projectId?: string): Promise<any[]> {
    const params = projectId ? `?projectId=${projectId}` : ''
    const res = await fetch(`${API_BASE}/tags/${tagId}/aliases${params}`)
    return res.json()
  },

  async saveTagValidationRules(tagId: string, rules: any[], projectId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/${tagId}/validation-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules, projectId }),
    })
    return res.json()
  },

  async getTagValidationRules(tagId: string, projectId?: string): Promise<any[]> {
    const params = projectId ? `?projectId=${projectId}` : ''
    const res = await fetch(`${API_BASE}/tags/${tagId}/validation-rules${params}`)
    return res.json()
  },

  async addValidationRule(tagId: string, rule: any): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/${tagId}/validation-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    })
    return res.json()
  },

  async addAlias(tagId: string, alias: any): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/${tagId}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alias),
    })
    return res.json()
  },

  async updateLifecycle(tagId: string, lifecycle: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/${tagId}/lifecycle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lifecycle }),
    })
    return res.json()
  },

  async updateScope(tagId: string, scope: string, locked: boolean = false): Promise<any> {
    const res = await fetch(`${API_BASE}/tags/${tagId}/scope`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, locked }),
    })
    return res.json()
  },
}

// PLC Execution APIs
export const plcApi = {
  async execute(stCode: string, options?: {
    programName?: string;
    timeout?: number;
    simulateOnly?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      executionMode: 'beremiz' | 'simulation';
      result: {
        variables?: Record<string, any>;
        executionLog?: Array<{
          line: number;
          statement: string;
          executed: boolean;
          timestamp: string;
        }>;
        output?: string;
        errors?: string;
        cycleTime?: number;
        status?: string;
        note?: string;
      };
      variables?: Array<{
        name: string;
        type: string;
        initialValue?: string;
      }>;
      xmlGenerated?: boolean;
    };
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        data: {
          executionMode: 'simulation' as const,
          result: {
            variables: {
              'Temperature_PV': 72.5,
              'Temperature_SP': 75.0,
              'Heater_Output': 45.2,
              'Pump_Run': true
            },
            executionLog: [
              { line: 1, statement: 'Error := Temperature_SP - Temperature_PV;', executed: true, timestamp: new Date().toISOString() },
              { line: 2, statement: 'Integral := Integral + Error;', executed: true, timestamp: new Date().toISOString() }
            ],
            cycleTime: 5.2,
            status: 'completed',
            note: 'Execution simulated - Beremiz runtime not available'
          },
          variables: [
            { name: 'Temperature_PV', type: 'REAL', initialValue: '72.5' },
            { name: 'Temperature_SP', type: 'REAL', initialValue: '75.0' }
          ],
          xmlGenerated: true
        }
      }, 800);
    }

    const res = await fetch(`${API_BASE}/plc/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stCode,
        ...options
      }),
    });
    return res.json();
  },

  async validate(stCode: string): Promise<{
    success: boolean;
    validation?: {
      isValid: boolean;
      errors: Array<{
        line: number;
        message: string;
        type: string;
      }>;
      warnings: Array<{
        line: number;
        message: string;
        type: string;
      }>;
      hasVariables: boolean;
    };
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        validation: {
          isValid: true,
          errors: [],
          warnings: [
            { line: 15, message: 'Statement might be missing semicolon', type: 'syntax' }
          ],
          hasVariables: true
        }
      }, 300);
    }

    const res = await fetch(`${API_BASE}/plc/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stCode }),
    });
    return res.json();
  },

  async getStatus(): Promise<{
    success: boolean;
    status?: {
      isRunning: boolean;
      currentExecution?: {
        startTime: string;
        programName: string;
        codeLength: number;
      };
      lastResult?: {
        success: boolean;
        executionMode: string;
        variableCount: number;
      };
      executionHistory: Array<{
        startTime: string;
        endTime: string;
        result: string;
        executionMode: string;
        programName: string;
      }>;
    };
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        status: {
          isRunning: false,
          lastResult: {
            success: true,
            executionMode: 'simulation',
            variableCount: 4
          },
          executionHistory: []
        }
      }, 200);
    }

    const res = await fetch(`${API_BASE}/plc/status`);
    return res.json();
  },

  async getCapabilities(): Promise<{
    success: boolean;
    capabilities?: {
      beremizAvailable: boolean;
      supportedLanguages: string[];
      supportedFormats: string[];
      simulationMode: boolean;
      realTimeExecution: boolean;
      features: {
        syntaxValidation: boolean;
        variableExtraction: boolean;
        xmlGeneration: boolean;
        executionHistory: boolean;
      };
    };
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        capabilities: {
          beremizAvailable: false,
          supportedLanguages: ['ST'],
          supportedFormats: ['PLCOpen XML'],
          simulationMode: true,
          realTimeExecution: false,
          features: {
            syntaxValidation: true,
            variableExtraction: true,
            xmlGeneration: true,
            executionHistory: true
          }
        }
      }, 200);
    }

    const res = await fetch(`${API_BASE}/plc/capabilities`);
    return res.json();
  },

  async convertToXml(stCode: string, programName?: string): Promise<{
    success: boolean;
    data?: {
      xmlContent: string;
      variables: Array<{
        name: string;
        type: string;
        initialValue?: string;
      }>;
      programName: string;
      generatedAt: string;
    };
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        data: {
          xmlContent: '<?xml version="1.0" encoding="UTF-8"?>...',
          variables: [
            { name: 'Temperature_PV', type: 'REAL', initialValue: '72.5' }
          ],
          programName: programName || 'Main',
          generatedAt: new Date().toISOString()
        }
      }, 400);
    }

    const res = await fetch(`${API_BASE}/plc/convert-to-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stCode,
        programName
      }),
    });
    return res.json();
  },

  async clearHistory(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Execution history cleared'
      }, 200);
    }

    const res = await fetch(`${API_BASE}/plc/clear-history`, {
      method: 'DELETE'
    });
    return res.json();
  }
}

// Version Control APIs
export const versionApi = {
  // Branches
  async getBranches(projectId: string | number) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/branches`);
    return res.json();
  },

  async createBranch(projectId: string | number, data: {
    name: string;
    stage: string;
    parentBranchId?: string;
    description?: string;
    createdBy?: string;
  }) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteBranch(branchId: string) {
    const res = await fetch(`${API_BASE}/versions/branches/${branchId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Versions
  async getVersions(projectId: string, filters?: {
    branchId?: string;
    status?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.branchId) params.append('branchId', filters.branchId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const url = `${API_BASE}/versions/projects/${projectId}/versions${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  async getVersionById(versionId: string) {
    const res = await fetch(`${API_BASE}/versions/${versionId}`);
    return res.json();
  },

  async getVersionFiles(versionId: string) {
    const res = await fetch(`${API_BASE}/versions/${versionId}/files`);
    return res.json();
  },

  async createVersion(projectId: number | string, data: {
    branch_id: number | string;
    message: string;
    author: string;
    tags?: string[];
    files: Array<{ path: string; content: string; type?: string }>;
  }) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateVersionStatus(versionId: string, status: string, actor: string) {
    const res = await fetch(`${API_BASE}/versions/${versionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actor }),
    });
    return res.json();
  },

  async signVersion(versionId: string, signedBy: string) {
    const res = await fetch(`${API_BASE}/versions/${versionId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedBy }),
    });
    return res.json();
  },

  async approveVersion(versionId: string, approver: string) {
    const res = await fetch(`${API_BASE}/versions/${versionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver }),
    });
    return res.json();
  },

  async getVersionFiles(versionId: string) {
    const res = await fetch(`${API_BASE}/versions/${versionId}/files`);
    return res.json();
  },

  async compareVersions(versionId1: string, versionId2: string) {
    const res = await fetch(`${API_BASE}/versions/compare/${versionId1}/${versionId2}`);
    return res.json();
  },

  // Snapshots
  async getSnapshots(projectId: string) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/snapshots`);
    return res.json();
  },

  async getSnapshotById(snapshotId: string) {
    const res = await fetch(`${API_BASE}/versions/snapshots/${snapshotId}`);
    return res.json();
  },

  async createSnapshot(projectId: string, data: {
    versionId: string;
    name: string;
    description?: string;
    createdBy: string;
    tags?: string[];
  }) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Releases
  async getReleases(projectId: string, filters?: { status?: string; environment?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.environment) params.append('environment', filters.environment);

    const url = `${API_BASE}/versions/projects/${projectId}/releases${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  async getReleaseById(releaseId: string) {
    const res = await fetch(`${API_BASE}/versions/releases/${releaseId}`);
    return res.json();
  },

  async getRelease(projectId: string, releaseId: string) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/releases/${releaseId}`);
    return res.json();
  },

  async getReleaseSafetyChecks(releaseId: string) {
    const res = await fetch(`${API_BASE}/versions/releases/${releaseId}/safety-checks`);
    return res.json();
  },

  async runSafetyChecks(releaseId: string) {
    const res = await fetch(`${API_BASE}/versions/releases/${releaseId}/run-safety-checks`, {
      method: 'POST'
    });
    return res.json();
  },

  async initiateDeploy(releaseId: string, environment: string, strategy: string = 'atomic') {
    const res = await fetch(`${API_BASE}/deploy/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        releaseId, 
        environment, 
        strategy,
        initiatedBy: 'current-user' 
      }),
    });
    return res.json();
  },

  async createRelease(projectId: string, data: {
    snapshotId: string;
    versionId: string;
    name: string;
    version: string;
    description?: string;
    createdBy: string;
    stage?: string; // Add stage support
    tags?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async promoteRelease(releaseId: string, targetEnvironment: string, promotedBy: string) {
    const res = await fetch(`${API_BASE}/versions/releases/${releaseId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEnvironment, promotedBy }),
    });
    return res.json();
  },

  async signRelease(releaseId: string, signedBy: string) {
    const res = await fetch(`${API_BASE}/versions/releases/${releaseId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedBy }),
    });
    return res.json();
  },

  // History and Stats
  async getHistory(projectId: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const url = `${API_BASE}/versions/projects/${projectId}/history${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  async getStats(projectId: string) {
    const res = await fetch(`${API_BASE}/versions/projects/${projectId}/stats`);
    return res.json();
  },
}

// Deployment APIs
export const deploymentApi = {
  // Create deployment
  async createDeployment(projectId: string, deploymentData: any) {
    const res = await fetch(`${API_BASE}/deploy/projects/${projectId}/deployments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deploymentData),
    });
    return res.json();
  },

  // Get deployments
  async getDeployments(projectId: string, filters?: { environment?: string; status?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.environment) params.append('environment', filters.environment);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const url = `${API_BASE}/deploy/projects/${projectId}/deployments${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  // Get deployment by ID
  async getDeploymentById(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}`);
    return res.json();
  },

  // Start deployment
  async startDeployment(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  // Pause deployment
  async pauseDeployment(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  // Cancel deployment
  async cancelDeployment(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  // Safety checks
  async getDeploymentChecks(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/checks`);
    return res.json();
  },

  async rerunChecks(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/checks/rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  // Approvals
  async getDeploymentApprovals(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/approvals`);
    return res.json();
  },

  async getDeploymentApprovals(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/approvals`);
    return res.json();
  },

  async submitApproval(approvalId: string, approverName: string, status: 'approved' | 'rejected', comment?: string) {
    const res = await fetch(`${API_BASE}/deploy/approvals/${approvalId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverName, status, comment }),
    });
    return res.json();
  },

  // Deployment logs
  async getDeploymentLogs(deployId: string, filters?: { limit?: number; level?: string }) {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.level) params.append('level', filters.level);

    const url = `${API_BASE}/deploy/deployments/${deployId}/logs${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  // Rollback
  async executeRollback(deployId: string, triggeredBy: string, reason: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggeredBy, reason }),
    });
    return res.json();
  },

  async getRollbackHistory(deployId: string) {
    const res = await fetch(`${API_BASE}/deploy/deployments/${deployId}/rollbacks`);
    return res.json();
  },

  // Snapshot promotions
  async promoteSnapshot(snapshotId: string, toStage: string, promotedBy: string, notes?: string) {
    const res = await fetch(`${API_BASE}/deploy/snapshots/${snapshotId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStage, promotedBy, notes }),
    });
    return res.json();
  },

  async getPromotionHistory(snapshotId: string) {
    const res = await fetch(`${API_BASE}/deploy/snapshots/${snapshotId}/promotions`);
    return res.json();
  },

  // Deployment stats
  async getDeploymentStats(projectId: string) {
    const res = await fetch(`${API_BASE}/deploy/projects/${projectId}/stats`);
    return res.json();
  },
}

// Mock data
const mockSTContent = `(* Temperature Control System *)
PROGRAM Temperature_Control
VAR
  Temperature_PV : REAL := 72.5;      (* Process Variable *)
  Temperature_SP : REAL := 75.0;      (* Setpoint *)
  Heater_Output : REAL := 0.0;        (* Control Output 0-100% *)
  
  (* PID Parameters *)
  Kp : REAL := 2.5;                   (* Proportional Gain *)
  Ki : REAL := 0.1;                   (* Integral Gain *)
  Kd : REAL := 0.5;                   (* Derivative Gain *)
  
  Error : REAL;
  Last_Error : REAL := 0.0;
  Integral : REAL := 0.0;
  Derivative : REAL;
END_VAR

(* Calculate error *)
Error := Temperature_SP - Temperature_PV;

(* Integral accumulation with anti-windup *)
Integral := Integral + Error;
IF Integral > 100.0 THEN Integral := 100.0; END_IF;
IF Integral < -100.0 THEN Integral := -100.0; END_IF;

(* Derivative calculation *)
Derivative := Error - Last_Error;

(* PID Output calculation *)
Heater_Output := (Kp * Error) + (Ki * Integral) + (Kd * Derivative);

(* Clamp output to 0-100% *)
IF Heater_Output > 100.0 THEN 
  Heater_Output := 100.0; 
ELSIF Heater_Output < 0.0 THEN 
  Heater_Output := 0.0;
END_IF;

(* Save error for next cycle *)
Last_Error := Error;

END_PROGRAM`

const mockPumpLogic = `(* Pump Control Logic *)
PROGRAM Pump_Control
VAR
  Pump_Run : BOOL := FALSE;
  Tank_Level : REAL := 50.0;
  Level_High : REAL := 80.0;
  Level_Low : REAL := 20.0;
  Emergency_Stop : BOOL := FALSE;
END_VAR

(* Start pump if level is low *)
IF Tank_Level < Level_Low AND NOT Emergency_Stop THEN
  Pump_Run := TRUE;
END_IF;

(* Stop pump if level is high *)
IF Tank_Level > Level_High OR Emergency_Stop THEN
  Pump_Run := FALSE;
END_IF;

END_PROGRAM`

// Audit Log APIs
export const auditApi = {
  async getEntries(filters: Record<string, any> = {}): Promise<any> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value)
    })
    
    const res = await fetch(`${API_BASE}/audit/entries?${params}`)
    return res.json()
  },

  async getStats(): Promise<any> {
    const res = await fetch(`${API_BASE}/audit/stats`)
    return res.json()
  },

  async checkIntegrity(): Promise<any> {
    const res = await fetch(`${API_BASE}/audit/integrity`)
    return res.json()
  },

  async createEntry(entry: {
    event_type: string
    actor: string
    resource: string
    action: string
    details?: Record<string, any>
    metadata?: Record<string, any>
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/audit/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    })
    return res.json()
  }
}

