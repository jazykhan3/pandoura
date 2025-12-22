import { create } from 'zustand'
import type { SyncStatus, SyncConflict, SyncEvent } from '../types'
import { syncWebSocket } from '../services/websocket'
import { syncApi } from '../services/api'
import { deviceAuth } from '../utils/deviceAuth'

type DeployedLogic = {
  id: string
  name: string
  content: string
  vendor?: string
  author?: string
  deployedAt: string
  status: string
}

type SyncState = {
  status: SyncStatus
  events: SyncEvent[]
  isPushing: boolean
  deployedLogic: DeployedLogic | null
  
  // Actions
  connect: (projectId: string) => void
  disconnect: () => void
  pushToShadow: (logicId: string) => Promise<boolean>
  pushToLive: (logicId: string) => Promise<boolean>
  resolveConflict: (conflictId: string, resolution: 'shadow' | 'live') => void
  syncTags: () => Promise<void>
  simulateConflicts: () => void
  fetchDeployedLogic: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: {
    connected: false,
    shadowOk: false,
    liveOk: false,
    lastSync: null,
    latency: 0,
    conflicts: [],
  },
  events: [],
  isPushing: false,
  deployedLogic: null,

  connect: (projectId: string) => {
    syncWebSocket.connect(projectId)

    // Fetch initial sync status and deployed logic
    get().fetchDeployedLogic()

    // Listen to WebSocket messages
    syncWebSocket.on((message) => {
      switch (message.type) {
        case 'connect':
          set(state => ({
            status: { ...state.status, connected: true },
          }))
          break

        case 'heartbeat': {
          const payload = message.payload as { latency: number }
          set(state => ({
            status: { ...state.status, latency: payload.latency },
          }))
          break
        }

        case 'sync_status': {
          const payload = message.payload as Partial<SyncStatus>
          set(state => ({
            status: { ...state.status, ...payload },
          }))
          break
        }

        case 'conflict': {
          const conflict = message.payload as SyncConflict
          set(state => ({
            status: {
              ...state.status,
              conflicts: [...state.status.conflicts, conflict],
            },
          }))
          break
        }

        case 'tag_update': {
          const event = syncWebSocket.createSyncEvent('TAG_UPDATE', message.payload as Record<string, unknown>)
          set(state => ({
            events: [event, ...state.events].slice(0, 100), // Keep last 100 events
          }))
          break
        }

        case 'logic_push_response': {
          const payload = message.payload as { success: boolean; target: string }
          if (payload.success) {
            set(state => ({
              status: {
                ...state.status,
                lastSync: new Date().toISOString(),
                shadowOk: payload.target === 'shadow' || state.status.shadowOk,
                liveOk: payload.target === 'live' || state.status.liveOk,
              },
            }))
          }
          set({ isPushing: false })
          break
        }
      }
    })
  },

  disconnect: () => {
    syncWebSocket.disconnect()
    set(state => ({
      status: {
        ...state.status,
        connected: false,
        shadowOk: false,
        liveOk: false,
      },
    }))
  },

  pushToShadow: async (logicId: string) => {
    set({ isPushing: true })
    try {
      const result = await syncApi.pushToShadow(logicId)
      
      // Also notify via WebSocket
      syncWebSocket.send({
        type: 'logic_push_request',
        payload: { logicId, target: 'shadow' },
      })
      
      // Update status on success
      if (result.success) {
        set(state => ({
          status: {
            ...state.status,
            shadowOk: true,
            lastSync: new Date().toISOString(),
          },
          isPushing: false
        }))
        
        // Fetch the deployed logic immediately after successful push
        await get().fetchDeployedLogic()
      } else {
        set({ isPushing: false })
      }
      
      return result.success
    } catch (error) {
      console.error('Failed to push to shadow:', error)
      set({ isPushing: false })
      return false
    }
  },

  pushToLive: async (logicId: string) => {
    set({ isPushing: true })
    try {
      const result = await syncApi.pushToLive(logicId)
      
      // Also notify via WebSocket
      syncWebSocket.send({
        type: 'logic_push_request',
        payload: { logicId, target: 'live' },
      })
      
      // Add event log for successful push
      if (result.success) {
        set(state => ({
          status: {
            ...state.status,
            liveOk: true,
            lastSync: new Date().toISOString(),
          },
          events: [
            {
              id: `event-${Date.now()}`,
              type: 'LOGIC_PUSH',
              timestamp: new Date().toISOString(),
              payload: { logicId, target: 'live', success: true, warnings: result.warnings },
            },
            ...state.events,
          ].slice(0, 100),
          isPushing: false
        }))
      } else {
        set({ isPushing: false })
      }
      
      return result.success
    } catch (error) {
      console.error('Failed to push to live:', error)
      set({ isPushing: false })
      return false
    }
  },

  resolveConflict: async (conflictId: string, resolution: 'shadow' | 'live') => {
    try {
      // Call backend to resolve conflict
      await syncApi.resolveConflict(conflictId, resolution)
      
      // Update local state
      set(state => ({
        status: {
          ...state.status,
          conflicts: state.status.conflicts.map(c =>
            c.id === conflictId ? { ...c, resolved: true, resolution } : c
          ),
        },
      }))
      
      // Add event log
      set(state => ({
        events: [
          {
            id: `event-${Date.now()}`,
            type: 'CONFLICT_RESOLVED',
            timestamp: new Date().toISOString(),
            payload: { conflictId, resolution },
          },
          ...state.events,
        ].slice(0, 100), // Keep last 100 events
      }))
      
      console.log(`Resolved conflict ${conflictId} with ${resolution}`)
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    }
  },

  syncTags: async () => {
    try {
      await syncApi.syncTags()
      set(state => ({
        status: { ...state.status, lastSync: new Date().toISOString() },
      }))
    } catch (error) {
      console.error('Failed to sync tags:', error)
    }
  },

  // Simulate conflicts for demo purposes
  simulateConflicts: async () => {
    try {
      // Call backend to generate mock conflicts
      const result = await syncApi.generateConflicts()
      
      if (result.success) {
        // Fetch updated status with conflicts
        await get().fetchDeployedLogic()
      }
    } catch (error) {
      console.error('Failed to generate conflicts:', error)
      
      // Fallback to client-side simulation if backend fails
      const mockConflicts = [
      {
        id: 'conflict-1',
        tagName: 'Temperature_SP',
        shadowValue: 75.0,
        liveValue: 72.5,
        timestamp: new Date().toISOString(),
        type: 'VALUE_CONFLICT' as const,
        resolved: false,
        description: 'Setpoint value differs between shadow and live runtime'
      },
      {
        id: 'conflict-2', 
        tagName: 'Pump_Run',
        shadowValue: true,
        liveValue: false,
        timestamp: new Date().toISOString(),
        type: 'VALUE_CONFLICT' as const,
        resolved: false,
        description: 'Pump control state mismatch detected'
      }
      ]

      set(state => ({
        status: {
          ...state.status,
          conflicts: [...state.status.conflicts, ...mockConflicts]
        }
      }))
    }
  },

  // Fetch deployed logic from backend
  fetchDeployedLogic: async () => {
    try {
      const sessionToken = await deviceAuth.getSessionToken()
      const headers: HeadersInit = {}
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`
      }
      const response = await fetch('http://localhost:8000/api/sync/status', { headers })
      const status = await response.json()
      
      set(state => ({
        status: { ...state.status, ...status },
        deployedLogic: status.deployedLogic || null
      }))
    } catch (error) {
      console.error('Failed to fetch deployed logic:', error)
    }
  },
}))

// Auto-connect on app load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useSyncStore.getState().connect('default-project')
  }, 1000)
}

