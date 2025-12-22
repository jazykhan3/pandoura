import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Key, Mail, X, Loader2, AlertCircle } from 'lucide-react'
import { useLicenseStore } from '../store/licenseStore'

interface LicenseActivationModalProps {
  isOpen: boolean
  onClose?: () => void
}

export function LicenseActivationModal({ isOpen, onClose }: LicenseActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const [showRestrictedMessage, setShowRestrictedMessage] = useState(false)
  const [showCloseWarning, setShowCloseWarning] = useState(false)

  const {
    isActivatingLicense,
    activationError,
    activateLicense
  } = useLicenseStore()

  const handleClose = () => {
    if (onClose) {
      setShowCloseWarning(true)
    }
  }

  const confirmClose = () => {
    setShowCloseWarning(false)
    setShowRestrictedMessage(false)
    if (onClose) {
      onClose()
    }
  }

  const cancelClose = () => {
    setShowCloseWarning(false)
  }

  const handleExit = () => {
    setIsClosing(true)
    // Show user what they can/cannot do without license
    setTimeout(() => {
      setIsClosing(false)
      setShowRestrictedMessage(true)
    }, 1500)
  }

  const formatLicenseKey = (value: string) => {
    // Remove all non-numeric characters
    const digitsOnly = value.replace(/\D/g, '')
    
    // Limit to 16 digits
    const limited = digitsOnly.substring(0, 16)
    
    // Add dashes after every 4 digits
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
      return
    }

    const success = await activateLicense(trimmedKey, trimmedEmail)
    
    if (success) {
      // License activated successfully - modal will be automatically hidden by store
      console.log('License activated, user can now access the application')
    }
  }

  const isFormValid = licenseKey.trim().length > 0 && ownerEmail.trim().length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl relative"
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} className="text-white" />
          </button>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6A00] to-orange-600 text-white p-8 rounded-t-lg">
          <div className="flex items-center space-x-4">
            <Shield size={32} />
            <div>
              <h2 className="text-3xl font-bold">Activate Pandaura AS License</h2>
              <p className="text-orange-100 text-base mt-2">License activation required to continue</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-12 space-y-8">

          {/* Error message */}
          {activationError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-5">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium mb-1">Activation Failed</p>
                  <p>{activationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Restricted Access Message */}
          {showRestrictedMessage && (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-5">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={18} />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-3 text-lg">Limited Access Without License</p>
                  <div className="space-y-2">
                    <p className="font-medium text-red-600 dark:text-red-400">🚫 Restricted Features:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                      <li>Cannot create new projects</li>
                      <li>Cannot open existing projects</li>
                      <li>Cannot use version control</li>
                      <li>Cannot deploy applications</li>
                      <li>Cannot access advanced features</li>
                    </ul>
                    <p className="font-medium text-green-600 dark:text-green-400 mt-3">✅ Available Features:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                      <li>View application interface</li>
                      <li>Access settings and profile</li>
                      <li>License activation (this modal)</li>
                    </ul>
                    <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                      <p className="text-sm font-medium">💡 To unlock all features, please activate your license above.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowRestrictedMessage(false)}
                    className="mt-4 text-sm text-yellow-700 dark:text-yellow-300 underline hover:no-underline"
                  >
                    Hide this message
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* License Key Input */}
          <div>
            <label htmlFor="licenseKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Key size={18} className="inline mr-2 text-[#FF6A00]" />
              License Key
            </label>
            <input
              id="licenseKey"
              type="text"
              value={licenseKey}
              onChange={handleLicenseKeyChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] transition-colors font-mono text-lg tracking-wide"
              disabled={isActivatingLicense}
              autoComplete="off"
              maxLength={19}
            />
          </div>

          {/* Owner Email Input */}
          <div>
            <label htmlFor="ownerEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Mail size={18} className="inline mr-2 text-[#FF6A00]" />
              Owner Email (for certificate bind)
            </label>
            <input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] transition-colors"
              disabled={isActivatingLicense}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-8 py-6 rounded-b-lg">
          <div className="flex justify-center items-center space-x-6">
            <button
              onClick={handleExit}
              disabled={isActivatingLicense}
              className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50 font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              {isClosing ? 'Closing...' : 'Exit'}
            </button>
            
            <button
              onClick={handleActivate}
              disabled={!isFormValid || isActivatingLicense}
              className="px-8 py-3 bg-gradient-to-r from-[#FF6A00] to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:bg-gray-400 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {isActivatingLicense && <Loader2 className="animate-spin" size={18} />}
              <span>{isActivatingLicense ? 'Activating...' : 'Activate'}</span>
            </button>
          </div>
        </div>

        {/* Close Warning Dialog */}
        {showCloseWarning && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-20 rounded-lg backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md mx-4"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <AlertCircle size={24} className="text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Close Without Activating?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    You won't be able to create or access projects without a license. You can activate your license later from the profile page.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={cancelClose}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Stay Here
                </button>
                <button
                  onClick={confirmClose}
                  className="flex-1 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                  Close Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default LicenseActivationModal