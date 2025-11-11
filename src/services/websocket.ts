import type { SyncEvent, Tag } from '../types'

type WebSocketMessage = {
  type: 'connect' | 'heartbeat' | 'tag_update' | 'logic_push_request' | 'logic_push_response' | 'conflict' | 'sync_status'
  payload?: unknown
}

type MessageHandler = (message: WebSocketMessage) => void

// Mock WebSocket service for development (simulates real-time sync)
export class SyncWebSocket {
  private handlers: MessageHandler[] = []
  private connected = false
  private heartbeatInterval?: number
  private tagUpdateInterval?: number
  private mockTags: Map<string, Tag> = new Map()

  constructor() {
    // Initialize with some mock tags
    this.mockTags.set('Temperature_PV', {
      id: '1',
      name: 'Temperature_PV',
      type: 'REAL',
      value: 72.5,
      address: 'DB1.DBD0',
      lastUpdate: new Date(),
      source: 'live',
    })
    this.mockTags.set('Temperature_SP', {
      id: '2',
      name: 'Temperature_SP',
      type: 'REAL',
      value: 75.0,
      address: 'DB1.DBD4',
      lastUpdate: new Date(),
      source: 'shadow',
    })
  }

  connect(projectId: string): void {
    console.log(`[WebSocket] Connecting to project: ${projectId}`)
    
    // Simulate connection delay
    setTimeout(() => {
      this.connected = true
      this.emit({
        type: 'connect',
        payload: {
          success: true,
          projectId,
          timestamp: new Date().toISOString(),
        },
      })

      // Start heartbeat
      this.startHeartbeat()
      
      // Start simulated tag updates
      this.startTagUpdates()

      console.log('[WebSocket] Connected')
    }, 300)
  }

  disconnect(): void {
    this.connected = false
    this.stopHeartbeat()
    this.stopTagUpdates()
    console.log('[WebSocket] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }

  on(handler: MessageHandler): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  send(message: WebSocketMessage): void {
    if (!this.connected) {
      console.warn('[WebSocket] Not connected, message not sent:', message)
      return
    }

    console.log('[WebSocket] Sending:', message)

    // Handle different message types
    switch (message.type) {
      case 'logic_push_request':
        this.handleLogicPushRequest(message.payload as { logic: string; target: 'shadow' | 'live' })
        break
      
      case 'tag_update':
        this.handleTagUpdate(message.payload as { name: string; value: unknown; source: 'live' | 'shadow' })
        break
    }
  }

  private emit(message: WebSocketMessage): void {
    this.handlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error('[WebSocket] Handler error:', error)
      }
    })
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.connected) {
        this.emit({
          type: 'heartbeat',
          payload: {
            timestamp: new Date().toISOString(),
            latency: Math.floor(Math.random() * 10) + 8, // 8-18ms
          },
        })
      }
    }, 5000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
  }

  private startTagUpdates(): void {
    // Simulate tag value changes
    this.tagUpdateInterval = window.setInterval(() => {
      if (this.connected) {
        // Update Temperature_PV with small variations
        const tempPV = this.mockTags.get('Temperature_PV')
        if (tempPV && typeof tempPV.value === 'number') {
          const newValue = tempPV.value + (Math.random() - 0.5) * 0.5
          tempPV.value = Number(newValue.toFixed(2))
          tempPV.lastUpdate = new Date()

          this.emit({
            type: 'tag_update',
            payload: {
              name: 'Temperature_PV',
              value: tempPV.value,
              type: 'REAL',
              source: 'live',
              timestamp: new Date().toISOString(),
            },
          })
        }

        // Occasionally simulate conflicts
        if (Math.random() < 0.05) { // 5% chance per update
          this.emit({
            type: 'conflict',
            payload: {
              id: Math.random().toString(36).substr(2, 9),
              tagName: 'Temperature_SP',
              shadowValue: 75.0,
              liveValue: 76.0,
              timestamp: new Date().toISOString(),
              resolved: false,
            },
          })
        }
      }
    }, 2000)
  }

  private stopTagUpdates(): void {
    if (this.tagUpdateInterval) {
      clearInterval(this.tagUpdateInterval)
      this.tagUpdateInterval = undefined
    }
  }

  private handleLogicPushRequest(payload: { logic: string; target: 'shadow' | 'live' }): void {
    // Simulate validation and push
    setTimeout(() => {
      const hasErrors = payload.logic.includes('ERROR')
      
      this.emit({
        type: 'logic_push_response',
        payload: {
          success: !hasErrors,
          target: payload.target,
          timestamp: new Date().toISOString(),
          errors: hasErrors ? ['Syntax error detected'] : [],
          warnings: payload.target === 'live' ? ['Pushing to live runtime - ensure safety checks pass'] : [],
        },
      })

      if (!hasErrors) {
        this.emit({
          type: 'sync_status',
          payload: {
            connected: true,
            shadowOk: true,
            liveOk: payload.target === 'live',
            lastSync: new Date().toISOString(),
            latency: Math.floor(Math.random() * 10) + 8,
          },
        })
      }
    }, 800)
  }

  private handleTagUpdate(payload: { name: string; value: unknown; source: 'live' | 'shadow' }): void {
    const tag = this.mockTags.get(payload.name)
    if (tag) {
      tag.value = payload.value as string | number | boolean | null
      tag.lastUpdate = new Date()
      tag.source = payload.source
    }
  }

  // Utility method to get current tag values
  getTagValue(name: string): unknown {
    return this.mockTags.get(name)?.value
  }

  // Utility method to create sync event
  createSyncEvent(type: SyncEvent['type'], payload: Record<string, unknown>): SyncEvent {
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      timestamp: new Date().toISOString(),
      payload,
    }
  }
}

// Singleton instance
export const syncWebSocket = new SyncWebSocket()

