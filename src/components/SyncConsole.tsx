import { useState, useEffect } from 'react'
import { useSyncStore } from '../store/syncStore'
import { useLogicStore } from '../store/enhancedLogicStore'
import { Activity, AlertCircle, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react'
import { deviceAuth } from '../utils/deviceAuth'
import { ConflictResolutionModal } from './ConflictResolutionModal'
import { PreviewChangesModal } from './PreviewChangesModal'

export function SyncConsole() {
  const { status, events, isPushing, resolveConflict, syncTags, pushToLive, simulateConflicts } = useSyncStore()
  const { currentFile } = useLogicStore()
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [tagUpdates, setTagUpdates] = useState<Array<{ name: string; value: any; timestamp: string }>>([])

  const unresolvedConflicts = status.conflicts.filter(c => !c.resolved)

  // Start tag streaming and poll for updates
  useEffect(() => {
    // Start streaming on mount
    deviceAuth.getSessionToken().then(token => {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      fetch('http://localhost:8000/api/sync/start-streaming', { method: 'POST', headers })
        .catch(err => console.error('Failed to start streaming:', err))
    })
    
    // Poll for tag updates every second
    const interval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/sync/stream-tags')
        const data = await response.json()
        
        if (data.tags && data.streaming) {
          // Convert tags object to array of updates
          const updates = Object.entries(data.tags).map(([name, value]) => ({
            name,
            value,
            timestamp: data.timestamp || new Date().toISOString()
          }))
          setTagUpdates(prev => [...updates, ...prev].slice(0, 20)) // Keep last 20
        }
      } catch (error) {
        console.error('Failed to fetch tag stream:', error)
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const handleResolveConflict = (conflictId: string, resolution: 'shadow' | 'live') => {
    resolveConflict(conflictId, resolution)
  }

  const handleResolveAllConflicts = (resolution: 'shadow' | 'live') => {
    unresolvedConflicts.forEach(conflict => {
      resolveConflict(conflict.id, resolution)
    })
  }

  const handlePreviewChanges = () => {
    if (unresolvedConflicts.length > 0) {
      setShowConflictModal(true)
    } else {
      setShowPreviewModal(true)
    }
  }

  const handleConfirmPush = async () => {
    if (currentFile) {
      setShowPreviewModal(false)
      await pushToLive(currentFile.id)
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold dark:text-white">Connection Status</h3>
          <div className="flex items-center gap-2">
            {status.connected ? (
              <>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-neutral-600 dark:text-gray-400 mb-1">Shadow Runtime</div>
            <div className="flex items-center gap-2">
              {status.shadowOk ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-neutral-400" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium dark:text-gray-200">{status.shadowOk ? 'OK' : 'Not Ready'}</span>
                {status.executionMode && (
                  <span className="text-xs text-neutral-500 dark:text-gray-400">
                    {status.executionMode === 'simulation' ? 'Simulation' : 
                     status.executionMode === 'beremiz' ? 'Beremiz' : 'Failed'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-600 dark:text-gray-400 mb-1">Live Runtime</div>
            <div className="flex items-center gap-2">
              {status.liveOk ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-neutral-400" />
              )}
              <span className="text-sm font-medium dark:text-gray-200">{status.liveOk ? 'OK' : 'Not Ready'}</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-600 dark:text-gray-400 mb-1">Latency</div>
            <div className="text-sm font-medium dark:text-gray-200">{status.latency}ms</div>
          </div>

          <div>
            <div className="text-xs text-neutral-600 dark:text-gray-400 mb-1">Last Sync</div>
            <div className="text-sm font-medium dark:text-gray-200">
              {status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Conflicts Alert */}
      {unresolvedConflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900 mb-2">
                {unresolvedConflicts.length} Conflict{unresolvedConflicts.length > 1 ? 's' : ''} Detected
              </div>
              <div className="space-y-2">
                {unresolvedConflicts.map((conflict) => (
                  <div key={conflict.id} className="bg-white dark:bg-gray-800 rounded border border-amber-300 dark:border-amber-500 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm dark:text-white">{conflict.tagName}</div>
                      <div className="text-xs text-neutral-500 dark:text-gray-400">
                        {new Date(conflict.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
                        <div className="text-neutral-600 dark:text-gray-400 mb-1">Shadow</div>
                        <div className="font-mono font-medium dark:text-gray-200">{String(conflict.shadowValue)}</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded">
                        <div className="text-neutral-600 dark:text-gray-400 mb-1">Live</div>
                        <div className="font-mono font-medium dark:text-gray-200">{String(conflict.liveValue)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'shadow')}
                        className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Keep Shadow
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'live')}
                        className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Keep Live
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tag Streams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Live Tag Stream */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm dark:text-white">Live Tag Stream</h3>
            <Activity className="w-4 h-4 text-green-600 animate-pulse" />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
            {tagUpdates.length > 0 ? (
              tagUpdates.map((tag, index) => (
                <div key={`live-${tag.name}-${index}`} className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-gray-700 last:border-0">
                  <div className="font-mono text-neutral-900 dark:text-gray-200">{tag.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-neutral-600 dark:text-gray-300">
                      {typeof tag.value === 'number' ? tag.value.toFixed(1) : String(tag.value)}
                    </span>
                    <span className="text-neutral-400 dark:text-gray-500">{new Date(tag.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-neutral-500 text-center py-4">Starting tag stream...</div>
            )}
          </div>
        </div>

        {/* Shadow Tag Stream */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm dark:text-white">Shadow Tag Stream</h3>
            <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
            {tagUpdates.length > 0 ? (
              tagUpdates.map((tag, index) => (
                <div key={`shadow-${tag.name}-${index}`} className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-gray-700 last:border-0">
                  <div className="font-mono text-neutral-900 dark:text-gray-200">{tag.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-neutral-600 dark:text-gray-300">
                      {typeof tag.value === 'number' ? tag.value.toFixed(1) : String(tag.value)}
                    </span>
                    <span className="text-neutral-400 dark:text-gray-500">{new Date(tag.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-neutral-500 text-center py-4">Starting tag stream...</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sync Log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm dark:text-white">Recent Sync Log</h3>
          <div className="flex gap-2">
            <button
              onClick={() => syncTags()}
              className="px-3 py-1.5 text-xs bg-[#FF6A00] text-white rounded hover:bg-[#FF8020] transition-colors"
            >
              Sync Tags Now
            </button>
            <button
              onClick={() => simulateConflicts()}
              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
              title="Simulate conflicts for demo"
            >
              Demo Conflicts
            </button>
          </div>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {events.slice(0, 20).map((event) => (
            <div key={event.id} className="flex items-start gap-3 py-2 border-b border-neutral-100 dark:border-gray-700 last:border-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                event.type === 'CONFLICT' ? 'bg-amber-500' :
                event.type === 'HEARTBEAT' ? 'bg-green-500' :
                'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium dark:text-gray-200">{event.type.replace(/_/g, ' ')}</div>
                <div className="text-xs text-neutral-500 dark:text-gray-400">{new Date(event.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-xs text-neutral-500 dark:text-gray-400 text-center py-4">No sync events yet</div>
          )}
        </div>
      </div>

      {/* Push to Live Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-sm mb-3 dark:text-white">Push to Live</h3>
        <div className="space-y-3">
          <div className="text-xs text-neutral-600 dark:text-gray-400">
            Push current shadow logic to live runtime. This will update the production PLC.
          </div>
          <button
            onClick={handlePreviewChanges}
            className="w-full px-4 py-2 text-sm bg-neutral-100 dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-gray-200 rounded-md hover:bg-neutral-200 dark:hover:bg-gray-600 transition-colors"
          >
            Preview Changes
          </button>
          <button
            disabled={isPushing || !status.shadowOk}
            className={`w-full px-4 py-2 text-sm rounded-md transition-colors ${
              !isPushing && status.shadowOk
                ? 'bg-[#FF6A00] text-white hover:bg-[#FF8020]'
                : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
            }`}
          >
            {isPushing ? 'Pushing to Live...' : 'Push to Live (with Safety Checks)'}
          </button>
          <div className="text-xs text-neutral-500 dark:text-gray-400">
            ⚠️ Advanced safety checks will be added in Milestone 3
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        conflicts={status.conflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
      />

      <PreviewChangesModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmPush}
        logicName={currentFile?.name || 'Unknown Logic'}
        shadowLogic={currentFile?.content || ''}
        liveLogic="" // In real implementation, this would be fetched from live runtime
        targetRuntime="live"
      />
    </div>
  )
}

