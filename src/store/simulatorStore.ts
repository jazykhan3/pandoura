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
  ioValues: {
    Temperature_PV: 72.5,
    Temperature_SP: 75.0,
    Heater_Output: 0.0,
    Pump_Run: false,
    Emergency_Stop: false,
    Tank_Level: 50.0,
  },
  breakpoints: [],
  currentLine: undefined,

  run: async (logicContent: string) => {
    try {
      const result = await simulatorApi.run(logicContent)
      if (result.success) {
        set({ 
          isRunning: true, 
          isPaused: false,
          currentLine: 1,
        })
        get().addLog('Simulator started', 'info')
        
        // Start simulation loop
        get().simulateExecution()
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

  toggleBreakpoint: (line: number) => {
    set(state => {
      const breakpoints = state.breakpoints.includes(line)
        ? state.breakpoints.filter(l => l !== line)
        : [...state.breakpoints, line]
      return { breakpoints }
    })
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

  // Internal simulation logic
  simulateExecution: () => {
    const state = get()
    if (!state.isRunning || state.isPaused) return

    // Simulate execution cycle
    setTimeout(() => {
      const currentState = get()
      
      // Simple PID simulation
      const tempPV = currentState.ioValues.Temperature_PV as number
      const tempSP = currentState.ioValues.Temperature_SP as number
      const error = tempSP - tempPV
      
      // Simple proportional control
      let heaterOutput = error * 2.5
      heaterOutput = Math.max(0, Math.min(100, heaterOutput))
      
      // Update temperature based on heater output
      const tempChange = (heaterOutput / 100) * 0.5 - 0.1
      const newTemp = tempPV + tempChange
      
      set(state => ({
        ioValues: {
          ...state.ioValues,
          Temperature_PV: Number(newTemp.toFixed(2)),
          Heater_Output: Number(heaterOutput.toFixed(2)),
        },
      }))

      // Check for breakpoints
      if (currentState.currentLine && currentState.breakpoints.includes(currentState.currentLine)) {
        get().pause()
        get().addLog(`Hit breakpoint at line ${currentState.currentLine}`, 'warning')
        return
      }

      // Continue execution
      if (get().isRunning && !get().isPaused) {
        setTimeout(() => get().simulateExecution(), 1000 / state.speed)
      }
    }, 1000 / state.speed)
  },
}))

