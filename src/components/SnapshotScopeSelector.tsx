import { useState, useEffect } from 'react'
import { Card } from './Card'
import {
  Check,
  AlertCircle,
  HardDrive,
  Code,
  Database,
  Box,
  Activity,
  FileCode
} from 'lucide-react'
import { deviceAuth } from '../utils/deviceAuth'

export type SnapshotScope = {
  programs: boolean
  tags: boolean
  dataTypes: boolean
  routines: boolean
  aois: boolean
  executionUnits: boolean
  constants: boolean
}

export type ScopeObjectCounts = {
  programs: number
  tags: number
  dataTypes: number
  routines: number
  aois: number
  executionUnits: number
  constants: number
}

export type ScopeEstimate = {
  totalObjects: number
  estimatedMemoryKB: number
}

interface SnapshotScopeSelectorProps {
  runtimeId: string
  selectedScope: SnapshotScope
  onScopeChange: (scope: SnapshotScope) => void
  disabled?: boolean
}

const SCOPE_ITEMS = [
  {
    key: 'programs' as const,
    label: 'Programs',
    icon: FileCode,
    description: 'Complete program logic and structure',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    key: 'executionUnits' as const,
    label: 'Execution Units',
    icon: Activity,
    description: 'Tasks, phases, and execution sequences',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20'
  },
  {
    key: 'tags' as const,
    label: 'Tags',
    icon: Database,
    description: 'Controller-scoped and program-scoped tags',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/20'
  },
  {
    key: 'dataTypes' as const,
    label: 'Data Types (UDTs)',
    icon: Box,
    description: 'User-defined data types and structures',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20'
  },
  {
    key: 'routines' as const,
    label: 'Routines',
    icon: Code,
    description: 'Ladder logic, structured text, and function blocks',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/20'
  },
  {
    key: 'aois' as const,
    label: 'Add-On Instructions',
    icon: Box,
    description: 'Reusable instruction definitions',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-900/20'
  },
  {
    key: 'constants' as const,
    label: 'Constants',
    icon: HardDrive,
    description: 'System and user-defined constants',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/20'
  }
]

