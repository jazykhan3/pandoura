import { useEffect, useState } from 'react'
import { PerformanceMonitor, detectLongTasks } from '../utils/performance'
import { Activity, Zap, AlertTriangle } from 'lucide-react'

/**
 * Performance Monitor Component
 * Displays real-time performance metrics in the UI
 * Use this in development to verify optimizations
 */
export function PerformanceMonitorWidget() {
  const [fps, setFps] = useState(60)
  const [longTasks, setLongTasks] = useState<number[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Monitor FPS
    PerformanceMonitor.monitorFPS((currentFps) => {
      setFps(currentFps)
    })

    // Detect long tasks
    const cleanup = detectLongTasks((duration) => {
      setLongTasks((prev) => [...prev.slice(-4), duration])
    })

    return cleanup
  }, [])

  // Toggle visibility with keyboard shortcut (Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible((v) => !v)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors z-50"
        title="Show Performance Monitor (Ctrl+Shift+P)"
      >
        <Activity size={20} />
      </button>
    )
  }

  const fpsColor = fps >= 55 ? 'text-green-500' : fps >= 30 ? 'text-yellow-500' : 'text-red-500'

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-2xl p-4 w-72 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          Performance Monitor
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      {/* FPS Counter */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">FPS</span>
          <span className={`text-xl font-bold ${fpsColor}`}>{fps}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
          <div
            className={`h-2 rounded-full transition-all ${
              fps >= 55 ? 'bg-green-500' : fps >= 30 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min((fps / 60) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Long Tasks */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-orange-400" />
          <span className="text-xs text-gray-400">Long Tasks (Recent)</span>
        </div>
        {longTasks.length === 0 ? (
          <p className="text-xs text-green-500">✓ No long tasks detected</p>
        ) : (
          <div className="space-y-1">
            {longTasks.map((duration, idx) => (
              <div key={idx} className="text-xs">
                <span className="text-red-400">{duration.toFixed(0)}ms</span>
                <span className="text-gray-500"> - Task {idx + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="text-xs text-gray-500 pt-3 border-t border-gray-700">
        <p>Press <kbd className="bg-gray-700 px-1 rounded">Ctrl+Shift+P</kbd> to toggle</p>
      </div>
    </div>
  )
}
