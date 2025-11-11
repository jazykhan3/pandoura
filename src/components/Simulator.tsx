import { useSimulatorStore } from '../store/simulatorStore'
import { Play, Pause, Square, SkipForward, Download, Trash2 } from 'lucide-react'

export function Simulator() {
  const {
    isRunning,
    isPaused,
    speed,
    logs,
    ioValues,
    currentLine,
    run,
    pause,
    resume,
    step,
    stop,
    setSpeed,
    setIOValue,
    clearLogs,
  } = useSimulatorStore()

  const handleToggleBoolean = (name: string) => {
    const currentValue = ioValues[name] as boolean
    setIOValue(name, !currentValue)
  }

  const handleSetNumeric = (name: string, value: number) => {
    setIOValue(name, value)
  }

  const downloadLogs = () => {
    const logContent = logs
      .map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n')
    
    const blob = new Blob([logContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulator-log-${new Date().toISOString()}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button
                onClick={() => run('(* Current logic *)')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={resume}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={pause}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
                
                <button
                  onClick={step}
                  disabled={!isPaused}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                    isPaused
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <SkipForward className="w-4 h-4" />
                  Step
                </button>

                <button
                  onClick={stop}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Speed:
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="px-2 py-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
              </select>
            </label>

            {currentLine && (
              <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-sm font-medium">
                Line: {currentLine}
              </div>
            )}

            <div className={`px-3 py-1 rounded-md text-sm font-medium ${
              isRunning 
                ? isPaused 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-green-100 text-green-800'
                : 'bg-neutral-100 text-neutral-600'
            }`}>
              {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* I/O Panel */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <h3 className="font-semibold mb-4">I/O Panel</h3>
          
          <div className="space-y-4">
            {/* Boolean I/O */}
            <div>
              <div className="text-sm font-medium text-neutral-700 mb-2">Digital I/O</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                  <span className="text-sm font-mono">Pump_Run</span>
                  <button
                    onClick={() => handleToggleBoolean('Pump_Run')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      ioValues.Pump_Run
                        ? 'bg-green-600 text-white'
                        : 'bg-neutral-300 text-neutral-700'
                    }`}
                  >
                    {ioValues.Pump_Run ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                  <span className="text-sm font-mono">Emergency_Stop</span>
                  <button
                    onClick={() => handleToggleBoolean('Emergency_Stop')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      ioValues.Emergency_Stop
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-300 text-neutral-700'
                    }`}
                  >
                    {ioValues.Emergency_Stop ? 'STOP' : 'OK'}
                  </button>
                </div>
              </div>
            </div>

            {/* Analog I/O */}
            <div>
              <div className="text-sm font-medium text-neutral-700 mb-2">Analog I/O</div>
              <div className="space-y-3">
                <div className="p-2 bg-neutral-50 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono">Temperature_PV</span>
                    <span className="text-sm font-medium">{ioValues.Temperature_PV}°C</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    step="0.1"
                    value={ioValues.Temperature_PV as number}
                    onChange={(e) => handleSetNumeric('Temperature_PV', Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="p-2 bg-neutral-50 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono">Temperature_SP</span>
                    <span className="text-sm font-medium">{ioValues.Temperature_SP}°C</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    step="0.1"
                    value={ioValues.Temperature_SP as number}
                    onChange={(e) => handleSetNumeric('Temperature_SP', Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="p-2 bg-neutral-50 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono">Tank_Level</span>
                    <span className="text-sm font-medium">{ioValues.Tank_Level}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={ioValues.Tank_Level as number}
                    onChange={(e) => handleSetNumeric('Tank_Level', Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Read-only output */}
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">Heater_Output</span>
                    <span className="text-sm font-medium text-blue-800">{ioValues.Heater_Output}%</span>
                  </div>
                  <div className="mt-1 w-full bg-neutral-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${ioValues.Heater_Output}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">Output (read-only)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Snapshot */}
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <button
              className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
              onClick={() => alert('Snapshot saved')}
            >
              Save I/O Snapshot
            </button>
          </div>
        </div>

        {/* Trace/Log Panel */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Trace Log</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadLogs}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-neutral-300 text-neutral-800 rounded hover:bg-neutral-50 transition-colors"
                title="Download Logs"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
              <button
                onClick={clearLogs}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-neutral-300 text-neutral-800 rounded hover:bg-neutral-50 transition-colors"
                title="Clear Logs"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 bg-neutral-900 text-neutral-100 rounded-md p-3 font-mono text-xs overflow-y-auto max-h-96">
            {logs.length === 0 ? (
              <div className="text-neutral-500">No logs yet. Start the simulator to see activity.</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-neutral-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`flex-shrink-0 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-amber-400' :
                      log.type === 'tag_change' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>
                      [{log.type.toUpperCase()}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breakpoint Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Click in the editor's left margin to set breakpoints. 
          The simulator will pause when execution reaches a breakpoint line.
        </div>
      </div>
    </div>
  )
}

