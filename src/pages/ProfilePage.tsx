import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Users, 
  Building, 
  Edit2, 
  X, 
  Check, 
  Settings, 
  Monitor, 
  Laptop, 
  Smartphone,
  FolderOpen,
  Key,
  AlertCircle
} from 'lucide-react'
import { Card } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { useProjectStore } from '../store/projectStore'
import { LicenseTypeSelectionModal } from '../components/LicenseTypeSelectionModal'
import { LicenseActivationModal } from '../components/LicenseActivationModal'
import { TeamsLicenseModal } from '../components/TeamsLicenseModal'
import { EnterpriseLicenseModal } from '../components/EnterpriseLicenseModal'
import { TeamsEnterpriseConfigModal } from '../components/TeamsEnterpriseConfigModal'
import { TeamsLicenseManagement } from './TeamsLicenseManagement'
import { EnterpriseManagementModal } from '../components/EnterpriseManagementModal'
import { useLicenseStore } from '../store/licenseStore'
import deviceAuth from '../utils/deviceAuth'
import { useTheme } from '../context/ThemeContext'

interface DeviceProfile {
  device: {
    deviceId: string
    deviceName: string
    deviceType: string
    osType: string
    osVersion: string
    hardwareInfo: {
      arch: string
      cpus: number
      platform: string
      totalMemory: number
    }
  }
  user?: {
    userId: number
    username: string
    displayName: string
    role: string
    isPrimary: boolean
    is_active: number
    created_at: string
    updated_at: string
    first_login: number
    last_activity: number
  }
  profileType?: 'Solo' | 'Team' | 'Enterprise'  // Optional - only set when license is activated
  workspacePresets: {
    defaultProject: string
    theme: string
    autoSave: boolean
    notifications: boolean
  }
}

