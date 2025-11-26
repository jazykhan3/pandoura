import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  StopCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Package,
  Activity,
  RotateCcw,
  Eye,
  FileText,
  Users,
  Calendar,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Dialog } from './Dialog'
import { deploymentApi, versionApi } from '../services/api'
import { useProjectStore } from '../store/projectStore'
import type { Version, Release } from '../types'

type DeployTarget = {
  id: string
  name: string
  environment: 'shadow' | 'live'
  status: 'idle' | 'deploying' | 'success' | 'failed' | 'rolled-back'
  progress: number
  logs: DeployLog[]
}

type DeployLog = {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  step?: string
}

type PreDeployCheck = {
  id: string
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning'
  message?: string
  details?: string[]
  severity?: 'critical' | 'warning' | 'info'
}

type DeployApproval = {
  id: string
  approver: string
  status: 'pending' | 'approved' | 'rejected'
  timestamp?: string
  comment?: string
}

type QueuedDeploy = {
  id: string
  versionId: string
  version: string
  author: string
  targetRuntimes: string[]
  status: 'queued' | 'staging' | 'ready' | 'deploying' | 'completed' | 'failed'
  scheduledTime?: string
  priority: 'low' | 'normal' | 'high' | 'critical'
}

type TagMetric = {
  name: string
  currentValue: number
  previousValue: number
  changeRate: number
  unit: string
  status: 'normal' | 'warning' | 'critical'
}

interface DeployConsoleProps {
  environment: 'staging' | 'production'
}

