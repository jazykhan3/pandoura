import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { StatusIndicator } from '../components/StatusIndicator'
import { mockActivities, mockConnections, mockTags } from '../data/mockData'
import type { ActivityLog, Connection } from '../types'

export function Dashboard() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [stats, setStats] = useState({
    activeTags: 0,
    logicBlocks: 18,
    runtimeStatus: 'Running' as const,
    lastDeploy: '2h ago',
  })

  useEffect(() => {
    // Simulate loading data
    setActivities(mockActivities.slice(0, 3))
    setConnections(mockConnections)
    setStats(prev => ({ ...prev, activeTags: mockTags.length }))
  }, [])

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>Project Status</CardHeader>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Active Tags:</span>
              <span className="font-semibold text-neutral-900">{stats.activeTags}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Logic Blocks:</span>
              <span className="font-semibold text-neutral-900">{stats.logicBlocks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Runtime Status:</span>
              <span className="font-semibold text-green-600">{stats.runtimeStatus}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Last Deploy:</span>
              <span className="font-semibold text-neutral-900">{stats.lastDeploy}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>Recent Activity</CardHeader>
          <div className="space-y-2 text-sm">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2">
                <span className="text-neutral-400 mt-0.5">•</span>
                <div>
                  <div className="text-neutral-900">{activity.message}</div>
                  <div className="text-xs text-neutral-500">{formatTimeAgo(activity.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>Connections</CardHeader>
          <div className="space-y-3">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-neutral-900">{conn.name}</div>
                  <div className="text-xs text-neutral-500">{conn.ip}</div>
                </div>
                <StatusIndicator status={conn.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}


