import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { Wifi, FileText, MessageCircle, Settings, Cpu, Palette, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Plug, Trash2, Plus, Edit2, Shield, TestTube } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { RuntimeSettings } from './RuntimeSettings'
import { ExternalToolModal } from '../components/ExternalToolModal'
import * as externalToolsApi from '../services/externalToolsApi'
import * as settingsApi from '../services/settingsApi'
import type { ExternalTool } from '../services/externalToolsApi'

type SettingsTab = 'general' | 'runtimes' | 'data-bridge' | 'integrations' | 'deploy'

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

  // External Code Tools State
  const [externalTools, setExternalTools] = useState<ExternalTool[]>([])
  const [isToolModalOpen, setIsToolModalOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<ExternalTool | null>(null)
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [toolError, setToolError] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; toolId: string | null; toolName: string }>({ isOpen: false, toolId: null, toolName: '' })

  // External Pre-Deploy Check Settings
  const [externalCheckEnabled, setExternalCheckEnabled] = useState(false)
  const [externalCheckUrl, setExternalCheckUrl] = useState('')
  const [externalCheckTimeout, setExternalCheckTimeout] = useState(30000)
  const [externalCheckThreshold, setExternalCheckThreshold] = useState<'critical' | 'high' | 'medium' | 'low'>('critical')
  const [externalCheckAuthHeader, setExternalCheckAuthHeader] = useState('')
  const [externalCheckRetryCount, setExternalCheckRetryCount] = useState(3)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testConnectionResult, setTestConnectionResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [saveSettingsResult, setSaveSettingsResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load external tools from backend
  useEffect(() => {
    loadExternalTools()
    loadDeploySettings()
  }, [])

  async function loadDeploySettings() {
    try {
      const settings = await settingsApi.fetchSettingsByCategory('deploy')
      
      if (settings.external_predeploy_check_enabled !== undefined) {
        setExternalCheckEnabled(settings.external_predeploy_check_enabled)
      }
      if (settings.external_predeploy_check_url !== undefined) {
        setExternalCheckUrl(settings.external_predeploy_check_url)
      }
      if (settings.external_predeploy_check_timeout !== undefined) {
        setExternalCheckTimeout(settings.external_predeploy_check_timeout)
      }
      if (settings.external_predeploy_check_blocking_threshold !== undefined) {
        setExternalCheckThreshold(settings.external_predeploy_check_blocking_threshold)
      }
      if (settings.external_predeploy_check_auth_header !== undefined) {
        setExternalCheckAuthHeader(settings.external_predeploy_check_auth_header)
      }
      if (settings.external_predeploy_check_retry_count !== undefined) {
        setExternalCheckRetryCount(settings.external_predeploy_check_retry_count)
      }
    } catch (error) {
      console.error('Failed to load deploy settings:', error)
    }
  }

  async function loadExternalTools() {
    setIsLoadingTools(true)
    setToolError(null)
    try {
      const tools = await externalToolsApi.fetchExternalTools()
      setExternalTools(tools)
    } catch (error) {
      console.error('Failed to load external tools:', error)
      setToolError(error instanceof Error ? error.message : 'Failed to load tools')
    } finally {
      setIsLoadingTools(false)
    }
  }

  async function handleSaveTool(tool: ExternalTool) {
    try {
      if (editingTool?.id) {
        // Update existing tool
        const updated = await externalToolsApi.updateExternalTool(editingTool.id, tool)
        setExternalTools(prev => prev.map(t => t.id === updated.id ? updated : t))
      } else {
        // Create new tool
        const created = await externalToolsApi.createExternalTool(tool)
        setExternalTools(prev => [...prev, created])
      }
      setIsToolModalOpen(false)
      setEditingTool(null)
    } catch (error) {
      console.error('Failed to save tool:', error)
      alert(error instanceof Error ? error.message : 'Failed to save tool')
    }
  }

  async function handleTestConnection() {
    if (!externalCheckUrl) {
      setTestConnectionResult({
        success: false,
        message: 'Please enter an endpoint URL'
      })
      return
    }

    setIsTestingConnection(true)
    setTestConnectionResult(null)

    try {
      const result = await settingsApi.testExternalCheckEndpoint(
        externalCheckUrl,
        externalCheckAuthHeader || undefined
      )
      setTestConnectionResult(result)
    } catch (error) {
      setTestConnectionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  async function handleSaveDeploySettings() {
    setIsSavingSettings(true)
    setSaveSettingsResult(null)

    try {
      await settingsApi.updateSettingsBatch([
        {
          key: 'external_predeploy_check_enabled',
          value: externalCheckEnabled,
          type: 'boolean',
          category: 'deploy'
        },
        {
          key: 'external_predeploy_check_url',
          value: externalCheckUrl,
          type: 'string',
          category: 'deploy'
        },
        {
          key: 'external_predeploy_check_timeout',
          value: externalCheckTimeout,
          type: 'number',
          category: 'deploy'
        },
        {
          key: 'external_predeploy_check_blocking_threshold',
          value: externalCheckThreshold,
          type: 'string',
          category: 'deploy'
        },
        {
          key: 'external_predeploy_check_auth_header',
          value: externalCheckAuthHeader,
          type: 'string',
          category: 'deploy',
          isEncrypted: true
        },
        {
          key: 'external_predeploy_check_retry_count',
          value: externalCheckRetryCount,
          type: 'number',
          category: 'deploy'
        }
      ])

      setSaveSettingsResult({
        success: true,
        message: 'Settings saved successfully'
      })

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSettingsResult(null), 3000)
    } catch (error) {
      setSaveSettingsResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save settings'
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function handleDeleteTool(id: string) {
    try {
      await externalToolsApi.deleteExternalTool(id)
      setExternalTools(prev => prev.filter(t => t.id !== id))
      setDeleteConfirmation({ isOpen: false, toolId: null, toolName: '' })
    } catch (error) {
      console.error('Failed to delete tool:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete tool')
    }
  }

  async function handleToggleTool(id: string, enabled: boolean) {
    try {
      const updated = await externalToolsApi.toggleExternalTool(id, enabled)
      setExternalTools(prev => prev.map(t => t.id === id ? updated : t))
    } catch (error) {
      console.error('Failed to toggle tool:', error)
      alert(error instanceof Error ? error.message : 'Failed to toggle tool')
    }
  }

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> =
    [
      { id: "general", label: "General", icon: <Settings size={18} /> },
      { id: "runtimes", label: "PLC / Runtimes", icon: <Cpu size={18} /> },
      { id: "deploy", label: "Deployment", icon: <Shield size={18} /> },
      { id: "integrations", label: "Integrations", icon: <Plug size={18} /> },
      // { id: 'data-bridge', label: 'Data Bridge', icon: <Wifi size={18} /> },
    ];

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
      
      {activeTab === 'deploy' && (
        <div className="space-y-6">
          {/* External Pre-Deploy Check Section */}
          <Card className="p-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                External Pre-Deploy Safety Check
              </div>
            </CardHeader>
            
            <div className="mt-4 space-y-4">
              <p className="text-sm text-neutral-600 dark:text-gray-400">
                Integrate your in-house safety models or external validation services into Pandaura's deployment workflow.
                External checks run automatically during pre-deploy safety validation and can block deployments based on severity thresholds.
              </p>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Enable External Pre-Deploy Check
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    When enabled, Pandaura will call your external service before every deployment
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={externalCheckEnabled}
                    onChange={(e) => setExternalCheckEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent-color)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
                </label>
              </div>

              {/* Settings Form */}
              <div className="space-y-4">
                {/* Endpoint URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Endpoint URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={externalCheckUrl}
                    onChange={(e) => setExternalCheckUrl(e.target.value)}
                    placeholder="https://your-safety-service.com/api/check"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  />
                  <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    HTTP/HTTPS endpoint that will receive deployment metadata for validation
                  </p>
                </div>

                {/* Blocking Severity Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Blocking Severity Threshold
                  </label>
                  <select
                    value={externalCheckThreshold}
                    onChange={(e) => setExternalCheckThreshold(e.target.value as 'critical' | 'high' | 'medium' | 'low')}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  >
                    <option value="critical">Critical Only</option>
                    <option value="high">High & Above</option>
                    <option value="medium">Medium & Above</option>
                    <option value="low">Low & Above (Block All Issues)</option>
                  </select>
                  <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    Deployments will be blocked if external check returns severity at or above this level
                  </p>
                </div>

                {/* Timeout */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Request Timeout (milliseconds)
                  </label>
                  <input
                    type="number"
                    value={externalCheckTimeout}
                    onChange={(e) => setExternalCheckTimeout(parseInt(e.target.value) || 30000)}
                    min={1000}
                    max={120000}
                    step={1000}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  />
                  <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    How long to wait for external service response before timing out
                  </p>
                </div>

                {/* Retry Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Retry Attempts
                  </label>
                  <input
                    type="number"
                    value={externalCheckRetryCount}
                    onChange={(e) => setExternalCheckRetryCount(parseInt(e.target.value) || 3)}
                    min={1}
                    max={10}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  />
                  <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    Number of retry attempts if external service request fails
                  </p>
                </div>

                {/* Authorization Header (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Authorization Header (Optional)
                  </label>
                  <input
                    type="password"
                    value={externalCheckAuthHeader}
                    onChange={(e) => setExternalCheckAuthHeader(e.target.value)}
                    placeholder="Bearer your-api-token"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  />
                  <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    Authorization header value for authenticating with your external service (stored encrypted)
                  </p>
                </div>
              </div>

              {/* Test Connection */}
              <div className="border-t border-neutral-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Test Connection
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                      Verify that your external service endpoint is reachable
                    </div>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !externalCheckUrl}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <TestTube className="w-4 h-4" />
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                {/* Test Result */}
                {testConnectionResult && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${
                    testConnectionResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testConnectionResult.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      <span className="font-medium">{testConnectionResult.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="border-t border-neutral-200 dark:border-gray-700 pt-4 flex items-center justify-between">
                <div>
                  {saveSettingsResult && (
                    <div className={`text-sm flex items-center gap-2 ${
                      saveSettingsResult.success
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {saveSettingsResult.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {saveSettingsResult.message}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSaveDeploySettings}
                  disabled={isSavingSettings}
                  className="px-6 py-2 text-sm bg-[var(--accent-color)] text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-medium"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              {/* API Documentation */}
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  📖 External Service API Contract
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-2 font-mono">
                  <div><strong>Request:</strong> POST {externalCheckUrl || 'https://your-endpoint.com/check'}</div>
                  <div className="pl-4 text-xs">
                    {`{\n  "deploymentId": "uuid",\n  "releaseId": "uuid",\n  "projectId": "uuid",\n  "environment": "production",\n  "bundle": { ... }\n}`}
                  </div>
                  <div className="mt-2"><strong>Expected Response:</strong></div>
                  <div className="pl-4 text-xs">
                    {`{\n  "status": "approved" | "rejected" | "warning",\n  "severity": "critical" | "high" | "medium" | "low" | "info",\n  "message": "Human-readable message",\n  "details": { ... },\n  "annotations": [...]\n}`}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* External Code Tools Section */}
          <Card className="p-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plug className="w-4 h-4" />
                  External Code Tools
                </div>
                <button
                  onClick={() => {
                    setEditingTool(null)
                    setIsToolModalOpen(true)
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--accent-color)] text-white rounded hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Add Tool
                </button>
              </div>
            </CardHeader>
            
            <div className="mt-4 space-y-3">
              <p className="text-sm text-neutral-600 dark:text-gray-400">
                Attach your own scripts, analyzers, linters, and AI services to the Structured Text editor.
                Tools can be accessed via context menu and CodeLens in the editor.
              </p>

              {/* Error Message */}
              {toolError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-900 dark:text-red-100">
                  {toolError}
                </div>
              )}

              {/* Loading State */}
              {isLoadingTools && (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-4 border-gray-300 dark:border-gray-600 border-t-[var(--accent-color)] rounded-full animate-spin" />
                  <p className="mt-2 text-sm text-neutral-500 dark:text-gray-400">Loading tools...</p>
                </div>
              )}

              {/* Tools Table */}
              {!isLoadingTools && externalTools.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-100 dark:bg-gray-800">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-600 dark:text-gray-400">Tool Name</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-600 dark:text-gray-400">URL / Command</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-600 dark:text-gray-400">Mode</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-600 dark:text-gray-400">Status</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-neutral-600 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-gray-700">
                      {externalTools.map((tool) => (
                        <tr key={tool.id} className="hover:bg-neutral-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-3 text-gray-900 dark:text-gray-100 font-medium">{tool.name}</td>
                          <td className="px-3 py-3 text-neutral-600 dark:text-gray-400 font-mono text-xs truncate max-w-xs">
                            {tool.urlOrCommand}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              tool.mode === 'http' 
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            }`}>
                              {tool.mode.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => tool.id && handleToggleTool(tool.id, !tool.enabled)}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                tool.enabled
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                  : 'bg-neutral-200 dark:bg-gray-700 text-neutral-600 dark:text-gray-400 hover:bg-neutral-300 dark:hover:bg-gray-600'
                              }`}
                            >
                              {tool.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingTool(tool)
                                  setIsToolModalOpen(true)
                                }}
                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirmation({
                                    isOpen: true,
                                    toolId: tool.id || '',
                                    toolName: tool.name
                                  })
                                }}
                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !isLoadingTools ? (
                <div className="text-center py-8 text-neutral-500 dark:text-gray-400">
                  <Plug className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No external tools configured</p>
                  <p className="text-xs mt-1">Click "Add Tool" to get started</p>
                </div>
              ) : null}
           
            </div>
          </Card>
        </div>
      )}

      {/* External Tool Modal */}
      <ExternalToolModal
        isOpen={isToolModalOpen}
        onClose={() => {
          setIsToolModalOpen(false)
          setEditingTool(null)
        }}
        onSave={handleSaveTool}
        editingTool={editingTool}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirmation({ isOpen: false, toolId: null, toolName: '' })}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Delete Tool
              </h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <strong className="font-semibold">"{deleteConfirmation.toolName}"</strong>?
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => setDeleteConfirmation({ isOpen: false, toolId: null, toolName: '' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmation.toolId) {
                    handleDeleteTool(deleteConfirmation.toolId)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Tool
              </button>
            </div>
          </div>
        </div>
      )}
      
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
      
      {/* {activeTab === 'data-bridge' && (
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
      )} */}
    </div>
  )
}

