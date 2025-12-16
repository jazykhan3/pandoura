import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Shield,
  Package2,
  GitBranch,
  Target,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Edit3,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react'
import type {
  DeploymentStrategy,
  PatchStrategy,
  DeploymentConfig,
  DeploymentTarget,
  HealthCheck,
  DeploymentCohort,
  RollbackTrigger,
} from '../types'

interface DeploymentStrategyConfigProps {
  config: DeploymentConfig | null
  onConfigChange: (config: DeploymentConfig) => void
  targets: DeploymentTarget[]
  onClose: () => void
}

export function DeploymentStrategyConfig({ 
  config, 
  onConfigChange, 
  targets: _targets, 
  onClose 
}: DeploymentStrategyConfigProps) {
  const [localConfig, setLocalConfig] = useState<DeploymentConfig>(
    config || createDefaultConfig()
  )
  const [activeTab, setActiveTab] = useState<'strategy' | 'targets' | 'health' | 'rollback'>('strategy')
  // const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']))

  useEffect(() => {
    if (config) {
      setLocalConfig(config)
    }
  }, [config])

  function createDefaultConfig(): DeploymentConfig {
    return {
      id: `config-${Date.now()}`,
      name: 'New Deployment Configuration',
      strategy: 'atomic',
      patchStrategy: 'quiesce',
      targets: [],
      rollbackTriggers: [],
      deployWatchWindow: 5,
      atomic: {
        strategy: 'atomic',
        validateBeforeSwap: true,
        rollbackOnFailure: true,
        tempAreaPath: '/tmp/deploy',
        swapTimeout: 30,
        cleanupAfterSuccess: true,
        preDeployValidation: [],
        postDeployValidation: [],
      },
      dryRunFirst: false,
      requireApproval: false,
      notificationSettings: {
        onStart: [],
        onSuccess: [],
        onFailure: [],
        onRollback: [],
      }
    }
  }

  const updateConfig = (updates: Partial<DeploymentConfig>) => {
    const newConfig = { ...localConfig, ...updates }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const updateStrategyConfig = (updates: any) => {
    const strategyKey = localConfig.strategy
    updateConfig({
      [strategyKey]: { ...localConfig[strategyKey], ...updates }
    })
  }



  const addTarget = () => {
    const newTarget: DeploymentTarget = {
      id: `target-${Date.now()}`,
      name: 'New Target',
      type: 'plc',
      address: '',
      runtime: 'PandaUra Runtime',
      status: 'offline',
      capabilities: ['deploy', 'rollback'],
      canQuiesce: true,
    }
    updateConfig({
      targets: [...localConfig.targets, newTarget]
    })
  }

  const updateTarget = (index: number, updates: Partial<DeploymentTarget>) => {
    const newTargets = [...localConfig.targets]
    newTargets[index] = { ...newTargets[index], ...updates }
    updateConfig({ targets: newTargets })
  }

  const removeTarget = (index: number) => {
    const newTargets = localConfig.targets.filter((_, i) => i !== index)
    updateConfig({ targets: newTargets })
  }

  const addHealthCheck = () => {
    if (!localConfig.canary) return
    
    const newCheck: HealthCheck = {
      id: `check-${Date.now()}`,
      name: 'New Health Check',
      type: 'tag_range',
      enabled: true,
      config: {
        timeout: 30,
        retryCount: 3,
      },
      thresholds: {
        warning: 1,
        critical: 3,
      }
    }
    
    updateStrategyConfig({
      healthChecks: [...(localConfig.canary.healthChecks || []), newCheck]
    })
  }

  const addCohort = () => {
    if (!localConfig.canary) return
    
    const newCohort: DeploymentCohort = {
      id: `cohort-${Date.now()}`,
      name: `Cohort ${(localConfig.canary.cohorts?.length || 0) + 1}`,
      fraction: 25,
      targets: [],
      order: (localConfig.canary.cohorts?.length || 0) + 1,
      healthChecks: [],
      waitTime: 300,
      autoPromote: false,
    }
    
    updateStrategyConfig({
      cohorts: [...(localConfig.canary.cohorts || []), newCohort]
    })
  }

  const addRollbackTrigger = () => {
    const newTrigger: RollbackTrigger = {
      id: `trigger-${Date.now()}`,
      type: 'health_check',
      enabled: true,
      threshold: 3,
      watchWindow: 5,
      autoRollback: false,
      config: {}
    }
    
    updateConfig({
      rollbackTriggers: [...localConfig.rollbackTriggers, newTrigger]
    })
  }

  const renderStrategySpecificConfig = () => {
    switch (localConfig.strategy) {
      case 'atomic':
        return renderAtomicConfig()
      case 'canary':
        return renderCanaryConfig()
      case 'chunked':
        return renderChunkedConfig()
      default:
        return null
    }
  }

  const renderAtomicConfig = () => {
    const config = localConfig.atomic || createDefaultConfig().atomic!
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <Shield size={20} />
          <span className="font-medium">Atomic Deployment</span>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Compute tree of changed files → Stage in temp area → Validate → Atomic swap → Cleanup
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.validateBeforeSwap}
                onChange={(e) => updateStrategyConfig({ validateBeforeSwap: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Validate before swap</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.rollbackOnFailure}
                onChange={(e) => updateStrategyConfig({ rollbackOnFailure: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Auto rollback on failure</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.cleanupAfterSuccess}
                onChange={(e) => updateStrategyConfig({ cleanupAfterSuccess: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Cleanup temp files on success</span>
            </label>
          </div>
          
          <div className="mt-4 space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temp Area Path
              </label>
              <input
                type="text"
                value={config.tempAreaPath}
                onChange={(e) => updateStrategyConfig({ tempAreaPath: e.target.value })}
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-800 dark:text-gray-200"
                placeholder="/tmp/deploy"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Swap Timeout (seconds)
              </label>
              <input
                type="number"
                value={config.swapTimeout}
                onChange={(e) => updateStrategyConfig({ swapTimeout: parseInt(e.target.value) })}
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-800 dark:text-gray-200"
                min="5"
                max="300"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderCanaryConfig = () => {
    const config = localConfig.canary || {
      strategy: 'canary' as const,
      cohorts: [],
      healthChecks: [],
      globalHealthWindow: 10,
      rollbackOnFailure: true,
      requireManualPromotion: false,
      maxConcurrentTargets: 3,
    }
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <GitBranch size={20} />
          <span className="font-medium">Canary / Phased Deployment</span>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300 mb-3">
            Deploy to cohorts → Run health checks → Promote to next cohort → Repeat
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Health Check Window (minutes)
              </label>
              <input
                type="number"
                value={config.globalHealthWindow}
                onChange={(e) => updateStrategyConfig({ globalHealthWindow: parseInt(e.target.value) })}
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-800 dark:text-gray-200"
                min="1"
                max="60"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Concurrent Targets
              </label>
              <input
                type="number"
                value={config.maxConcurrentTargets}
                onChange={(e) => updateStrategyConfig({ maxConcurrentTargets: parseInt(e.target.value) })}
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-800 dark:text-gray-200"
                min="1"
                max="10"
              />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.rollbackOnFailure}
                onChange={(e) => updateStrategyConfig({ rollbackOnFailure: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Auto rollback on failure</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.requireManualPromotion}
                onChange={(e) => updateStrategyConfig({ requireManualPromotion: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Require manual promotion between cohorts</span>
            </label>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm dark:text-gray-200">Deployment Cohorts</span>
            <button
              onClick={addCohort}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center gap-1"
            >
              <Plus size={14} />
              Add Cohort
            </button>
          </div>
          
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {config.cohorts?.map((cohort) => (
              <div key={cohort.id} className="bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium dark:text-gray-200">{cohort.name} ({cohort.fraction}%)</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{cohort.targets.length} targets</span>
                    <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                      <Edit3 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(!config.cohorts || config.cohorts.length === 0) && (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                No cohorts configured. Click "Add Cohort" to create deployment phases.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderChunkedConfig = () => {
    const config = localConfig.chunked || {
      strategy: 'chunked' as const,
      chunkBoundaries: [],
      autoDetectBoundaries: true,
      maxChunkSize: 50,
      dependencyOrdering: true,
      stageWiseMode: false,
      parallelChunks: false,
      rollbackChunkOnFailure: true,
    }
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-purple-600">
          <Package2 size={20} />
          <span className="font-medium">Large Project Chunking</span>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg">
          <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
            Auto-split by logical boundaries → Deploy chunks with dependency ordering → Stage-wise mode available
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Chunk Size (files)
              </label>
              <input
                type="number"
                value={config.maxChunkSize}
                onChange={(e) => updateStrategyConfig({ maxChunkSize: parseInt(e.target.value) })}
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-800 dark:text-gray-200"
                min="1"
                max="200"
              />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.autoDetectBoundaries}
                onChange={(e) => updateStrategyConfig({ autoDetectBoundaries: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Auto-detect logical boundaries</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.dependencyOrdering}
                onChange={(e) => updateStrategyConfig({ dependencyOrdering: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Use dependency ordering (topological sort)</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.stageWiseMode}
                onChange={(e) => updateStrategyConfig({ stageWiseMode: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Stage-wise mode (force chunk boundaries)</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.parallelChunks}
                onChange={(e) => updateStrategyConfig({ parallelChunks: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Deploy independent chunks in parallel</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.rollbackChunkOnFailure}
                onChange={(e) => updateStrategyConfig({ rollbackChunkOnFailure: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm dark:text-gray-300">Rollback chunk on failure</span>
            </label>
          </div>
          
          <div className="text-sm text-purple-700 dark:text-purple-300">
            <div className="font-medium mb-1">Boundary Types:</div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Per-program: Each PROGRAM block becomes a chunk</li>
              <li>Per-controller: Files grouped by target controller</li>
              <li>Per-IO block: I/O configuration files grouped separately</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Deployment Strategy Configuration</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure deployment strategy, targets, and rollback behavior
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6">
          <div className="flex space-x-6">
            {[
              { id: 'strategy', label: 'Strategy', icon: Settings },
              { id: 'targets', label: 'Targets', icon: Target },
              { id: 'health', label: 'Health Checks', icon: CheckCircle },
              { id: 'rollback', label: 'Rollback', icon: RotateCcw },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === id
                    ? 'border-[#FF6A00] text-[#FF6A00]'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] dark:bg-gray-800">
          {activeTab === 'strategy' && (
            <div className="space-y-6">
              {/* Basic Configuration */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Configuration Name
                    </label>
                    <input
                      type="text"
                      value={localConfig.name}
                      onChange={(e) => updateConfig({ name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                      placeholder="My Deployment Strategy"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deploy Watch Window (minutes)
                    </label>
                    <input
                      type="number"
                      value={localConfig.deployWatchWindow}
                      onChange={(e) => updateConfig({ deployWatchWindow: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                      min="1"
                      max="60"
                    />
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deployment Strategy
                    </label>
                    <div className="flex space-x-4">
                      {[
                        { value: 'atomic', label: 'Atomic Deploy (Default)', icon: Shield },
                        { value: 'canary', label: 'Canary / Phased Deploy', icon: GitBranch },
                        { value: 'chunked', label: 'Large Project Chunking', icon: Package2 },
                      ].map(({ value, label, icon: Icon }) => (
                        <label key={value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="strategy"
                            value={value}
                            checked={localConfig.strategy === value}
                            onChange={(e) => updateConfig({ strategy: e.target.value as DeploymentStrategy })}
                            className="text-[#FF6A00]"
                          />
                          <Icon size={16} className="dark:text-gray-400" />
                          <span className="text-sm dark:text-gray-300">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Patch Strategy
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="patchStrategy"
                          value="quiesce"
                          checked={localConfig.patchStrategy === 'quiesce'}
                          onChange={(e) => updateConfig({ patchStrategy: e.target.value as PatchStrategy })}
                          className="text-[#FF6A00]"
                        />
                        <Pause size={16} className="dark:text-gray-400" />
                        <span className="text-sm dark:text-gray-300">Quiesce (Pause system)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="patchStrategy"
                          value="live"
                          checked={localConfig.patchStrategy === 'live'}
                          onChange={(e) => updateConfig({ patchStrategy: e.target.value as PatchStrategy })}
                          className="text-[#FF6A00]"
                        />
                        <Play size={16} className="dark:text-gray-400" />
                        <span className="text-sm dark:text-gray-300">Live Patch (Hot swap)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy-Specific Configuration */}
              {renderStrategySpecificConfig()}

              {/* Common Options */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Common Options</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={localConfig.dryRunFirst}
                      onChange={(e) => updateConfig({ dryRunFirst: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm dark:text-gray-300">Run dry run simulation first</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={localConfig.requireApproval}
                      onChange={(e) => updateConfig({ requireApproval: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm dark:text-gray-300">Require manual approval before deployment</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'targets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Deployment Targets</h3>
                <button
                  onClick={addTarget}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-orange-600 flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Target
                </button>
              </div>
              
              <div className="space-y-3">
                {localConfig.targets.map((target, index) => (
                  <div key={target.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-gray-500 dark:text-gray-400" />
                        <input
                          type="text"
                          value={target.name}
                          onChange={(e) => updateTarget(index, { name: e.target.value })}
                          className="font-medium border-none bg-transparent dark:text-gray-200"
                          placeholder="Target Name"
                        />
                      </div>
                      <button
                        onClick={() => removeTarget(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                        <select
                          value={target.type}
                          onChange={(e) => updateTarget(index, { type: e.target.value as any })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-gray-200"
                        >
                          <option value="plc">PLC</option>
                          <option value="hmi">HMI</option>
                          <option value="scada">SCADA</option>
                          <option value="cluster">Cluster</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Address</label>
                        <input
                          type="text"
                          value={target.address}
                          onChange={(e) => updateTarget(index, { address: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-gray-200"
                          placeholder="192.168.1.100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Runtime</label>
                        <input
                          type="text"
                          value={target.runtime}
                          onChange={(e) => updateTarget(index, { runtime: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-gray-200"
                          placeholder="PandaUra Runtime"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={target.canQuiesce}
                          onChange={(e) => updateTarget(index, { canQuiesce: e.target.checked })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        Can Quiesce
                      </label>
                      <div className={`px-2 py-1 rounded text-xs ${
                        target.status === 'online' ? 'bg-green-100 text-green-700' :
                        target.status === 'offline' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {target.status}
                      </div>
                    </div>
                  </div>
                ))}
                
                {localConfig.targets.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Target size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No deployment targets configured.</p>
                    <p className="text-sm">Add targets to define where your deployment will be executed.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Health Checks</h3>
                <button
                  onClick={addHealthCheck}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-orange-600 flex items-center gap-2"
                  disabled={localConfig.strategy !== 'canary'}
                >
                  <Plus size={16} />
                  Add Check
                </button>
              </div>
              
              {localConfig.strategy !== 'canary' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle size={16} />
                    <span className="font-medium">Health checks are only available for Canary deployments</span>
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                    Switch to Canary/Phased deployment strategy to configure health monitoring.
                  </p>
                </div>
              )}
              
              {localConfig.strategy === 'canary' && localConfig.canary && (
                <div className="space-y-3">
                  {localConfig.canary.healthChecks?.map((check) => (
                    <div key={check.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={16} className={check.enabled ? 'text-green-600' : 'text-gray-400'} />
                        <input
                          type="text"
                          value={check.name}
                          className="font-medium border-none bg-transparent flex-1 dark:text-gray-200"
                          placeholder="Health Check Name"
                        />
                        <label className="flex items-center gap-1 text-sm dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={check.enabled}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          Enabled
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                          <select
                            value={check.type}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-200"
                          >
                            <option value="script">Test Script</option>
                            <option value="tag_range">Tag Value Range</option>
                            <option value="exception_log">Exception Logs</option>
                            <option value="resource_usage">Resource Usage</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Timeout (seconds)</label>
                          <input
                            type="number"
                            value={check.config.timeout || 30}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Warning Threshold</label>
                          <input
                            type="number"
                            value={check.thresholds.warning}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Critical Threshold</label>
                          <input
                            type="number"
                            value={check.thresholds.critical}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-200"
                          />
                        </div>
                      </div>
                    </div>
                  )) || []}
                  
                  {(!localConfig.canary.healthChecks || localConfig.canary.healthChecks.length === 0) && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <CheckCircle size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                      <p>No health checks configured.</p>
                      <p className="text-sm">Add health checks to monitor deployment success.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rollback' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Rollback Triggers</h3>
                <button
                  onClick={addRollbackTrigger}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-orange-600 flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Trigger
                </button>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">Automated Rollback Conditions</h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Triggers activated within the deploy watch window ({localConfig.deployWatchWindow} minutes) will initiate rollback procedures.
                </p>
              </div>
              
              <div className="space-y-3">
                {localConfig.rollbackTriggers.map((trigger) => (
                  <div key={trigger.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <RotateCcw size={16} className={trigger.enabled ? 'text-red-600' : 'text-gray-400'} />
                      <select
                        value={trigger.type}
                        className="font-medium border-none bg-transparent dark:text-gray-200"
                      >
                        <option value="health_check">Failed Health Checks</option>
                        <option value="exception_count">Unhandled Exceptions</option>
                        <option value="tag_limit">Critical Tag Limits</option>
                        <option value="resource_usage">Excessive Resource Usage</option>
                        <option value="manual">Manual Trigger</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm ml-auto dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={trigger.enabled}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        Enabled
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Threshold</label>
                        <input
                          type="number"
                          value={trigger.threshold}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Watch Window (min)</label>
                        <input
                          type="number"
                          value={trigger.watchWindow}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <label className="flex items-center gap-1 text-sm dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={trigger.autoRollback}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          Auto Rollback
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                
                {localConfig.rollbackTriggers.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <RotateCcw size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p>No rollback triggers configured.</p>
                    <p className="text-sm">Add triggers to automatically detect and respond to deployment failures.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Strategy: <span className="font-medium capitalize dark:text-gray-300">{localConfig.strategy}</span> | 
            Targets: <span className="font-medium dark:text-gray-300">{localConfig.targets.length}</span> | 
            Triggers: <span className="font-medium dark:text-gray-300">{localConfig.rollbackTriggers.length}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfigChange(localConfig)
                onClose()
              }}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-orange-600"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}