export const ProfilePage = () => {
  const [profile, setProfile] = useState<DeviceProfile | null>(null)
  const [editedProfile, setEditedProfile] = useState<DeviceProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showTeamOnboarding, setShowTeamOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  
  // License activation state
  const [showLicenseTypeModal, setShowLicenseTypeModal] = useState(false)
  const [showSoloActivationModal, setShowSoloActivationModal] = useState(false)
  const [showTeamsActivationModal, setShowTeamsActivationModal] = useState(false)
  const [showEnterpriseActivationModal, setShowEnterpriseActivationModal] = useState(false)
  const [showTeamsConfigModal, setShowTeamsConfigModal] = useState(false)
  const [showTeamsManagementModal, setShowTeamsManagementModal] = useState(false)
  const [showEnterpriseManagementModal, setShowEnterpriseManagementModal] = useState(false)
  
  const { hasValidLicense, checkLicenseStatus } = useLicenseStore()
  
  const [teamSettings, setTeamSettings] = useState({
    license: {
      key: '',
      activated: false,
      companyName: '',
      totalSeats: 0,
      expiration: '',
      isValid: false
    },
    seats: {
      total: 0,
      assigned: [] as Array<{id: number; username: string; role: string; status: string}>,
      remaining: 0,
      currentUserAssigned: false
    },
    device: {
      name: '',
      osUser: '',
      tpmKeyPair: false,
      deviceCert: false,
      deviceFingerprint: false,
      certified: false
    },
    roles: {
      osUsers: [] as string[],
      mappings: {} as Record<string, string>,
      availableRoles: ['Viewer', 'Editor', 'Approver', 'Admin']
    },
    approvalPolicy: {
      enabled: false,
      minApprovers: 1,
      rules: {
        deployments: true,
        rollbacks: true,
        criticalEdits: true,
        deviceRemoval: true
      },
      approvers: []
    }
  })
  
  const { projects, activeProject } = useProjectStore()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    loadProfileData()
  }, [])
  
  // Note: Auto-show logic removed from ProfilePage to prevent duplicate modal opening.
  // The auto-show logic is handled in Layout.tsx only.

  const loadProfileData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Get device information using authenticated request
      const deviceData = await deviceAuth.getDeviceInfo()
      console.log('Profile data received:', deviceData) // Debug log
      
      // Check license status to get profile type
      await checkLicenseStatus()
      const licenseStore = useLicenseStore.getState()
      
      console.log('🔍 License Store State:', {
        hasValidLicense: licenseStore.hasValidLicense,
        licenseInfo: licenseStore.licenseInfo
      })
      
      // Determine profile type from license (if activated)
      let profileType: 'Solo' | 'Team' | 'Enterprise' | undefined = undefined
      if (licenseStore.hasValidLicense && licenseStore.licenseInfo) {
        const licenseTypeMap: Record<string, 'Solo' | 'Team' | 'Enterprise'> = {
          'solo': 'Solo',
          'team': 'Team',
          'teams': 'Team',
          'enterprise': 'Enterprise'
        }
        profileType = licenseTypeMap[licenseStore.licenseInfo.licenseType.toLowerCase()]
        console.log('✅ Profile type set from license:', profileType)
      } else {
        console.log('❌ No valid license - profileType will be undefined')
      }
      
      // Create profile from device data
      if (deviceData && deviceData.device) {
        const fullProfile: DeviceProfile = {
          profileType, // Only set if license is activated
          workspacePresets: {
            defaultProject: activeProject?.name || 'No active project',
            theme: theme,
            autoSave: true,
            notifications: true
          },
          device: {
            deviceId: deviceData.device.device_id,
            deviceName: deviceData.device.device_name,
            deviceType: deviceData.device.device_type,
            osType: deviceData.device.os_type,
            osVersion: deviceData.device.os_version,
            hardwareInfo: typeof deviceData.device.hardware_info === 'string' 
              ? JSON.parse(deviceData.device.hardware_info)
              : deviceData.device.hardware_info
          },
          user: deviceData.users[0] ? {
            userId: deviceData.users[0].id,
            username: deviceData.users[0].os_username,
            displayName: deviceData.users[0].display_name,
            role: deviceData.users[0].user_role,
            isPrimary: deviceData.users[0].is_primary,
            is_active: deviceData.users[0].is_active,
            created_at: deviceData.users[0].created_at,
            updated_at: deviceData.users[0].updated_at,
            first_login: deviceData.users[0].first_login,
            last_activity: deviceData.users[0].last_activity
          } : undefined
        }
        
        console.log('Full profile created:', fullProfile)
        console.log('📊 Profile Type Value:', fullProfile.profileType)
        console.log('User data:', fullProfile.user)
        console.log('Created at:', fullProfile.user?.created_at)
        
        setProfile(fullProfile)
        setEditedProfile(fullProfile)
      } else {
        setError('No device data received from server')
        console.error('Invalid device data structure:', deviceData)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile data')
      console.error('Error loading profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const profileTypeIcons = {
    Solo: <User size={20} className="text-blue-500" />,
    Team: <Users size={20} className="text-green-500" />,
    Enterprise: <Building size={20} className="text-purple-500" />
  }

  const profileTypeDescriptions = {
    Solo: 'Individual workspace for personal projects',
    Team: 'Collaborative workspace for team projects',
    Enterprise: 'Advanced workspace with enterprise features'
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'desktop':
        return <Monitor size={16} className="text-gray-600" />
      case 'laptop':
        return <Laptop size={16} className="text-gray-600 dark:text-gray-400" />
      case 'mobile':
        return <Smartphone size={16} className="text-gray-600 dark:text-gray-400" />
      default:
        return <Monitor size={16} className="text-gray-600" />
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditedProfile(profile)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!editedProfile || !profile) return

    setIsSaving(true)
    try {
      // Update theme immediately when saving
      setTheme(editedProfile.workspacePresets.theme as 'light' | 'dark' | 'system')
      
      // Here you would make API calls to save the changes
      // For now, we'll just update the local state
      setProfile(editedProfile)
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving profile:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Profile type is now read-only and determined by license type
  // Users cannot manually change profile type

  const handleLicenseTypeSelected = (type: 'solo' | 'teams' | 'enterprise') => {
    setShowLicenseTypeModal(false)
    
    if (type === 'solo') {
      setShowSoloActivationModal(true)
    } else if (type === 'teams') {
      // Use legacy TeamsEnterpriseConfigModal for Teams (works with backend)
      setShowTeamsConfigModal(true)
    } else if (type === 'enterprise') {
      setShowEnterpriseActivationModal(true)
    }
  }

  const handleSoloActivationComplete = async () => {
    setShowSoloActivationModal(false)
    await loadProfileData()
  }

  const handleTeamsConfigComplete = async () => {
    setShowTeamsConfigModal(false)
    await loadProfileData()
  }

  const handleBackToLicenseTypeSelection = () => {
    setShowTeamsActivationModal(false)
    setShowEnterpriseActivationModal(false)
    setShowLicenseTypeModal(true)
  }

  const updateWorkspacePreset = (key: keyof DeviceProfile['workspacePresets'], value: string | boolean) => {
    if (!editedProfile) return
    setEditedProfile({
      ...editedProfile,
      workspacePresets: {
        ...editedProfile.workspacePresets,
        [key]: value
      }
    })
  }

  const calculateProfileCompletion = (): number => {
    if (!profile) return 0
    
    let completedFields = 0
    let totalFields = 0
    
    // Check device info completion
    totalFields += 6
    if (profile.device.deviceId) completedFields++
    if (profile.device.deviceName) completedFields++
    if (profile.device.deviceType) completedFields++
    if (profile.device.osType) completedFields++
    if (profile.device.osVersion) completedFields++
    if (profile.device.hardwareInfo) completedFields++
    
    // Check user info completion (if user exists)
    if (profile.user) {
      totalFields += 5
      if (profile.user.username) completedFields++
      if (profile.user.displayName) completedFields++
      if (profile.user.role) completedFields++
      if (profile.user.is_active) completedFields++
      if (profile.user.created_at) completedFields++
    }
    
    // Check workspace presets completion
    totalFields += 4
    if (profile.workspacePresets.defaultProject) completedFields++
    if (profile.workspacePresets.theme) completedFields++
    if (profile.workspacePresets.autoSave !== undefined) completedFields++
    if (profile.workspacePresets.notifications !== undefined) completedFields++
    
    return Math.round((completedFields / totalFields) * 100)
  }

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <X size={24} className="text-red-500 dark:text-red-400" />
          </div>
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Failed to load profile'}</p>
          <button
            onClick={loadProfileData}
            className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full space-y-6 min-h-screen bg-white dark:bg-panda-surface-dark transition-colors duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your account and workspace preferences</p>
        </div>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors"
          >
            <Edit2 size={16} />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors disabled:opacity-50"
            >
              <Check size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Main Profile Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-[#FF6A00] to-[#E55A00] rounded-full flex items-center justify-center">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {profile.user?.displayName || profile.device.deviceName}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {profile.user?.username ? `@${profile.user.username}` : 'Device User'}
              </p>
            </div>
          </div>

          {/* Profile Type Display - Read-only, shown only when license is activated */}
          {profile.profileType && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Profile Type
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Determined by license)</span>
              </label>
              <div className="p-4 border-2 border-[#FF6A00] bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10 rounded-lg">
                <div className="flex items-center gap-3">
                  {profileTypeIcons[profile.profileType]}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white text-lg">{profile.profileType}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {profileTypeDescriptions[profile.profileType]}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      ✓ Active
                    </div>
                    {profile.profileType === 'Team' && (
                      <button
                        onClick={() => setShowTeamsManagementModal(true)}
                        className="px-3 py-1 bg-[#FF6A00] text-white rounded text-xs font-medium hover:bg-[#E55A00] transition-colors"
                      >
                        Manage License
                      </button>
                    )}
                    {profile.profileType === 'Enterprise' && (
                      <button
                        onClick={() => setShowEnterpriseManagementModal(true)}
                        className="px-3 py-1 bg-[#FF6A00] text-white rounded text-xs font-medium hover:bg-[#E55A00] transition-colors"
                      >
                        Manage Enterprise
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Profile type is automatically set based on your activated license and cannot be changed manually.
              </p>
            </div>
          )}

          {/* Debug: Show when no profile type */}
          {!profile.profileType && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>No Profile Type Set:</strong> Profile type will be automatically assigned when you activate your license.
              </p>
            </div>
          )}

          {/* Device Information */}
          {profile.device && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Device Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Operating System</div>
                  <div className="font-medium text-gray-900 dark:text-white">{profile.device.osType} {profile.device.osVersion}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Architecture</div>
                  <div className="font-medium text-gray-900 dark:text-white">{profile.device.hardwareInfo.arch}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">CPU Cores</div>
                  <div className="font-medium text-gray-900 dark:text-white">{profile.device.hardwareInfo.cpus}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Memory</div>
                  <div className="font-medium text-gray-900 dark:text-white">{profile.device.hardwareInfo.totalMemory}GB</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Platform</div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">{profile.device.hardwareInfo.platform}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Device Type</div>
                  <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    {getDeviceIcon(profile.device.deviceType)}
                    <span className="capitalize">{profile.device.deviceType}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Information */}
          {profile.user && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">User Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">OS Username</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{profile.user.username}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Role</div>
                  <div className="font-medium">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      profile.user.role === 'admin' 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    }`}>
                      {profile.user.role}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Account Type</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {profile.user.isPrimary ? 'Primary User' : 'Secondary User'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* License Status Card - Show activation option if no valid license */}
      {!hasValidLicense && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <AlertCircle size={20} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">License Activation Required</h2>
                <p className="text-gray-600 dark:text-gray-300">Activate your license to access all features</p>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Key size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Limited Access Mode
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Your device has been initialized with TPM-backed security, but you need to activate a license to:
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1 ml-5 list-disc">
                    <li>Create and open projects</li>
                    <li>Access logic editor and deployment features</li>
                    <li>View dashboard analytics</li>
                    <li>Use shadow runtime and versioning</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLicenseTypeModal(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors font-medium shadow-lg"
            >
              <Key size={20} />
              Activate License Now
            </button>
          </div>
        </Card>
      )}

      {/* Current Project Information - Only show with valid license */}
      {hasValidLicense && activeProject && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <FolderOpen size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Current Project</h2>
                <p className="text-gray-600 dark:text-gray-300">Active project workspace</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Project Name</div>
                <div className="font-medium text-lg text-gray-900 dark:text-white">{activeProject.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Opened</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {new Date(activeProject.last_opened).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Project ID</div>
                <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{activeProject.id}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Projects</div>
                <div className="font-medium text-gray-900 dark:text-white">{projects.length}</div>
              </div>
            </div>

            {activeProject.description && (
              <div className="mt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Description</div>
                <div className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {activeProject.description}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Workspace Presets Card - Only show with valid license */}
      {hasValidLicense && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Settings size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Workspace Presets</h2>
                <p className="text-gray-600">Configure your default workspace settings</p>
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Project */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Project
              </label>
              {isEditing && editedProfile ? (
                <input
                  type="text"
                  value={editedProfile.workspacePresets.defaultProject}
                  onChange={(e) => updateWorkspacePreset('defaultProject', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Enter default project name"
                />
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-gray-100">
                  {profile.workspacePresets.defaultProject}
                </div>
              )}
            </div>

            {/* Theme Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme Preference
              </label>
              {isEditing && editedProfile ? (
                <select
                  value={editedProfile.workspacePresets.theme}
                  onChange={(e) => {
                    const newTheme = e.target.value as 'light' | 'dark' | 'system'
                    updateWorkspacePreset('theme', newTheme)
                    setTheme(newTheme) // Update global theme
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-gray-100 capitalize">
                  {profile.workspacePresets.theme}
                </div>
              )}
            </div>

            {/* Auto Save */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editedProfile?.workspacePresets.autoSave || false}
                  onChange={(e) => updateWorkspacePreset('autoSave', e.target.checked)}
                  disabled={!isEditing}
                  className="w-4 h-4 text-[#FF6A00] border-gray-300 rounded focus:ring-[#FF6A00]"
                />
                <div>
                  <div className="text-sm font-medium text-gray-700">Auto Save</div>
                  <div className="text-xs text-gray-500">Automatically save changes</div>
                </div>
              </label>
            </div>

            {/* Notifications */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editedProfile?.workspacePresets.notifications || false}
                  onChange={(e) => updateWorkspacePreset('notifications', e.target.checked)}
                  disabled={!isEditing}
                  className="w-4 h-4 text-[#FF6A00] border-gray-300 rounded focus:ring-[#FF6A00]"
                />
                <div>
                  <div className="text-sm font-medium text-gray-700">Notifications</div>
                  <div className="text-xs text-gray-500">Enable workspace notifications</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </Card>
      )}

      {/* Account Status Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Account Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your account is active and in good standing</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                profile.user?.is_active ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                profile.user?.is_active ? 'text-green-600' : 'text-red-600'
              }`}>
                {profile.user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Member since</div>
              <div className="font-medium">
                {(() => {
                  if (!profile.user?.created_at) return 'Unknown'
                  
                  try {
                    const date = new Date(profile.user.created_at)
                    if (isNaN(date.getTime())) return 'Invalid Date'
                    
                    return date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })
                  } catch (error) {
                    console.error('Error parsing created_at:', profile.user.created_at, error)
                    return 'Date Error'
                  }
                })()}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Last activity</div>
              <div className="font-medium">
                {(() => {
                  if (!profile.user?.last_activity) return 'Unknown'
                  
                  try {
                    // Handle both timestamp and date string formats
                    const date = new Date(typeof profile.user.last_activity === 'number' 
                      ? profile.user.last_activity 
                      : profile.user.last_activity)
                    
                    if (isNaN(date.getTime())) return 'Invalid Date'
                    
                    return date.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  } catch (error) {
                    console.error('Error parsing last_activity:', profile.user.last_activity, error)
                    return 'Date Error'
                  }
                })()}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Profile completion</div>
              <div className="font-medium text-green-600">
                {calculateProfileCompletion()}%
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 🧭 Enterprise Onboarding Wizard Modal */}
      {showTeamOnboarding && (
        <Dialog isOpen={showTeamOnboarding} onClose={() => setShowTeamOnboarding(false)} title="Teams Onboarding" size="large">
          <div className="p-6 space-y-8">
            {/* Enhanced Step Progress */}
            <div className="relative">
              {/* Progress Line Background */}
              <div className="absolute top-4 left-8 right-8 h-0.5 bg-gray-200 dark:bg-gray-600"></div>
              {/* Active Progress Line */}
              <div 
                className="absolute top-4 left-8 h-0.5 bg-[#FF6A00] transition-all duration-500 ease-in-out"
                style={{ width: `${((onboardingStep - 1) / 4) * 100}%` }}
              ></div>
              
              {/* Step Indicators */}
              <div className="relative flex items-center justify-between">
                {[
                  { step: 1, title: 'License', icon: '🔑' },
                  { step: 2, title: 'Seats', icon: '👥' },
                  { step: 3, title: 'Security', icon: '🛡️' },
                  { step: 4, title: 'Roles', icon: '🎭' },
                  { step: 5, title: 'Policies', icon: '📋' }
                ].map(({ step, title, icon }) => (
                  <div key={step} className="flex flex-col items-center">
                    <div
                      className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                        onboardingStep >= step
                          ? 'bg-[#FF6A00] border-[#FF6A00] text-white shadow-lg shadow-[#FF6A00]/30'
                          : onboardingStep === step - 1
                          ? 'bg-white dark:bg-gray-800 border-[#FF6A00] text-[#FF6A00] animate-pulse'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {onboardingStep > step ? (
                        <Check size={18} className="text-white" />
                      ) : (
                        <span className="text-lg">{icon}</span>
                      )}
                    </div>
                    <div className={`mt-2 text-xs font-medium transition-colors ${
                      onboardingStep >= step 
                        ? 'text-[#FF6A00]' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {title}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Step Counter */}
              <div className="absolute -top-8 right-0 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-medium">
                Step {onboardingStep} of 5
              </div>
            </div>

            {/* Step 1: License Activation */}
            {onboardingStep === 1 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔑</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    License Activation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter your enterprise license key to activate collaborative features.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      License Key
                    </label>
                    <input
                      type="text"
                      value={teamSettings.license.key}
                      onChange={(e) => setTeamSettings(prev => ({ 
                        ...prev, 
                        license: { ...prev.license, key: e.target.value } 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                    />
                  </div>
                  
                  {teamSettings.license.activated && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">License Activated Successfully!</h4>
                      <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                        <div>Company: <strong>{teamSettings.license.companyName}</strong></div>
                        <div>Total Seats: <strong>{teamSettings.license.totalSeats}</strong></div>
                        <div>Expires: <strong>{teamSettings.license.expiration}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      // Simulate license activation
                      setTeamSettings(prev => ({
                        ...prev,
                        license: {
                          ...prev.license,
                          activated: true,
                          companyName: 'Pandaura Industrial',
                          totalSeats: 20,
                          expiration: 'Dec 8, 2026',
                          isValid: true
                        },
                        seats: {
                          ...prev.seats,
                          total: 20,
                          remaining: 20
                        }
                      }))
                      setOnboardingStep(2)
                    }}
                    disabled={!teamSettings.license.key}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg shadow-[#FF6A00]/25"
                  >
                    <span className="text-lg">🚀</span>
                    Activate License
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Seat Registry Setup */}
            {onboardingStep === 2 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">👥</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Seat Registry Setup
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Configure team seats and assign users to your workspace.
                  </p>
                </div>
                
                {/* Seat Overview */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {teamSettings.seats.total}
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-300">Total Seats</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {teamSettings.seats.assigned.length}
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-300">Assigned Seats</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {teamSettings.seats.remaining}
                    </div>
                    <div className="text-sm text-orange-800 dark:text-orange-300">Remaining</div>
                  </div>
                </div>

                {/* Seat Management */}
                <div className="space-y-4">
                  {/* Add New Seat */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                      <h4 className="font-medium text-gray-900 dark:text-white">Add New Seat</h4>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email or Username
                          </label>
                          <input
                            type="text"
                            placeholder="user@example.com or username"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF6A00]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Role
                          </label>
                          <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF6A00]">
                            <option value="Viewer">Viewer</option>
                            <option value="Editor">Editor</option>
                            <option value="Approver">Approver</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                          Add Seat
                        </button>
                        <button 
                          onClick={() => {
                            setTeamSettings(prev => ({
                              ...prev,
                              seats: {
                                ...prev.seats,
                                assigned: [{id: 1, username: profile?.user?.username || 'current-user', role: 'Admin', status: 'validated'}],
                                remaining: prev.seats.total - 1,
                                currentUserAssigned: true
                              }
                            }))
                          }}
                          disabled={teamSettings.seats.currentUserAssigned}
                          className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                          {teamSettings.seats.currentUserAssigned ? '✓ Added Me' : 'Add Me'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Seats Table */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                      <h4 className="font-medium text-gray-900 dark:text-white">Assigned Seats</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {/* Current User Row */}
                          {!teamSettings.seats.currentUserAssigned && (
                            <tr>
                              <td className="px-4 py-4">
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{profile?.user?.username}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">Current OS User</div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium">
                                  Admin
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                                  Pending
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Auto-detected</span>
                              </td>
                            </tr>
                          )}
                          
                          {/* Assigned Seats */}
                          {teamSettings.seats.assigned.map((seat) => (
                            <tr key={seat.id}>
                              <td className="px-4 py-4">
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{seat.username}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {seat.username === (profile?.user?.username || 'current-user') ? 'Current User' : 'External User'}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  seat.role === 'Admin' 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                    : seat.role === 'Approver'
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                    : seat.role === 'Editor'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}>
                                  {seat.role}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                                  seat.status === 'validated'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : seat.status === 'pending'
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                }`}>
                                  {seat.status === 'validated' && <Check size={12} />}
                                  {seat.status === 'pending' && <span>⏳</span>}
                                  {seat.status === 'failed' && <X size={12} />}
                                  {seat.status.charAt(0).toUpperCase() + seat.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex gap-2">
                                  {seat.status === 'pending' && (
                                    <button 
                                      onClick={() => {
                                        setTeamSettings(prev => ({
                                          ...prev,
                                          seats: {
                                            ...prev.seats,
                                            assigned: prev.seats.assigned.map(s => 
                                              s.id === seat.id ? {...s, status: 'validated'} : s
                                            )
                                          }
                                        }))
                                      }}
                                      className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                                    >
                                      Validate
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => {
                                      setTeamSettings(prev => ({
                                        ...prev,
                                        seats: {
                                          ...prev.seats,
                                          assigned: prev.seats.assigned.filter(s => s.id !== seat.id),
                                          remaining: prev.seats.remaining + 1,
                                          currentUserAssigned: seat.username === (profile?.user?.username || 'current-user') ? false : prev.seats.currentUserAssigned
                                        }
                                      }))
                                    }}
                                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          
                          {/* Empty State */}
                          {teamSettings.seats.assigned.length === 0 && !teamSettings.seats.currentUserAssigned && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                No seats assigned yet. Add your first seat above.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setOnboardingStep(1)}
                    className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                  >
                    <span className="text-lg">←</span>
                    Back
                  </button>
                  <button
                    onClick={() => setOnboardingStep(3)}
                    disabled={!teamSettings.seats.currentUserAssigned}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] disabled:opacity-50 transition-all duration-200 font-medium shadow-lg shadow-[#FF6A00]/25"
                  >
                    <span className="text-lg">🛡️</span>
                    Continue to Security
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Device Certification + TPM */}
            {onboardingStep === 3 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🛡️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Device Certification + TPM
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Secure your device with TPM-based authentication and certificate generation.
                  </p>
                </div>
                
                {/* Device Info */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Device Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Device Name:</span>
                      <div className="font-medium text-gray-900 dark:text-white">{profile?.device.hardwareInfo.platform} Workstation</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">OS User:</span>
                      <div className="font-medium text-gray-900 dark:text-white">{profile?.user?.username}</div>
                    </div>
                  </div>
                </div>

                {/* Security Setup Steps */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">TPM KeyPair</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Generate secure cryptographic keys using TPM</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {teamSettings.device.tpmKeyPair ? (
                        <span className="text-green-600 dark:text-green-400 font-medium text-sm">✓</span>
                      ) : (
                        <button 
                          onClick={() => setTeamSettings(prev => ({
                            ...prev,
                            device: { ...prev.device, tpmKeyPair: true }
                          }))}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          Generate TPM Keys
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Device Cert</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Issue device certificate automatically after TPM</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {teamSettings.device.deviceCert ? (
                        <span className="text-green-600 dark:text-green-400 font-medium text-sm">✓</span>
                      ) : (
                        <button 
                          onClick={() => setTeamSettings(prev => ({
                            ...prev,
                            device: { ...prev.device, deviceCert: true, deviceFingerprint: true }
                          }))}
                          disabled={!teamSettings.device.tpmKeyPair}
                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          Issue Device Certificate
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Device Fingerprint</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Unique device identifier generated</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {teamSettings.device.deviceFingerprint ? (
                        <span className="text-green-600 dark:text-green-400 font-medium text-sm">✓</span>
                      ) : (
                        <span className="text-red-500 font-medium text-sm">✗</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setOnboardingStep(2)}
                    className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                  >
                    <span className="text-lg">←</span>
                    Back
                  </button>
                  <button
                    onClick={() => {
                      setTeamSettings(prev => ({
                        ...prev,
                        device: { ...prev.device, certified: true },
                        roles: {
                          ...prev.roles,
                          osUsers: [profile?.user?.username || 'current-user'],
                          mappings: { [profile?.user?.username || 'current-user']: 'Admin' }
                        }
                      }))
                      setOnboardingStep(4)
                    }}
                    disabled={!teamSettings.device.deviceCert}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] disabled:opacity-50 transition-all duration-200 font-medium shadow-lg shadow-[#FF6A00]/25"
                  >
                    <span className="text-lg">🎭</span>
                    Continue to Roles
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: OS-user → Role Mapping */}
            {onboardingStep === 4 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🎭</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    OS-user → Role Mapping
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Configure user roles and permissions for your team workspace.
                  </p>
                </div>
                
                {/* Role Descriptions */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Role Descriptions:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
                    <div><strong>Viewer:</strong> Read-only access</div>
                    <div><strong>Editor:</strong> Edit logic and configurations</div>
                    <div><strong>Approver:</strong> Approve deployments and changes</div>
                    <div><strong>Admin:</strong> Manage seats and security settings</div>
                  </div>
                </div>

                {/* User Role Mapping */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-gray-900 dark:text-white">User Role Assignments</h4>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {teamSettings.roles.osUsers.map((username, index) => (
                      <div key={index} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{username}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Auto-detected OS user</div>
                        </div>
                        <select
                          value={teamSettings.roles.mappings[username] || 'Viewer'}
                          onChange={(e) => setTeamSettings(prev => ({
                            ...prev,
                            roles: {
                              ...prev.roles,
                              mappings: {
                                ...prev.roles.mappings,
                                [username]: e.target.value
                              }
                            }
                          }))}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {teamSettings.roles.availableRoles.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setOnboardingStep(3)}
                    className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                  >
                    <span className="text-lg">←</span>
                    Back
                  </button>
                  <button
                    onClick={() => setOnboardingStep(5)}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-all duration-200 font-medium shadow-lg shadow-[#FF6A00]/25"
                  >
                    <span className="text-lg">📋</span>
                    Continue to Policies
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Approval Policy Setup */}
            {onboardingStep === 5 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Approval Policy Setup
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Configure approval workflows for enterprise safety and compliance.
                  </p>
                </div>
                
                {/* Enable Approval Workflow */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={teamSettings.approvalPolicy.enabled}
                      onChange={(e) => setTeamSettings(prev => ({
                        ...prev,
                        approvalPolicy: {
                          ...prev.approvalPolicy,
                          enabled: e.target.checked
                        }
                      }))}
                      className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                    />
                    <label className="font-medium text-yellow-800 dark:text-yellow-200">
                      Enable Approval Workflow (Recommended for Enterprise)
                    </label>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 ml-7">
                    Require approvals for critical operations to ensure safety and compliance.
                  </p>
                </div>

                {teamSettings.approvalPolicy.enabled && (
                  <>
                    {/* Minimum Approvers */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Minimum Number of Approvers
                      </label>
                      <select
                        value={teamSettings.approvalPolicy.minApprovers}
                        onChange={(e) => setTeamSettings(prev => ({
                          ...prev,
                          approvalPolicy: {
                            ...prev.approvalPolicy,
                            minApprovers: parseInt(e.target.value)
                          }
                        }))}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>

                    {/* Approval Rules */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Approval Required For:
                      </label>
                      <div className="space-y-2">
                        {Object.entries(teamSettings.approvalPolicy.rules).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setTeamSettings(prev => ({
                                ...prev,
                                approvalPolicy: {
                                  ...prev.approvalPolicy,
                                  rules: {
                                    ...prev.approvalPolicy.rules,
                                    [key]: e.target.checked
                                  }
                                }
                              }))}
                              className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
                            />
                            <label className="text-sm text-gray-900 dark:text-white capitalize">
                              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setOnboardingStep(4)}
                    className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                  >
                    <span className="text-lg">←</span>
                    Back
                  </button>
                  <button
                    onClick={() => {
                      // Complete onboarding
                      setShowTeamOnboarding(false)
                      setOnboardingStep(1)
                      // Update profile type
                      if (profile) {
                        setProfile({ ...profile, profileType: 'Team' })
                      }
                      if (editedProfile) {
                        setEditedProfile({ ...editedProfile, profileType: 'Team' })
                      }
                    }}
                    className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold shadow-lg shadow-green-500/25"
                  >
                    <Check size={18} />
                    <span>🎉</span>
                    Complete Setup
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* License Type Selection Modal */}
      <LicenseTypeSelectionModal 
        isOpen={showLicenseTypeModal}
        onSelectType={handleLicenseTypeSelected}
        onClose={() => setShowLicenseTypeModal(false)}
      />

      {/* Solo License Activation Modal */}
      <LicenseActivationModal 
        isOpen={showSoloActivationModal}
        onClose={handleSoloActivationComplete}
      />

      {/* Teams License Modal - New (Not used, kept for future) */}
      <TeamsLicenseModal 
        isOpen={showTeamsActivationModal}
        onBack={handleBackToLicenseTypeSelection}
        onClose={async () => {
          setShowTeamsActivationModal(false)
          await loadProfileData()
        }}
      />

      {/* Enterprise License Modal */}
      <EnterpriseLicenseModal 
        isOpen={showEnterpriseActivationModal}
        onBack={handleBackToLicenseTypeSelection}
        onClose={async () => {
          setShowEnterpriseActivationModal(false)
          await loadProfileData()
        }}
        onAdminSetupComplete={() => {
          setShowEnterpriseActivationModal(false)
          setShowEnterpriseManagementModal(true)
        }}
      />

      {/* Teams Configuration Modal (Active - Works with Backend) */}
      <TeamsEnterpriseConfigModal 
        isOpen={showTeamsConfigModal}
        onComplete={handleTeamsConfigComplete}
      />

      {/* Teams License Management Modal */}
      <TeamsLicenseManagement
        isOpen={showTeamsManagementModal}
        onClose={() => setShowTeamsManagementModal(false)}
      />

      {/* Enterprise License Management Modal */}
      <EnterpriseManagementModal
        isOpen={showEnterpriseManagementModal}
        onClose={() => setShowEnterpriseManagementModal(false)}
      />
    </motion.div>
  )
}

export default ProfilePage