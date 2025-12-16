import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Shield, 
  Users, 
  Settings, 
  CheckCircle,
  Building,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  Laptop
} from 'lucide-react'
import { useLicenseStore } from '../store/licenseStore'

interface EnterpriseManagementModalProps {
  isOpen: boolean
  onClose: () => void
}

interface EnterpriseLicenseData {
  licenseKey: string
  orgName: string
  adminEmail: string
  maxSeats: number
  usedSeats: number
  securityPolicies: any
  rbacConfig: any
  requiresApproval: boolean
  auditEnabled: boolean
  isActive: boolean
  expiresAt: string
}

interface DeviceSeat {
  deviceId: string
  deviceName: string
  userEmail: string
  role: string
  isAdmin: boolean
  claimedAt: string
  seatStatus: string
}

export function EnterpriseManagementModal({ isOpen, onClose }: EnterpriseManagementModalProps) {
  const [licenseData, setLicenseData] = useState<EnterpriseLicenseData | null>(null)
  const [devices, setDevices] = useState<DeviceSeat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [showLicenseKey, setShowLicenseKey] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'configure'>('overview')
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const { licenseInfo } = useLicenseStore()
  
  // Configuration states
  const [securityPolicies, setSecurityPolicies] = useState({
    twoPersonApproval: false,
    rollbackRequiresApproval: false
  })
  
  const [approverGroups, setApproverGroups] = useState({
    defaultRole: 'Viewer',
    adminCanOverride: false,
    inheritPermissions: false
  })
  
  const [deployGovernance, setDeployGovernance] = useState({
    deployRestrictions: false
  })

  useEffect(() => {
    if (isOpen && licenseInfo) {
      loadEnterpriseData()
    }
  }, [isOpen, licenseInfo])

  const loadEnterpriseData = async () => {
    try {
      setIsLoading(true)
      
      // Extract data from license store
      const license = licenseInfo as any
      const licenseKey = license.licenseKey || ''
      
      // Fetch full license details from backend
      const response = await fetch('/api/license/enterprise/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      })
      
      if (response.ok) {
        const data = await response.json()
        
        console.log('📥 Loaded enterprise data:', data)
        console.log('📊 RBAC Config from server:', data.rbacConfig)
        
        setLicenseData({
          licenseKey: data.licenseKey || licenseKey,
          orgName: data.orgName || license.organizationName || 'Enterprise Organization',
          adminEmail: data.adminEmail || license.ownerEmail || '',
          maxSeats: data.maxSeats || license.limits?.max_seats || 50,
          usedSeats: data.usedSeats || 1,
          securityPolicies: data.securityPolicies || license.configuration?.securityPolicies || {},
          rbacConfig: data.rbacConfig || license.configuration?.rbacConfig || {},
          requiresApproval: data.requiresApproval ?? license.configuration?.requiresApproval ?? false,
          auditEnabled: data.auditEnabled ?? license.configuration?.auditEnabled ?? false,
          isActive: data.isActive ?? true,
          expiresAt: data.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        })
        
        // Initialize configuration states
        if (data.securityPolicies) {
          console.log('🔒 Loading security policies:', data.securityPolicies)
          setSecurityPolicies({
            twoPersonApproval: data.securityPolicies.twoPersonApproval || false,
            rollbackRequiresApproval: data.securityPolicies.rollbackRequiresApproval || false
          })
        }
        
        if (data.rbacConfig) {
          console.log('👥 Loading RBAC config:', data.rbacConfig)
          console.log('📋 ApproverGroups from rbacConfig:', data.rbacConfig.approverGroups)
          
          // Check if approverGroups is nested or at top level
          const approverGroupsData = data.rbacConfig.approverGroups || data.rbacConfig
          
          setApproverGroups({
            defaultRole: approverGroupsData.defaultRole || 'Viewer',
            adminCanOverride: approverGroupsData.adminCanOverride || false,
            inheritPermissions: approverGroupsData.inheritPermissions || false
          })
          
          console.log('✅ Set approverGroups state:', {
            defaultRole: approverGroupsData.defaultRole || 'Viewer',
            adminCanOverride: approverGroupsData.adminCanOverride || false,
            inheritPermissions: approverGroupsData.inheritPermissions || false
          })
        }
        
        if (data.rbacConfig?.deployGovernance) {
          console.log('🚀 Loading deploy governance:', data.rbacConfig.deployGovernance)
          setDeployGovernance({
            deployRestrictions: data.rbacConfig.deployGovernance.deployRestrictions || false
          })
        }

        // Fetch device seats
        const devicesResponse = await fetch('/api/license/enterprise/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey })
        })
        
        if (devicesResponse.ok) {
          const devicesData = await devicesResponse.json()
          setDevices(devicesData.devices || [])
        }
      } else {
        // Fallback to license store data
        setLicenseData({
          licenseKey: licenseKey,
          orgName: license.organizationName || 'Enterprise Organization',
          adminEmail: license.ownerEmail || '',
          maxSeats: license.limits?.max_seats || 50,
          usedSeats: 1,
          securityPolicies: license.configuration?.securityPolicies || {},
          rbacConfig: license.configuration?.rbacConfig || {},
          requiresApproval: license.configuration?.requiresApproval || false,
          auditEnabled: license.configuration?.auditEnabled || false,
          isActive: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        })
        
        setDevices([{
          deviceId: license.deviceId || 'unknown',
          deviceName: 'Current Device',
          userEmail: license.ownerEmail || '',
          role: license.role || 'admin',
          isAdmin: license.isAdmin ?? true,
          claimedAt: new Date().toISOString(),
          seatStatus: 'active'
        }])
      }

    } catch (error) {
      console.error('Error loading Enterprise data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveConfiguration = async () => {
    setIsSavingConfig(true)
    try {
      console.log('💾 Saving configuration:', {
        securityPolicies,
        approverGroups,
        deployGovernance
      })
      
      const response = await fetch('/api/license/enterprise/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: licenseData?.licenseKey,
          globalSecurityPolicies: securityPolicies,
          approverGroups,
          deployGovernance
        })
      })
      
      if (response.ok) {
        setShowSuccessNotification(true)
        setTimeout(() => setShowSuccessNotification(false), 3000)
        await loadEnterpriseData()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Failed to save configuration: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('Error saving configuration:', error)
      alert(`Failed to save configuration: ${error.message || 'Network error'}`)
    } finally {
      setIsSavingConfig(false)
    }
  }
  
  const maskLicenseKey = (key: string) => {
    if (!key) return '****-****-****-****-****'
    const parts = key.split('-')
    return parts.map((part, i) => i < parts.length - 1 ? '****' : part).join('-')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF6A00] to-[#E55A00] p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Building size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Enterprise License Management</h2>
                  <p className="text-purple-100 text-sm mt-1">
                    Configure your organization's governance and security policies
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mt-6 border-t border-white/20 pt-4">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-white text-[#FF6A00]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Shield size={16} />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-white text-[#FF6A00]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Users size={16} />
                Users & Devices
              </button>
              <button
                onClick={() => setActiveTab('configure')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'configure'
                    ? 'bg-white text-[#FF6A00]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Settings size={16} />
                Configuration
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-[#FF6A00]" size={32} />
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && licenseData && (
                  <div className="space-y-6">
                    {/* License Info Card */}
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                          <Crown className="text-white" size={32} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Enterprise License</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{licenseData.orgName}</p>
                        </div>
                        <div className="ml-auto">
                          <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold flex items-center gap-2">
                            <CheckCircle size={18} />
                            Active
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">License Key</div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-gray-900 dark:text-gray-100">
                              {showLicenseKey ? licenseData.licenseKey : maskLicenseKey(licenseData.licenseKey)}
                            </code>
                            <button
                              onClick={() => setShowLicenseKey(!showLicenseKey)}
                              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              {showLicenseKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Admin Email</div>
                          <div className="text-gray-900 dark:text-gray-100">{licenseData.adminEmail}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Seat Usage</div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {licenseData.usedSeats} / {licenseData.maxSeats}
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                            <div
                              className="bg-gradient-to-r from-[#FF6A00] to-[#E55A00] h-2 rounded-full transition-all"
                              style={{ width: `${(licenseData.usedSeats / licenseData.maxSeats) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expires</div>
                          <div className="text-gray-900 dark:text-gray-100">
                            {new Date(licenseData.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Current Configuration Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Current Configuration</h3>
                      
                      {/* Security Policies */}
                      <div className="mb-6">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                          <Shield size={18} className="text-green-600" />
                          Security Policies
                        </h4>
                        <div className="space-y-2 ml-7">
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Two-Person Approval Rule</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              licenseData.securityPolicies?.twoPersonApproval
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {licenseData.securityPolicies?.twoPersonApproval ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Rollback Requires Approval</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              licenseData.securityPolicies?.rollbackRequiresApproval
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {licenseData.securityPolicies?.rollbackRequiresApproval ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Audit Logging</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              licenseData.auditEnabled
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {licenseData.auditEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* RBAC Configuration */}
                      <div className="mb-6">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                          <Users size={18} className="text-blue-600" />
                          Role-Based Access Control
                        </h4>
                        <div className="space-y-2 ml-7">
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Default Role for New Users</span>
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                              {licenseData.rbacConfig?.approverGroups?.defaultRole || licenseData.rbacConfig?.defaultRole || 'Viewer'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Admin Can Override</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              (licenseData.rbacConfig?.approverGroups?.adminCanOverride ?? licenseData.rbacConfig?.adminCanOverride)
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {(licenseData.rbacConfig?.approverGroups?.adminCanOverride ?? licenseData.rbacConfig?.adminCanOverride) ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Inherit Permissions</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              (licenseData.rbacConfig?.approverGroups?.inheritPermissions ?? licenseData.rbacConfig?.inheritPermissions)
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {(licenseData.rbacConfig?.approverGroups?.inheritPermissions ?? licenseData.rbacConfig?.inheritPermissions) ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Deployment Governance */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                          <Settings size={18} className="text-purple-600" />
                          Deployment Governance
                        </h4>
                        <div className="space-y-2 ml-7">
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Deploy Restrictions</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              licenseData.rbacConfig?.deployGovernance?.deployRestrictions
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {licenseData.rbacConfig?.deployGovernance?.deployRestrictions ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Requires Approval</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              licenseData.requiresApproval
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {licenseData.requiresApproval ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Users & Devices Tab */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Active Devices</h3>
                      {devices.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Users size={48} className="mx-auto mb-2 opacity-50" />
                          <p>No devices registered yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {devices.map((device, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                                  <Laptop className="text-white" size={20} />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{device.deviceName}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">{device.userEmail}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                                  {device.role}
                                </span>
                                {device.isAdmin && (
                                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                                    Admin
                                  </span>
                                )}
                                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium capitalize">
                                  {device.seatStatus}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Configuration Tab */}
                {activeTab === 'configure' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Configure organization-wide settings for approval policies, security governance, and deployment controls.
                      </p>
                    </div>

                {/* Configure Global Security Policies */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Shield className="text-green-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configure Global Security Policies</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Set up approval requirements and security controls for critical operations
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={securityPolicies.twoPersonApproval}
                        onChange={(e) =>
                          setSecurityPolicies({ ...securityPolicies, twoPersonApproval: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Two-Person Approval Rule
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Require approval from two different users for critical actions
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={securityPolicies.rollbackRequiresApproval}
                        onChange={(e) =>
                          setSecurityPolicies({
                            ...securityPolicies,
                            rollbackRequiresApproval: e.target.checked
                          })
                        }
                        className="mt-1 w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Rollback Requires Approval
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Version rollbacks require additional approval before execution
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Configure Approver Groups */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Users className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configure Approver Groups</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Set up role-based access control and default permissions for new users
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default Role for New Users
                      </label>
                      <select
                        value={approverGroups.defaultRole}
                        onChange={(e) => setApproverGroups({ ...approverGroups, defaultRole: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="Viewer">Viewer (Read-only access)</option>
                        <option value="Editor">Editor (Can edit projects)</option>
                        <option value="Approver">Approver (Can approve changes)</option>
                        <option value="Admin">Admin (Full access)</option>
                      </select>
                    </div>

                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={approverGroups.adminCanOverride}
                        onChange={(e) =>
                          setApproverGroups({ ...approverGroups, adminCanOverride: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Admin Can Override Restrictions
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Allow administrators to bypass approval policies when necessary
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={approverGroups.inheritPermissions}
                        onChange={(e) =>
                          setApproverGroups({ ...approverGroups, inheritPermissions: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Inherit Permissions from Organization
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          New users inherit base permissions from organization settings
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Configure Deploy Governance */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Settings className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configure Deploy Governance</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Control deployment restrictions and approval workflows
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={deployGovernance.deployRestrictions}
                        onChange={(e) =>
                          setDeployGovernance({ ...deployGovernance, deployRestrictions: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Deploy Restrictions
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Restrict deployments to approved users only
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
                
                {/* Save Configuration Button */}
                <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleSaveConfiguration}
                    disabled={isSavingConfig}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#FF6A00] to-[#E55A00] text-white rounded-lg font-semibold hover:from-[#E55A00] hover:to-[#D54A00] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingConfig ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Saving Configuration...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={20} />
                        Save Configuration
                      </>
                    )}
                  </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>

        {/* Success Notification */}
        <AnimatePresence>
          {showSuccessNotification && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 right-4 z-[60] bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3"
            >
              <CheckCircle size={24} />
              <div>
                <div className="font-semibold">Configuration Saved!</div>
                <div className="text-sm text-green-100">Your enterprise settings have been updated successfully.</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  )
}

export default EnterpriseManagementModal
