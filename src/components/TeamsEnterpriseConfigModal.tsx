import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Shield, Users, Building, CheckCircle, ChevronRight } from 'lucide-react'
import { deviceAuth } from '../utils/deviceAuth'

interface TeamsEnterpriseConfigModalProps {
  isOpen: boolean
  onComplete: () => void
}

export function TeamsEnterpriseConfigModal({ isOpen, onComplete }: TeamsEnterpriseConfigModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingLicense, setIsCheckingLicense] = useState(false)
  const [isFirstDevice, setIsFirstDevice] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  // License activation fields
  const [licenseKey, setLicenseKey] = useState('')
  const [adminEmail, setAdminEmail] = useState('')

  const formatLicenseKey = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '')
    const limited = digitsOnly.substring(0, 16)
    const formatted = limited.replace(/(\d{4})(?=\d)/g, '$1-')
    return formatted
  }

  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatLicenseKey(e.target.value)
    setLicenseKey(formattedValue)
    setError(null)
    
    // Check license when it's complete
    if (formattedValue.length >= 19) {
      checkLicenseStatus(formattedValue)
    }
  }

  const checkLicenseStatus = async (key: string) => {
    setIsCheckingLicense(true)
    try {
      const response = await fetch('/api/license/teams/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      })

      const data = await response.json()

      if (data.success) {
        setIsFirstDevice(data.needsSetup)
        if (!data.needsSetup) {
          setError('This license is already configured. You will join as a team member.')
        }
      } else {
        // License doesn't exist yet or error - needs setup (first device)
        setIsFirstDevice(true)
      }
    } catch (error) {
      console.error('Error checking license:', error)
      // On error, assume first device
      setIsFirstDevice(true)
    } finally {
      setIsCheckingLicense(false)
    }
  }

  const handleActivateLicense = async () => {
    if (!licenseKey || licenseKey.length < 19 || !adminEmail) {
      setError('Please enter a complete license key and email')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        throw new Error('No session token available. Please refresh and try again.')
      }

      // Activate Teams license using the general activate-license endpoint
      const response = await fetch('/api/device/activate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          licenseKey,
          ownerEmail: adminEmail,
          licenseType: 'teams'
        })
      })

      const data = await response.json()

      if (data.success) {
        // Show success message and close modal
        setShowSuccessMessage(true)
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
          onComplete()
        }, 1500)
      } else {
        setError(data.error || 'Failed to activate license')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to activate license')
    } finally {
      setIsSaving(false)
    }
  }



  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-8 rounded-t-lg">
          <div className="flex items-center space-x-4">
            <Users size={32} />
            <div>
              <h2 className="text-2xl font-bold">Activate Teams License</h2>
              <p className="text-green-100 text-sm mt-1">Enter your license key and email to activate</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {showSuccessMessage ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Teams License Activated Successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isFirstDevice 
                  ? "You can now configure your organization settings using the 'Manage License' button."
                  : "You have successfully joined the team."}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={20} className="text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Activate Teams License
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter your Teams license key and admin email to begin setup
                </p>
              </div>

              {isCheckingLicense && licenseKey.length >= 19 && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">Checking license status...</p>
                </div>
              )}

              {!isFirstDevice && licenseKey.length >= 19 && !isCheckingLicense && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ℹ️ This license is already configured. You will join the team after activation.
                  </p>
                </div>
              )}

              {isFirstDevice && licenseKey.length >= 19 && !isCheckingLicense && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✓ First device - After activation, use "Manage License" to configure organization settings.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Teams License Key
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleLicenseKeyChange}
                  placeholder="1111-1111-1111-1111"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="admin@company.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isSaving}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This email will be the primary admin for the Teams license
                </p>
              </div>

              <div className="flex justify-end mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={handleActivateLicense}
                  disabled={!licenseKey || licenseKey.length < 19 || !adminEmail || isSaving || isCheckingLicense}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Settings size={20} />
                      </motion.div>
                      Activating...
                    </>
                  ) : isCheckingLicense ? (
                    'Checking...'
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Activate License
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
