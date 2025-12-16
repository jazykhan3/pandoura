import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Key, Mail, Loader2, AlertCircle, Info, CheckCircle, Building, Settings } from 'lucide-react'
import { useLicenseStore } from '../store/licenseStore'

interface TeamsLicenseModalProps {
  isOpen: boolean
  onClose?: () => void
  onBack: () => void
}

export function TeamsLicenseModal({ isOpen, onClose, onBack }: TeamsLicenseModalProps) {
  const [mode, setMode] = useState<'checking' | 'setup' | 'claim'>('checking')
  const [step, setStep] = useState<'license' | 'setup' | 'complete'>('license')
  const [licenseKey, setLicenseKey] = useState('')
  const [orgName, setOrgName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [maxSeats, setMaxSeats] = useState(5)
  const [userEmail, setUserEmail] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [licenseInfo, setLicenseInfo] = useState<any>(null)
  
  // Approval policies configuration
  const [approvalPolicies, setApprovalPolicies] = useState({
    deploymentApproval: true,
    configChangeApproval: true,
    twoPersonRule: true,
    restrictCriticalDeploys: true
  })
  
  // RBAC defaults configuration
  const [rbacDefaults, setRbacDefaults] = useState({
    defaultRole: 'developer',
    adminCanOverride: true,
    inheritPermissions: true,
    roleHierarchy: ['admin', 'lead', 'developer', 'operator', 'viewer']
  })
  
  // Org identity store configuration
  const [orgIdentity, setOrgIdentity] = useState({
    enableLocalAuth: true,
    allowExternalAuth: false,
    auditUserActions: true
  })
  
  const setupTeamsLicense = async () => {
    if (!licenseKey || !orgName || !adminEmail || !maxSeats) {
      setValidationError('All fields are required')
      return
    }
    
    setIsValidating(true)
    setValidationError(null)
    
    try {
      const setupData = {
        licenseKey,
        orgName,
        adminEmail,
        maxSeats,
        approvalPolicies,
        rbacDefaults,
        orgIdentity
      }
      
      const response = await fetch('/api/license/teams/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStep('complete')
      } else {
        setValidationError(data.error)
      }
    } catch (error) {
      setValidationError('Failed to setup Teams license')
    } finally {
      setIsValidating(false)
    }
  }
  
  const claimTeamsSeat = async () => {
    if (!licenseKey || !userEmail || !deviceName) {
      setValidationError('All fields are required')
      return
    }
    
    setIsValidating(true)
    setValidationError(null)
    
    try {
      const response = await fetch('/api/license/teams/claim-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, userEmail, deviceName })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStep('complete')
      } else {
        setValidationError(data.error)
      }
    } catch (error) {
      setValidationError('Failed to claim Teams seat')
    } finally {
      setIsValidating(false)
    }
  }

  const { setHasValidLicense } = useLicenseStore()
  
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

  // Format Teams license key: 1111-1111-1111-1111 (same as Solo)
  const formatTeamsLicenseKey = (value: string) => {
    // Remove all non-numeric characters
    const digitsOnly = value.replace(/\D/g, '')
    
    // Limit to 16 digits
    const limited = digitsOnly.substring(0, 16)
    
    // Add dashes after every 4 digits
    const formatted = limited.replace(/(\d{4})(?=\d)/g, '$1-')
    
    return formatted
  }

  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatTeamsLicenseKey(e.target.value)
    setLicenseKey(formattedValue)
  }

  // Reset to license entry mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('setup')
      setStep('license')
      setValidationError(null)
    }
  }, [isOpen])
  
  // Check license status when license key changes and is complete
  useEffect(() => {
    if (licenseKey.length >= 19) { // Full license key (1111-1111-1111-1111 = 19 chars)
      checkLicenseStatus()
    }
  }, [licenseKey])

  const checkLicenseStatus = async () => {
    if (!licenseKey || licenseKey.length < 19) return
    
    setIsValidating(true)
    setValidationError(null)
    
    try {
      const response = await fetch('/api/license/teams/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setLicenseInfo(data)
        if (data.exists && !data.needsSetup) {
          setMode('claim')
        } else {
          setMode('setup')
        }
      } else {
        setValidationError(data.error)
        setMode('setup')
      }
    } catch (error) {
      setValidationError('Failed to check license status')
      setMode('setup')
    } finally {
      setIsValidating(false)
    }
  }





  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-8 rounded-t-lg">
          <div className="flex items-center space-x-4">
            <Users size={28} />
            <div>
              <h2 className="text-2xl font-bold">Teams License</h2>
              <p className="text-green-100 text-sm mt-1">
                {isValidating && licenseKey.length >= 20 && 'Checking license status...'}
                {mode === 'setup' && step === 'license' && !isValidating && 'Enter your Teams license key'}
                {mode === 'setup' && step === 'setup' && 'Setup your organization'}
                {mode === 'claim' && 'Claim your seat'}
                {step === 'complete' && 'Activation complete!'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {isValidating && licenseKey.length >= 20 && (
            <div className="text-center py-12">
              <Loader2 className="animate-spin mx-auto mb-4 text-green-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400">Checking license status...</p>
            </div>
          )}

          {/* Setup Mode - License Entry */}
          {mode === 'setup' && step === 'license' && !isValidating && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Info className="text-green-600 dark:text-green-400 mt-0.5" size={18} />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <p className="font-semibold mb-2">New Teams License Setup</p>
                    <p>Enter your Teams license key to begin the setup process.</p>
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-5">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                    <div className="text-sm text-red-800 dark:text-red-200">
                      <p className="font-semibold mb-2">Error</p>
                      <p>{validationError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <Key size={18} className="inline mr-2 text-green-600" />
                  Teams License Key
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleLicenseKeyChange}
                  placeholder="1111-1111-1111-1111"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg"
                  disabled={isValidating}
                />
              </div>
            </motion.div>
          )}

          {/* Setup Mode - Organization Details */}
          {mode === 'setup' && step === 'setup' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Building className="text-blue-600 dark:text-blue-400 mt-0.5" size={18} />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-2">Organization Setup</p>
                    <p>Configure your organization details for the Teams license.</p>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Your Company"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Seats
                  </label>
                  <select
                    value={maxSeats}
                    onChange={(e) => setMaxSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value={5}>5 Seats</option>
                    <option value={10}>10 Seats</option>
                    <option value={25}>25 Seats</option>
                    <option value={50}>50 Seats</option>
                    <option value={100}>100 Seats</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail size={18} className="inline mr-2 text-green-600" />
                  Admin Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              {/* Approval Policies Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <Settings className="mr-2 text-blue-600" size={20} />
                  Approval Policies
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={approvalPolicies.deploymentApproval}
                      onChange={(e) => setApprovalPolicies(prev => ({
                        ...prev,
                        deploymentApproval: e.target.checked
                      }))}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Require deployment approval</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={approvalPolicies.configChangeApproval}
                      onChange={(e) => setApprovalPolicies(prev => ({
                        ...prev,
                        configChangeApproval: e.target.checked
                      }))}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Config change approval</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={approvalPolicies.twoPersonRule}
                      onChange={(e) => setApprovalPolicies(prev => ({
                        ...prev,
                        twoPersonRule: e.target.checked
                      }))}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Two-person approval rule</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={approvalPolicies.restrictCriticalDeploys}
                      onChange={(e) => setApprovalPolicies(prev => ({
                        ...prev,
                        restrictCriticalDeploys: e.target.checked
                      }))}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Restrict critical deployments</span>
                  </label>
                </div>
              </div>
              
              {/* RBAC Defaults Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <Users className="mr-2 text-purple-600" size={20} />
                  RBAC Defaults
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Role
                    </label>
                    <select
                      value={rbacDefaults.defaultRole}
                      onChange={(e) => setRbacDefaults(prev => ({
                        ...prev,
                        defaultRole: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="operator">Operator</option>
                      <option value="developer">Developer</option>
                      <option value="lead">Lead</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={rbacDefaults.adminCanOverride}
                        onChange={(e) => setRbacDefaults(prev => ({
                          ...prev,
                          adminCanOverride: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Admin can override</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={rbacDefaults.inheritPermissions}
                        onChange={(e) => setRbacDefaults(prev => ({
                          ...prev,
                          inheritPermissions: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Inherit permissions</span>
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Org Identity Store Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <Key className="mr-2 text-orange-600" size={20} />
                  Organization Identity Store
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={orgIdentity.enableLocalAuth}
                        onChange={(e) => setOrgIdentity(prev => ({
                          ...prev,
                          enableLocalAuth: e.target.checked
                        }))}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Enable local authentication</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={orgIdentity.allowExternalAuth}
                        onChange={(e) => setOrgIdentity(prev => ({
                          ...prev,
                          allowExternalAuth: e.target.checked
                        }))}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow external auth</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={orgIdentity.auditUserActions}
                        onChange={(e) => setOrgIdentity(prev => ({
                          ...prev,
                          auditUserActions: e.target.checked
                        }))}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Audit user actions</span>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Claim Mode */}
          {mode === 'claim' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-5">
                <div className="flex items-start space-x-3">
                  <Users className="text-green-600 dark:text-green-400 mt-0.5" size={18} />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <p className="font-semibold mb-2">Claim Your Seat</p>
                    <p>Available seats: {licenseInfo?.availableSeats || 0}</p>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail size={18} className="inline mr-2 text-green-600" />
                  Your Email
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="My-Workstation"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </motion.div>
          )}

          {/* Complete */}
          {step === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Teams License Activated!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your Teams license is now active and ready to use.
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-8 py-6 rounded-b-lg flex justify-between items-center">
          <button
            onClick={step === 'complete' ? onClose || (() => {}) : (step === 'setup' && mode === 'setup') ? () => setStep('license') : onBack}
            disabled={isValidating}
            className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50 font-medium"
          >
            {step === 'complete' ? 'Close' : (step === 'setup' && mode === 'setup') ? 'Back' : 'Back to Types'}
          </button>
          
          {mode === 'setup' && step === 'license' && (
            <button
              onClick={() => {
                if (licenseKey.length >= 19) {
                  setStep('setup')
                } else {
                  setValidationError('Please enter a complete license key')
                }
              }}
              disabled={!licenseKey || licenseKey.length < 19 || isValidating}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}

          {mode === 'setup' && step === 'setup' && (
            <button
              onClick={setupTeamsLicense}
              disabled={!orgName || !adminEmail || isValidating}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center space-x-2 font-semibold disabled:cursor-not-allowed"
            >
              {isValidating && <Loader2 className="animate-spin" size={18} />}
              <span>{isValidating ? 'Setting Up...' : 'Setup License'}</span>
            </button>
          )}

          {mode === 'claim' && (
            <button
              onClick={claimTeamsSeat}
              disabled={!userEmail || !deviceName || isValidating}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center space-x-2 font-semibold disabled:cursor-not-allowed"
            >
              {isValidating && <Loader2 className="animate-spin" size={18} />}
              <span>{isValidating ? 'Claiming...' : 'Claim Seat'}</span>
            </button>
          )}

          {step === 'complete' && (
            <button
              onClick={() => {
                setHasValidLicense(true)
                if (onClose) onClose()
              }}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold"
            >
              Continue to App
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default TeamsLicenseModal