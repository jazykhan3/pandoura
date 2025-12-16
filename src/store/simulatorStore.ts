import { create } from 'zustand'
import type { SimulatorState, SimulatorLog } from '../types'
import { simulatorApi } from '../services/api'

type SimulatorStoreState = SimulatorState & {
  // Actions
  run: (logicContent: string) => Promise<void>
  pause: () => void
  resume: () => void
  step: () => Promise<void>
  stop: () => void
  setSpeed: (speed: number) => void
  setIOValue: (name: string, value: number | boolean) => Promise<void>
  toggleBreakpoint: (line: number) => void
  addLog: (message: string, type: SimulatorLog['type']) => void
  clearLogs: () => void
  simulateExecution: () => void
}

export const useSimulatorStore = create<SimulatorStoreState>((set, get) => ({
  isRunning: false,
  isPaused: false,
  speed: 1,
  logs: [],
  ioValues: {}, // Dynamically populated from backend based on ST code
  breakpoints: [],
  currentLine: undefined,

  run: async (logicContent: string) => {
    try {
      const result = await simulatorApi.run(logicContent)
      if (result.success) {
        console.log('✅ Simulator run result:', result)
        console.log('📊 Initial ioValues from logic:', result.ioValues)
        
        set({ 
          isRunning: true, 
          isPaused: false,
          currentLine: 1,
          ioValues: result.ioValues || {}, // Load dynamic variables from backend
        })
        
        get().addLog('Simulator started', 'info')
        get().addLog(`Loaded ${Object.keys(result.ioValues || {}).length} variables from code`, 'info')
        
        // Log the initial values for debugging
        Object.entries(result.ioValues || {}).forEach(([name, value]) => {
          get().addLog(`${name}: ${value} (initial from code)`, 'info')
        })
        
        // Start simulation loop after a brief delay to ensure initial values are displayed
        setTimeout(() => {
          if (get().isRunning) {
            get().simulateExecution()
          }
        }, 100)
      }
    } catch (error) {
      console.error('Failed to run simulator:', error)
      get().addLog('Failed to start simulator', 'error')
    }
  },

  pause: () => {
    set({ isPaused: true })
    get().addLog('Simulator paused', 'info')
  },

  resume: () => {
    set({ isPaused: false })
    get().addLog('Simulator resumed', 'info')
    get().simulateExecution()
  },

  step: async () => {
    try {
      await simulatorApi.step()
      const state = get()
      if (state.currentLine !== undefined) {
        set({ currentLine: state.currentLine + 1 })
      }
      get().addLog(`Stepped to line ${get().currentLine}`, 'info')
    } catch (error) {
      console.error('Failed to step:', error)
    }
  },

  stop: () => {
    set({ 
      isRunning: false, 
      isPaused: false,
      currentLine: undefined,
      ioValues: {},  // Clear cached I/O values for completely dynamic behavior
    })
    get().addLog('Simulator stopped', 'info')
  },

  setSpeed: (speed: number) => {
    set({ speed })
    get().addLog(`Speed set to ${speed}x`, 'info')
  },

  setIOValue: async (name: string, value: number | boolean) => {
    try {
      await simulatorApi.setIOValue(name, value)
      set(state => ({
        ioValues: { ...state.ioValues, [name]: value },
      }))
      get().addLog(`${name} set to ${value}`, 'tag_change')
    } catch (error) {
      console.error('Failed to set I/O value:', error)
    }
  },

  toggleBreakpoint: async (line: number) => {
    const state = get()
    const newBreakpoints = state.breakpoints.includes(line)
      ? state.breakpoints.filter(l => l !== line)
      : [...state.breakpoints, line]
    
    try {
      // Update backend
      await simulatorApi.setBreakpoints(newBreakpoints)
      
      set({ breakpoints: newBreakpoints })
      
      const action = newBreakpoints.includes(line) ? 'set' : 'removed'
      get().addLog(`Breakpoint ${action} at line ${line}`, 'info')
    } catch (error) {
      console.error('Failed to toggle breakpoint:', error)
      get().addLog(`Failed to toggle breakpoint at line ${line}`, 'error')
    }
  },

  addLog: (message: string, type: SimulatorLog['type']) => {
    const log: SimulatorLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      message,
      type,
    }
    set(state => ({
      logs: [log, ...state.logs].slice(0, 200), // Keep last 200 logs
    }))
  },

  clearLogs: () => {
    set({ logs: [] })
  },

  // Poll backend for simulator status
  simulateExecution: () => {
    const state = get()
    if (!state.isRunning || state.isPaused) return

    // Poll simulator status and logs to sync with backend
    Promise.all([simulatorApi.getStatus(), simulatorApi.getLogs()]).then(([status, backendLogs]) => {
      const currentState = get()
      if (currentState.isRunning) {
        // Log value updates for debugging
        if (status.ioValues) {
          console.log('🔄 Updating ioValues from backend:', status.ioValues)
        }
        
        // Merge backend logs with local logs (avoid duplicates by timestamp)
        const currentLogIds = new Set(currentState.logs.map(log => log.timestamp + log.message))
        const newLogs = backendLogs.filter(log => !currentLogIds.has(log.timestamp + log.message))
        
        set({
          currentLine: status.currentLine,
          isPaused: status.isPaused,
          ioValues: status.ioValues || {},  // Use empty object when backend returns empty, don't cache old values
          breakpoints: status.breakpoints || currentState.breakpoints,
          logs: [...newLogs, ...currentState.logs].slice(0, 200) // Merge and keep last 200 logs
        })

        // Check if execution was paused by breakpoint
        if (status.isPaused && !currentState.isPaused) {
          get().addLog(`Hit breakpoint at line ${status.currentLine}`, 'warning')
        }

        // Continue polling
        if (currentState.isRunning && !currentState.isPaused) {
          setTimeout(() => get().simulateExecution(), 1000 / currentState.speed)
        }
      }
    }).catch(error => {
      console.error('Failed to get simulator status:', error)
      // Retry polling after error
      if (get().isRunning && !get().isPaused) {
        setTimeout(() => get().simulateExecution(), 2000)
      }
    })
  },
}))

