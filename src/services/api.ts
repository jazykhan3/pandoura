import type { LogicFile, Tag, ValidationResult, SimulatorLog } from '../types'

const API_BASE = 'http://localhost:8000'

// Dummy responses for development (no actual backend needed)
const DUMMY_MODE = true

// Helper to simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper for dummy responses
async function dummyFetch<T>(data: T, delayMs = 300): Promise<T> {
  await delay(delayMs)
  return data
}

// Logic File APIs
export const logicApi = {
  async getAll(): Promise<LogicFile[]> {
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
    const res = await fetch(`${API_BASE}/logic`)
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

  async validate(content: string): Promise<ValidationResult> {
    if (DUMMY_MODE) {
      await delay(500)
      const errors: Array<{
        line: number
        column: number
        severity: 'error' | 'warning' | 'info'
        message: string
      }> = []
      
      // Simple validation rules
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
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
        
        // Check for undefined tags (basic)
        if (line.includes(':=') && !line.includes('VAR')) {
          const match = line.match(/(\w+)\s*:=/)
          if (match && !content.includes(`${match[1]} :`)) {
            errors.push({
              line: i + 1,
              column: 0,
              severity: 'warning',
              message: `Tag '${match[1]}' may not be defined`,
            })
          }
        }
      }
      
      return {
        isValid: !errors.some(e => e.severity === 'error'),
        errors,
      }
    }
    const res = await fetch(`${API_BASE}/logic/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
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
    const res = await fetch(`${API_BASE}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logicId, target: 'shadow' }),
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
}

// Simulator APIs
export const simulatorApi = {
  async run(logicContent: string): Promise<{ success: boolean; message: string }> {
    if (DUMMY_MODE) {
      return dummyFetch({
        success: true,
        message: 'Simulator started',
      }, 400)
    }
    const res = await fetch(`${API_BASE}/simulate/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logic: logicContent }),
    })
    return res.json()
  },

  async step(): Promise<{ success: boolean }> {
    if (DUMMY_MODE) {
      return dummyFetch({ success: true }, 100)
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
}

// Mock ST content
const mockSTContent = `(* PID Temperature Control Loop *)
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

