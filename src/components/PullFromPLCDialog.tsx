import { useState, useEffect } from 'react'
import { X, CheckCircle, Loader2, AlertCircle, Server, Shield } from 'lucide-react'
import { SnapshotScopeSelector, type SnapshotScope } from './SnapshotScopeSelector'
import { pullFlowMachine, type PullFlowState, type PullFlowContext } from '../utils/pullFlowStateMachine'
import { enforcePullPermissions } from '../utils/pullMiddleware'
import { getImportDefaults } from '../utils/importDefaults'
import { getPermissionsForRole, type PLCPullPermissions } from '../utils/plcPermissions'
import { logPullCompleted, logPullFailed } from '../utils/auditLogger'
import { deviceAuth } from '../utils/deviceAuth'
import { useProjectStore } from '../store/projectStore'

interface PullFromPLCDialogProps {
  isOpen: boolean
  onClose: () => void
  currentUser: {
    userId: string
    username: string
    role: 'admin' | 'engineer' | 'operator' | 'viewer'
  }
  projectId?: string
  projectName?: string
  entryPoint?: 'project-wizard' | 'empty-project-cta' | 'topbar-menu' | 'runtime-card' | 'manual'
}

type Runtime = {
  id: string
  name: string
  environment: 'production' | 'staging' | 'development'
  ipAddress: string
  status: 'connected' | 'disconnected' | 'error'
}

