import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'

type RuntimeMetrics = {
  latency: number
  throughput: number
  errors: number
  cycleTime: number
}

export function ShadowRuntime() {
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
      latency: 12,
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
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shadow Runtime</h1>
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
    </div>
  )
}


