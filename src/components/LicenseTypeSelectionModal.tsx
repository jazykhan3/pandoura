import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, User, Users, X, AlertTriangle } from 'lucide-react'

interface LicenseTypeSelectionModalProps {
  isOpen: boolean
  onSelectType: (type: 'solo' | 'teams' | 'enterprise') => void
  onClose?: () => void
}

export function LicenseTypeSelectionModal({ isOpen, onSelectType, onClose }: LicenseTypeSelectionModalProps) {
  const [selectedType, setSelectedType] = useState<'solo' | 'teams' | 'enterprise'>('solo')
  const [showCloseWarning, setShowCloseWarning] = useState(false)

  const handleContinue = () => {
    onSelectType(selectedType)
  }

  const handleClose = () => {
    if (onClose) {
      setShowCloseWarning(true)
    }
  }

  const confirmClose = () => {
    setShowCloseWarning(false)
    if (onClose) {
      onClose()
    }
  }

  const cancelClose = () => {
    setShowCloseWarning(false)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-75 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl relative"
        >
          {/* Close Button */}
          {onClose && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF6A00] to-orange-600 text-white p-8 rounded-t-lg">
            <div className="flex items-center space-x-4">
              <Shield size={32} />
              <div>
                <h2 className="text-2xl font-bold">Choose Your License Type</h2>
                <p className="text-orange-100 text-sm mt-1">Select the license that fits your needs</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select the type of license you want to activate for this device.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {/* Solo License */}
              <label className="block cursor-pointer">
                <div className={`border-2 rounded-lg p-4 transition-all ${
                  selectedType === 'solo' 
                    ? 'border-[#FF6A00] bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="licenseType"
                      value="solo"
                      checked={selectedType === 'solo'}
                      onChange={(e) => setSelectedType(e.target.value as 'solo' | 'teams' | 'enterprise')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User size={18} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Solo License</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Individual developer license for single device use
                      </p>
                    </div>
                  </div>
                </div>
              </label>

              {/* Teams License */}
              <label className="block cursor-pointer">
                <div className={`border-2 rounded-lg p-4 transition-all ${
                  selectedType === 'teams' 
                    ? 'border-[#FF6A00] bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="licenseType"
                      value="teams"
                      checked={selectedType === 'teams'}
                      onChange={(e) => setSelectedType(e.target.value as 'solo' | 'teams' | 'enterprise')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={18} className="text-green-600 dark:text-green-400" />
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Teams License</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Multi-seat license with collaboration features for small teams
                      </p>
                    </div>
                  </div>
                </div>
              </label>

              {/* Enterprise License */}
              <label className="block cursor-pointer">
                <div className={`border-2 rounded-lg p-4 transition-all ${
                  selectedType === 'enterprise' 
                    ? 'border-[#FF6A00] bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="licenseType"
                      value="enterprise"
                      checked={selectedType === 'enterprise'}
                      onChange={(e) => setSelectedType(e.target.value as 'solo' | 'teams' | 'enterprise')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield size={18} className="text-purple-600 dark:text-purple-400" />
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Enterprise License</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Advanced security, RBAC, approval workflows, and audit controls
                      </p>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {onClose && (
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleContinue}
                className="px-6 py-2 bg-gradient-to-r from-[#FF6A00] to-orange-600 text-white rounded-lg text-sm font-medium hover:from-[#E55F00] hover:to-orange-700 transition-all shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Close Warning Dialog */}
      {showCloseWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[10000] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <AlertTriangle size={24} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Close License Activation?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Without an active license, you won't be able to create or access projects. You can only view your profile and settings.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={cancelClose}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Continue Activation
              </button>
              <button
                onClick={confirmClose}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Close Anyway
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}