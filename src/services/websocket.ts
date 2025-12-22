import type { SyncEvent } from '../types'
import { io, Socket } from 'socket.io-client'

type WebSocketMessage = {
  type: 'connect' | 'heartbeat' | 'tag_update' | 'logic_push_request' | 'logic_push_response' | 'conflict' | 'sync_status'
  payload?: unknown
}

type MessageHandler = (message: WebSocketMessage) => void

// Real WebSocket service that connects to the backend
export class SyncWebSocket {
  private handlers: MessageHandler[] = []
  private connected = false
  private socket: Socket | null = null
  private heartbeatInterval?: number
  private reconnectTimeout?: number
  private readonly WS_URL = 'http://localhost:8000'

  constructor() {
    // Auto-connect on initialization
    this.initializeConnection()
  }

  private initializeConnection(): void {
    try {
      this.socket = io(this.WS_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 5
      })

      this.setupSocketListeners()
    } catch (error) {
      console.error('[WebSocket] Failed to initialize connection:', error)
      this.scheduleReconnect()
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected to backend')
      this.connected = true
      this.clearReconnectTimeout()
      
      // Send initial connection message
      this.socket?.emit('connect_client', { 
        clientType: 'frontend',
        timestamp: new Date().toISOString()
      })

      this.emit({
        type: 'connect',
        payload: {
          success: true,
          timestamp: new Date().toISOString(),
        },
      })

      this.startHeartbeat()
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason)
      this.connected = false
      this.stopHeartbeat()
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        this.scheduleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error)
      this.connected = false
      this.scheduleReconnect()
    })

    this.socket.on('connect_ack', (data) => {
      console.log('[WebSocket] Connection acknowledged:', data)
    })

    this.socket.on('heartbeat_ack', (data) => {
      this.emit({
        type: 'heartbeat',
        payload: {
          timestamp: data.ts,
          latency: Date.now() - new Date(data.ts).getTime(),
        },
      })
    })

    this.socket.on('tag_update', (payload) => {
      this.emit({
        type: 'tag_update',
        payload,
      })
    })

    this.socket.on('logic_push_response', (payload) => {
      this.emit({
        type: 'logic_push_response',
        payload,
      })
    })

    this.socket.on('logic_push_request', (payload) => {
      this.emit({
        type: 'logic_push_request',
        payload,
      })
    })

    // Handle custom events for conflicts and sync status
    this.socket.on('sync_conflict', (payload) => {
      this.emit({
        type: 'conflict',
        payload,
      })
    })

    this.socket.on('sync_status_update', (payload) => {
      this.emit({
        type: 'sync_status',
        payload,
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return

    console.log('[WebSocket] Scheduling reconnect in 5 seconds...')
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = undefined
      this.initializeConnection()
    }, 5000)
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = undefined
    }
  }

  connect(projectId: string): void {
    console.log(`[WebSocket] Connecting to project: ${projectId}`)
    
    if (!this.socket || !this.connected) {
      this.initializeConnection()
    }

    // Send project connection message
    if (this.socket && this.connected) {
      this.socket.emit('project_connect', { projectId })
    }
  }

  disconnect(): void {
    this.connected = false
    this.stopHeartbeat()
    this.clearReconnectTimeout()
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    console.log('[WebSocket] Disconnected')
  }

  isConnected(): boolean {
    return this.connected && this.socket?.connected === true
  }

  on(handler: MessageHandler): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  send(message: WebSocketMessage): void {
    if (!this.socket || !this.connected) {
      console.warn('[WebSocket] Not connected, message not sent:', message)
      return
    }

    console.log('[WebSocket] Sending:', message)

    // Map message types to socket events
    switch (message.type) {
      case 'logic_push_request':
        this.socket.emit('logic_push_request', message.payload)
        break
      
      case 'tag_update':
        this.socket.emit('tag_update', message.payload)
        break

      case 'heartbeat':
        this.socket.emit('heartbeat')
        break

      default:
        console.warn('[WebSocket] Unknown message type:', message.type)
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
    this.stopHeartbeat() // Clear any existing interval
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.connected && this.socket) {
        this.socket.emit('heartbeat')
      }
    }, 5000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
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

  // Method to manually trigger reconnection
  reconnect(): void {
    this.disconnect()
    setTimeout(() => {
      this.initializeConnection()
    }, 1000)
  }
}

// Singleton instance
export const syncWebSocket = new SyncWebSocket()