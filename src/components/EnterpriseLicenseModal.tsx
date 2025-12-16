import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Key, Mail, Loader2, AlertCircle, Info, CheckCircle, Shield, Users, Lock, UserCog, Settings } from 'lucide-react'
import { useLicenseStore } from '../store/licenseStore'
import { EnterpriseFirstRunModal } from './EnterpriseFirstRunModal'

interface EnterpriseLicenseModalProps {
  isOpen: boolean
  onClose?: () => void
  onBack: () => void
  onAdminSetupComplete?: () => void
}

export function EnterpriseLicenseModal({ isOpen, onClose, onBack, onAdminSetupComplete }: EnterpriseLicenseModalProps) {
  const [mode, setMode] = useState<'checking' | 'first-run' | 'setup' | 'provision' | 'register'>('first-run')
  const [step, setStep] = useState<'selection' | 'license' | 'org-setup' | 'security-policies' | 'rbac-config' | 'approval-setup' | 'identity-store' | 'admin-security' | 'admin-approvers' | 'admin-governance' | 'complete'>('selection')
  const [deviceRole, setDeviceRole] = useState<'register' | 'provision-admin' | 'team-member' | null>(null)
  const [showFirstRun, setShowFirstRun] = useState(true)
  const [licenseKey, setLicenseKey] = useState('')
  const [orgKey, setOrgKey] = useState('')
  const [orgName, setOrgName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [maxSeats, setMaxSeats] = useState(10)
  const [userEmail, setUserEmail] = useState('')
  const [enterpriseId, setEnterpriseId] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [, setLicenseInfo] = useState<any>(null)
  const [isFirstDevice, setIsFirstDevice] = useState(false)

  // Comprehensive security policies state
  const [securityPolicies, setSecurityPolicies] = useState({
    requireApproval: true,
    multiDeviceCerts: true,
    auditEnabled: true,
    rbacEnforcement: 'strict' as 'strict' | 'moderate' | 'flexible',
    sessionTimeout: 480,
    maxFailedAttempts: 3,
    deployGovernance: 'require_approval' as 'require_approval' | 'admin_only' | 'flexible',
    remoteAdminControls: true,
    certificateValidityDays: 365,
    forcePasswordPolicy: true,
    enableAuditChain: true,
    restrictLocalChanges: true
  })

  // RBAC configuration state
  const [rbacConfig, setRbacConfig] = useState({
    defaultRole: 'developer' as 'admin' | 'developer' | 'operator' | 'viewer',
    adminRoles: ['admin'],
    approverRoles: ['admin', 'lead'],
    deployRoles: ['admin', 'lead', 'developer'],
    viewerRoles: ['viewer'],
    inheritFromActiveDirectory: false,
    customRoles: [] as Array<{name: string, permissions: string[]}>
  })

  // Approval policies state
  const [approvalPolicies, setApprovalPolicies] = useState({
    deploymentApproval: {
      enabled: true,
      requiredApprovers: 2,
      approverRoles: ['admin', 'lead'],
      autoApproveOwn: false
    },
    configurationApproval: {
      enabled: true,
      requiredApprovers: 1,
      approverRoles: ['admin'],
      autoApproveOwn: false
    },
    userManagementApproval: {
      enabled: true,
      requiredApprovers: 1,
      approverRoles: ['admin'],
      autoApproveOwn: false
    },
    emergencyBypass: {
      enabled: true,
      bypassRoles: ['admin'],
      requireJustification: true
    }
  })

  // Identity store configuration
  const [identityStore, setIdentityStore] = useState({
    type: 'local' as 'local' | 'ldap' | 'ad',
    localUsers: [] as Array<{enterpriseId: string, email: string, role: string, department: string}>,
    ldapConfig: {
      server: '',
      baseDN: '',
      bindUser: '',
      bindPassword: '',
      userSearchFilter: '',
      groupSearchFilter: ''
    },
    syncEnabled: false,
    syncInterval: 60
  })

  // Admin-Only Configuration State (First Device Only)
  const [globalSecurityPolicies, setGlobalSecurityPolicies] = useState({
    enforceDeviceEncryption: true,
    deviceCompliance: true
  })
  
  const [approverGroups, setApproverGroups] = useState([
    { 
      id: 1,
      name: 'Senior Admins', 
      members: [] as string[], 
      minApprovals: 1, 
      canApprove: ['deploy', 'config', 'user_management'],
      isActive: true
    },
    { 
      id: 2,
      name: 'Deploy Managers', 
      members: [] as string[], 
      minApprovals: 2, 
      canApprove: ['deploy'],
      isActive: false
    }
  ])
  
  const [deployGovernance, setDeployGovernance] = useState({
    requireTestingEnvironment: true,
    mandatoryReviewPeriod: 24, // hours
    allowEmergencyDeploys: true,
    requireChangeTicket: true,
    restrictProductionDeploys: true,
    maxSimultaneousDeploys: 3,
    requireRollbackPlan: true,
    approvalWorkflow: 'sequential' as 'sequential' | 'parallel' | 'majority',
    autoRevertOnFailure: true,
    deploymentWindows: [] as Array<{day: string, startTime: string, endTime: string}>
  })

  const { setLicenseStatus, checkLicenseStatus: refreshLicenseStatus } = useLicenseStore()

  // Format Enterprise license key: 1111-1111-1111-1111 (same as Solo and Teams)
  const formatEnterpriseLicenseKey = (value: string) => {
    // Remove all non-numeric characters
    const digitsOnly = value.replace(/\D/g, '')
    
    // Limit to 16 digits
    const limited = digitsOnly.substring(0, 16)
    
    // Add dashes after every 4 digits
    const formatted = limited.replace(/(\d{4})(?=\d)/g, '$1-')
    
    return formatted
  }

  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatEnterpriseLicenseKey(e.target.value)
    setLicenseKey(formattedValue)
  }

  // Initialize device name
  useEffect(() => {
    if (!deviceName) {
      const hostname = window.location.hostname || 'Unknown'
      const userAgent = navigator.userAgent
      const platform = userAgent.includes('Windows') ? 'Windows' : 
                      userAgent.includes('Mac') ? 'Mac' : 
                      userAgent.includes('Linux') ? 'Linux' : 'Unknown'
      setDeviceName(`${platform}-${hostname}-${Date.now().toString().slice(-4)}`)
    }
  }, [])

  // Check if device is first device
  useEffect(() => {
    const checkFirstDevice = async () => {
      try {
        const response = await fetch('/api/license/enterprise/check-first-device', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        const data = await response.json()
        setIsFirstDevice(data.isFirstDevice)
      } catch (error) {
        console.error('Error checking first device:', error)
      }
    }
    
    if (isOpen) {
      checkFirstDevice()
    }
  }, [isOpen])

  const handleFirstRunOption = (option: 'register' | 'provision-admin' | 'team-member') => {
    console.log('🎯 handleFirstRunOption called with:', option)
    setDeviceRole(option)
    setShowFirstRun(false)
    
    if (option === 'provision-admin') {
      setMode('provision')
      setStep('license')
    } else if (option === 'register') {
      setMode('register')
      setStep('license')
    } else if (option === 'team-member') {
      setMode('register')
      setStep('license')
    }
    console.log('✅ deviceRole set to:', option)
  }

  const checkLicenseStatus = async () => {
    if (!licenseKey) return
    
    setIsValidating(true)
    setValidationError(null)
    
    try {
      const response = await fetch('/api/license/enterprise/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setLicenseInfo(data)
        setIsFirstDevice(data.isFirstDevice)
      } else {
        setValidationError(data.error)
      }
    } catch (error) {
      setValidationError('Failed to check Enterprise license status')
    } finally {
      setIsValidating(false)
    }
  }

  const setupEnterpriseLicense = async () => {
    console.log('🔐 setupEnterpriseLicense called', { deviceRole, licenseKey, userEmail })
    
    if (!licenseKey || !userEmail) {
      setValidationError('License key and email are required')
      return
    }
    
    setIsValidating(true)
    setValidationError(null)
    
    try {
      const endpoint = deviceRole === 'provision-admin' 
        ? '/api/license/enterprise/provision-admin'
        : '/api/license/enterprise/register-device'
      
      console.log('📡 Calling endpoint:', endpoint)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          licenseKey,
          userEmail,
          deviceName,
          // Admin-specific data
          ...(deviceRole === 'provision-admin' && {
            orgName,
            adminEmail,
            maxSeats
          })
        })
      })
      
      const data = await response.json()
      console.log('📥 Response:', data)
      
      if (data.success) {
        // For provision-admin, go to admin setup steps first
        if (deviceRole === 'provision-admin') {
          setStep('admin-security')
        } else {
          setStep('complete')
        }
        
        // Update license status by checking with the server
        // This will get the full license info with all required fields
        await refreshLicenseStatus()
      } else {
        setValidationError(data.error || 'Failed to activate license')
      }
    } catch (error: any) {
      console.error('❌ Error:', error)
      setValidationError(error.message || 'Failed to setup Enterprise license')
    } finally {
      setIsValidating(false)
    }
  }
  
  const claimEnterpriseSeat = async () => {
    console.log('🎟️ claimEnterpriseSeat called', { licenseKey, userEmail })
    
    if (!licenseKey || !userEmail) {
      setValidationError('License key and email are required')
      return
    }
    
    setIsValidating(true)
    setValidationError(null)
    
    try {
      console.log('📡 Calling /api/license/enterprise/claim-seat')
      
      const response = await fetch('/api/license/enterprise/claim-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          licenseKey,
          userEmail,
          deviceName
        })
      })
      
      const data = await response.json()
      console.log('📥 Response:', data)
      
      if (data.success) {
        setStep('complete')
        
        // Update license status by checking with the server
        // This will get the full license info with all required fields
        await refreshLicenseStatus()
      } else {
        setValidationError(data.error || 'Failed to claim seat')
      }
    } catch (error: any) {
      console.error('❌ Error:', error)
      setValidationError(error.message || 'Failed to claim Enterprise seat')
    } finally {
      setIsValidating(false)
    }
  }



  if (!isOpen) return null

  return (
    <>
      {/* First Run Modal */}
      {showFirstRun && (
        <EnterpriseFirstRunModal
          isOpen={showFirstRun}
          onSelectOption={handleFirstRunOption}
          isFirstDevice={isFirstDevice}
        />
      )}

      {/* Main Enterprise License Modal */}
      {!showFirstRun && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8 rounded-t-lg">
              <div className="flex items-center space-x-4">
                <Shield size={28} />
                <div>
                  <h2 className="text-2xl font-bold">Enterprise License</h2>
                  <p className="text-purple-100 text-sm mt-1">
                    {deviceRole === 'provision-admin' && 'Provision Admin Device'}
                    {deviceRole === 'register' && 'Register This Device'}
                    {deviceRole === 'team-member' && 'Add as Team Member'}
                    {step === 'complete' && ' - Complete!'}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8">
              {mode === 'checking' && (
                <div className="text-center py-12">
                  <Loader2 className="animate-spin mx-auto mb-4 text-purple-600" size={48} />
                  <p className="text-gray-600 dark:text-gray-400">Checking Enterprise license status...</p>
                </div>
              )}

              {/* License Entry Form */}
              {step === 'license' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-5">
                    <div className="flex items-start space-x-3">
                      <Info className="text-purple-600 dark:text-purple-400 mt-0.5" size={18} />
                      <div className="text-sm text-purple-800 dark:text-purple-200">
                        <p className="font-semibold mb-2">
                          {deviceRole === 'provision-admin' && 'Provision Admin Device'}
                          {deviceRole === 'register' && 'Register This Device'}
                          {deviceRole === 'team-member' && 'Add as Team Member'}
                        </p>
                        <p>Enter your Enterprise license key and email to continue.</p>
                      </div>
                    </div>
                  </div>

                  {validationError && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-5">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                        <div className="text-sm text-red-800 dark:text-red-200">
                          <p>{validationError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* License Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Key size={16} className="inline mr-2 text-purple-600" />
                      Enterprise License Key
                    </label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={handleLicenseKeyChange}
                      placeholder="1111-1111-1111-1111"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-purple-500"
                      disabled={isValidating}
                    />
                  </div>

                  {/* User Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Mail size={16} className="inline mr-2 text-purple-600" />
                      Your Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="your.email@company.com"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                      disabled={isValidating}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between pt-4">
                    <button
                      onClick={onBack}
                      className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      disabled={isValidating}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        console.log('🔘 Activate License button clicked. deviceRole:', deviceRole)
                        if (deviceRole === 'team-member') {
                          console.log('➡️ Calling claimEnterpriseSeat()')
                          claimEnterpriseSeat()
                        } else {
                          console.log('➡️ Calling setupEnterpriseLicense()')
                          setupEnterpriseLicense()
                        }
                      }}
                      disabled={isValidating || !licenseKey || !userEmail}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isValidating && <Loader2 className="animate-spin" size={16} />}
                      {isValidating ? 'Activating...' : 'Activate License'}
                    </button>
                  </div>
                </motion.div>
              )}

          {/* Organization Setup Form */}
          {step === 'org-setup' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Settings className="text-purple-600 dark:text-purple-400 mt-0.5" size={18} />
                  <div className="text-sm text-purple-800 dark:text-purple-200">
                    <p className="font-semibold mb-2">Organization Details</p>
                    <p>Provide your organization information to complete the admin device provisioning.</p>
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-5">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                    <div className="text-sm text-red-800 dark:text-red-200">
                      <p>{validationError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your Company Name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                  disabled={isValidating}
                />
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail size={16} className="inline mr-2 text-purple-600" />
                  Admin Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                  disabled={isValidating}
                />
              </div>

              {/* Device Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Admin Workstation"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                  disabled={isValidating}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('license')}
                  className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  disabled={isValidating}
                >
                  Back
                </button>
                <button
                  onClick={setupEnterpriseLicense}
                  disabled={isValidating || !licenseKey || !userEmail || !orgName || !adminEmail}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isValidating && <Loader2 className="animate-spin" size={16} />}
                  {isValidating ? 'Provisioning...' : 'Complete Setup'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'security-policies' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Settings className="text-blue-600 dark:text-blue-400 mt-0.5" size={18} />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-2">Enterprise Admin Setup</p>
                    <p className="leading-relaxed">Configure global security policies for your enterprise deployment.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Security Policies</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={securityPolicies.multiDeviceCerts}
                      onChange={(e) => setSecurityPolicies(prev => ({
                        ...prev,
                        multiDeviceCerts: e.target.checked
                      }))}
                      className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Enable multi-device certification</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={securityPolicies.rbacEnforcement !== 'flexible'}
                      onChange={(e) => setSecurityPolicies(prev => ({
                        ...prev,
                        rbacEnforcement: e.target.checked ? 'strict' : 'flexible'
                      }))}
                      className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Enforce RBAC restrictions</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={securityPolicies.auditEnabled}
                      onChange={(e) => setSecurityPolicies(prev => ({
                        ...prev,
                        auditEnabled: e.target.checked
                      }))}
                      className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Require audit chaining</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={securityPolicies.remoteAdminControls}
                      onChange={(e) => setSecurityPolicies(prev => ({
                        ...prev,
                        remoteAdminEnabled: e.target.checked
                      }))}
                      className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Enable remote admin controls</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={securityPolicies.requireApproval}
                      onChange={(e) => setSecurityPolicies(prev => ({
                        ...prev,
                        requireApproval: e.target.checked
                      }))}
                      className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Require approval for deployments</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* Admin-Only Step 1: Global Security Policies */}
          {step === 'admin-security' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Shield className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-semibold mb-2">Global Security Policies (Admin Only - First Device)</p>
                    <p>Configure organization-wide security policies that will apply to all devices in your enterprise.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Device Security Requirements</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={globalSecurityPolicies.enforceDeviceEncryption}
                      onChange={(e) => setGlobalSecurityPolicies(prev => ({
                        ...prev,
                        enforceDeviceEncryption: e.target.checked
                      }))}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Enforce device encryption</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={globalSecurityPolicies.deviceCompliance}
                      onChange={(e) => setGlobalSecurityPolicies(prev => ({
                        ...prev,
                        deviceCompliance: e.target.checked
                      }))}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Enforce device compliance</span>
                  </label>
                </div>
              </div>
              
              {/* Navigation */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep('admin-approvers')}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
                >
                  Next: Configure Approvers
                </button>
              </div>
            </motion.div>
          )}

          {/* Admin-Only Step 2: Configure Approver Groups */}
          {step === 'admin-approvers' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <UserCog className="text-blue-600 dark:text-blue-400 mt-0.5" size={18} />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-2">Configure Approver Groups (Admin Only - First Device)</p>
                    <p>Set up approval groups that will manage different types of changes and deployments.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {approverGroups.map((group) => (
                  <div key={group.id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{group.name}</h4>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={group.isActive}
                          onChange={(e) => setApproverGroups(prev => prev.map(g => 
                            g.id === group.id ? { ...g, isActive: e.target.checked } : g
                          ))}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Minimum Approvals Required
                        </label>
                        <select
                          value={group.minApprovals}
                          onChange={(e) => setApproverGroups(prev => prev.map(g => 
                            g.id === group.id ? { ...g, minApprovals: Number(e.target.value) } : g
                          ))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value={1}>1 Approval</option>
                          <option value={2}>2 Approvals</option>
                          <option value={3}>3 Approvals</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Can Approve
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['deploy', 'config', 'user_management'].map(action => (
                            <label key={action} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={group.canApprove.includes(action)}
                                onChange={(e) => {
                                  setApproverGroups(prev => prev.map(g => 
                                    g.id === group.id ? {
                                      ...g, 
                                      canApprove: e.target.checked 
                                        ? [...g.canApprove, action]
                                        : g.canApprove.filter(a => a !== action)
                                    } : g
                                  ))
                                }}
                                className="w-3 h-3 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                                {action.replace('_', ' ')}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('admin-security')}
                  className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('admin-governance')}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
                >
                  Next: Deploy Governance
                </button>
              </div>
            </motion.div>
          )}

          {/* Admin-Only Step 3: Deploy Governance */}
          {step === 'admin-governance' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Settings className="text-green-600 dark:text-green-400 mt-0.5" size={18} />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <p className="font-semibold mb-2">Deploy Governance Setup (Admin Only - First Device)</p>
                    <p>Configure deployment policies and governance rules for your enterprise.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={deployGovernance.requireTestingEnvironment}
                        onChange={(e) => setDeployGovernance(prev => ({
                          ...prev,
                          requireTestingEnvironment: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Require testing environment</span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={deployGovernance.restrictProductionDeploys}
                        onChange={(e) => setDeployGovernance(prev => ({
                          ...prev,
                          restrictProductionDeploys: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Restrict production deployments</span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={deployGovernance.requireRollbackPlan}
                        onChange={(e) => setDeployGovernance(prev => ({
                          ...prev,
                          requireRollbackPlan: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Require rollback plan</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={deployGovernance.allowEmergencyDeploys}
                        onChange={(e) => setDeployGovernance(prev => ({
                          ...prev,
                          allowEmergencyDeploys: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Allow emergency deployments</span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={deployGovernance.autoRevertOnFailure}
                        onChange={(e) => setDeployGovernance(prev => ({
                          ...prev,
                          autoRevertOnFailure: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Auto-revert on failure</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Review Period (hours)
                    </label>
                    <select
                      value={deployGovernance.mandatoryReviewPeriod}
                      onChange={(e) => setDeployGovernance(prev => ({
                        ...prev,
                        mandatoryReviewPeriod: Number(e.target.value)
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value={1}>1 hour</option>
                      <option value={4}>4 hours</option>
                      <option value={12}>12 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={48}>48 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Simultaneous Deploys
                    </label>
                    <select
                      value={deployGovernance.maxSimultaneousDeploys}
                      onChange={(e) => setDeployGovernance(prev => ({
                        ...prev,
                        maxSimultaneousDeploys: Number(e.target.value)
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Approval Workflow
                    </label>
                    <select
                      value={deployGovernance.approvalWorkflow}
                      onChange={(e) => setDeployGovernance(prev => ({
                        ...prev,
                        approvalWorkflow: e.target.value as 'sequential' | 'parallel' | 'majority'
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="sequential">Sequential</option>
                      <option value="parallel">Parallel</option>
                      <option value="majority">Majority Vote</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('admin-approvers')}
                  className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    setIsValidating(true)
                    try {
                      // Save all admin configurations to backend
                      const response = await fetch('/api/license/enterprise/update-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          licenseKey,
                          globalSecurityPolicies,
                          approverGroups,
                          deployGovernance
                        })
                      })
                      
                      const data = await response.json()
                      if (data.success) {
                        setStep('complete')
                        await refreshLicenseStatus()
                        
                        // Notify parent that admin setup is complete
                        if (onAdminSetupComplete) {
                          setTimeout(() => {
                            if (onClose) onClose()
                            onAdminSetupComplete()
                          }, 1500) // Small delay to show success message
                        }
                      } else {
                        setValidationError(data.error || 'Failed to save configurations')
                      }
                    } catch (error: any) {
                      console.error('Error saving configurations:', error)
                      setValidationError('Failed to save configurations')
                    } finally {
                      setIsValidating(false)
                    }
                  }}
                  disabled={isValidating}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isValidating && <Loader2 className="animate-spin" size={16} />}
                  {isValidating ? 'Saving...' : 'Complete Setup'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <CheckCircle className="mx-auto mb-6 text-green-600" size={64} />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Enterprise License Activated!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                {deviceRole === 'provision-admin' && 'Admin device provisioned successfully. Enterprise security policies are now active.'}
                {deviceRole === 'register' && 'Device registered successfully. You can now access Pandaura AS with your assigned permissions.'}
                {deviceRole === 'team-member' && 'Team member seat claimed successfully. Welcome to the organization!'}
              </p>
              <button
                onClick={async () => {
                  await refreshLicenseStatus()
                  if (onClose) onClose()
                }}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
              >
                Continue to Project Hub
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
