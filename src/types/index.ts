export type ActivityLog = {
  id: string
  message: string
  timestamp: Date
}

export type Connection = {
  id: string
  name: string
  ip: string
  status: 'online' | 'warning' | 'offline'
}

export type Tag = {
  id: string
  name: string
  type: 'INT' | 'REAL' | 'BOOL' | 'STRING'
  value: string | number | boolean
  address: string
  lastUpdate: Date
}

export type DeploymentLog = {
  id: string
  timestamp: Date
  version: string
  status: 'success' | 'failed' | 'pending'
  changes: number
}

