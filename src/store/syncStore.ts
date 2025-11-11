import { create } from 'zustand'
import type { SyncStatus, SyncConflict, SyncEvent } from '../types'
import { syncWebSocket } from '../services/websocket'
import { syncApi } from '../services/api'

type SyncState = {
  status: SyncStatus
  events: SyncEvent[]
  isPushing: boolean
  
  // Actions
  connect: (projectId: string) => void
  disconnect: () => void
  pushToShadow: (logicId: string) => Promise<boolean>
  pushToLive: (logicId: string) => Promise<boolean>
  resolveConflict: (conflictId: string, resolution: 'shadow' | 'live') => void
  syncTags: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set) => ({
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

  connect: (projectId: string) => {
    syncWebSocket.connect(projectId)

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
      
      return result.success
    } catch (error) {
      console.error('Failed to push to live:', error)
      set({ isPushing: false })
      return false
    }
  },

  resolveConflict: (conflictId: string, resolution: 'shadow' | 'live') => {
    set(state => ({
      status: {
        ...state.status,
        conflicts: state.status.conflicts.map(c =>
          c.id === conflictId ? { ...c, resolved: true } : c
        ),
      },
    }))

    // In a real implementation, this would send the resolution to the backend
    console.log(`Resolved conflict ${conflictId} with ${resolution}`)
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
}))

// Auto-connect on app load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useSyncStore.getState().connect('default-project')
  }, 1000)
}

