import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Shield, 
  Building, 
  X,
  Key,
  AlertCircle,
  CheckCircle2,
  Eye,
  Settings
} from 'lucide-react'
import { Card } from '../components/Card'
import { deviceAuth } from '../utils/deviceAuth'
import { useLicenseStore } from '../store/licenseStore'

interface TeamsSeat {
  bindingId: string
  deviceId: string
  deviceName?: string
  ownerEmail: string
  role: string
  bindingStatus: string
  boundAt: string
}

interface LicenseConfig {
  licenseId: string
  licenseType: string
  organizationName: string
  ownerEmail: string
  maxSeats: number
  usedSeats: number
  invitedSeats: number
  availableSeats: number
  expiresAt: string
  isActive: boolean
  approvalPolicies: any
  rbacDefaults: any
  orgIdentityConfig: any
  orgLicenseKey?: string
}

interface TeamsLicenseManagementProps {
  isOpen: boolean
  onClose: () => void
}

export function TeamsLicenseManagement({ isOpen, onClose }: TeamsLicenseManagementProps) {
  const [config, setConfig] = useState<LicenseConfig | null>(null)
  const [_seats, setSeats] = useState<TeamsSeat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddSeatModal, setShowAddSeatModal] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<{ bindingId: string; email: string } | null>(null)
  const [statusModal, setStatusModal] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'seats' | 'config'>('config')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const { licenseInfo } = useLicenseStore()
  
  // Configuration states
  const [approvalPolicies, setApprovalPolicies] = useState({
    twoPersonApproval: false,
    deployRestrictions: false,
    rollbackRequiresApproval: false
  })
  
  const [rbacDefaults, setRbacDefaults] = useState({
    defaultRole: 'Viewer',
    adminCanOverride: false,
    inheritPermissions: false
  })
  
  const [orgIdentity, setOrgIdentity] = useState({
    orgName: '',
    maxSeats: 20,
    enableLocalAuth: false
  })

  useEffect(() => {
    if (isOpen) {
      loadLicenseData()
    }
  }, [isOpen])

  const loadLicenseData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Use data from license store (already loaded from license status API)
      if (!licenseInfo) {
        throw new Error('No license information available. Please activate a Teams license first.')
      }

      console.log('📋 Using license info from store:', licenseInfo)
      const licenseData = licenseInfo as any // Type assertion for extended properties
      
      // Check if this is a Teams license
      if (licenseData.licenseType !== 'teams' && licenseData.licenseType !== 'enterprise') {
        throw new Error('This device is not using a Teams or Enterprise license. Please activate a Teams license to access this feature.')
      }
      
      console.log('📋 Configuration:', licenseData.configuration)
      
      // Load configuration if available
      if (licenseData.configuration) {
        if (licenseData.configuration.approvalPolicies) {
          // Map backend format to frontend format
          const backendPolicies = licenseData.configuration.approvalPolicies
          setApprovalPolicies({
            twoPersonApproval: backendPolicies.requireTwoPersonApproval || false,
            deployRestrictions: backendPolicies.deployRestrictions?.production?.requireApproval || false,
            rollbackRequiresApproval: backendPolicies.rollbackRequiresApproval || false
          })
        }
        if (licenseData.configuration.rbacDefaults) {
          setRbacDefaults(licenseData.configuration.rbacDefaults)
        }
        if (licenseData.configuration.orgIdentity) {
          setOrgIdentity(licenseData.configuration.orgIdentity)
        }
      }

      // Map license store data to config format
      const mappedConfig: LicenseConfig = {
        licenseId: licenseData.licenseId,
        licenseType: licenseData.licenseType,
        // Use organizationName from configuration if available, otherwise use top-level or default
        organizationName: licenseData.configuration?.organizationName || licenseData.organizationName || 'Unknown',
        ownerEmail: licenseData.ownerEmail || '',
        // Use maxSeats from configuration if available, otherwise from limits
        maxSeats: licenseData.configuration?.maxSeats || licenseData.limits?.max_seats || 20,
        usedSeats: 0, // Will be calculated from seats
        invitedSeats: 0, // Will be calculated from seats
        availableSeats: 0, // Will be calculated from seats
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Default 1 year
        isActive: true,
        approvalPolicies: licenseData.configuration?.approvalPolicies || null,
        rbacDefaults: licenseData.configuration?.rbacDefaults || null,
        orgIdentityConfig: licenseData.configuration?.orgIdentity || null,
        orgLicenseKey: licenseData.configuration?.orgLicenseKey || undefined // Get from configuration
      }

      // Get seat information
      const sessionToken = await deviceAuth.getSessionToken()
      if (!sessionToken) {
        throw new Error('No session token available')
      }

      const seatsResponse = await fetch('/api/device/license/teams/seats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include'
      })

      if (!seatsResponse.ok) {
        throw new Error('Failed to load seat information')
      }

      const seatsData = await seatsResponse.json()
      const seats = seatsData.seats || []

      // Calculate used seats (only active seats)
      const usedSeats = seats.filter((s: TeamsSeat) => s.bindingStatus === 'active').length
      const invitedSeats = seats.filter((s: TeamsSeat) => s.bindingStatus === 'invited').length
      mappedConfig.usedSeats = usedSeats
      mappedConfig.invitedSeats = invitedSeats
      mappedConfig.availableSeats = mappedConfig.maxSeats - usedSeats - invitedSeats

      // Get org license key from backend if available
      try {
        const configResponse = await fetch('/api/device/license/teams/config', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          },
          credentials: 'include'
        })

        if (configResponse.ok) {
          const configData = await configResponse.json()
          mappedConfig.orgLicenseKey = configData.config?.orgLicenseKey
        }
      } catch (err) {
        console.warn('Could not fetch org license key:', err)
      }

      setConfig(mappedConfig)
      setSeats(seats)
    } catch (err: any) {
      setError(err.message || 'Failed to load license data')
      console.error('Error loading license data:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleSaveConfiguration = async () => {
    setIsSavingConfig(true)
    
    try {
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        throw new Error('No session token available. Please refresh and try again.')
      }

      // Save configuration to backend
      const response = await fetch('/api/device/license/teams/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          approvalPolicies,
          rbacDefaults,
          orgIdentity
        })
      })

      const data = await response.json()

      if (data.success) {
        setStatusModal({ type: 'success', message: 'Configuration saved successfully!' })
        // Refresh license status to get updated configuration
        await useLicenseStore.getState().checkLicenseStatus()
        // Reload to get updated config and seats
        await loadLicenseData()
      } else {
        const errorMessage = data.error || 'Failed to save configuration'
        if (errorMessage.includes('not bound')) {
          setStatusModal({ 
            type: 'error', 
            message: 'This device is not bound to a Teams license. Please activate a Teams license first from the Profile page.' 
          })
        } else {
          setStatusModal({ type: 'error', message: errorMessage })
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to save configuration'
      if (errorMessage.includes('not bound')) {
        setStatusModal({ 
          type: 'error', 
          message: 'This device is not bound to a Teams license. Please activate a Teams license first from the Profile page.' 
        })
      } else {
        setStatusModal({ type: 'error', message: errorMessage })
      }
    } finally {
      setIsSavingConfig(false)
    }
  }

  const confirmRemoveSeat = async () => {
    if (!confirmRemove) return

    const { bindingId, email } = confirmRemove
    setConfirmRemove(null)

    try {
      const sessionToken = await deviceAuth.getSessionToken()
      if (!sessionToken) {
        setStatusModal({ type: 'error', message: 'No session token available. Please log in again.' })
        return
      }

      console.log('🗑️ Removing seat:', { bindingId, email })

      const response = await fetch('/api/device/license/teams/remove-seat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({ bindingId })
      })

      console.log('📡 Remove seat response status:', response.status)

      const data = await response.json()
      console.log('📡 Remove seat response data:', data)

      if (!response.ok) {
        setStatusModal({ type: 'error', message: data.error || `Failed to remove seat (HTTP ${response.status})` })
        return
      }

      if (data.success) {
        console.log('✅ Seat removed successfully, reloading data...')
        await loadLicenseData()
        setStatusModal({ type: 'success', message: `Seat for ${email} removed successfully` })
      } else {
        setStatusModal({ type: 'error', message: data.error || 'Failed to remove seat' })
      }
    } catch (err: any) {
      console.error('❌ Error removing seat:', err)
      setStatusModal({ type: 'error', message: err.message || 'Failed to remove seat' })
    }
  }

  if (!isOpen) return null

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading license configuration...</p>
        </div>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4 text-center">{error || 'Failed to load license'}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={loadLicenseData}
              className="flex-1 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6A00] to-[#E55A00] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Teams License Management</h1>
              <p className="text-orange-100 mt-1">Manage your organization's license and seats</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-[#FF6A00] text-[#FF6A00]'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Eye size={16} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-[#FF6A00] text-[#FF6A00]'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Settings size={16} />
              Configuration
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Organization License Key */}
      {config.orgLicenseKey && (
        <Card>
          <div className="p-6 bg-gradient-to-r from-[#FF6A00]/10 to-[#E55A00]/10 dark:from-[#FF6A00]/5 dark:to-[#E55A00]/5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="text-[#FF6A00]" size={20} />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Organization License Key</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Share this key with team members to let them join your organization automatically
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm text-gray-900 dark:text-white">
                    {config.orgLicenseKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(config.orgLicenseKey!)
                      setStatusModal({ type: 'success', message: 'Organization license key copied to clipboard!' })
                    }}
                    className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* License Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Building className="text-blue-500" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{config.organizationName}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Organization</div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Key className="text-green-500" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{config.licenseType}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">License Type</div>
          </div>
        </Card>

        {/* <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="text-purple-500" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {config.usedSeats} / {config.maxSeats}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Seats</div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="text-yellow-500" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{config.invitedSeats}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Invited Seats</div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="text-green-500" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{config.availableSeats}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Available Seats</div>
          </div>
        </Card> */}
      </div>

      {/* Seat Management */}
      {/* <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={20} />
                Team Seats
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage active and invited users with access to your license
              </p>
            </div>
            <button
              onClick={() => setShowAddSeatModal(true)}
              disabled={config.availableSeats === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus size={16} />
              Add Seat
            </button>
          </div>

          {seats.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No seats assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {seats.map((seat) => (
                <div
                  key={seat.bindingId}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {seat.ownerEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{seat.ownerEmail}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {seat.bindingStatus === 'active' 
                          ? `Joined ${new Date(seat.boundAt).toLocaleDateString()}`
                          : seat.bindingStatus === 'invited'
                          ? `Invited ${new Date(seat.boundAt).toLocaleDateString()}`
                          : seat.bindingStatus === 'revoked'
                          ? 'Access Revoked'
                          : 'Unknown Status'
                        }
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(seat.role)}`}>
                      {getRoleIcon(seat.role)}
                      {seat.role}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      seat.bindingStatus === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                        : seat.bindingStatus === 'invited'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {seat.bindingStatus === 'invited' ? 'Pending' : seat.bindingStatus}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSeat(seat.bindingId, seat.ownerEmail)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Remove seat"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card> */}

      {/* Configuration Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approval Policies */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-green-600" size={20} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Approval Policies</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Two-Person Approval</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  approvalPolicies.twoPersonApproval
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {approvalPolicies.twoPersonApproval ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Deploy Restrictions</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  approvalPolicies.deployRestrictions
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {approvalPolicies.deployRestrictions ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Rollback Requires Approval</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  approvalPolicies.rollbackRequiresApproval
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {approvalPolicies.rollbackRequiresApproval ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* RBAC Settings */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-blue-600" size={20} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">RBAC Settings</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Default Role for New Users</span>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  {rbacDefaults.defaultRole}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Admin Can Override</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  rbacDefaults.adminCanOverride
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {rbacDefaults.adminCanOverride ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Inherit Permissions</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  rbacDefaults.inheritPermissions
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {rbacDefaults.inheritPermissions ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Organization Settings */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="text-purple-600" size={20} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Organization</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Organization</span>
                <div className="font-medium text-gray-900 dark:text-white mt-1">{config.organizationName}</div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Expires</span>
                <div className="font-medium text-gray-900 dark:text-white mt-1">
                  {new Date(config.expiresAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
            </>
          )}
          
          {/* Configuration Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Configure organization-wide settings for approval policies, RBAC defaults, and identity management.
                </p>
              </div>
              
              {/* Approval Policies */}
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="text-green-600" size={24} />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Approval Policies</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Configure approval requirements for critical operations
                  </p>
                  
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvalPolicies.twoPersonApproval}
                        onChange={(e) =>
                          setApprovalPolicies({ ...approvalPolicies, twoPersonApproval: e.target.checked })
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Two-Person Approval Rule
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Require approval from two different users for critical actions
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvalPolicies.deployRestrictions}
                        onChange={(e) =>
                          setApprovalPolicies({ ...approvalPolicies, deployRestrictions: e.target.checked })
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Deploy Restrictions
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Restrict deployments to approved users only
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvalPolicies.rollbackRequiresApproval}
                        onChange={(e) =>
                          setApprovalPolicies({
                            ...approvalPolicies,
                            rollbackRequiresApproval: e.target.checked
                          })
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Rollback Requires Approval
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Version rollbacks require additional approval
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </Card>
              
              {/* RBAC Defaults */}
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="text-blue-600" size={24} />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">RBAC Defaults</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Set up role-based access control defaults
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default Role for New Users
                      </label>
                      <select
                        value={rbacDefaults.defaultRole}
                        onChange={(e) => setRbacDefaults({ ...rbacDefaults, defaultRole: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="Viewer">Viewer (Read-only access)</option>
                        <option value="Editor">Editor (Can edit projects)</option>
                        <option value="Approver">Approver (Can approve changes)</option>
                        <option value="Admin">Admin (Full access)</option>
                      </select>
                    </div>

                    <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rbacDefaults.adminCanOverride}
                        onChange={(e) =>
                          setRbacDefaults({ ...rbacDefaults, adminCanOverride: e.target.checked })
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Admin Can Override Restrictions
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Allow administrators to bypass approval policies when necessary
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rbacDefaults.inheritPermissions}
                        onChange={(e) =>
                          setRbacDefaults({ ...rbacDefaults, inheritPermissions: e.target.checked })
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Inherit Permissions from Organization
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          New users inherit base permissions from organization settings
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </Card>
              
              {/* Organization Identity */}
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Building className="text-purple-600" size={24} />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Organization Identity</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Set up organization identity and authentication settings
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={orgIdentity.orgName}
                        onChange={(e) => setOrgIdentity({ ...orgIdentity, orgName: e.target.value })}
                        placeholder="Your Company Name"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Maximum Seats
                      </label>
                      <input
                        type="number"
                        value={orgIdentity.maxSeats}
                        onChange={(e) =>
                          setOrgIdentity({ ...orgIdentity, maxSeats: parseInt(e.target.value) || 20 })
                        }
                        min="1"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Number of devices that can be added to this organization (1-100)
                      </p>
                    </div>


                  </div>
                </div>
              </Card>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveConfiguration}
                  disabled={isSavingConfig}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF6A00] to-[#E55A00] text-white rounded-lg font-medium hover:from-[#E55A00] hover:to-[#D54A00] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingConfig ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Settings size={20} />
                      </motion.div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add Seat Modal */}
        {showAddSeatModal && (
          <AddSeatModal
            onClose={() => setShowAddSeatModal(false)}
            onSuccess={() => {
              setShowAddSeatModal(false)
              loadLicenseData()
            }}
            availableSeats={config.availableSeats}
          />
        )}

        {/* Confirmation Modal */}
        {confirmRemove && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10001] p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Remove Seat</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Are you sure you want to remove the seat for <span className="font-semibold text-gray-900 dark:text-white">{confirmRemove.email}</span>? 
                  This will immediately revoke their access to the application.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmRemove(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRemoveSeat}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Remove Seat
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Status Modal */}
        {statusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10001] p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    statusModal.type === 'success' 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {statusModal.type === 'success' ? (
                      <CheckCircle2 className="text-green-600 dark:text-green-400" size={24} />
                    ) : (
                      <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {statusModal.type === 'success' ? 'Success' : 'Error'}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {statusModal.message}
                </p>
                <button
                  onClick={() => setStatusModal(null)}
                  className="w-full px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

interface AddSeatModalProps {
  onClose: () => void
  onSuccess: () => void
  availableSeats: number
}

function AddSeatModal({ onClose, onSuccess, availableSeats }: AddSeatModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Viewer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const sessionToken = await deviceAuth.getSessionToken()
      const response = await fetch('/api/device/license/teams/add-seat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          role
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess()
      } else {
        setError(data.error || 'Failed to add seat')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add seat')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add New Seat</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Viewer">Viewer (Read-only)</option>
                <option value="Editor">Editor (Can edit)</option>
                <option value="Deployer">Deployer (Can deploy)</option>
                <option value="Approver">Approver (Can approve)</option>
                <option value="Admin">Admin (Full access)</option>
              </select>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              Available seats: {availableSeats}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || availableSeats === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add Seat'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
