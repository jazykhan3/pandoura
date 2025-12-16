import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Key, Mail, Loader2, AlertCircle, X } from 'lucide-react'
import { useLicenseStore } from '../store/licenseStore'
import { deviceAuth } from '../utils/deviceAuth'
import { TeamsLicenseConfigDialog } from './TeamsLicenseConfigDialog'

interface TeamsEnterpriseActivationModalProps {
  isOpen: boolean
  onClose?: () => void  
  onActivationComplete: (isFirstDevice: boolean) => void
}

export function TeamsEnterpriseActivationModal({ 
  isOpen, 
  onClose, 
  onActivationComplete 
}: TeamsEnterpriseActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [activationError, setActivationError] = useState<string | null>(null)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [isFirstDevice, setIsFirstDevice] = useState(false)

  const setLicenseStatus = useLicenseStore((state) => state.setLicenseStatus)

  const formatLicenseKey = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '')
    const limited = digitsOnly.substring(0, 16)
    const formatted = limited.replace(/(\d{4})(?=\d)/g, '$1-')
    return formatted
  }

  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatLicenseKey(e.target.value)
    setLicenseKey(formattedValue)
  }

  const handleActivate = async () => {
    const trimmedKey = licenseKey.trim()
    const trimmedEmail = ownerEmail.trim()

    if (!trimmedKey || !trimmedEmail) {
      setActivationError('Please enter both license key and email address')
      return
    }

    setIsActivating(true)
    setActivationError(null)

    try {
      // Get session token
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        throw new Error('No session token available. Please refresh and try again.')
      }

      // Call backend to activate Teams/Enterprise license
      const response = await fetch('/api/device/activate-teams-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          licenseKey: trimmedKey,
          ownerEmail: trimmedEmail
        })
      })

      const data = await response.json()

      console.log('Teams activation response:', data)
      console.log('isFirstDevice:', data.isFirstDevice)
      console.log('needsConfiguration:', data.needsConfiguration)

      if (data.success) {
        // Check if configuration is needed (organization not set up yet)
        const needsSetup = data.needsConfiguration || false
        const firstDevice = data.isFirstDevice || false
        
        console.log('Configuration needed:', needsSetup)
        
        // Update license store directly with Teams license data
        setLicenseStatus({
          hasValidLicense: true,
          needsLicenseActivation: false,
          licenseInfo: {
            licenseId: data.licenseId,
            licenseType: data.licenseType,
            ownerEmail: trimmedEmail,
            features: [],
            limits: { max_seats: data.maxDevices },
            bindingId: '',
            boundAt: new Date().toISOString(),
            lastValidated: new Date().toISOString()
          }
        })
        
        console.log('✅ Teams license store updated')
        
        // Reset form
        setActivationError(null)
        setLicenseKey('')
        setOwnerEmail('')
        
        // Show configuration dialog if license needs setup (regardless of device order)
        if (needsSetup) {
          console.log('License needs configuration - showing config dialog')
          setIsFirstDevice(firstDevice)
          setShowConfigDialog(true)
        } else {
          console.log('License already configured, completing activation')
          // License already configured, just complete activation
          onActivationComplete(firstDevice)
        }
      } else {
        setActivationError(data.error || 'Failed to activate license')
      }
    } catch (error: any) {
      setActivationError(error.message || 'Failed to activate license')
    } finally {
      setIsActivating(false)
    }
  }

  const isFormValid = licenseKey.trim().length > 0 && ownerEmail.trim().length > 0

  const handleConfigComplete = () => {
    setShowConfigDialog(false)
    onActivationComplete(isFirstDevice)
  }

  const handleConfigSkip = () => {
    setShowConfigDialog(false)
    onActivationComplete(isFirstDevice)
  }

  if (!isOpen) return null

  // Show configuration dialog if activated and is first device
  if (showConfigDialog) {
    return (
      <TeamsLicenseConfigDialog
        isOpen={true}
        onSkip={handleConfigSkip}
        onComplete={handleConfigComplete}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl"
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-8 rounded-t-lg">
          <div className="flex items-center space-x-4">
            <Users size={32} />
            <div>
              <h2 className="text-2xl font-bold">Activate Teams/Enterprise License</h2>
              <p className="text-green-100 text-sm mt-1">Multi-seat license with collaboration features</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">

          {/* Error message */}
          {activationError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium mb-1">Activation Failed</p>
                  <p>{activationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* License Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Key size={16} className="inline mr-2" />
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={handleLicenseKeyChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-mono"
              disabled={isActivating}
            />
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Mail size={16} className="inline mr-2" />
              Owner Email
            </label>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="admin@company.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isActivating}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            {onClose && (
              <button
                onClick={onClose}
                disabled={isActivating}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleActivate}
              disabled={!isFormValid || isActivating}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isActivating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Users size={16} />
                  Activate License
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
