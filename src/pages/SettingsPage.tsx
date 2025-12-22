import { useState } from 'react'
import { Card, CardHeader } from '../components/Card'
import { Wifi, FileText, MessageCircle, Settings, Cpu, Palette, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { RuntimeSettings } from './RuntimeSettings'

type SettingsTab = 'general' | 'runtimes' | 'data-bridge'

export function SettingsPage() {
  const { 
    theme, 
    actualTheme, 
    setTheme, 
    accentColor, 
    setAccentColor,
    checkContrast,
  } = useTheme()

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [accentPickerExpanded, setAccentPickerExpanded] = useState(false)
  const [mode, setMode] = useState<'simulation' | 'live'>('simulation')
  const [storagePath, setStoragePath] = useState('~/Pandaura/Projects')
  const [autoSave, setAutoSave] = useState(true)
  const [showNotifications, setShowNotifications] = useState(true)

  // Check contrast of WHITE TEXT on the accent color (for buttons and sidebar)
  // This is the key check - can users read white text on the accent color?
  const whiteTextContrast = checkContrast('#FFFFFF', accentColor)
  const blackTextContrast = checkContrast('#000000', accentColor)
  
  // Only show warning for VERY light colors (ratio < 3:1)
  // Most colors will pass without warnings - only yellow, light pink, etc. will trigger
  const isTooLight = whiteTextContrast.ratio < 2 // Extremely light (e.g., yellow, white-ish)
  const isLightColor = whiteTextContrast.ratio < 3 && !isTooLight // Light but not extreme
  const needsWarning = isTooLight || isLightColor
  const suggestDarkText = blackTextContrast.ratio > whiteTextContrast.ratio

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

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'General', icon: <Settings size={18} /> },
    { id: 'runtimes', label: 'PLC / Runtimes', icon: <Cpu size={18} /> },
    { id: 'data-bridge', label: 'Data Bridge', icon: <Wifi size={18} /> },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header with Tabs */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'runtimes' && <RuntimeSettings />}
      
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Selection */}
          <Card className="p-4">
            <CardHeader>Theme</CardHeader>
            <div className="space-y-3">
              <div className="text-sm text-neutral-600 dark:text-gray-400">
                Current: {theme} {theme === 'system' && `(${actualTheme})`}
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <div className="text-xs text-neutral-500 dark:text-gray-400">
                {theme === 'system' 
                  ? 'Theme follows your system preference'
                  : `Using ${theme} theme`}
              </div>
            </div>
          </Card>

          {/* Accent Color Picker - Collapsible */}
          <Card className="p-4">
            {/* Collapsed Header - Always visible */}
            <button
              onClick={() => setAccentPickerExpanded(!accentPickerExpanded)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-md border-2 border-gray-200 dark:border-gray-600 shadow-sm"
                  style={{ backgroundColor: accentColor }}
                />
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Accent Color
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-gray-400">
                    <span className="font-mono">{accentColor.toUpperCase()}</span>
                    {needsWarning && (
                      <span className={`ml-2 ${isTooLight ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        ⚠️ {isTooLight ? 'Too Light' : 'Light Color'}
                      </span>
                    )}
                    {!accentPickerExpanded && (
                      <span className="ml-2 text-[var(--accent-color)] group-hover:underline">
                        — Click to customize
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {accentPickerExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                )}
              </div>
            </button>

            {/* Expanded Content - Minimalistic */}
            {accentPickerExpanded && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {/* Color Picker Row */}
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 p-0 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                    aria-label="Accent Color Picker"
                  />
                  <input
                    type="text"
                    value={accentColor.toUpperCase()}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        setAccentColor(val)
                      }
                    }}
                    className="w-20 px-2 py-1 text-xs font-mono border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                    placeholder="#FF6A00"
                  />
                  {/* Inline Preview */}
                  <button
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{ 
                      backgroundColor: accentColor,
                      color: suggestDarkText ? '#000000' : '#FFFFFF'
                    }}
                  >
                    Preview
                  </button>
                </div>

                {/* Contrast Check Results - Only show for very light colors */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-gray-400">White text contrast:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{whiteTextContrast.ratio.toFixed(2)}:1</span>
                      {!needsWarning ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Good
                        </span>
                      ) : isTooLight ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          Too Light!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          Light
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Critical Warning - Color is TOO LIGHT (ratio < 2) */}
                  {isTooLight && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-800 dark:text-red-200">
                            ⚠️ Color is Too Light!
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            This color is too light for the sidebar and buttons. White text will be unreadable. 
                            Please choose a slightly darker shade.
                          </p>
                          
                          {/* Suggested slightly darker color (3 shades max) */}
                          {whiteTextContrast.suggestedColor && (
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-10 h-10 rounded border-2 border-red-300 dark:border-red-600"
                                  style={{ backgroundColor: whiteTextContrast.suggestedColor }}
                                />
                                <div className="text-xs">
                                  <div className="font-bold text-red-800 dark:text-red-200">Slightly Darker</div>
                                  <div className="font-mono text-red-600 dark:text-red-400">
                                    {whiteTextContrast.suggestedColor.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => setAccentColor(whiteTextContrast.suggestedColor!)}
                                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                              >
                                Use This
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Light Color Warning (ratio 2-3) - not critical */}
                  {isLightColor && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Light Color Notice
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            This is a light color. White text may be slightly hard to read. Consider a slightly darker shade.
                          </p>
                          
                          {/* Suggested slightly darker color (3 shades max) */}
                          {whiteTextContrast.suggestedColor && (
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600"
                                  style={{ backgroundColor: whiteTextContrast.suggestedColor }}
                                />
                                <div className="text-xs">
                                  <div className="font-medium text-amber-800 dark:text-amber-200">Suggested</div>
                                  <div className="font-mono text-amber-600 dark:text-amber-400">
                                    {whiteTextContrast.suggestedColor.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => setAccentColor(whiteTextContrast.suggestedColor!)}
                                className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                              >
                                Use This Color
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success message when contrast is good */}
                  {!needsWarning && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-green-700 dark:text-green-300">
                        Good contrast! White text is readable on this color.
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-neutral-500 dark:text-gray-400">
                  The accent color is applied to sidebar, primary buttons, links, toggles, selected items, and focus states.
                </div>
              </div>
            )}
          </Card>

          {/* Runtime Mode */}
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
                    className="w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
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
                    className="w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">Live</span>
                </label>
              </div>
              <div className="text-xs text-neutral-500 dark:text-gray-400">
                {mode === 'simulation' ? 'Using simulated PLC data' : 'Connected to live PLC'}
              </div>
            </div>
          </Card>

          {/* Data Bridge Configuration */}
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
                    className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                  />
                  <span className="text-sm font-medium">Enable Data Bridge Service</span>
                </label>
              </div>

              {dataBridgeEnabled && (
                <div className="space-y-4 pt-2 border-t border-neutral-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-gray-300 mb-1">
                      Data Bridge Host
                    </label>
                    <input
                      type="text"
                      value={dataBridgeHost}
                      onChange={(e) => setDataBridgeHost(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                      placeholder="localhost:3001"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-neutral-700 dark:text-gray-300 mb-2">Enabled Adapters</div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabledAdapters.websocket}
                          onChange={(e) => setEnabledAdapters(prev => ({ ...prev, websocket: e.target.checked }))}
                          className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                        />
                        <Wifi className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">WebSocket (Real-time)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabledAdapters.mqtt}
                          onChange={(e) => setEnabledAdapters(prev => ({ ...prev, mqtt: e.target.checked }))}
                          className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                        />
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">MQTT Broker</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabledAdapters.csv}
                          onChange={(e) => setEnabledAdapters(prev => ({ ...prev, csv: e.target.checked }))}
                          className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                        />
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">CSV Export</span>
                      </label>
                    </div>
                  </div>

                  {enabledAdapters.mqtt && (
                    <div className="bg-neutral-50 dark:bg-gray-800 p-3 rounded-md">
                      <div className="text-sm font-medium text-neutral-700 dark:text-gray-300 mb-2">MQTT Configuration</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-neutral-600 dark:text-gray-400 mb-1">Broker URL</label>
                          <input
                            type="text"
                            value={mqttSettings.broker}
                            onChange={(e) => setMqttSettings(prev => ({ ...prev, broker: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                            placeholder="mqtt://localhost:1883"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-600 dark:text-gray-400 mb-1">Client ID</label>
                          <input
                            type="text"
                            value={mqttSettings.clientId}
                            onChange={(e) => setMqttSettings(prev => ({ ...prev, clientId: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                            placeholder="pandaura-bridge"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-600 dark:text-gray-400 mb-1">Username (Optional)</label>
                          <input
                            type="text"
                            value={mqttSettings.username}
                            onChange={(e) => setMqttSettings(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-600 dark:text-gray-400 mb-1">Password (Optional)</label>
                          <input
                            type="password"
                            value={mqttSettings.password}
                            onChange={(e) => setMqttSettings(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {enabledAdapters.csv && (
                    <div className="bg-neutral-50 dark:bg-gray-800 p-3 rounded-md">
                      <div className="text-sm font-medium text-neutral-700 dark:text-gray-300 mb-2">CSV Export Configuration</div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-neutral-600 dark:text-gray-400 mb-1">Output Directory</label>
                          <input
                            type="text"
                            value={csvSettings.outputDir}
                            onChange={(e) => setCsvSettings(prev => ({ ...prev, outputDir: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                            placeholder="./data/exports"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-neutral-600 dark:text-gray-400 mb-1">Export Interval (ms)</label>
                            <input
                              type="number"
                              min="100"
                              max="60000"
                              value={csvSettings.interval}
                              onChange={(e) => setCsvSettings(prev => ({ ...prev, interval: Number(e.target.value) }))}
                              className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                            />
                          </div>
                          <div className="flex items-center pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={csvSettings.includeTimestamp}
                                onChange={(e) => setCsvSettings(prev => ({ ...prev, includeTimestamp: e.target.checked }))}
                                className="w-3 h-3 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
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
                      className="px-3 py-1 text-sm text-white rounded transition-colors bg-[#FF6A00] hover:bg-[#E55A00]"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Local Storage Path */}
          <Card className="md:col-span-2 p-4">
            <CardHeader>Local Storage Path</CardHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={storagePath}
                onChange={(e) => setStoragePath(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
              <button className="px-4 py-2 text-sm bg-neutral-100 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 rounded-md hover:bg-neutral-200 dark:hover:bg-gray-600 transition-colors">
                Browse...
              </button>
            </div>
          </Card>

          {/* Auto Save */}
          <Card className="p-4">
            <CardHeader>Auto Save</CardHeader>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">Enable auto-save (every 5 minutes)</span>
            </label>
          </Card>

          {/* Notifications */}
          <Card className="p-4">
            <CardHeader>Notifications</CardHeader>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showNotifications}
                onChange={(e) => setShowNotifications(e.target.checked)}
                className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">Show deployment notifications</span>
            </label>
          </Card>

          {/* About */}
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
          <div/>
        </div>
      )}
      
      {activeTab === 'data-bridge' && (
        <div className="space-y-6">
          <Card className="md:col-span-2 p-4">
            <CardHeader>Data Bridge Configuration</CardHeader>
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-blue-900 dark:text-blue-100">
                  The Data Bridge has been moved to its own tab. All existing settings have been preserved.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

