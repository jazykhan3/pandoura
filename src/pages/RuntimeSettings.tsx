import { useState, useEffect } from 'react'
import { Card, CardHeader } from '../components/Card'
import { ApprovalDashboard } from '../components/ApprovalDashboard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Dialog } from '../components/Dialog'
import { 
  Cpu, 
  Plus, 
  RefreshCw, 
  Play, 
  Trash2, 
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Shield
} from 'lucide-react'
import { 
  type ImportDefaults, 
  DEFAULT_IMPORT_SETTINGS,
  getImportDefaults,
  saveImportDefaults as saveImportDefaultsUtil
} from '../utils/importDefaults'
import { type PLCPullPermissions, getPermissionsForRole } from '../utils/plcPermissions'
import { deviceAuth } from '../utils/deviceAuth'

type RuntimeStatus = 'online' | 'disconnected' | 'connecting' | 'unsupported' | 'error' | 'maintenance' | 'stopped' | 'faulted'

type RuntimeConnection = {
  id: string
  name: string
  runtimeType: 'PLC' | 'SoftPLC' | 'Virtual Runtime' | 'Hardware-in-the-loop' // Required runtime type
  vendorType: string
  ipAddress: string // Network address (IP/hostname)
  logicalIdentifier?: string // Logical runtime identifier (name/instance ID)
  port: number
  transport?: string // Transport/Protocol (auto-selected by adapter)
  status: RuntimeStatus
  firmwareVersion?: string
  runtimeVersion?: string
  lastConnectedAt?: string
  isProduction: boolean
  environment: string
  deploymentStatus?: string
  // Authentication fields (encrypted)
  username?: string
  password?: string
  certificatePath?: string
  token?: string
}

// Add Runtime Dialog Component
interface AddRuntimeDialogProps {
  onClose: () => void
  onAdd: (runtime: RuntimeConnection) => void
}

const RUNTIME_TYPES = [
  { value: 'PLC', label: 'PLC' },
  { value: 'SoftPLC', label: 'SoftPLC' },
  { value: 'Virtual Runtime', label: 'Virtual Runtime' },
  { value: 'Hardware-in-the-loop', label: 'Hardware-in-the-loop' },
] as const

const ADAPTER_TYPES = [
  { value: 'rockwell', label: 'Rockwell Automation (Allen-Bradley)', defaultPort: 44818, transport: 'EtherNet/IP' },
  { value: 'siemens', label: 'Siemens S7', defaultPort: 102, transport: 'S7 Protocol' },
  { value: 'beckhoff', label: 'Beckhoff TwinCAT', defaultPort: 851, transport: 'ADS/AMS' },
  { value: 'codesys', label: 'CODESYS', defaultPort: 11740, transport: 'CODESYS Protocol' },
  { value: 'mitsubishi', label: 'Mitsubishi', defaultPort: 5007, transport: 'MC Protocol' },
  { value: 'omron', label: 'Omron', defaultPort: 9600, transport: 'FINS' },
  { value: 'schneider', label: 'Schneider Electric', defaultPort: 502, transport: 'Modbus TCP' },
  { value: 'generic-modbus', label: 'Generic Modbus TCP', defaultPort: 502, transport: 'Modbus TCP' },
]

const ENVIRONMENTS = [
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
]

