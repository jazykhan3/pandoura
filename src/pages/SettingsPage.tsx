import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { Wifi, FileText, MessageCircle, Settings, Cpu, Palette, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Plug, Trash2, Plus, Edit2, Shield, TestTube, User, FolderOpen, Key, AlertCircle } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { RuntimeSettings } from './RuntimeSettings'
import { ExternalToolModal } from '../components/ExternalToolModal'
import * as externalToolsApi from '../services/externalToolsApi'
import * as settingsApi from '../services/settingsApi'
import * as rbacApi from '../services/rbacApi'
import type { ExternalTool } from '../services/externalToolsApi'
import type { RBACConfig } from '../services/rbacApi'
import { deviceAuth } from '../utils/deviceAuth'

type SettingsTab = 'profile' | 'runtimes' | 'data-bridge' | 'integrations' | 'deploy' | 'appearance' | 'security' | 'licensing'

export function SettingsPage() {
  const { 
    theme, 
    actualTheme, 
    setTheme, 
    accentColor, 
    setAccentColor,
    checkContrast,
  } = useTheme()

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
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

  // RBAC Settings
  const [rbacEnabled, setRbacEnabled] = useState(true)
  const [selectedRole, setSelectedRole] = useState<'Viewer' | 'Editor' | 'Approver' | 'Admin'>('Editor')
  const [approvalEnabled, setApprovalEnabled] = useState(true)
  const [minApprovers, setMinApprovers] = useState(2)
  const [requireDeployApproval, setRequireDeployApproval] = useState(true)
  const [requireRollbackApproval, setRequireRollbackApproval] = useState(true)
  const [requireCriticalTagApproval, setRequireCriticalTagApproval] = useState(true)
  const [approverRoles, setApproverRoles] = useState<string[]>(['Approver', 'Admin'])
  const [isLoadingRBAC, setIsLoadingRBAC] = useState(false)
  const [isSavingRBAC, setIsSavingRBAC] = useState(false)
  const [rbacSaveSuccess, setRbacSaveSuccess] = useState(false)

  // License and Seat Management State
  const [licenseInfo, setLicenseInfo] = useState<any>(null)
  const [licenseSeats, setLicenseSeats] = useState<any[]>([])
  const [loadingLicense, setLoadingLicense] = useState(false)
  const [loadingSeats, setLoadingSeats] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingRoleForSeat, setEditingRoleForSeat] = useState<string | null>(null)
  const [updatingRoleForSeat, setUpdatingRoleForSeat] = useState<string | null>(null)
  const [roleUpdateModal, setRoleUpdateModal] = useState<{ isOpen: boolean; seat: any; newRole: string } | null>(null)
  const [roleUpdateSuccess, setRoleUpdateSuccess] = useState<{ isOpen: boolean; oldRole: string; newRole: string; email: string } | null>(null)
  const [removeSeatModal, setRemoveSeatModal] = useState<{ isOpen: boolean; seat: any } | null>(null)
  const [removeSeatSuccess, setRemoveSeatSuccess] = useState<{ isOpen: boolean; email: string } | null>(null)

  // Load RBAC configuration on mount
  useEffect(() => {
    loadRBACConfig();
  }, []);

  // Load license information when licensing tab is active
  useEffect(() => {
    if (activeTab === 'licensing') {
      loadLicenseInfo();
    }
  }, [activeTab]);

  const loadLicenseInfo = async () => {
    setLoadingLicense(true);
    try {
      const response = await fetch('/api/device/license-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('License status data:', data);
        console.log('License object:', data.license);
        console.log('Role from license:', data.license?.role);
        
        // Extract license info from the response
        if (data.license) {
          setLicenseInfo(data.license);
          setIsAdmin(data.license.role === 'Admin' || data.license.role === 'admin');
          console.log('Is Admin:', data.license.role === 'Admin' || data.license.role === 'admin');
          
          // If it's a Teams/Enterprise license, load seats (case-insensitive check)
          const licenseType = data.license.licenseType?.toLowerCase();
          if (licenseType === 'teams' || licenseType === 'enterprise') {
            await loadSeats();
          }
        } else {
          setLicenseInfo(null);
        }
      }
    } catch (error) {
      console.error('Failed to load license info:', error);
    } finally {
      setLoadingLicense(false);
    }
  };

  const loadSeats = async () => {
    setLoadingSeats(true);
    try {
      // Always show test data for demo purposes
      setLicenseSeats([
        {
          bindingId: 'test-binding-1',
          deviceId: 'device-1',
          deviceName: 'John\'s Workstation',
          ownerEmail: 'john.doe@company.com',
          role: 'Editor',
          bindingStatus: 'active',
          boundAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          bindingId: 'test-binding-2',
          deviceId: 'device-2',
          deviceName: 'Sarah\'s Laptop',
          ownerEmail: 'sarah.smith@company.com',
          role: 'Viewer',
          bindingStatus: 'active',
          boundAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        }
      ]);
      
      // Optionally try to fetch real data in the background
      // const response = await fetch('/api/device/license/teams/seats');
      // if (response.ok) {
      //   const data = await response.json();
      //   if (data.seats && data.seats.length > 0) {
      //     setLicenseSeats(data.seats);
      //   }
      // }
    } catch (error) {
      console.error('Failed to load seats:', error);
    } finally {
      setLoadingSeats(false);
    }
  };

  const updateSeatRole = async (bindingId: string, newRole: string) => {
    setUpdatingRoleForSeat(bindingId);
    try {
      // For demo purposes, since we're using test data, just update the local state
      // In production, this would call the API
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      const seat = licenseSeats.find(s => s.bindingId === bindingId);
      const oldRole = seat?.role || 'Unknown';
      const email = seat?.ownerEmail || '';
      
      setLicenseSeats(prev => prev.map(s => 
        s.bindingId === bindingId 
          ? { ...s, role: newRole }
          : s
      ));
      
      setEditingRoleForSeat(null);
      
      // Show success modal
      setRoleUpdateSuccess({ 
        isOpen: true, 
        oldRole,
        newRole,
        email
      });
      
      // In production, you would call the API:
      /*
      const sessionToken = await deviceAuth.getSessionToken();
      
      const response = await fetch('/api/device/license/teams/update-seat-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ bindingId, newRole })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Role updated:', data);
        
        setLicenseSeats(prev => prev.map(seat => 
          seat.bindingId === bindingId 
            ? { ...seat, role: newRole }
            : seat
        ));
        
        setEditingRoleForSeat(null);
        setRoleUpdateSuccess({ isOpen: true, oldRole: data.oldRole, newRole: data.newRole, email: seat.ownerEmail });
      } else {
        const error = await response.json();
        alert(`Failed to update role: ${error.error || 'Unknown error'}`);
      }
      */
    } catch (error) {
      console.error('Failed to update seat role:', error);
      alert('Failed to update seat role. Please try again.');
    } finally {
      setUpdatingRoleForSeat(null);
    }
  };

  const removeSeat = async (bindingId: string) => {
    try {
      // For demo purposes, since we're using test data, just update the local state
      // In production, this would call the API
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const seat = licenseSeats.find(s => s.bindingId === bindingId);
      const email = seat?.ownerEmail || '';
      
      // Remove the seat from local state
      setLicenseSeats(prev => prev.filter(s => s.bindingId !== bindingId));
      
      // Show success modal
      setRemoveSeatSuccess({ 
        isOpen: true, 
        email
      });
      
      // In production, you would call the API:
      /*
      const sessionToken = await deviceAuth.getSessionToken();
      
      const response = await fetch('/api/device/license/teams/remove-seat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ bindingId })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Seat removed:', data);
        
        setLicenseSeats(prev => prev.filter(s => s.bindingId !== bindingId));
        setRemoveSeatSuccess({ isOpen: true, email: seat.ownerEmail });
      } else {
        const error = await response.json();
        alert(`Failed to remove seat: ${error.error || 'Unknown error'}`);
      }
      */
    } catch (error) {
      console.error('Failed to remove seat:', error);
      alert('Failed to remove seat. Please try again.');
    }
  };

  const loadRBACConfig = async () => {
    try {
      setIsLoadingRBAC(true);
      const config = await rbacApi.getRBACConfig();
      
      setRbacEnabled(config.rbacEnabled);
      setApprovalEnabled(config.approvalEnabled);
      setMinApprovers(config.minApprovers);
      setRequireDeployApproval(config.requireDeployApproval);
      setRequireRollbackApproval(config.requireRollbackApproval);
      setRequireCriticalTagApproval(config.requireCriticalTagApproval);
      setApproverRoles(config.approverRoles);
    } catch (error) {
      console.error('Failed to load RBAC config:', error);
    } finally {
      setIsLoadingRBAC(false);
    }
  };

  const saveRBACConfig = async () => {
    try {
      setIsSavingRBAC(true);
      
      const config: Partial<RBACConfig> = {
        rbacEnabled,
        approvalEnabled,
        minApprovers,
        requireDeployApproval,
        requireRollbackApproval,
        requireCriticalTagApproval,
        approverRoles
      };

      console.log('Saving RBAC config:', config);
      await rbacApi.updateRBACConfig(config);
      setRbacSaveSuccess(true);
    } catch (error) {
      console.error('Failed to save RBAC config:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save RBAC settings: ${errorMessage}`);
    } finally {
      setIsSavingRBAC(false);
    }
  };

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
      { id: "profile", label: "Profile", icon: <User size={18} /> },
      { id: "appearance", label: "Appearance", icon: <Palette size={18} /> },
      { id: "runtimes", label: "PLC / Runtimes", icon: <Cpu size={18} /> },
      { id: "deploy", label: "Deployment", icon: <Shield size={18} /> },
      { id: "integrations", label: "Integrations", icon: <Plug size={18} /> },
      { id: "security", label: "Security & RBAC", icon: <AlertCircle size={18} /> },
      { id: "licensing", label: "Licensing & Seats", icon: <Key size={18} /> },
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
              {/* <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
              </div> */}
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
      
      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Information */}
          <Card className="md:col-span-2 p-4">
            <CardHeader>Account Information</CardHeader>
            <div className="space-y-6">
              {/* Device Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Device Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Device Name</div>
                    <div className="font-medium text-gray-900 dark:text-white">DESKTOP-ABC123</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Operating System</div>
                    <div className="font-medium text-gray-900 dark:text-white">Windows 11 Pro</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Architecture</div>
                    <div className="font-medium text-gray-900 dark:text-white">x64</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">CPU Cores</div>
                    <div className="font-medium text-gray-900 dark:text-white">8</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Memory</div>
                    <div className="font-medium text-gray-900 dark:text-white">16GB</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Device Type</div>
                    <div className="font-medium text-gray-900 dark:text-white">Desktop</div>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">User Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">OS Username</div>
                    <div className="font-medium text-gray-900 dark:text-white">admin</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Role</div>
                    <div className="font-medium">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        admin
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Account Type</div>
                    <div className="font-medium text-gray-900 dark:text-white">Primary User</div>
                  </div>
                </div>
              </div>
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
          <Card className="md:col-span-2 p-4">
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
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
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
                    {accentColor.toUpperCase()}
                  </div>
                </div>
              </div>
              {accentPickerExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              )}
            </button>

            {/* Expanded Content */}
            {accentPickerExpanded && (
              <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Color Palette</div>
                    <div className="text-xs text-neutral-500 dark:text-gray-400">
                      {Object.keys({
                        '#FF6A00': 'Panda Orange',
                        '#3B82F6': 'Electric Blue',
                        '#10B981': 'Emerald Green',
                        '#8B5CF6': 'Royal Purple',
                        '#F43F5E': 'Rose Pink',
                        '#F59E0B': 'Amber Gold',
                        '#14B8A6': 'Teal Cyan',
                        '#6366F1': 'Indigo'
                      }).length} presets
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-8 gap-2">
                    {[
                      { color: '#FF6A00', name: 'Panda Orange' },
                      { color: '#3B82F6', name: 'Electric Blue' },
                      { color: '#10B981', name: 'Emerald Green' },
                      { color: '#8B5CF6', name: 'Royal Purple' },
                      { color: '#F43F5E', name: 'Rose Pink' },
                      { color: '#F59E0B', name: 'Amber Gold' },
                      { color: '#14B8A6', name: 'Teal Cyan' },
                      { color: '#6366F1', name: 'Indigo' },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => setAccentColor(preset.color)}
                        className={`w-10 h-10 rounded-md border-2 transition-all hover:scale-110 ${
                          accentColor === preset.color 
                            ? 'border-gray-900 dark:border-white shadow-lg scale-105' 
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Color</div>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-12 h-10 rounded border border-gray-200 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                          setAccentColor(value)
                        }
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                      placeholder="#FF6A00"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Contrast Warning/Info - Only show for problematic colors */}
                <div className="space-y-2">
                  {needsWarning && (
                    <div className="space-y-2">
                      <div className={`flex items-start gap-2 p-3 rounded-md border ${
                        isTooLight 
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          isTooLight 
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`} />
                        <div className="text-xs space-y-1">
                          <div className={`font-medium ${
                            isTooLight 
                              ? 'text-red-800 dark:text-red-200'
                              : 'text-amber-800 dark:text-amber-200'
                          }`}>
                            {isTooLight ? 'Very Light Color' : 'Light Color Detected'}
                          </div>
                          <div className={isTooLight 
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-amber-700 dark:text-amber-300'
                          }>
                            {isTooLight 
                              ? `White text may be difficult to read (contrast: ${whiteTextContrast.ratio.toFixed(1)}:1). Dark text is ${suggestDarkText ? 'recommended' : 'also low contrast'}.`
                              : `White text contrast is ${whiteTextContrast.ratio.toFixed(1)}:1. Consider a darker shade for better readability.`
                            }
                          </div>
                          
                          {/* Show suggested color if available */}
                          {whiteTextContrast.suggestedColor && (
                            <div className="flex items-center gap-2 mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-amber-200 dark:border-amber-800">
                              <div
                                className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600"
                                style={{ backgroundColor: whiteTextContrast.suggestedColor }}
                              />
                              <div className="text-xs">
                                <div className="font-medium text-amber-800 dark:text-amber-200">Suggested</div>
                                <div className="font-mono text-amber-600 dark:text-amber-400">
                                  {whiteTextContrast.suggestedColor.toUpperCase()}
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
        </div>
      )}

      {/* Security & RBAC Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {isLoadingRBAC ? (
            <Card className="p-6">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading RBAC configuration...</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
          {/* RBAC Enable/Disable */}
          <Card className="p-6">
            <CardHeader>Role-Based Access Control (RBAC)</CardHeader>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rbacEnabled}
                  onChange={(e) => setRbacEnabled(e.target.checked)}
                  className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable RBAC</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Enforce role-based permissions for all operations</p>
                </div>
              </label>
            </div>
          </Card>

          {/* Role Definitions */}
          {rbacEnabled && (
            <Card className="p-6">
              <CardHeader>Role Definitions</CardHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Viewer Role */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedRole === 'Viewer' 
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`} onClick={() => setSelectedRole('Viewer')}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Viewer</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Read-only access</p>
                        <ul className="text-xs text-gray-500 dark:text-gray-500 mt-2 space-y-1">
                          <li>• View projects and logic</li>
                          <li>• View dashboard metrics</li>
                          <li>• No edit or deploy permissions</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Editor Role */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedRole === 'Editor' 
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`} onClick={() => setSelectedRole('Editor')}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <Edit2 size={20} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Editor</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Edit and create</p>
                        <ul className="text-xs text-gray-500 dark:text-gray-500 mt-2 space-y-1">
                          <li>• All Viewer permissions</li>
                          <li>• Edit logic and projects</li>
                          <li>• Cannot deploy or approve</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Approver Role */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedRole === 'Approver' 
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`} onClick={() => setSelectedRole('Approver')}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={20} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Approver</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Review and approve</p>
                        <ul className="text-xs text-gray-500 dark:text-gray-500 mt-2 space-y-1">
                          <li>• All Editor permissions</li>
                          <li>• Approve deployments</li>
                          <li>• Approve rollbacks</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Admin Role */}
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedRole === 'Admin' 
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`} onClick={() => setSelectedRole('Admin')}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <Shield size={20} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Admin</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Full control</p>
                        <ul className="text-xs text-gray-500 dark:text-gray-500 mt-2 space-y-1">
                          <li>• All Approver permissions</li>
                          <li>• Manage users and roles</li>
                          <li>• Configure RBAC policies</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Approval Workflow */}
          {rbacEnabled && (
            <Card className="p-6">
              <CardHeader>Approval Workflow</CardHeader>
              <div className="space-y-6">
                {/* Enable Approval */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approvalEnabled}
                    onChange={(e) => setApprovalEnabled(e.target.checked)}
                    className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Approval Workflow</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Require approvals for critical operations</p>
                  </div>
                </label>

                {approvalEnabled && (
                  <>
                    {/* Two-Person Approval */}
                    <div className="pl-7 space-y-4 border-l-2 border-gray-200 dark:border-gray-700">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Minimum Approvers Required
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={minApprovers}
                            onChange={(e) => setMinApprovers(parseInt(e.target.value) || 1)}
                            className="w-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {minApprovers === 1 ? 'Single approver' : minApprovers === 2 ? 'Two-person approval' : `${minApprovers} approvers required`}
                          </span>
                        </div>
                        {minApprovers >= 2 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>Two-person approval enforced: Operations require {minApprovers} independent approvals</span>
                          </p>
                        )}
                      </div>

                      {/* Operations Requiring Approval */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Operations Requiring Approval
                        </label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input
                              type="checkbox"
                              checked={requireDeployApproval}
                              onChange={(e) => setRequireDeployApproval(e.target.checked)}
                              className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Deployments</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">All PLC deployments require approval</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input
                              type="checkbox"
                              checked={requireRollbackApproval}
                              onChange={(e) => setRequireRollbackApproval(e.target.checked)}
                              className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Rollbacks</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Rolling back to previous versions requires approval</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input
                              type="checkbox"
                              checked={requireCriticalTagApproval}
                              onChange={(e) => setRequireCriticalTagApproval(e.target.checked)}
                              className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Critical Tag Modifications</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Editing tags marked as critical requires approval</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Approver Roles */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Who Can Approve
                        </label>
                        <div className="space-y-2">
                          {['Viewer', 'Editor', 'Approver', 'Admin'].map((role) => (
                            <label key={role} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                              <input
                                type="checkbox"
                                checked={approverRoles.includes(role)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setApproverRoles([...approverRoles, role])
                                  } else {
                                    setApproverRoles(approverRoles.filter(r => r !== role))
                                  }
                                }}
                                disabled={role === 'Viewer' || role === 'Editor'}
                                className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)] disabled:opacity-50"
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100">{role}</span>
                              {(role === 'Viewer' || role === 'Editor') && (
                                <span className="text-xs text-gray-400">(Cannot approve)</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Enforcement Summary */}
          {rbacEnabled && (
            <Card className="p-6">
              <CardHeader>Enforcement Summary</CardHeader>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">Current Configuration</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800 dark:text-blue-200">RBAC Status:</span>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {rbacEnabled ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    </div>
                    {rbacEnabled && approvalEnabled && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-800 dark:text-blue-200">Approval Workflow:</span>
                          <span className="font-medium text-blue-900 dark:text-blue-100">✓ Active</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-800 dark:text-blue-200">Required Approvers:</span>
                          <span className="font-medium text-blue-900 dark:text-blue-100">{minApprovers}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-800 dark:text-blue-200">Protected Operations:</span>
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            {[requireDeployApproval && 'Deploy', requireRollbackApproval && 'Rollback', requireCriticalTagApproval && 'Critical Tags'].filter(Boolean).join(', ') || 'None'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button 
                  onClick={saveRBACConfig}
                  disabled={isSavingRBAC}
                  className="w-full px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingRBAC ? 'Saving...' : 'Save RBAC Configuration'}
                </button>
              </div>
            </Card>
          )}
            </>
          )}
        </div>
      )}

      {/* Licensing & Seats Tab */}
      {activeTab === 'licensing' && (
        <div className="space-y-6">
          {/* Current License Information */}
          <Card className="p-6">
            <CardHeader>License Information</CardHeader>
            {loadingLicense ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
              </div>
            ) : licenseInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">License Type</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        licenseInfo.licenseType === 'Solo' 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : licenseInfo.licenseType === 'Teams'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                      }`}>
                        {licenseInfo.licenseType}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Role</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        licenseInfo.role === 'Admin'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : licenseInfo.role === 'Approver'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                          : licenseInfo.role === 'Editor'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                      }`}>
                        {licenseInfo.role}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">License ID</div>
                    <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{licenseInfo.licenseId?.substring(0, 16)}...</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Owner Email</div>
                    <div className="text-sm text-gray-900 dark:text-gray-100">{licenseInfo.ownerEmail}</div>
                  </div>
                  {licenseInfo.lastValidated && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Validated</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(licenseInfo.lastValidated).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {licenseInfo.boundAt && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Activated</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(licenseInfo.boundAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
                  <AlertCircle size={20} />
                  <p>No active license found. Please activate a license to access all features.</p>
                </div>
              </div>
            )}
          </Card>

          {/* Seat Management (Admin Only) */}
          {isAdmin && (licenseInfo?.licenseType?.toLowerCase() === 'teams' || licenseInfo?.licenseType?.toLowerCase() === 'enterprise') && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CardHeader>Seat Management</CardHeader>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadSeats}
                    disabled={loadingSeats}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {loadingSeats ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {loadingSeats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Seat Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Total Seats</div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {licenseInfo?.limits?.maxSeats || 20}
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="text-sm text-green-600 dark:text-green-400 mb-1">Used Seats</div>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {licenseSeats.filter(s => s.bindingStatus === 'active').length}
                      </div>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Remaining Seats</div>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {(licenseInfo?.limits?.maxSeats || 20) - licenseSeats.filter(s => s.bindingStatus === 'active').length}
                      </div>
                    </div>
                  </div>

                  {/* Seat List */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Active Team Members</div>
                    {licenseSeats.length > 0 ? (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Activity</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {licenseSeats.map((seat, index) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  <div className="flex items-center gap-2">
                                    <User size={16} className="text-gray-400" />
                                    {seat.deviceName}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{seat.ownerEmail}</td>
                                <td className="px-4 py-3 text-sm">
                                  {editingRoleForSeat === seat.bindingId ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={seat.role}
                                        onChange={(e) => {
                                          const newRole = e.target.value;
                                          setRoleUpdateModal({
                                            isOpen: true,
                                            seat: { ...seat, oldRole: seat.role, newRole },
                                            newRole
                                          });
                                        }}
                                        disabled={updatingRoleForSeat === seat.bindingId}
                                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                      >
                                        <option value="Viewer">Viewer</option>
                                        <option value="Editor">Editor</option>
                                        <option value="Deployer">Deployer</option>
                                        <option value="Approver">Approver</option>
                                        <option value="Admin">Admin</option>
                                      </select>
                                      <button
                                        onClick={() => setEditingRoleForSeat(null)}
                                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        seat.role === 'Admin'
                                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                          : seat.role === 'Approver'
                                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                                          : seat.role === 'Deployer'
                                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                          : seat.role === 'Editor'
                                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                                      }`}>
                                        {seat.role}
                                      </span>
                                      <button
                                        onClick={() => setEditingRoleForSeat(seat.bindingId)}
                                        className="text-gray-400 hover:text-[var(--accent-color)] transition-colors"
                                        title="Edit role"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    seat.bindingStatus === 'active'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                  }`}>
                                    {seat.bindingStatus}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {seat.lastActivity ? (
                                    <div className="flex flex-col">
                                      <span>{new Date(seat.lastActivity).toLocaleDateString()}</span>
                                      <span className="text-xs text-gray-400">{new Date(seat.lastActivity).toLocaleTimeString()}</span>
                                    </div>
                                  ) : (
                                    'N/A'
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  <button
                                    onClick={() => {
                                      setRemoveSeatModal({ isOpen: true, seat });
                                    }}
                                    disabled={seat.role === 'Admin'}
                                    className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={seat.role === 'Admin' ? 'Cannot remove admin seat' : 'Remove this seat'}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-center text-gray-600 dark:text-gray-400">
                        No seats assigned yet
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Non-Admin Message */}
          {!isAdmin && (licenseInfo?.licenseType?.toLowerCase() === 'teams' || licenseInfo?.licenseType?.toLowerCase() === 'enterprise') && (
            <Card className="p-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Shield size={20} />
                  <p>Seat management is only available to administrators. Contact your admin to manage license seats.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* RBAC Save Success Dialog */}
      {rbacSaveSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Success</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">RBAC settings saved successfully</p>
              </div>
            </div>
            <button
              onClick={() => setRbacSaveSuccess(false)}
              className="w-full px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Role Update Confirmation Modal */}
      {roleUpdateModal?.isOpen && roleUpdateModal.seat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Role Change</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Update user permissions</p>
              </div>
            </div>
            
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>User:</strong> {roleUpdateModal.seat.ownerEmail || roleUpdateModal.seat.email}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Role:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  roleUpdateModal.seat.oldRole === 'Admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  roleUpdateModal.seat.oldRole === 'Approver' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                  roleUpdateModal.seat.oldRole === 'Deployer' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                  roleUpdateModal.seat.oldRole === 'Editor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }`}>
                  {roleUpdateModal.seat.oldRole}
                </span>
                <span className="text-gray-400">→</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  roleUpdateModal.newRole === 'Admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  roleUpdateModal.newRole === 'Approver' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                  roleUpdateModal.newRole === 'Deployer' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                  roleUpdateModal.newRole === 'Editor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }`}>
                  {roleUpdateModal.newRole}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to change this user's role? This will update their permissions immediately.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRoleUpdateModal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateSeatRole(roleUpdateModal.seat.bindingId, roleUpdateModal.newRole);
                  setRoleUpdateModal(null);
                }}
                className="flex-1 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Update Success Modal */}
      {roleUpdateSuccess?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Role Updated Successfully</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">User permissions have been changed</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>User:</strong> {roleUpdateSuccess.email}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Role changed from</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  roleUpdateSuccess.oldRole === 'Admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  roleUpdateSuccess.oldRole === 'Approver' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                  roleUpdateSuccess.oldRole === 'Deployer' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                  roleUpdateSuccess.oldRole === 'Editor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }`}>
                  {roleUpdateSuccess.oldRole}
                </span>
                <span className="text-gray-400">to</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  roleUpdateSuccess.newRole === 'Admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  roleUpdateSuccess.newRole === 'Approver' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                  roleUpdateSuccess.newRole === 'Deployer' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                  roleUpdateSuccess.newRole === 'Editor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }`}>
                  {roleUpdateSuccess.newRole}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              The change has been logged in the audit trail.
            </p>

            <button
              onClick={() => setRoleUpdateSuccess(null)}
              className="w-full px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Remove Seat Confirmation Modal */}
      {removeSeatModal?.isOpen && removeSeatModal.seat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Remove Seat</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revoke user access</p>
              </div>
            </div>
            
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>User:</strong> {removeSeatModal.seat.ownerEmail}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>Device:</strong> {removeSeatModal.seat.deviceName}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Role:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  removeSeatModal.seat.role === 'Admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  removeSeatModal.seat.role === 'Approver' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                  removeSeatModal.seat.role === 'Deployer' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                  removeSeatModal.seat.role === 'Editor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }`}>
                  {removeSeatModal.seat.role}
                </span>
              </div>
            </div>

            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This action will:
              </p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 ml-4 list-disc">
                <li>Deactivate the user's device immediately</li>
                <li>Revoke all access to the platform</li>
                <li>Free up one license seat</li>
                <li>Log this action in the audit trail</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to remove this seat? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRemoveSeatModal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removeSeat(removeSeatModal.seat.bindingId);
                  setRemoveSeatModal(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Remove Seat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Seat Success Modal */}
      {removeSeatSuccess?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Seat Removed Successfully</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">User access has been revoked</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>Removed user:</strong> {removeSeatSuccess.email}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                ✓ Device access deactivated<br />
                ✓ License seat freed up<br />
                ✓ Action logged in audit trail
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              The user will no longer have access to the platform. You can reassign this seat to another user.
            </p>

            <button
              onClick={() => setRemoveSeatSuccess(null)}
              className="w-full px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