export function SnapshotScopeSelector({
  runtimeId,
  selectedScope,
  onScopeChange,
  disabled = false
}: SnapshotScopeSelectorProps) {
  const [objectCounts, setObjectCounts] = useState<ScopeObjectCounts | null>(null)
  const [estimate, setEstimate] = useState<ScopeEstimate | null>(null)
  const [isLoadingCounts, setIsLoadingCounts] = useState(true)
  const [countsError, setCountsError] = useState<string | null>(null)

  useEffect(() => {
    loadObjectCounts()
  }, [runtimeId])

  useEffect(() => {
    calculateEstimate()
  }, [selectedScope, objectCounts])

  const loadObjectCounts = async () => {
    if (!runtimeId) {
      setCountsError('No runtime selected')
      setIsLoadingCounts(false)
      return
    }
    
    setIsLoadingCounts(true)
    setCountsError(null)
    
    try {
      // Get session token for authentication
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        throw new Error('No session token available. Please log in.')
      }
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${sessionToken}`
      }
      
      // First, try to get runtime details to fetch counts directly
      const runtimeResponse = await fetch(
        `http://localhost:8000/api/runtimes/${runtimeId}`,
        { headers }
      )
      
      if (!runtimeResponse.ok) {
        const errorData = await runtimeResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch runtime details: ${runtimeResponse.status}`)
      }
      
      const runtimeData = await runtimeResponse.json()
      const runtime = runtimeData.runtime
      
      if (!runtime) {
        throw new Error('Runtime not found')
      }
      
      // Fetch counts directly from runtime
      const runtimeUrl = `http://${runtime.ipAddress}:${runtime.port}`
      console.log(`📊 Fetching counts from ${runtimeUrl}/snapshot/summary`)
      
      const summaryResponse = await fetch(`${runtimeUrl}/snapshot/summary`)
      
      if (!summaryResponse.ok) {
        throw new Error(`Runtime summary endpoint failed: ${summaryResponse.status}`)
      }
      
      const summaryData = await summaryResponse.json()
      console.log('✅ Loaded dynamic object counts from runtime:', summaryData)
      
      // Map to component format
      const counts = {
        programs: summaryData.programs || 0,
        executionUnits: summaryData.tasks || 0,
        tags: summaryData.symbols || 0,
        dataTypes: summaryData.types || 0,
        routines: 0, // Not in mock runtime
        aois: 0, // Not in mock runtime
        constants: summaryData.constants || 0
      }
      
      setObjectCounts(counts)
      setCountsError(null)
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load object counts'
      console.error('❌ Error loading object counts:', errorMsg)
      setCountsError(errorMsg)
      setObjectCounts(null)
    } finally {
      setIsLoadingCounts(false)
    }
  }

  const calculateEstimate = () => {
    if (!objectCounts) return

    let total = 0
    let memory = 0

    if (selectedScope.programs) {
      total += objectCounts.programs
      memory += objectCounts.programs * 50 // ~50KB per program
    }
    if (selectedScope.executionUnits) {
      total += objectCounts.executionUnits
      memory += objectCounts.executionUnits * 10 // ~10KB per execution unit
    }
    if (selectedScope.tags) {
      total += objectCounts.tags
      memory += objectCounts.tags * 2 // ~2KB per tag
    }
    if (selectedScope.dataTypes) {
      total += objectCounts.dataTypes
      memory += objectCounts.dataTypes * 5 // ~5KB per UDT
    }
    if (selectedScope.routines) {
      total += objectCounts.routines
      memory += objectCounts.routines * 20 // ~20KB per routine
    }
    if (selectedScope.aois) {
      total += objectCounts.aois
      memory += objectCounts.aois * 30 // ~30KB per AOI
    }
    if (selectedScope.constants) {
      total += objectCounts.constants
      memory += objectCounts.constants * 0.5 // ~0.5KB per constant
    }

    setEstimate({ totalObjects: total, estimatedMemoryKB: memory })
  }

  const handleToggle = (key: keyof SnapshotScope) => {
    if (disabled) return
    onScopeChange({
      ...selectedScope,
      [key]: !selectedScope[key]
    })
  }

  const handleSelectAll = () => {
    if (disabled) return
    onScopeChange({
      programs: true,
      executionUnits: true,
      tags: true,
      dataTypes: true,
      routines: true,
      aois: true,
      constants: true
    })
  }

  const handleSelectNone = () => {
    if (disabled) return
    onScopeChange({
      programs: false,
      executionUnits: false,
      tags: false,
      dataTypes: false,
      routines: false,
      aois: false,
      constants: false
    })
  }

  const selectedCount = Object.values(selectedScope).filter(Boolean).length
  const hasSelection = selectedCount > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Snapshot Scope
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Select what to extract from the PLC runtime
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            disabled={disabled}
            className="text-sm text-[#FF6A00] hover:text-[#FF6A00]/80 transition-colors disabled:opacity-50"
          >
            Select All
          </button>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <button
            onClick={handleSelectNone}
            disabled={disabled}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error loading counts */}
      {countsError && (
        <Card className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Failed to Load Object Counts
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {countsError}
              </p>
              <button
                onClick={loadObjectCounts}
                className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Warning if no selection */}
      {!hasSelection && (
        <Card className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                No Items Selected
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                You must select at least one scope item to proceed. Nothing will be extracted with the current selection.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Scope Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SCOPE_ITEMS.map((item) => {
          const Icon = item.icon
          const isSelected = selectedScope[item.key]
          const count = objectCounts?.[item.key] ?? 0

          return (
            <div
              key={item.key}
              className={`p-4 cursor-pointer transition-all rounded-lg border border-gray-200 dark:border-gray-700 ${
                isSelected
                  ? 'ring-2 ring-[#FF6A00] bg-orange-50 dark:bg-orange-900/10'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && handleToggle(item.key)}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`p-2 ${item.bgColor} rounded-lg flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {item.label}
                    </h4>
                    {isSelected && (
                      <Check className="w-5 h-5 text-[#FF6A00] flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {item.description}
                  </p>
                  
                  {/* Object Count */}
                  {isLoadingCounts ? (
                    <div className="mt-2 h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : countsError ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        Error
                      </span>
                      <span className="text-xs text-red-500 dark:text-red-400">
                        unable to load
                      </span>
                    </div>
                  ) : objectCounts ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {count.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        objects
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        ?
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        unknown
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Estimate Summary */}
      {estimate && hasSelection && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Selection Summary
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-blue-700 dark:text-blue-300">Categories:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedCount} of {SCOPE_ITEMS.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-700 dark:text-blue-300">Total Objects:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {estimate.totalObjects.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-700 dark:text-blue-300">Estimated Size:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {formatMemorySize(estimate.estimatedMemoryKB)}
                  </span>
                </div>
              </div>
            </div>
            
            <HardDrive className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </Card>
      )}
    </div>
  )
}

// Mock data for development
const mockCounts: ScopeObjectCounts = {
  programs: 12,
  executionUnits: 8,
  tags: 247,
  dataTypes: 23,
  routines: 45,
  aois: 7,
  constants: 156
}

function formatMemorySize(kb: number): string {
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }
  const mb = kb / 1024
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`
  }
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}
