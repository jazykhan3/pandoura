import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { mockDeployments } from '../data/mockData'
import type { DeploymentLog } from '../types'

export function Deploy() {
  const [deployments, setDeployments] = useState<DeploymentLog[]>([])
  const [isDeploying, setIsDeploying] = useState(false)

  useEffect(() => {
    setDeployments(mockDeployments)
  }, [])

  const handleDeploy = () => {
    setIsDeploying(true)
    setTimeout(() => {
      setIsDeploying(false)
      alert('Deployment completed successfully!')
    }, 2000)
  }

  const formatDate = (date: Date) => {
    const now = Date.now()
    const diff = now - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deploy to Live</h1>
        <button
          onClick={handleDeploy}
          disabled={isDeploying}
          className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
            isDeploying
              ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              : 'bg-[#FF6A00] text-white hover:bg-[#FF8020]'
          }`}
        >
          {isDeploying ? 'Deploying...' : 'Deploy Now'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>Verification</CardHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-green-600">
              <span>✓</span>
              <span>Syntax validation passed</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <span>✓</span>
              <span>No compilation errors</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <span>✓</span>
              <span>Tag mapping verified</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <span>✓</span>
              <span>PLC connection stable</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>Deployment Summary</CardHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Target:</span>
              <span className="font-medium">PLC-01</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Version:</span>
              <span className="font-medium">v2.1.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Changes:</span>
              <span className="font-medium">7 blocks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Est. Time:</span>
              <span className="font-medium">~15s</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>Change Logs</CardHeader>
          <div className="space-y-1 text-xs">
            <div className="text-neutral-600">• Updated PID_Control_Loop</div>
            <div className="text-neutral-600">• Modified Motor_Speed logic</div>
            <div className="text-neutral-600">• Added Safety_Interlock</div>
            <div className="text-neutral-600">• Fixed Temperature calculation</div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>Deployment History</CardHeader>
        <div className="space-y-2">
          {deployments.map((deploy) => (
            <div key={deploy.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  deploy.status === 'success' ? 'bg-green-500' : 
                  deploy.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <div className="text-sm font-medium">{deploy.version}</div>
                  <div className="text-xs text-neutral-500">{formatDate(deploy.timestamp)}</div>
                </div>
              </div>
              <div className="text-xs text-neutral-600">{deploy.changes} changes</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}


