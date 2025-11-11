import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { SyncConsole } from '../components/SyncConsole'
import { Simulator } from '../components/Simulator'
import { useSyncStore } from '../store/syncStore'

type RuntimeMetrics = {
  latency: number
  throughput: number
  errors: number
  cycleTime: number
}

export function ShadowRuntime() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sync' | 'simulator'>('overview')
  const syncStatus = useSyncStore((s) => s.status)
  
  const [metrics, setMetrics] = useState<RuntimeMetrics>({
    latency: 0,
    throughput: 0,
    errors: 0,
    cycleTime: 0,
  })

  const [liveValues, setLiveValues] = useState({
    motorSpeed: 1450.5,
    temperature: 72.5,
    pressure: 101.3,
    flowRate: 23.7,
  })

  useEffect(() => {
    // Simulate real-time metrics
    setMetrics({
      latency: syncStatus.latency || 12,
      throughput: 247,
      errors: 0,
      cycleTime: 50,
    })

    // Simulate live value updates
    const interval = setInterval(() => {
      setLiveValues(prev => ({
        motorSpeed: prev.motorSpeed + (Math.random() - 0.5) * 2,
        temperature: prev.temperature + (Math.random() - 0.5) * 0.5,
        pressure: prev.pressure + (Math.random() - 0.5) * 0.2,
        flowRate: prev.flowRate + (Math.random() - 0.5) * 0.3,
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [syncStatus.latency])

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
            <span className="font-medium text-sm">
              {syncStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
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
            <Card className="h-64">
              <CardHeader>Live Process Mirror</CardHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Motor Speed:</span>
                  <span className="font-mono text-neutral-900">{liveValues.motorSpeed.toFixed(1)} RPM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Temperature:</span>
                  <span className="font-mono text-neutral-900">{liveValues.temperature.toFixed(1)} °C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Pressure:</span>
                  <span className="font-mono text-neutral-900">{liveValues.pressure.toFixed(1)} kPa</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Flow Rate:</span>
                  <span className="font-mono text-neutral-900">{liveValues.flowRate.toFixed(1)} L/min</span>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-200">
                  <div className="text-xs text-neutral-500">Last update: {new Date().toLocaleTimeString()}</div>
                </div>
              </div>
            </Card>

            <Card className="h-64">
              <CardHeader>Test Logic Preview</CardHeader>
              <div className="text-xs font-mono text-neutral-700 space-y-1">
                <div className="text-green-600">(* PID Control Active *)</div>
                <div>IF Temperature_PV {'<'} Temperature_SP THEN</div>
                <div className="pl-4">Heater_Output := PID_Calculate();</div>
                <div>END_IF;</div>
                <div className="mt-2 text-neutral-500">(* Cycle: {metrics.cycleTime}ms *)</div>
                <div className="mt-4 p-2 bg-green-50 border border-green-200 rounded text-green-700">
                  ✓ Logic validation passed
                </div>
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