export function PullFromPLCDialog({
  isOpen,
  onClose,
  currentUser,
  projectId,
  projectName,
  entryPoint = 'manual'
}: PullFromPLCDialogProps) {
  const [flowState, setFlowState] = useState<PullFlowState>('idle')
  const [context, setContext] = useState<PullFlowContext>(pullFlowMachine.getContext())
  const [runtimes, setRuntimes] = useState<Runtime[]>([])
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string>('')
  const [selectedScope, setSelectedScope] = useState<SnapshotScope>({
    programs: false,
    tags: false,
    dataTypes: false,
    routines: false,
    aois: false,
    executionUnits: false,
    constants: false
  })
  const [reason, setReason] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string>('')

  const permissions: PLCPullPermissions = getPermissionsForRole(currentUser.role)
  const { loadProjects, setActiveProject, getProjectById } = useProjectStore()

  useEffect(() => {
    if (isOpen) {
      // Initialize flow
      pullFlowMachine.send({
        type: 'START',
        payload: { entryPoint, projectId, projectName }
      })
      
      // Load import defaults
      const defaults = getImportDefaults()
      setSelectedScope({
        programs: defaults.snapshotScope.includePrograms,
        tags: defaults.snapshotScope.includeTags,
        dataTypes: defaults.snapshotScope.includeDataTypes,
        routines: defaults.snapshotScope.includeRoutines,
        aois: defaults.snapshotScope.includeAOIs,
        executionUnits: true,
        constants: true
      })
      
      loadRuntimes()
    }
  }, [isOpen])

  useEffect(() => {
    const unsubscribe = pullFlowMachine.subscribe((state, ctx) => {
      setFlowState(state)
      setContext(ctx)
    })
    return unsubscribe
  }, [])

  const loadRuntimes = async () => {
    try {
      // Get session token for authentication
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        console.warn('⚠️ No session token available, using mock runtimes')
        setRuntimes(mockRuntimes)
        return
      }

      const response = await fetch('http://localhost:8000/api/runtimes', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Map API runtimes to component format
        const apiRuntimes: Runtime[] = (data.runtimes || []).map((runtime: any) => ({
          id: runtime.id,
          name: runtime.name,
          environment: runtime.isProduction ? 'production' : (runtime.environment || 'development'),
          ipAddress: runtime.ipAddress,
          status: mapRuntimeStatus(runtime.status)
        }))
        
        console.log('✅ Loaded', apiRuntimes.length, 'runtimes for pull selection')
        setRuntimes(apiRuntimes.length > 0 ? apiRuntimes : mockRuntimes)
      } else {
        console.warn('Failed to load runtimes, using mock data')
        setRuntimes(mockRuntimes)
      }
    } catch (error) {
      console.error('Error loading runtimes:', error)
      setRuntimes(mockRuntimes)
    }
  }

  const mapRuntimeStatus = (status: string): 'connected' | 'disconnected' | 'error' => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'online':
        return 'connected'
      case 'error':
      case 'faulted':
      case 'maintenance':
        return 'error'
      default:
        return 'disconnected'
    }
  }

  const handleRuntimeSelect = (runtime: Runtime) => {
    setSelectedRuntimeId(runtime.id)
    pullFlowMachine.send({
      type: 'RUNTIME_SELECTED',
      payload: {
        runtimeId: runtime.id,
        runtimeName: runtime.name,
        environment: runtime.environment
      }
    })
  }

  const handleContinueToScope = () => {
    if (!selectedRuntimeId) return
    const runtime = runtimes.find(r => r.id === selectedRuntimeId)
    if (runtime) {
      handleRuntimeSelect(runtime)
    }
  }

  const handleScopeConfirm = () => {
    const hasSelection = Object.values(selectedScope).some(v => v)
    if (!hasSelection) {
      setError('Please select at least one scope item')
      return
    }
    
    pullFlowMachine.send({
      type: 'SCOPE_SELECTED',
      payload: selectedScope
    })
  }

  const handleExecutePull = async () => {
    const runtime = runtimes.find(r => r.id === selectedRuntimeId)
    if (!runtime) return

    setIsExecuting(true)
    setError('')

    try {
      // Check permissions and approval requirements
      const middlewareResult = await enforcePullPermissions({
        runtimeId: runtime.id,
        runtimeName: runtime.name,
        runtimeEnvironment: runtime.environment,
        projectId: projectId,
        snapshotScope: {
          includePrograms: selectedScope.programs,
          includeTags: selectedScope.tags,
          includeDataTypes: selectedScope.dataTypes,
          includeRoutines: selectedScope.routines,
          includeAOIs: selectedScope.aois
        },
        user: currentUser,
        reason: reason || 'Pull from PLC'
      }, permissions)

      if (!middlewareResult.allowed) {
        if (middlewareResult.requiresApproval) {
          pullFlowMachine.send({
            type: 'APPROVAL_REQUIRED',
            payload: { requestId: middlewareResult.approvalRequestId! }
          })
          return
        }
        
        setError(middlewareResult.denialReason || 'Permission denied')
        pullFlowMachine.send({
          type: 'PULL_ERROR',
          payload: { error: middlewareResult.denialReason || 'Permission denied' }
        })
        return
      }

      // Execute pull
      pullFlowMachine.send({ type: 'EXECUTE_PULL' })
      
      // Get session token for API authentication
      const sessionToken = await deviceAuth.getSessionToken()
      if (!sessionToken) {
        throw new Error('No authentication token available')
      }
      
      const startTime = Date.now()
      const response = await fetch(`http://localhost:8000/api/runtimes/${runtime.id}/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          project_id: projectId,
          snapshot_scope: {
            include_programs: selectedScope.programs,
            include_tags: selectedScope.tags,
            include_data_types: selectedScope.dataTypes,
            include_routines: selectedScope.routines,
            include_aois: selectedScope.aois,
            include_execution_units: selectedScope.executionUnits,
            include_constants: selectedScope.constants
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Pull failed: ${response.statusText}`)
      }

      const result = await response.json()
      const duration = Date.now() - startTime

      // Log success
      await logPullCompleted({
        userId: currentUser.userId,
        username: currentUser.username,
        userRole: currentUser.role,
        runtimeId: runtime.id,
        runtimeName: runtime.name,
        runtimeEnvironment: runtime.environment,
        projectId: projectId,
        snapshotId: result.snapshot_id,
        itemsPulled: result.items_pulled || 0,
        duration: duration
      })

      pullFlowMachine.send({
        type: 'PULL_SUCCESS',
        payload: {
          snapshotId: result.snapshot_id,
          itemsPulled: result.items_pulled || 0,
          projectId: result.project_id,
          projectName: result.project_name
        }
      })

      // Reload projects to get the newly created project
      if (result.project_id) {
        console.log(`🔄 Reloading projects to find: ${result.project_id}`)
        await loadProjects()
        
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Set the newly created project as active
        const newProject = getProjectById(result.project_id)
        if (newProject) {
          console.log(`✅ Found project: ${newProject.name} (${newProject.id})`)
          console.log(`   Logic Files: ${newProject.stats?.logicFiles || 0}`)
          console.log(`   Tags: ${newProject.stats?.tags || 0}`)
          setActiveProject(newProject)
          console.log(`✅ Active project set - Logic Editor should reload automatically`)
        } else {
          console.warn(`⚠️ Could not find project with ID: ${result.project_id}`)
          const allProjects = useProjectStore.getState().projects
          console.log(`Available projects (${allProjects.length}):`, allProjects.map(p => ({ id: p.id, name: p.name })))
        }
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Pull operation failed'
      setError(errorMsg)

      // Log failure
      await logPullFailed({
        userId: currentUser.userId,
        username: currentUser.username,
        userRole: currentUser.role,
        runtimeId: runtime.id,
        runtimeName: runtime.name,
        runtimeEnvironment: runtime.environment,
        projectId: projectId,
        error: errorMsg
      })

      pullFlowMachine.send({
        type: 'PULL_ERROR',
        payload: { error: errorMsg }
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleClose = () => {
    pullFlowMachine.send({ type: 'RESET' })
    setSelectedRuntimeId('')
    setReason('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  const runtime = runtimes.find(r => r.id === selectedRuntimeId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pull from PLC
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {projectName && `Project: ${projectName} • `}
              Entry: {entryPoint.replace(/-/g, ' ')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Runtime */}
          {(flowState === 'selecting-runtime') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Select PLC Runtime
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {runtimes.map((rt) => (
                  <button
                    key={rt.id}
                    onClick={() => setSelectedRuntimeId(rt.id)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedRuntimeId === rt.id
                        ? 'border-[#FF6A00] bg-orange-50 dark:bg-orange-900/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Server className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {rt.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {rt.ipAddress} • {rt.environment}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        rt.status === 'connected'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}>
                        {rt.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Scope */}
          {(flowState === 'selecting-scope') && runtime && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Server className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{runtime.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{runtime.environment}</div>
                </div>
              </div>
              
              <SnapshotScopeSelector
                runtimeId={runtime.id}
                selectedScope={selectedScope}
                onScopeChange={setSelectedScope}
              />
            </div>
          )}

          {/* Step 3: Review & Reason */}
          {(flowState === 'reviewing-approval') && runtime && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Server className="w-5 h-5" />
                <div className="flex-1">
                  <div className="font-medium">{runtime.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {Object.values(selectedScope).filter(Boolean).length} categories selected
                  </div>
                </div>
              </div>

              {runtime.environment === 'production' && !permissions.canBypassApproval && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                        Approval Required
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Production pulls require approval. Please provide a reason for this pull.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Pull {runtime.environment === 'production' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why you need to pull from this runtime..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] resize-none"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Executing */}
          {flowState === 'executing-pull' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#FF6A00] animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Pulling from PLC...
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                This may take a few moments
              </p>
            </div>
          )}

          {/* Success */}
          {flowState === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Pull Successful!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {context.itemsPulled} objects extracted
              </p>
              {context.createdProjectName && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saved to Project:</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{context.createdProjectName}</p>
                </div>
              )}
            </div>
          )}

          {/* Approval Pending */}
          {flowState === 'approval-pending' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Approval Required
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Request ID: {context.approvalRequestId}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                You'll be notified when approved
              </p>
            </div>
          )}

          {/* Error */}
          {flowState === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Pull Failed
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center max-w-md">
                {error || context.error}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          {flowState === 'success' ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              Close
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              {flowState === 'error' || flowState === 'approval-pending' ? 'Close' : 'Cancel'}
            </button>
          )}

          {flowState === 'success' && context.createdProjectName && (
            <button
              onClick={() => {
                handleClose()
                window.location.hash = '#/logic-editor'
              }}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-[#FF6A00]/90 transition-colors"
            >
              Open in Logic Editor →
            </button>
          )}

          {flowState === 'selecting-runtime' && (
            <button
              onClick={handleContinueToScope}
              disabled={!selectedRuntimeId}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-[#FF6A00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          )}

          {flowState === 'selecting-scope' && (
            <button
              onClick={handleScopeConfirm}
              disabled={!Object.values(selectedScope).some(v => v)}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-[#FF6A00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Review & Continue
            </button>
          )}

          {flowState === 'reviewing-approval' && (
            <button
              onClick={handleExecutePull}
              disabled={isExecuting || (runtime?.environment === 'production' && !reason.trim())}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-[#FF6A00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin" />}
              Execute Pull
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Mock runtimes for development
const mockRuntimes: Runtime[] = [
  {
    id: '1',
    name: 'Production PLC-01',
    environment: 'production',
    ipAddress: '192.168.1.100',
    status: 'connected'
  },
  {
    id: '2',
    name: 'Staging PLC-02',
    environment: 'staging',
    ipAddress: '192.168.1.101',
    status: 'connected'
  },
  {
    id: '3',
    name: 'Dev PLC-03',
    environment: 'development',
    ipAddress: '192.168.1.102',
    status: 'connected'
  }
]
