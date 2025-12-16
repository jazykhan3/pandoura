import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { SyncConflict } from '../types'

type ConflictResolutionModalProps = {
  isOpen: boolean
  onClose: () => void
  conflicts: SyncConflict[]
  onResolve: (conflictId: string, resolution: 'shadow' | 'live') => void
  onResolveAll: (resolution: 'shadow' | 'live') => void
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  onResolve,
  onResolveAll
}: ConflictResolutionModalProps) {
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, 'shadow' | 'live'>>({})
  
  if (!isOpen) return null

  const unresolvedConflicts = conflicts.filter(c => !c.resolved)

  const handleIndividualResolve = (conflictId: string, resolution: 'shadow' | 'live') => {
    onResolve(conflictId, resolution)
    // Remove from local state
    const newResolutions = { ...selectedResolutions }
    delete newResolutions[conflictId]
    setSelectedResolutions(newResolutions)
  }

  const handleBatchResolve = (resolution: 'shadow' | 'live') => {
    onResolveAll(resolution)
    setSelectedResolutions({})
    onClose()
  }

  const formatValue = (value: unknown): string => {
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (typeof value === 'number') return value.toFixed(2)
    if (typeof value === 'string') return `"${value}"`
    return String(value)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <div>
                <h2 className="text-xl font-bold text-amber-900">
                  Sync Conflicts Detected
                </h2>
                <p className="text-sm text-amber-700 mt-1">
                  {unresolvedConflicts.length} conflict{unresolvedConflicts.length !== 1 ? 's' : ''} require resolution before pushing to live runtime
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-amber-600 hover:text-amber-800 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {unresolvedConflicts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">All Conflicts Resolved</h3>
              <p className="text-green-700">You can now proceed with the push operation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Batch Resolution */}
              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                <h3 className="font-semibold text-sm mb-3">Quick Resolution</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleBatchResolve('shadow')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Keep All Shadow Values
                  </button>
                  <button
                    onClick={() => handleBatchResolve('live')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Keep All Live Values
                  </button>
                </div>
                <p className="text-xs text-neutral-600 mt-2">
                  Or resolve conflicts individually below
                </p>
              </div>

              {/* Individual Conflicts */}
              <div className="space-y-3">
                {unresolvedConflicts.map((conflict) => (
                  <div key={conflict.id} className="bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{conflict.tagName}</h4>
                        <div className="flex items-center gap-2 text-sm text-neutral-600 mt-1">
                          <Clock className="w-4 h-4" />
                          <span>Detected: {new Date(conflict.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        {conflict.type || 'VALUE_CONFLICT'}
                      </div>
                    </div>

                    {/* Value Comparison */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-900">Shadow Runtime</span>
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        </div>
                        <div className="font-mono text-lg text-blue-800">
                          {formatValue(conflict.shadowValue)}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Test environment value
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-900">Live Runtime</span>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="font-mono text-lg text-green-800">
                          {formatValue(conflict.liveValue)}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Production environment value
                        </div>
                      </div>
                    </div>

                    {/* Resolution Options */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleIndividualResolve(conflict.id, 'shadow')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Keep Shadow Value
                      </button>
                      <button
                        onClick={() => handleIndividualResolve(conflict.id, 'live')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Keep Live Value
                      </button>
                    </div>

                    {/* Additional Info */}
                    {conflict.description && (
                      <div className="mt-3 p-2 bg-neutral-50 rounded text-sm text-neutral-700">
                        <strong>Details:</strong> {conflict.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-50 border-t border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600">
              {unresolvedConflicts.length > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-500" />
                  Resolve all conflicts to proceed with push
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
                  All conflicts resolved
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors"
              >
                {unresolvedConflicts.length > 0 ? 'Cancel Push' : 'Close'}
              </button>
              {unresolvedConflicts.length === 0 && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-[#FF6A00] text-white rounded-md hover:bg-[#FF8020] transition-colors"
                >
                  Continue Push
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