function AddRuntimeDialog({ onClose, onAdd }: AddRuntimeDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    runtimeType: 'PLC' as 'PLC' | 'SoftPLC' | 'Virtual Runtime' | 'Hardware-in-the-loop',
    ipAddress: '',
    logicalIdentifier: '',
    vendorType: 'rockwell',
    port: 44818,
    transport: 'EtherNet/IP',
    environment: 'development',
    isProduction: false,
    description: '',
    username: '',
    password: '',
    certificatePath: '',
    token: '',
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  
  // Update port and transport when adapter type changes
  const handleAdapterChange = (value: string) => {
    const adapter = ADAPTER_TYPES.find(a => a.value === value)
    setFormData(prev => ({
      ...prev,
      vendorType: value,
      port: adapter?.defaultPort || 44818,
      transport: adapter?.transport || 'TCP/IP'
    }))
  }
  
  // Update isProduction when environment changes
  const handleEnvironmentChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      environment: value,
      isProduction: value === 'production'
    }))
  }
  
  // Validate IP address or hostname
  const validateIpOrHostname = (value: string): boolean => {
    if (!value) return false
    
    // Check if it's a valid hostname
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (hostnameRegex.test(value)) return true
    
    // Check if it's a valid IPv4
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (ipv4Regex.test(value)) return true
    
    // Check if it's a valid IPv6 (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/
    if (ipv6Regex.test(value)) return true
    
    return false
  }
  
  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.runtimeType) {
      newErrors.runtimeType = 'Runtime type is required'
    }
    
    if (!formData.ipAddress.trim()) {
      newErrors.ipAddress = 'IP address or hostname is required'
    } else if (!validateIpOrHostname(formData.ipAddress)) {
      newErrors.ipAddress = 'Invalid IP address or hostname'
    }
    
    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    
    try {
      // Get session token for authentication
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        throw new Error('No session token available. Please log in.')
      }
      
      // Call API to create runtime (userId will be extracted from session token on backend)
      const response = await fetch('/api/runtimes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: formData.name,
          runtimeType: formData.runtimeType,
          vendorType: formData.vendorType,
          ipAddress: formData.ipAddress,
          logicalIdentifier: formData.logicalIdentifier || null,
          port: formData.port,
          transport: formData.transport,
          environment: formData.environment,
          isProduction: formData.isProduction,
          description: formData.description,
          username: formData.username || null,
          password: formData.password || null, // Will be encrypted on backend
          certificatePath: formData.certificatePath || null,
          token: formData.token || null, // Will be encrypted on backend
          autoConnect: false,
          enableMonitoring: true,
          enableTelemetry: true,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.error || errorData.message || 'Failed to add runtime'
        
        // Add helpful context for permission errors
        if (response.status === 403) {
          const permission = errorData.required_permission || 'edit_logic'
          throw new Error(`Permission Denied: You need the '${permission}' permission to create runtimes. Please contact your administrator.`)
        }
        
        throw new Error(errorMsg)
      }
      
      const result = await response.json()
      const newRuntime: RuntimeConnection = result.runtime || result
      
      // Show success message briefly before closing
      setSubmitSuccess(result.message || 'Runtime added successfully!')
      
      // Wait 1.5 seconds to show success, then call onAdd
      setTimeout(() => {
        onAdd(newRuntime)
      }, 1500)
    } catch (error) {
      console.error('Error adding runtime:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to add runtime')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Add Runtime Connection
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {/* Error Message */}
          {submitError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-200">Error</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{submitError}</p>
              </div>
              <button
                onClick={() => setSubmitError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-200"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Success Message */}
          {submitSuccess && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 dark:text-green-200">Success</h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">{submitSuccess}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:text-white ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="e.g., Production Line 1 PLC"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>
            
            {/* Runtime Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Runtime Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.runtimeType}
                onChange={e => setFormData(prev => ({ ...prev, runtimeType: e.target.value as any }))}
                className={`w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:text-white ${
                  errors.runtimeType ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {RUNTIME_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.runtimeType && (
                <p className="mt-1 text-sm text-red-500">{errors.runtimeType}</p>
              )}
            </div>
            
            {/* IP/Hostname */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Network Address (IP / Hostname) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ipAddress}
                onChange={e => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:text-white ${
                  errors.ipAddress ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="e.g., 192.168.1.100 or plc1.factory.local"
              />
              {errors.ipAddress && (
                <p className="mt-1 text-sm text-red-500">{errors.ipAddress}</p>
              )}
            </div>
            
            {/* Logical Identifier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Logical Runtime Identifier (Optional)
              </label>
              <input
                type="text"
                value={formData.logicalIdentifier}
                onChange={e => setFormData(prev => ({ ...prev, logicalIdentifier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                placeholder="e.g., PLC-001 or RuntimeInstance-A"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                A unique identifier for this runtime instance (name/instance ID)
              </p>
            </div>
            
            {/* Adapter Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adapter Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.vendorType}
                onChange={e => handleAdapterChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
              >
                {ADAPTER_TYPES.map(adapter => (
                  <option key={adapter.value} value={adapter.value}>
                    {adapter.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={e => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
                className={`w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:text-white ${
                  errors.port ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                min="1"
                max="65535"
              />
              {errors.port && (
                <p className="mt-1 text-sm text-red-500">{errors.port}</p>
              )}
            </div>
            
            {/* Transport/Protocol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transport / Protocol
              </label>
              <input
                type="text"
                value={formData.transport}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 bg-gray-50 dark:text-gray-400 text-gray-600 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Automatically selected based on the adapter type
              </p>
            </div>
            
            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Environment <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.environment}
                onChange={e => handleEnvironmentChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
              >
                {ENVIRONMENTS.map(env => (
                  <option key={env.value} value={env.value}>
                    {env.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Authentication Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Authentication (Optional)
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                All authentication data (credentials, certificates, tokens) are encrypted before storage using AES-256 encryption
              </p>
              
              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                    placeholder="PLC username"
                    autoComplete="off"
                  />
                </div>
                
                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                
                {/* Certificate Path */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Certificate Path
                  </label>
                  <input
                    type="text"
                    value={formData.certificatePath}
                    onChange={e => setFormData(prev => ({ ...prev, certificatePath: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                    placeholder="/path/to/certificate.pem"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Path to SSL/TLS certificate for secure connections
                  </p>
                </div>
                
                {/* Token */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Authentication Token
                  </label>
                  <input
                    type="password"
                    value={formData.token}
                    onChange={e => setFormData(prev => ({ ...prev, token: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                    placeholder="Bearer token or API key"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    For token-based authentication (JWT, API keys, etc.)
                  </p>
                </div>
              </div>
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                rows={3}
                placeholder="Additional notes about this runtime..."
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm bg-[#FF6A00] text-white rounded-md hover:bg-[#FF6A00]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Runtime
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

type DiagnosticResult = {
  success: boolean
  diagnostics: {
    overall_status: string
    read_only_verified: boolean
    total_duration_ms: number
    phases: Record<string, {
      name: string
      status: string
      duration_ms: number
      details: Record<string, any>
    }>
  }
}

const API_BASE = 'http://localhost:8000/api'

// Mock data for demo - will be replaced with actual API calls
const mockRuntimes: RuntimeConnection[] = [
  {
    id: '1',
    name: 'Production PLC-01',
    runtimeType: 'PLC',
    vendorType: 'rockwell',
    ipAddress: '192.168.1.100',
    port: 44818,
    status: 'online',
    firmwareVersion: 'v32.12',
    runtimeVersion: 'Studio 5000 v33.0',
    lastConnectedAt: new Date(Date.now() - 300000).toISOString(),
    isProduction: true,
    environment: 'production',
    deploymentStatus: 'deployed'
  },
  {
    id: '2',
    name: 'Staging PLC-02',
    runtimeType: 'PLC',
    vendorType: 'rockwell',
    ipAddress: '192.168.1.101',
    port: 44818,
    status: 'disconnected',
    firmwareVersion: 'v32.11',
    lastConnectedAt: new Date(Date.now() - 3600000).toISOString(),
    isProduction: false,
    environment: 'staging'
  },
  {
    id: '3',
    name: 'Dev PLC-03',
    runtimeType: 'PLC',
    vendorType: 'siemens',
    ipAddress: '192.168.1.102',
    port: 102,
    status: 'error',
    lastConnectedAt: new Date(Date.now() - 7200000).toISOString(),
    isProduction: false,
    environment: 'development'
  }
]

export function RuntimeSettings() {
  const [runtimes, setRuntimes] = useState<RuntimeConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, DiagnosticResult>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showApprovals, setShowApprovals] = useState(false)
  
  // Import Defaults Configuration
  const [importDefaults, setImportDefaults] = useState<ImportDefaults>(DEFAULT_IMPORT_SETTINGS)
  const [showImportDefaults, setShowImportDefaults] = useState(false)

  // Delete runtime state
  const [runtimeToDelete, setRuntimeToDelete] = useState<RuntimeConnection | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{type: 'success' | 'error', message: string} | null>(null)

  // Simulate current user - in production, this would come from authentication context
  const currentUser = {
    userId: 'user-123',
    username: 'john.doe',
    role: 'engineer' as const
  }

  // PLC Pull Permissions - based on user role
  const plcPermissions: PLCPullPermissions = getPermissionsForRole(currentUser.role)

  // Simulate RBAC - in production, this would come from authentication context
  const userPermissions = {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true, // Allow delete for testing (in production: check if role is 'admin')
    canTestConnection: true
  }

  useEffect(() => {
    loadRuntimes()
    loadImportDefaultsFromStorage()
  }, [])

  const loadImportDefaultsFromStorage = () => {
    const defaults = getImportDefaults()
    setImportDefaults(defaults)
  }

  const saveImportDefaults = (newDefaults: ImportDefaults) => {
    const success = saveImportDefaultsUtil(newDefaults)
    if (success) {
      setImportDefaults(newDefaults)
      console.log('Import defaults saved successfully')
    }
  }

  const loadRuntimes = async () => {
    setIsLoading(true)
    try {
      // Get session token for authentication
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        console.warn('No session token, using mock runtime data')
        setRuntimes(mockRuntimes)
        return
      }
      
      // Fetch real runtimes from API
      const response = await fetch(`${API_BASE}/runtimes`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setRuntimes(data.runtimes || [])
        console.log('✅ Loaded', data.runtimes?.length || 0, 'runtimes from API')
      } else {
        console.warn('Failed to load runtimes, using mock data')
        setRuntimes(mockRuntimes)
      }
    } catch (error) {
      console.error('Failed to load runtimes:', error)
      // Fallback to mock data
      setRuntimes(mockRuntimes)
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async (runtimeId: string) => {
    setTestingConnectionId(runtimeId)
    try {
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        console.error('No session token available')
        return
      }
      
      const response = await fetch(`${API_BASE}/runtimes/${runtimeId}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        setTestResults(prev => ({ ...prev, [runtimeId]: result }))
        
        // Update runtime status based on test result
        if (result.success) {
          setRuntimes(prev => prev.map(r => 
            r.id === runtimeId 
              ? { ...r, status: 'online' as RuntimeStatus }
              : r
          ))
        } else {
          setRuntimes(prev => prev.map(r => 
            r.id === runtimeId 
              ? { ...r, status: 'error' as RuntimeStatus }
              : r
          ))
        }
      } else {
        console.error('Connection test failed:', await response.text())
        alert('Connection test failed. Check console for details.')
      }
    } catch (error) {
      console.error('Connection test error:', error)
      alert('Connection test failed. Is the backend running?')
    } finally {
      setTestingConnectionId(null)
    }
  }

  const handleDeleteRuntime = async () => {
    if (!runtimeToDelete) return
    
    setIsDeleting(true)
    try {
      const sessionToken = await deviceAuth.getSessionToken()
      
      const response = await fetch(`${API_BASE}/runtimes/${runtimeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Remove runtime from list
        setRuntimes(prev => prev.filter(r => r.id !== runtimeToDelete.id))
        
        // Show success message
        setDeleteResult({
          type: 'success',
          message: `Runtime "${runtimeToDelete.name}" deleted successfully`
        })
        
        console.log('✅ Runtime deleted:', data)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        // Show error message
        setDeleteResult({
          type: 'error',
          message: errorData.error || 'Failed to delete runtime'
        })
        
        console.error('❌ Delete failed:', errorData)
      }
    } catch (error) {
      console.error('❌ Delete runtime error:', error)
      
      // Show error message
      setDeleteResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete runtime. Check connection.'
      })
    } finally {
      setIsDeleting(false)
      setRuntimeToDelete(null)
    }
  }

  const getStatusIcon = (status: RuntimeStatus) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-gray-400" />
      case 'connecting':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'unsupported':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'faulted':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'stopped':
        return <Activity className="w-4 h-4 text-gray-500" />
      case 'maintenance':
        return <Activity className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: RuntimeStatus) => {
    switch (status) {
      case 'online':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
      case 'disconnected':
        return 'bg-gray-50 dark:bg-gray-800/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
      case 'connecting':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
      case 'unsupported':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
      case 'faulted':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700'
      case 'stopped':
        return 'bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
      case 'maintenance':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
    }
  }

  const getVendorIcon = (__vendor: string) => {
    // In a real app, you'd have specific icons for each vendor
    return <Cpu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  if (!userPermissions.canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PLC / Runtimes</h1>
        <Card className="p-8">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm mt-2">You don't have permission to view runtime connections.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PLC / Runtimes</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage PLC runtime connections and test connectivity
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {(plcPermissions.canViewPendingApprovals || plcPermissions.canApproveProductionPull) && (
            <button
              onClick={() => setShowApprovals(!showApprovals)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Shield className="w-4 h-4" />
              {showApprovals ? 'Hide Approvals' : 'Show Approvals'}
            </button>
          )}
          
          {userPermissions.canCreate && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-md hover:bg-[#FF6A00]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Runtime
            </button>
          )}
        </div>
      </div>

      {/* Approval Dashboard */}
      {showApprovals && (
        <ApprovalDashboard 
          permissions={plcPermissions}
          currentUser={currentUser}
        />
      )}

      {/* Import Defaults Configuration */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <CardHeader>Import Defaults</CardHeader>
          <button
            onClick={() => setShowImportDefaults(!showImportDefaults)}
            className="text-sm text-[#FF6A00] hover:text-[#FF6A00]/80 transition-colors"
          >
            {showImportDefaults ? 'Hide' : 'Configure'}
          </button>
        </div>
        
        {showImportDefaults && (
          <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Snapshot Scope */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Snapshot Scope Defaults
              </h3>
              <div className="space-y-2">
                {Object.entries({
                  includePrograms: 'Programs',
                  includeTags: 'Tags',
                  includeDataTypes: 'Data Types (UDTs)',
                  includeRoutines: 'Routines',
                  includeAOIs: 'Add-On Instructions (AOIs)'
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importDefaults.snapshotScope[key as keyof typeof importDefaults.snapshotScope]}
                      onChange={(e) => saveImportDefaults({
                        ...importDefaults,
                        snapshotScope: {
                          ...importDefaults.snapshotScope,
                          [key]: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Conflict Resolution Strategy */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Conflict Resolution Strategy
              </h3>
              <select
                value={importDefaults.conflictResolution}
                onChange={(e) => saveImportDefaults({
                  ...importDefaults,
                  conflictResolution: e.target.value as ImportDefaults['conflictResolution']
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              >
                <option value="ask">Ask me each time (recommended)</option>
                <option value="keep-existing">Always keep existing values</option>
                <option value="use-incoming">Always use incoming values</option>
                <option value="merge">Attempt intelligent merge</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                How to handle conflicts when pulling from PLC
              </p>
            </div>

            {/* Warning Behavior */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Warning Behavior
              </h3>
              <select
                value={importDefaults.warningBehavior}
                onChange={(e) => saveImportDefaults({
                  ...importDefaults,
                  warningBehavior: e.target.value as ImportDefaults['warningBehavior']
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              >
                <option value="show-all">Show all warnings</option>
                <option value="show-critical">Show only critical warnings</option>
                <option value="silent">Silent mode (no warnings)</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Control warning notifications during import
              </p>
            </div>

            {/* Auto Shadow Runtime */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Shadow Runtime
              </h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importDefaults.autoShadowRuntime}
                  onChange={(e) => saveImportDefaults({
                    ...importDefaults,
                    autoShadowRuntime: e.target.checked
                  })}
                  className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Auto-create Shadow Runtime
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Automatically create a shadow runtime mirror when pulling from PLC
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  saveImportDefaults(DEFAULT_IMPORT_SETTINGS)
                  alert('Import defaults reset to factory settings')
                }}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {runtimes.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Runtimes</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {runtimes.filter(r => r.status === 'online').length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Online</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {runtimes.filter(r => r.status === 'error').length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Errors</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {runtimes.filter(r => r.isProduction).length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Production</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Runtime List */}
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Runtime Connections</span>
            <button
              onClick={loadRuntimes}
              disabled={isLoading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#FF6A00] animate-spin" />
          </div>
        ) : runtimes.length === 0 ? (
          <div className="text-center py-12">
            <Cpu className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No runtime connections</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Add a PLC runtime connection to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {runtimes.map((runtime) => (
              <div
                key={runtime.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Vendor Icon */}
                    <div className="mt-1">
                      {getVendorIcon(runtime.vendorType)}
                    </div>

                    {/* Runtime Info */}
                    <div className="flex-1 min-w-0">
                      {/* Runtime Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {runtime.name}
                        </h3>
                        
                        {/* Runtime Status Indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(runtime.status)}`}>
                          {getStatusIcon(runtime.status)}
                          <span className="capitalize">{runtime.status}</span>
                        </div>

                        {/* Production Badge */}
                        {runtime.isProduction && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-800">
                            Production
                          </span>
                        )}
                      </div>

                      {/* Runtime Capability Summary */}
                      <div className="bg-gray-50 dark:bg-gray-800/30 rounded-md p-3 mb-3">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Runtime Capabilities</h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Runtime ID:</span>
                            <span className="font-mono text-gray-900 dark:text-gray-100">{runtime.id.slice(0, 8)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Type:</span>
                            <span className="text-gray-900 dark:text-gray-100">{runtime.runtimeType || 'PLC'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Firmware:</span>
                            <span className="text-gray-900 dark:text-gray-100">{runtime.firmwareVersion || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Runtime Version:</span>
                            <span className="text-gray-900 dark:text-gray-100">{runtime.runtimeVersion || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Operational State:</span>
                            <span className={`font-medium ${
                              runtime.status === 'online' ? 'text-green-600 dark:text-green-400' :
                              runtime.status === 'stopped' ? 'text-gray-600 dark:text-gray-400' :
                              runtime.status === 'faulted' ? 'text-red-600 dark:text-red-400' :
                              'text-yellow-600 dark:text-yellow-400'
                            }`}>
                              {runtime.status === 'online' ? 'Online' : 
                               runtime.status === 'stopped' ? 'Stopped' :
                               runtime.status === 'faulted' ? 'Faulted' : 'Offline'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Transport:</span>
                            <span className="text-gray-900 dark:text-gray-100">{runtime.transport || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Connection Details */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Vendor:</span>
                          <span className="capitalize">{runtime.vendorType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Network:</span>
                          <span className="font-mono">{runtime.ipAddress}:{runtime.port}</span>
                        </div>
                        {runtime.logicalIdentifier && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Logical ID:</span>
                            <span className="font-mono">{runtime.logicalIdentifier}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Environment:</span>
                          <span className="capitalize">{runtime.environment}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                          <span className="font-medium">Last Connected:</span>
                          <span>{formatTimestamp(runtime.lastConnectedAt)}</span>
                        </div>
                      </div>

                      {/* Diagnostics Panel */}
                      {testResults[runtime.id] && (
                        <div className="mt-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 rounded-md border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-3">
                            {testResults[runtime.id].success ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Diagnostics - {testResults[runtime.id].success ? 'Connection Verified' : 'Connection Failed'}
                            </span>
                          </div>
                          
                          {/* Core Diagnostics */}
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            {/* Latency */}
                            <div className="bg-white dark:bg-gray-900/40 rounded p-2 border border-gray-200 dark:border-gray-700">
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Latency</div>
                              <div className={`text-lg font-bold ${
                                testResults[runtime.id].diagnostics.total_duration_ms < 100 ? 'text-green-600 dark:text-green-400' :
                                testResults[runtime.id].diagnostics.total_duration_ms < 500 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                              }`}>
                                {testResults[runtime.id].diagnostics.total_duration_ms}ms
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                {testResults[runtime.id].diagnostics.total_duration_ms < 100 ? 'Excellent' :
                                 testResults[runtime.id].diagnostics.total_duration_ms < 500 ? 'Good' : 'High'}
                              </div>
                            </div>
                            
                            {/* Data Access Permissions */}
                            <div className="bg-white dark:bg-gray-900/40 rounded p-2 border border-gray-200 dark:border-gray-700">
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Permissions</div>
                              <div className={`text-sm font-semibold ${
                                testResults[runtime.id].diagnostics.read_only_verified ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {testResults[runtime.id].diagnostics.read_only_verified ? '✓ Read Access' : '✗ No Access'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                {testResults[runtime.id].diagnostics.read_only_verified ? 'Verified' : 'Check Credentials'}
                              </div>
                            </div>
                            
                            {/* Read Capability */}
                            <div className="bg-white dark:bg-gray-900/40 rounded p-2 border border-gray-200 dark:border-gray-700">
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Read Capability</div>
                              <div className={`text-sm font-semibold ${
                                testResults[runtime.id].diagnostics.overall_status === 'operational' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                              }`}>
                                {testResults[runtime.id].diagnostics.overall_status === 'operational' ? '✓ Confirmed' : '⚠ Limited'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                                {testResults[runtime.id].diagnostics.overall_status}
                              </div>
                            </div>
                          </div>
                          
                          {/* Test Phases */}
                          <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Connection Test Phases</div>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(testResults[runtime.id].diagnostics.phases).map(([key, phase]) => (
                                <span
                                  key={key}
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    phase.status === 'passed'
                                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800'
                                      : phase.status === 'warning'
                                      ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-800'
                                      : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                                  }`}
                                  title={`${phase.name}: ${phase.duration_ms}ms - ${(phase as any).message || 'OK'}`}
                                >
                                  {phase.status === 'passed' ? '✓' : phase.status === 'warning' ? '⚠' : '✗'} {phase.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {userPermissions.canTestConnection && (
                      <button
                        onClick={() => testConnection(runtime.id)}
                        disabled={testingConnectionId === runtime.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Test Connection"
                      >
                        {testingConnectionId === runtime.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Test
                          </>
                        )}
                      </button>
                    )}

                    {userPermissions.canDelete && (
                      <button
                        className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        title="Delete Runtime"
                        onClick={() => setRuntimeToDelete(runtime)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Runtime Dialog */}
      {showAddDialog && (
        <AddRuntimeDialog
          onClose={() => setShowAddDialog(false)}
          onAdd={async (runtime) => {
            // Add the new runtime to the list
            setRuntimes(prev => [...prev, runtime])
            setShowAddDialog(false)
            // Success message is already shown in the modal before it closes
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={runtimeToDelete !== null}
        onClose={() => setRuntimeToDelete(null)}
        onConfirm={handleDeleteRuntime}
        title="Delete Runtime"
        message={`Are you sure you want to delete runtime "${runtimeToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
        isLoading={isDeleting}
      />

      {/* Delete Result Dialog */}
      <Dialog
        isOpen={deleteResult !== null}
        onClose={() => setDeleteResult(null)}
        title={deleteResult?.type === 'success' ? 'Success' : 'Error'}
        message={deleteResult?.message || ''}
        type={deleteResult?.type === 'success' ? 'success' : 'error'}
        actions={[
          {
            label: 'OK',
            onClick: () => setDeleteResult(null),
            variant: 'primary'
          }
        ]}
      />
    </div>
  )
}
