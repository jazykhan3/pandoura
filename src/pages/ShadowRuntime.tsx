import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { SyncConsole } from '../components/SyncConsole'
import { Simulator } from '../components/Simulator'
import { useSyncStore } from '../store/syncStore'
import { useSimulatorStore } from '../store/simulatorStore'
import { syncApi } from '../services/api'

type RuntimeMetrics = {
  latency: number
  throughput: number
  errors: number
  cycleTime: number
}

export function ShadowRuntime() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sync' | 'simulator'>('overview')
  const syncStatus = useSyncStore((s) => s.status)
  const { isRunning, isPaused, currentLine, ioValues } = useSimulatorStore()
  
  const [metrics, setMetrics] = useState<RuntimeMetrics>({
    latency: 0,
    throughput: 0,
    errors: 0,
    cycleTime: 0,
  })

  const [deployedLogic, setDeployedLogic] = useState<any>(null)

  useEffect(() => {
    // Fetch deployed logic status
    const fetchDeployedLogic = async () => {
      try {
        const status = await fetch('http://localhost:8000/api/sync/status').then(r => r.json())
        setDeployedLogic(status.deployedLogic)
      } catch (error) {
        console.error('Failed to fetch deployed logic:', error)
      }
    }
    fetchDeployedLogic()
    
    // Start tag streaming
    fetch('http://localhost:8000/api/sync/start-streaming', { method: 'POST' })
      .catch(err => console.error('Failed to start streaming:', err))
    
    // Poll for deployed logic updates every 3 seconds
    const logicPollInterval = setInterval(fetchDeployedLogic, 3000)

    // Poll for simulator metrics every second
    const dataInterval = setInterval(async () => {
      try {
        // Fetch simulator status for metrics
        const simResponse = await fetch('http://localhost:8000/api/simulate/status')
        const simData = await simResponse.json()
        
        // Calculate real metrics
        const operationsCount = simData.ioValues ? Object.keys(simData.ioValues).length : 0
        const throughput = isRunning ? Math.floor(1000 / (simData.cycleTime || 100)) * operationsCount : 0
        
        setMetrics({
          latency: syncStatus.latency || 12,
          throughput: throughput,
          errors: 0, // Could be tracked from simulator logs
          cycleTime: isRunning ? (simData.cycleTime || 100) : 50,
        })
      } catch (error) {
        console.error('Failed to fetch real-time data:', error)
      }
    }, 1000)

    return () => {
      clearInterval(dataInterval)
      clearInterval(logicPollInterval)
    }
  }, [syncStatus.latency, isRunning])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shadow Runtime</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Test and validate logic in a safe shadow environment before deploying to production
          </p>
        </div>
        
        {/* Connection Status Badge */}
        <div className={`px-4 py-2 rounded-lg border-2 ${
          syncStatus.connected
            ? 'bg-green-50 border-green-500 text-green-900'
            : 'bg-red-50 border-red-500 text-red-900'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {syncStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
              {syncStatus.executionMode && (
                <span className="text-xs opacity-75">
                  {syncStatus.executionMode === 'simulation' ? 'Simulation Mode' : 
                   syncStatus.executionMode === 'beremiz' ? 'Beremiz Runtime' : 'Failed'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#FF6A00] text-[#FF6A00]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sync'
                ? 'border-[#FF6A00] text-[#FF6A00]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Sync Console
            {syncStatus.conflicts.filter(c => !c.resolved).length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                {syncStatus.conflicts.filter(c => !c.resolved).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'simulator'
                ? 'border-[#FF6A00] text-[#FF6A00]'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Simulator
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>Live Process Mirror</CardHeader>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {Object.keys(ioValues).length === 0 ? (
                  <div className="text-sm text-neutral-500 text-center py-8">
                    No I/O values available. Start the simulator to see live data.
                  </div>
                ) : (
                  <>
                    {/* Boolean I/O - Digital Inputs/Outputs */}
                    {Object.entries(ioValues).some(([_, value]) => typeof value === 'boolean') && (
                      <div>
                        <div className="text-sm font-medium text-neutral-700 mb-2">Digital I/O</div>
                        <div className="space-y-2">
                          {Object.entries(ioValues)
                            .filter(([_, value]) => typeof value === 'boolean')
                            .map(([name, value]) => (
                              <div key={name} className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                                <span className="text-sm font-mono">{name}</span>
                                <span className={`px-3 py-1 rounded-md text-sm font-medium ${
                                  value
                                    ? 'bg-green-600 text-white'
                                    : 'bg-neutral-300 text-neutral-700'
                                }`}>
                                  {value ? 'ON' : 'OFF'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Numeric I/O - Analog Inputs/Outputs */}
                    {Object.entries(ioValues).some(([_, value]) => typeof value === 'number') && (
                      <div>
                        <div className="text-sm font-medium text-neutral-700 mb-2">Analog I/O</div>
                        <div className="space-y-3">
                          {Object.entries(ioValues)
                            .filter(([_, value]) => typeof value === 'number')
                            .map(([name, value]) => {
                              // Determine if this is an output variable (read-only)
                              const isOutput = name.includes('Output') || name.includes('output')
                              const isPercentage = name.includes('Level') || name.includes('Output') || name.includes('Humidity')
                              const isTemperature = name.includes('Temp') || name.includes('temp')
                              
                              const unit = isTemperature ? '°C' : isPercentage ? '%' : ''
                              
                              return (
                                <div 
                                  key={name} 
                                  className={`p-2 rounded ${isOutput ? 'bg-blue-50 border border-blue-200' : 'bg-neutral-50'}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-mono">{name}</span>
                                    <span className={`text-sm font-medium ${isOutput ? 'text-blue-800' : 'text-neutral-900'}`}>
                                      {typeof value === 'number' ? value.toFixed(2) : value}{unit}
                                    </span>
                                  </div>
                                  {isOutput && (
                                    <>
                                      <div className="mt-1 w-full bg-neutral-200 rounded-full h-2">
                                        <div 
                                          className="bg-blue-600 h-2 rounded-full transition-all"
                                          style={{ width: `${Math.min(100, Math.max(0, value as number))}%` }}
                                        />
                                      </div>
                                      <div className="text-xs text-neutral-600 mt-1">Calculated Output</div>
                                    </>
                                  )}
                                  {!isOutput && (
                                    <div className="mt-1 w-full bg-neutral-200 rounded-full h-2">
                                      <div 
                                        className="bg-green-600 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, Math.max(0, value as number))}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-neutral-200">
                      <div className="text-xs text-neutral-500">Last update: {new Date().toLocaleTimeString()}</div>
                      <div className="text-xs text-green-600 mt-1">● Live data from simulator</div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span>Shadow Logic Status</span>
                  {deployedLogic && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        isRunning ? (isPaused ? 'bg-amber-500' : 'bg-green-500') : 'bg-neutral-400'
                      }`}></div>
                      <span className={`text-xs font-medium ${
                        isRunning ? (isPaused ? 'text-amber-700' : 'text-green-700') : 'text-neutral-600'
                      }`}>
                        {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Deployed'}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <div className="flex flex-col h-full">
                {deployedLogic ? (
                  <>
                    <div className="text-xs text-neutral-600 mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <strong>{deployedLogic.name}</strong> • {deployedLogic.vendor}
                        </div>
                        {currentLine && (
                          <div className="text-blue-600 font-medium">
                            Line: {currentLine}
                          </div>
                        )}
                      </div>
                      <div className="text-neutral-500 mt-1">
                        Deployed: {new Date(deployedLogic.deployedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex-1 text-xs font-mono text-neutral-700 space-y-1 bg-neutral-50 p-2 rounded border overflow-y-auto">
                      {deployedLogic.content.split('\n').slice(0, 8).map((line: string, i: number) => (
                        <div 
                          key={i} 
                          className={`${
                            line.trim().startsWith('(*') ? 'text-green-600' : ''
                          } ${
                            currentLine === i + 1 ? 'bg-yellow-200 font-bold' : ''
                          }`}
                        >
                          <span className="text-neutral-400 mr-2">{String(i + 1).padStart(2, ' ')}</span>
                          {line || ' '}
                        </div>
                      ))}
                      {deployedLogic.content.split('\n').length > 8 && (
                        <div className="text-neutral-400">... ({deployedLogic.content.split('\n').length - 8} more lines)</div>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className={`p-2 border rounded text-xs ${
                        isRunning 
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}>
                        {isRunning 
                          ? `✓ Logic executing ${isPaused ? '(paused)' : '(active)'}` 
                          : '✓ Logic deployed to shadow runtime'
                        }
                      </div>
                      <button 
                        className="w-full px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        onClick={() => setActiveTab('simulator')}
                      >
                        🚀 Open in Simulator
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                    <div className="text-4xl mb-2">📝</div>
                    <div className="text-sm font-medium">No Logic Deployed</div>
                    <div className="text-xs mt-1 text-center">Push logic from Logic Editor to see preview here</div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>Runtime Health</CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-neutral-600 mb-1">Latency</div>
                <div className="text-2xl font-semibold text-neutral-900">{metrics.latency}ms</div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">Throughput</div>
                <div className="text-2xl font-semibold text-neutral-900">{metrics.throughput} ops/s</div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">Errors</div>
                <div className="text-2xl font-semibold text-green-600">{metrics.errors}</div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">Cycle Time</div>
                <div className="text-2xl font-semibold text-neutral-900">{metrics.cycleTime}ms</div>
              </div>
            </div>
          </Card>

          {/* Sync Status Summary */}
          <Card>
            <CardHeader>Sync Status</CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-neutral-600 mb-1">Shadow Runtime</div>
                <div className={`font-semibold ${syncStatus.shadowOk ? 'text-green-600' : 'text-neutral-400'}`}>
                  {syncStatus.shadowOk ? '✓ Ready' : '✗ Not Ready'}
                </div>
                {syncStatus.executionMode && (
                  <div className="text-xs text-neutral-500 mt-1">
                    {syncStatus.executionMode === 'simulation' ? 'Simulation Mode' : 
                     syncStatus.executionMode === 'beremiz' ? 'Beremiz Runtime' : 'Failed'}
                  </div>
                )}
              </div>
              <div>
                <div className="text-neutral-600 mb-1">Live Runtime</div>
                <div className={`font-semibold ${syncStatus.liveOk ? 'text-green-600' : 'text-neutral-400'}`}>
                  {syncStatus.liveOk ? '✓ Connected' : '✗ Not Connected'}
                </div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">Last Sync</div>
                <div className="font-semibold text-neutral-900">
                  {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleTimeString() : 'Never'}
                </div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">Conflicts</div>
                <div className={`font-semibold ${
                  syncStatus.conflicts.filter(c => !c.resolved).length > 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {syncStatus.conflicts.filter(c => !c.resolved).length}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'sync' && <SyncConsole />}
      
      {activeTab === 'simulator' && <Simulator />}
    </div>
  )
}