export function DeployConsole({ environment }: DeployConsoleProps) {
  const { activeProject } = useProjectStore()
  const [queuedDeploys, setQueuedDeploys] = useState<QueuedDeploy[]>([]) // These will be releases
  const [selectedDeploy, setSelectedDeploy] = useState<QueuedDeploy | null>(null)
  const [deployTargets, setDeployTargets] = useState<DeployTarget[]>([])
  const [preDeployChecks, setPreDeployChecks] = useState<PreDeployCheck[]>([])
  const [approvals, setApprovals] = useState<DeployApproval[]>([])
  const [showDiffViewer, setShowDiffViewer] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [tagMetrics, setTagMetrics] = useState<TagMetric[]>([])
  const [isDeploying, setIsDeploying] = useState(false)
  const [canRollback, setCanRollback] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')
  const [currentDeploymentId, setCurrentDeploymentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [releases, setReleases] = useState<any[]>([])

  // Load releases from backend filtered by environment
  useEffect(() => {
    if (activeProject) {
      loadReleases()
    }
  }, [activeProject, environment])

  const loadReleases = async () => {
    if (!activeProject) return
    
    try {
      setLoading(true)
      // Load releases filtered by environment
      const result = await versionApi.getReleases(activeProject.id, { environment })
      
      if (result.success) {
        // Convert releases to queued deploy format for display
        const deploysFromReleases = result.releases.map((release: any) => ({
          id: release.id,
          versionId: release.version_id,
          version: release.version,
          author: release.created_by,
          targetRuntimes: release.metadata?.targetRuntimes || ['Runtime-01'],
          status: 'ready' as const,
          priority: 'normal' as const,
          releaseData: release, // Store full release data
        }))
        setQueuedDeploys(deploysFromReleases)
      }
    } catch (error) {
      console.error('Failed to load releases:', error)
      setQueuedDeploys([])
    } finally {
      setLoading(false)
    }
  }

  // Load deployment details when release is selected
  useEffect(() => {
    if (selectedDeploy && activeProject) {
      loadDeploymentDetails(selectedDeploy.id)
    }
  }, [selectedDeploy, activeProject])

  const loadDeploymentDetails = async (deployId: string) => {
    try {
      const result = await deploymentApi.getDeploymentById(deployId)
      
      if (result.success) {
        const deployment = result.deployment
        
        // Update checks
        if (deployment.checks) {
          setPreDeployChecks(deployment.checks.map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            message: c.message,
            details: c.details,
            severity: c.severity,
          })))
        }
        
        // Update approvals
        if (deployment.approvals) {
          setApprovals(deployment.approvals.map((a: any) => ({
            id: a.id,
            approver: a.approverName,
            status: a.status,
            timestamp: a.respondedAt,
            comment: a.comment,
          })))
        }
        
        // Update logs
        if (deployment.logs) {
          setDeployTargets([{
            id: 'target-1',
            name: 'Target Runtime',
            environment: environment === 'staging' ? 'shadow' : 'live',
            status: deployment.status === 'success' ? 'success' :
                    deployment.status === 'failed' ? 'failed' :
                    deployment.status === 'running' ? 'deploying' : 'idle',
            progress: deployment.progress || 0,
            logs: deployment.logs.map((log: any) => ({
              id: log.id,
              timestamp: log.timestamp,
              level: log.level,
              message: log.message,
              step: log.step,
            })),
          }])
        }
        
        setCurrentDeploymentId(deployId)
        setIsDeploying(deployment.status === 'running')
        setCanRollback(deployment.status === 'success')
      }
    } catch (error) {
      console.error('Failed to load deployment details:', error)
    }
  }

  const handleDryRun = async () => {
    alert('Starting Dry Run in Simulator...\n\nThis will execute the deployment in a safe simulation environment with a copy of the target runtime.')
  }

  const handleStartDeploy = async () => {
    if (!currentDeploymentId) {
      alert('No deployment selected')
      return
    }

    try {
      setIsDeploying(true)
      
      // Start deployment via API
      const result = await deploymentApi.startDeployment(currentDeploymentId)
      
      if (result.success) {
        // Poll for updates
        const pollInterval = setInterval(async () => {
          try {
            const updateResult = await deploymentApi.getDeploymentById(currentDeploymentId)
            
            if (updateResult.success) {
              const deployment = updateResult.deployment
              
              // Update progress and logs
              setDeployTargets(prev => prev.map(target => ({
                ...target,
                status: deployment.status === 'success' ? 'success' :
                        deployment.status === 'failed' ? 'failed' :
                        deployment.status === 'running' ? 'deploying' : 'idle',
                progress: deployment.progress || 0,
                logs: deployment.logs?.map((log: any) => ({
                  id: log.id,
                  timestamp: log.timestamp,
                  level: log.level,
                  message: log.message,
                  step: log.step,
                })) || [],
              })))
              
              // Stop polling if completed or failed
              if (deployment.status === 'success' || deployment.status === 'failed') {
                clearInterval(pollInterval)
                setIsDeploying(false)
                setCanRollback(deployment.status === 'success')
              }
            }
          } catch (error) {
            console.error('Failed to poll deployment status:', error)
            clearInterval(pollInterval)
            setIsDeploying(false)
          }
        }, 2000) // Poll every 2 seconds
      }
    } catch (error) {
      console.error('Failed to start deployment:', error)
      alert('Failed to start deployment: ' + (error as Error).message)
      setIsDeploying(false)
    }
  }

  const handlePauseDeploy = async () => {
    if (!currentDeploymentId) return
    
    try {
      await deploymentApi.pauseDeployment(currentDeploymentId)
      alert('Deployment paused. You can resume or cancel.')
    } catch (error) {
      console.error('Failed to pause deployment:', error)
      alert('Failed to pause deployment')
    }
  }

  const handleCancelDeploy = async () => {
    if (!currentDeploymentId) return
    
    if (confirm('Are you sure you want to cancel this deployment?')) {
      try {
        const result = await deploymentApi.cancelDeployment(currentDeploymentId)
        
        if (result.success) {
          setIsDeploying(false)
          await loadDeploymentDetails(currentDeploymentId)
        }
      } catch (error) {
        console.error('Failed to cancel deployment:', error)
        alert('Failed to cancel deployment')
      }
    }
  }

  const handleRollback = async () => {
    if (!currentDeploymentId) return
    
    if (confirm('Are you sure you want to rollback to the previous version?')) {
      try {
        const result = await deploymentApi.executeRollback(
          currentDeploymentId,
          'Current User',
          'Manual rollback initiated by user'
        )
        
        if (result.success) {
          await loadDeploymentDetails(currentDeploymentId)
          setCanRollback(false)
          alert('Rollback completed successfully')
        }
      } catch (error) {
        console.error('Failed to execute rollback:', error)
        alert('Failed to execute rollback')
      }
    }
  }

  const handleScheduleDeploy = () => {
    setShowScheduleDialog(true)
  }

  const handleApprove = () => {
    setShowApprovalDialog(true)
  }

  const submitApproval = async () => {
    if (!selectedDeploy) return
    
    // Find pending approval
    const pendingApproval = approvals.find(a => a.status === 'pending')
    if (!pendingApproval) {
      alert('No pending approvals')
      return
    }

    try {
      const result = await deploymentApi.submitApproval(
        pendingApproval.id,
        pendingApproval.approver,
        'approved',
        approvalComment || undefined
      )
      
      if (result.success) {
        setShowApprovalDialog(false)
        setApprovalComment('')
        // Reload deployment details to get updated approvals
        await loadDeploymentDetails(selectedDeploy.id)
        alert('Approval submitted successfully')
      }
    } catch (error) {
      console.error('Failed to submit approval:', error)
      alert('Failed to submit approval')
    }
  }

  const toggleFileExpanded = (fileId: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const getCheckIcon = (status: PreDeployCheck['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle size={18} className="text-green-500" />
      case 'failed':
        return <XCircle size={18} className="text-red-500" />
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" />
      case 'running':
        return <Activity size={18} className="text-blue-500 animate-spin" />
      default:
        return <Clock size={18} className="text-gray-400" />
    }
  }

  const getStatusColor = (status: DeployTarget['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'deploying':
        return 'bg-blue-500'
      case 'rolled-back':
        return 'bg-amber-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getPriorityColor = (priority: QueuedDeploy['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-700'
      case 'high':
        return 'bg-orange-100 text-orange-700'
      case 'normal':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const allApproved = approvals.every(a => a.status === 'approved')
  const hasWarnings = preDeployChecks.some(c => c.status === 'warning' || c.status === 'failed')

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">Deploy Console</h1>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Environment:</label>
              <div className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium text-gray-800">
                {environment === 'staging' ? 'Shadow Runtime (Staging)' : 'Production Runtime'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Queued Deploys */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Queued Deploys
            </h2>
            <div className="space-y-2">
              {queuedDeploys.map((deploy) => (
                <motion.div
                  key={deploy.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedDeploy?.id === deploy.id
                      ? 'border-[#FF6A00] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                  onClick={() => setSelectedDeploy(deploy)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{deploy.version}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(deploy.priority)}`}>
                      {deploy.priority}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Author: {deploy.author}</div>
                    <div>Targets: {deploy.targetRuntimes.join(', ')}</div>
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        deploy.status === 'completed' ? 'bg-green-500' :
                        deploy.status === 'failed' ? 'bg-red-500' :
                        deploy.status === 'deploying' ? 'bg-blue-500 animate-pulse' :
                        'bg-gray-400'
                      }`} />
                      {deploy.status}
                    </div>
                    {deploy.scheduledTime && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Clock size={12} />
                        Scheduled: {new Date(deploy.scheduledTime).toLocaleString()}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Pane - Deploy Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedDeploy ? (
            <div className="space-y-6">
              {/* Release Metadata */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package size={20} className="text-[#FF6A00]" />
                  Release Metadata
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Version</div>
                    <div className="font-medium">{selectedDeploy.version}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Author</div>
                    <div className="font-medium">{selectedDeploy.author}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Change Reason</div>
                    <div className="font-medium">Performance optimization</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Package Size</div>
                    <div className="font-medium">2.3 MB</div>
                  </div>
                </div>
              </div>

              {/* Pre-Deploy Checks */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-blue-600" />
                  Pre-Deploy Checks
                  {hasWarnings && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                      Warnings detected
                    </span>
                  )}
                </h3>
                <div className="space-y-3">
                  {preDeployChecks.map((check) => (
                    <div
                      key={check.id}
                      className={`p-4 rounded-lg border ${
                        check.status === 'failed' ? 'border-red-200 bg-red-50' :
                        check.status === 'warning' ? 'border-amber-200 bg-amber-50' :
                        check.status === 'passed' ? 'border-green-200 bg-green-50' :
                        'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getCheckIcon(check.status)}
                        <div className="flex-1">
                          <div className="font-medium text-sm mb-1">{check.name}</div>
                          <div className="text-xs text-gray-600">{check.message}</div>
                          {check.details && check.details.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {check.details.map((detail, idx) => (
                                <div key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                                  <ChevronRight size={12} />
                                  {detail}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diff Viewer */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText size={20} className="text-purple-600" />
                    File Changes
                  </h3>
                  <button
                    onClick={() => setShowDiffViewer(!showDiffViewer)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
                  >
                    <Eye size={16} />
                    {showDiffViewer ? 'Hide' : 'Show'} Diff
                  </button>
                </div>
                
                {showDiffViewer && (
                  <div className="space-y-2">
                    {['Main_Program.st', 'PID_Controller.st', 'Safety_Logic.st'].map((file) => {
                      const isExpanded = expandedFiles.has(file)
                      return (
                        <div key={file} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleFileExpanded(file)}
                            className="w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <FileText size={16} />
                              {file}
                            </div>
                            <span className="text-xs text-gray-600">+15 -8 lines</span>
                          </button>
                          {isExpanded && (
                            <div className="p-4 bg-gray-50">
                              <pre className="text-xs font-mono">
                                <div className="text-green-600">+ PROGRAM Main_Cycle</div>
                                <div className="text-gray-600">  VAR</div>
                                <div className="text-green-600">+   temperature: REAL;</div>
                                <div className="text-red-600">-   temp: INT;</div>
                                <div className="text-gray-600">  END_VAR</div>
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-800">
                      <strong>Stage-wise Deploy Available:</strong> This deployment can be automatically split into
                      stages to minimize risk. Enable in deploy options.
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Area */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" />
                  Approvals
                  {allApproved && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      All approved
                    </span>
                  )}
                </h3>
                <div className="space-y-3">
                  {approvals.map((approval) => (
                    <div
                      key={approval.id}
                      className={`p-4 rounded-lg border ${
                        approval.status === 'approved' ? 'border-green-200 bg-green-50' :
                        approval.status === 'rejected' ? 'border-red-200 bg-red-50' :
                        'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{approval.approver}</div>
                        <div className="flex items-center gap-2">
                          {approval.status === 'approved' && (
                            <CheckCircle size={16} className="text-green-600" />
                          )}
                          {approval.status === 'rejected' && (
                            <XCircle size={16} className="text-red-600" />
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            approval.status === 'approved' ? 'bg-green-100 text-green-700' :
                            approval.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {approval.status}
                          </span>
                        </div>
                      </div>
                      {approval.comment && (
                        <div className="text-xs text-gray-600 mb-1">{approval.comment}</div>
                      )}
                      {approval.timestamp && (
                        <div className="text-xs text-gray-500">
                          {new Date(approval.timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {!allApproved && (
                  <button
                    onClick={handleApprove}
                    className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Shield size={16} />
                    Sign & Approve
                  </button>
                )}
              </div>

              {/* Deploy Actions */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Deploy Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={handleDryRun}
                    className="px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex flex-col items-center gap-2"
                  >
                    <Eye size={20} />
                    <span className="text-sm font-medium">Dry Run</span>
                  </button>
                  <button
                    onClick={handleStartDeploy}
                    disabled={isDeploying || !allApproved}
                    className={`px-4 py-3 rounded-lg transition-colors flex flex-col items-center gap-2 ${
                      !isDeploying && allApproved
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Play size={20} />
                    <span className="text-sm font-medium">Start Deploy</span>
                  </button>
                  <button
                    onClick={handleScheduleDeploy}
                    className="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex flex-col items-center gap-2"
                  >
                    <Calendar size={20} />
                    <span className="text-sm font-medium">Schedule</span>
                  </button>
                  <button
                    onClick={handleCancelDeploy}
                    disabled={!isDeploying}
                    className={`px-4 py-3 rounded-lg transition-colors flex flex-col items-center gap-2 ${
                      isDeploying
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <StopCircle size={20} />
                    <span className="text-sm font-medium">Cancel</span>
                  </button>
                </div>
                
                {isDeploying && (
                  <button
                    onClick={handlePauseDeploy}
                    className="mt-3 w-full px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Pause size={16} />
                    Pause Deployment
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Package size={48} className="mx-auto mb-4 text-gray-400" />
                <p>Select a deploy from the queue to preview</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane - Live Logs & Metrics */}
        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Deploy Status */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Deploy Status
              </h3>
              <div className="space-y-3">
                {deployTargets.map((target) => (
                  <div key={target.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">{target.name}</div>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(target.status)}`} />
                    </div>
                    {target.status === 'deploying' && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{target.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${target.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-600 capitalize">{target.status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Deploy Logs */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Live Deploy Logs
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {deployTargets.flatMap(target => target.logs).slice(-10).map((log) => (
                  <div key={log.id} className="text-xs">
                    <div className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        log.level === 'error' ? 'bg-red-500' :
                        log.level === 'warning' ? 'bg-amber-500' :
                        log.level === 'success' ? 'bg-green-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="text-gray-800">{log.message}</div>
                        <div className="text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {deployTargets.every(t => t.logs.length === 0) && (
                  <div className="text-center text-gray-500 py-4">No logs yet</div>
                )}
              </div>
            </div>

            {/* Rollback Button */}
            {canRollback && (
              <button
                onClick={handleRollback}
                className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                Rollback Deployment
              </button>
            )}

            {/* Tag Metrics Dashboard */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Key Tag Metrics
              </h3>
              <div className="space-y-3">
                {tagMetrics.map((metric) => (
                  <div
                    key={metric.name}
                    className={`p-3 rounded-lg border ${
                      metric.status === 'critical' ? 'border-red-200 bg-red-50' :
                      metric.status === 'warning' ? 'border-amber-200 bg-amber-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-xs">{metric.name}</div>
                      {metric.status !== 'normal' && (
                        <AlertTriangle
                          size={14}
                          className={metric.status === 'critical' ? 'text-red-500' : 'text-amber-500'}
                        />
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-lg font-semibold">
                        {metric.currentValue.toFixed(1)} {metric.unit}
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${
                        metric.changeRate > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        <TrendingUp size={12} />
                        {metric.changeRate > 0 ? '+' : ''}{metric.changeRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Previous: {metric.previousValue.toFixed(1)} {metric.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Dialog */}
      {showScheduleDialog && (
        <Dialog isOpen={showScheduleDialog} onClose={() => setShowScheduleDialog(false)} title="Schedule Deployment">
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Window
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]">
                  <option>Off-peak hours (2 AM - 4 AM)</option>
                  <option>Low traffic (11 PM - 1 AM)</option>
                  <option>Custom...</option>
                </select>
              </div>
              <div className="flex items-start gap-2">
                <input type="checkbox" id="auto-rollback" className="mt-1" />
                <label htmlFor="auto-rollback" className="text-sm text-gray-700">
                  Auto-rollback on failure
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowScheduleDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowScheduleDialog(false)
                  alert('Deployment scheduled successfully!')
                }}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
              >
                Schedule Deploy
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <Dialog isOpen={showApprovalDialog} onClose={() => setShowApprovalDialog(false)} title="Sign & Approve Deployment">
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments (Optional)
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Add your approval comments..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  rows={3}
                />
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    By approving, you certify that you have reviewed the deployment changes and
                    authorize this deployment to proceed.
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowApprovalDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitApproval}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Shield size={16} />
                Approve & Sign
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
