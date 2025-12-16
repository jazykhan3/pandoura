import { useState } from 'react'
import { Card, CardHeader } from '../components/Card'
import { Wifi, FileText, MessageCircle, Settings } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export function SettingsPage() {
  const { theme, actualTheme, setTheme } = useTheme()
  const [mode, setMode] = useState<'simulation' | 'live'>('simulation')
  const [storagePath, setStoragePath] = useState('~/Pandaura/Projects')
  const [autoSave, setAutoSave] = useState(true)
  const [showNotifications, setShowNotifications] = useState(true)

  // Data Bridge Settings
  const [dataBridgeEnabled, setDataBridgeEnabled] = useState(false)
  const [dataBridgeHost, setDataBridgeHost] = useState('localhost:3001')
  const [enabledAdapters, setEnabledAdapters] = useState({
    websocket: true,
    mqtt: false,
    csv: true
  })
  const [mqttSettings, setMqttSettings] = useState({
    broker: 'mqtt://localhost:1883',
    username: '',
    password: '',
    clientId: 'pandaura-bridge'
  })
  const [csvSettings, setCsvSettings] = useState({
    outputDir: './data/exports',
    interval: 1000,
    includeTimestamp: true
  })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <CardHeader>Theme</CardHeader>
          <div className="space-y-3">
            <div className="text-sm text-neutral-600 dark:text-gray-400">
              Current: {theme} {theme === 'system' && `(${actualTheme})`}
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <div className="text-xs text-neutral-500 dark:text-gray-400">
              {theme === 'system' 
                ? 'Theme follows your system preference'
                : `Using ${theme} theme`
              }
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader>Runtime Mode</CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="simulation"
                  checked={mode === 'simulation'}
                  onChange={(e) => setMode(e.target.value as 'simulation' | 'live')}
                  className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Simulation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="live"
                  checked={mode === 'live'}
                  onChange={(e) => setMode(e.target.value as 'simulation' | 'live')}
                  className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Live</span>
              </label>
            </div>
            <div className="text-xs text-neutral-500 dark:text-gray-400">
              {mode === 'simulation' ? 'Using simulated PLC data' : 'Connected to live PLC'}
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2 p-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Data Bridge Configuration
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataBridgeEnabled}
                  onChange={(e) => setDataBridgeEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                />
                <span className="text-sm font-medium">Enable Data Bridge Service</span>
              </label>
            </div>

            {dataBridgeEnabled && (
              <div className="space-y-4 pt-2 border-t border-neutral-200">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Data Bridge Host
                  </label>
                  <input
                    type="text"
                    value={dataBridgeHost}
                    onChange={(e) => setDataBridgeHost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                    placeholder="localhost:3001"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-neutral-700 mb-2">Enabled Adapters</div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabledAdapters.websocket}
                        onChange={(e) => setEnabledAdapters(prev => ({ ...prev, websocket: e.target.checked }))}
                        className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                      />
                      <Wifi className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">WebSocket (Real-time)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabledAdapters.mqtt}
                        onChange={(e) => setEnabledAdapters(prev => ({ ...prev, mqtt: e.target.checked }))}
                        className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                      />
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">MQTT Broker</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabledAdapters.csv}
                        onChange={(e) => setEnabledAdapters(prev => ({ ...prev, csv: e.target.checked }))}
                        className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                      />
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">CSV Export</span>
                    </label>
                  </div>
                </div>

                {enabledAdapters.mqtt && (
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-neutral-700 mb-2">MQTT Configuration</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Broker URL</label>
                        <input
                          type="text"
                          value={mqttSettings.broker}
                          onChange={(e) => setMqttSettings(prev => ({ ...prev, broker: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                          placeholder="mqtt://localhost:1883"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Client ID</label>
                        <input
                          type="text"
                          value={mqttSettings.clientId}
                          onChange={(e) => setMqttSettings(prev => ({ ...prev, clientId: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                          placeholder="pandaura-bridge"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Username (Optional)</label>
                        <input
                          type="text"
                          value={mqttSettings.username}
                          onChange={(e) => setMqttSettings(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Password (Optional)</label>
                        <input
                          type="password"
                          value={mqttSettings.password}
                          onChange={(e) => setMqttSettings(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {enabledAdapters.csv && (
                  <div className="bg-neutral-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-neutral-700 mb-2">CSV Export Configuration</div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-neutral-600 mb-1">Output Directory</label>
                        <input
                          type="text"
                          value={csvSettings.outputDir}
                          onChange={(e) => setCsvSettings(prev => ({ ...prev, outputDir: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                          placeholder="./data/exports"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-neutral-600 mb-1">Export Interval (ms)</label>
                          <input
                            type="number"
                            min="100"
                            max="60000"
                            value={csvSettings.interval}
                            onChange={(e) => setCsvSettings(prev => ({ ...prev, interval: Number(e.target.value) }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6A00]"
                          />
                        </div>
                        <div className="flex items-center pt-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={csvSettings.includeTimestamp}
                              onChange={(e) => setCsvSettings(prev => ({ ...prev, includeTimestamp: e.target.checked }))}
                              className="w-3 h-3 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                            />
                            <span className="text-xs">Include Timestamps</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => {
                      console.log('Testing Data Bridge connection...', { dataBridgeHost, enabledAdapters });
                      alert('Connection test started - check logs for results');
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Test Connection
                  </button>
                  <button 
                    onClick={() => {
                      console.log('Saving Data Bridge settings...', { dataBridgeHost, enabledAdapters, mqttSettings, csvSettings });
                      alert('Data Bridge settings saved successfully');
                    }}
                    className="px-3 py-1 text-sm bg-[#FF6A00] text-white rounded hover:bg-[#FF6A00]/90 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="md:col-span-2 p-4">
          <CardHeader>Local Storage Path</CardHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            />
            <button className="px-4 py-2 text-sm bg-neutral-100 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 rounded-md hover:bg-neutral-200 dark:hover:bg-gray-600 transition-colors">
              Browse...
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader>Auto Save</CardHeader>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Enable auto-save (every 5 minutes)</span>
          </label>
        </Card>

        <Card className="p-4">
          <CardHeader>Notifications</CardHeader>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showNotifications}
              onChange={(e) => setShowNotifications(e.target.checked)}
              className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Show deployment notifications</span>
          </label>
        </Card>
      </div>

      <Card className="p-4">
        <CardHeader>About</CardHeader>
        <div className="space-y-2 text-sm text-neutral-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Version:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">2.1.5</span>
          </div>
          <div className="flex justify-between">
            <span>Build:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">20241101</span>
          </div>
          <div className="flex justify-between">
            <span>License:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">Enterprise</span>
          </div>
        </div>
      </Card>
    </div>
  )
}


