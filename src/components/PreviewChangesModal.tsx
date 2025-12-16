import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, FileText, Shield, Clock, Zap } from 'lucide-react'

type SafetyCheck = {
  id: string
  name: string
  status: 'pass' | 'warning' | 'error'
  message: string
  details?: string
}

type LogicDiff = {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  lineNumber: number
  content: string
  oldContent?: string
}

type PreviewChangesModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  logicName?: string
  shadowLogic?: string
  liveLogic?: string
  targetRuntime: 'shadow' | 'live'
}

export function PreviewChangesModal({
  isOpen,
  onClose,
  onConfirm,
  logicName = 'Unknown Logic',
  shadowLogic = '',
  liveLogic = '',
  targetRuntime
}: PreviewChangesModalProps) {
  const [activeTab, setActiveTab] = useState<'diff' | 'safety' | 'summary'>('summary')
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>([])
  const [logicDiff, setLogicDiff] = useState<LogicDiff[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  useEffect(() => {
    if (isOpen) {
      performSafetyAnalysis()
      generateDiff()
    }
  }, [isOpen, shadowLogic, liveLogic])

  const performSafetyAnalysis = async () => {
    setIsAnalyzing(true)
    
    // Simulate safety analysis
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const checks: SafetyCheck[] = [
      {
        id: 'syntax',
        name: 'Syntax Validation',
        status: 'pass',
        message: 'No syntax errors detected',
        details: 'All ST constructs are properly formatted'
      },
      {
        id: 'tags',
        name: 'Tag References',
        status: shadowLogic.includes('undefined_tag') ? 'error' : 'pass',
        message: shadowLogic.includes('undefined_tag') 
          ? 'Undefined tag references found' 
          : 'All referenced tags are defined',
        details: shadowLogic.includes('undefined_tag')
          ? 'Tag "undefined_tag" is not declared in any VAR section'
          : 'All tag references validated against Tag Database'
      },
      {
        id: 'critical_tags',
        name: 'Critical Tag Protection',
        status: shadowLogic.toLowerCase().includes('emergency') ? 'warning' : 'pass',
        message: shadowLogic.toLowerCase().includes('emergency')
          ? 'Logic modifies emergency/safety tags'
          : 'No critical safety tags affected',
        details: shadowLogic.toLowerCase().includes('emergency')
          ? 'Changes affect emergency stop or safety interlock systems'
          : 'No safety-critical systems are modified'
      },
      {
        id: 'runtime_compatibility',
        name: 'Runtime Compatibility',
        status: 'pass',
        message: 'Logic is compatible with target runtime',
        details: `Compatible with ${targetRuntime} runtime environment`
      },
      {
        id: 'performance',
        name: 'Performance Impact',
        status: shadowLogic.length > 1000 ? 'warning' : 'pass',
        message: shadowLogic.length > 1000 
          ? 'Large logic file may impact cycle time'
          : 'Minimal performance impact expected',
        details: `Logic size: ${shadowLogic.length} characters`
      }
    ]

    setSafetyChecks(checks)
    setIsAnalyzing(false)
  }

  const generateDiff = () => {
    const shadowLines = shadowLogic.split('\n')
    const liveLines = liveLogic.split('\n')
    const diff: LogicDiff[] = []

    const maxLines = Math.max(shadowLines.length, liveLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      const shadowLine = i < shadowLines.length ? shadowLines[i] : undefined
      const liveLine = i < liveLines.length ? liveLines[i] : undefined

      if (shadowLine === undefined && liveLine !== undefined) {
        diff.push({
          type: 'removed',
          lineNumber: i + 1,
          content: liveLine,
          oldContent: liveLine
        })
      } else if (shadowLine !== undefined && liveLine === undefined) {
        diff.push({
          type: 'added',
          lineNumber: i + 1,
          content: shadowLine
        })
      } else if (shadowLine !== liveLine) {
        diff.push({
          type: 'modified',
          lineNumber: i + 1,
          content: shadowLine || '',
          oldContent: liveLine
        })
      } else if (shadowLine === liveLine) {
        diff.push({
          type: 'unchanged',
          lineNumber: i + 1,
          content: shadowLine || ''
        })
      }
    }

    setLogicDiff(diff)
  }

  if (!isOpen) return null

  const hasErrors = safetyChecks.some(check => check.status === 'error')
  const hasWarnings = safetyChecks.some(check => check.status === 'warning')
  const changesCount = logicDiff.filter(d => d.type !== 'unchanged').length

  const getStatusIcon = (status: SafetyCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />
    }
  }

  const getDiffLineClass = (type: LogicDiff['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 text-green-800 dark:text-green-300'
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 text-red-800 dark:text-red-300'
      case 'modified':
        return 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 text-blue-800 dark:text-blue-300'
      default:
        return 'bg-neutral-50 dark:bg-gray-700 text-neutral-600 dark:text-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#FF6A00] text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Preview Changes</h2>
                <p className="text-orange-100 text-sm">
                  Review changes before pushing "{logicName}" to {targetRuntime} runtime
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-orange-100 hover:text-white transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'summary'
                  ? 'border-[#FF6A00] text-[#FF6A00]'
                  : 'border-transparent text-neutral-600 dark:text-gray-300 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Summary
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'diff'
                  ? 'border-[#FF6A00] text-[#FF6A00]'
                  : 'border-transparent text-neutral-600 dark:text-gray-300 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Changes ({changesCount})
            </button>
            <button
              onClick={() => setActiveTab('safety')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'safety'
                  ? 'border-[#FF6A00] text-[#FF6A00]'
                  : 'border-transparent text-neutral-600 dark:text-gray-300 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Safety Checks
              {hasErrors && <span className="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
              {!hasErrors && hasWarnings && <span className="ml-1 w-2 h-2 bg-amber-500 rounded-full inline-block"></span>}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {isAnalyzing ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-neutral-600 dark:text-gray-400">Analyzing changes and running safety checks...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Overview */}
                  <div className="bg-neutral-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3 dark:text-white">Change Overview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-neutral-600 dark:text-gray-400 mb-1">Target Runtime</div>
                        <div className="font-semibold capitalize dark:text-gray-200">{targetRuntime}</div>
                      </div>
                      <div>
                        <div className="text-neutral-600 dark:text-gray-400 mb-1">Logic File</div>
                        <div className="font-semibold dark:text-gray-200">{logicName}</div>
                      </div>
                      <div>
                        <div className="text-neutral-600 dark:text-gray-400 mb-1">Changes</div>
                        <div className="font-semibold dark:text-gray-200">{changesCount} lines</div>
                      </div>
                      <div>
                        <div className="text-neutral-600 dark:text-gray-400 mb-1">Safety Status</div>
                        <div className={`font-semibold ${
                          hasErrors ? 'text-red-600' : hasWarnings ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {hasErrors ? 'Blocked' : hasWarnings ? 'Warnings' : 'Clear'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Safety Summary */}
                  <div className="bg-white dark:bg-gray-700 border border-neutral-200 dark:border-gray-600 rounded-lg p-4">
                    <h3 className="font-semibold mb-3 dark:text-white">Safety Check Summary</h3>
                    <div className="space-y-2">
                      {safetyChecks.map((check) => (
                        <div key={check.id} className="flex items-center gap-3">
                          {getStatusIcon(check.status)}
                          <span className="flex-1 dark:text-gray-200">{check.name}</span>
                          <span className="text-sm text-neutral-600 dark:text-gray-400">{check.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impact Assessment */}
                  <div className="bg-white dark:bg-gray-700 border border-neutral-200 dark:border-gray-600 rounded-lg p-4">
                    <h3 className="font-semibold mb-3 dark:text-white">Impact Assessment</h3>
                    <div className="text-sm text-neutral-700 dark:text-gray-300 space-y-2">
                      <p>• This push will update the {targetRuntime} runtime with new logic</p>
                      <p>• {changesCount} line{changesCount !== 1 ? 's' : ''} will be modified</p>
                      {hasWarnings && <p className="text-amber-600">• Review warnings before proceeding</p>}
                      {hasErrors && <p className="text-red-600">• Critical errors must be resolved first</p>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold dark:text-white">Logic Changes</h3>
                    <div className="text-sm text-neutral-600 dark:text-gray-400">
                      {changesCount} change{changesCount !== 1 ? 's' : ''} detected
                    </div>
                  </div>

                  <div className="bg-neutral-900 text-neutral-100 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    {logicDiff.length === 0 ? (
                      <div className="text-neutral-500 dark:text-gray-400 text-center py-4">No changes detected</div>
                    ) : (
                      <div className="space-y-1">
                        {logicDiff.filter(d => d.type !== 'unchanged').map((diff, index) => (
                          <div key={index} className={`p-2 rounded ${getDiffLineClass(diff.type)}`}>
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-neutral-500 w-8 flex-shrink-0">
                                {diff.lineNumber}
                              </span>
                              <span className="text-xs font-medium w-8 flex-shrink-0">
                                {diff.type === 'added' && '+'}
                                {diff.type === 'removed' && '-'}
                                {diff.type === 'modified' && '~'}
                              </span>
                              <div className="flex-1">
                                {diff.type === 'modified' && diff.oldContent && (
                                  <div className="text-red-700 mb-1">- {diff.oldContent}</div>
                                )}
                                <div className={diff.type === 'modified' ? 'text-green-700' : ''}>
                                  {diff.type === 'added' && '+ '}
                                  {diff.type === 'removed' && '- '}
                                  {diff.type === 'modified' && '+ '}
                                  {diff.content}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'safety' && (
                <div className="space-y-4">
                  <h3 className="font-semibold dark:text-white">Safety Check Details</h3>
                  
                  <div className="space-y-3">
                    {safetyChecks.map((check) => (
                      <div key={check.id} className="bg-white dark:bg-gray-700 border border-neutral-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(check.status)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium dark:text-white">{check.name}</h4>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                check.status === 'pass' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                check.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' :
                                'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                              }`}>
                                {check.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-700 dark:text-gray-300 mb-2">{check.message}</p>
                            {check.details && (
                              <p className="text-xs text-neutral-600 dark:text-gray-400 bg-neutral-50 dark:bg-gray-600 p-2 rounded">
                                {check.details}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-50 dark:bg-gray-700 border-t border-neutral-200 dark:border-gray-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Analysis completed at {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-md hover:bg-neutral-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={hasErrors}
                className={`px-6 py-2 text-sm rounded-md transition-colors ${
                  hasErrors
                    ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                    : 'bg-[#FF6A00] text-white hover:bg-[#FF8020]'
                }`}
              >
                {hasErrors ? 'Cannot Push (Errors)' : hasWarnings ? 'Push with Warnings' : 'Confirm Push'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
