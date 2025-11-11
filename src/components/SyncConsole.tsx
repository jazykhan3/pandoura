import { useSyncStore } from '../store/syncStore'
import { Activity, AlertCircle, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react'

export function SyncConsole() {
  const { status, events, isPushing, resolveConflict, syncTags } = useSyncStore()

  const unresolvedConflicts = status.conflicts.filter(c => !c.resolved)

  const handleResolveConflict = (conflictId: string, resolution: 'shadow' | 'live') => {
    resolveConflict(conflictId, resolution)
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Connection Status</h3>
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
            <div className="text-xs text-neutral-600 mb-1">Shadow Runtime</div>
            <div className="flex items-center gap-2">
              {status.shadowOk ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-neutral-400" />
              )}
              <span className="text-sm font-medium">{status.shadowOk ? 'OK' : 'Not Ready'}</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-600 mb-1">Live Runtime</div>
            <div className="flex items-center gap-2">
              {status.liveOk ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-neutral-400" />
              )}
              <span className="text-sm font-medium">{status.liveOk ? 'OK' : 'Not Ready'}</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-neutral-600 mb-1">Latency</div>
            <div className="text-sm font-medium">{status.latency}ms</div>
          </div>

          <div>
            <div className="text-xs text-neutral-600 mb-1">Last Sync</div>
            <div className="text-sm font-medium">
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
                  <div key={conflict.id} className="bg-white rounded border border-amber-300 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">{conflict.tagName}</div>
                      <div className="text-xs text-neutral-500">
                        {new Date(conflict.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="text-neutral-600 mb-1">Shadow</div>
                        <div className="font-mono font-medium">{String(conflict.shadowValue)}</div>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <div className="text-neutral-600 mb-1">Live</div>
                        <div className="font-mono font-medium">{String(conflict.liveValue)}</div>
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
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Live Tag Stream</h3>
            <Activity className="w-4 h-4 text-green-600" />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
            {events
              .filter(e => e.type === 'TAG_UPDATE')
              .slice(0, 10)
              .map((event) => {
                const payload = event.payload as { name: string; value: unknown; timestamp: string }
                return (
                  <div key={event.id} className="flex items-center justify-between py-1 border-b border-neutral-100 last:border-0">
                    <div className="font-mono text-neutral-900">{payload.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-neutral-600">{String(payload.value)}</span>
                      <span className="text-neutral-400">{new Date(payload.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                )
              })}
            {events.filter(e => e.type === 'TAG_UPDATE').length === 0 && (
              <div className="text-neutral-500 text-center py-4">No tag updates yet</div>
            )}
          </div>
        </div>

        {/* Shadow Tag Stream */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Shadow Tag Stream</h3>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
            <div className="text-neutral-500 text-center py-4">Mirror of live stream (testing mode)</div>
          </div>
        </div>
      </div>

      {/* Recent Sync Log */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Recent Sync Log</h3>
          <button
            onClick={() => syncTags()}
            className="px-3 py-1.5 text-xs bg-[#FF6A00] text-white rounded hover:bg-[#FF8020] transition-colors"
          >
            Sync Tags Now
          </button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {events.slice(0, 20).map((event) => (
            <div key={event.id} className="flex items-start gap-3 py-2 border-b border-neutral-100 last:border-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                event.type === 'CONFLICT' ? 'bg-amber-500' :
                event.type === 'HEARTBEAT' ? 'bg-green-500' :
                'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{event.type.replace(/_/g, ' ')}</div>
                <div className="text-xs text-neutral-500">{new Date(event.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-xs text-neutral-500 text-center py-4">No sync events yet</div>
          )}
        </div>
      </div>

      {/* Push to Live Actions */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <h3 className="font-semibold text-sm mb-3">Push to Live</h3>
        <div className="space-y-3">
          <div className="text-xs text-neutral-600">
            Push current shadow logic to live runtime. This will update the production PLC.
          </div>
          <button
            onClick={() => alert('Preview Changes modal (feature ready for Milestone 3)')}
            className="w-full px-4 py-2 text-sm bg-neutral-100 border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-200 transition-colors"
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
          <div className="text-xs text-neutral-500">
            ⚠️ Advanced safety checks will be added in Milestone 3
          </div>
        </div>
      </div>
    </div>
  )
}

