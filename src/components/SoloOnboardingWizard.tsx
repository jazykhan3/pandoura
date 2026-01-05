import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Monitor, Check, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { useLicenseStore } from '../store/licenseStore'
import deviceAuth from '../utils/deviceAuth'

interface SoloOnboardingWizardProps {
  isOpen: boolean
  onComplete: () => void
  onCancel: () => void
}

export function SoloOnboardingWizard({ isOpen, onComplete, onCancel }: SoloOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    deviceName: '',
    osUser: ''
  })

  const { activateLicense, checkLicenseStatus } = useLicenseStore()

  const steps = [
    {
      id: 1,
      title: 'Welcome to Pandaura',
      description: 'Let\'s set up your Solo workspace in just a few steps.'
    },
    {
      id: 2,
      title: 'Device Provisioning',
      description: 'We\'ll automatically configure this device for secure operation.'
    },
    {
      id: 3,
      title: 'Identity Setup',
      description: 'Creating your local audit identity for compliance tracking.'
    },
    {
      id: 4,
      title: 'Ready to Go!',
      description: 'Your Solo workspace is configured and ready to use.'
    }
  ]

  const handleNext = async () => {
    if (currentStep === 2) {
      // Step 2: Device provisioning
      setIsProcessing(true)
      setError(null)
      try {
        // Perform device onboarding
        const success = await deviceAuth.performOnboarding()
        if (!success) {
          throw new Error('Device provisioning failed')
        }
        
        // Get device info from localStorage cache
        const cached = localStorage.getItem('device_info_cache')
        if (cached) {
          const data = JSON.parse(cached)
          setDeviceInfo({
            deviceName: data.device?.deviceName || 'Unknown Device',
            osUser: data.users?.[0]?.username || 'Unknown User'
          })
        }
        
        setCurrentStep(3)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Device provisioning failed')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 3) {
      // Step 3: Create local audit identity
      setIsProcessing(true)
      setError(null)
      try {
        // Activate Solo license (free tier)
        const success = await activateLicense('SOLO-FREE-TIER', deviceInfo.osUser || 'solo-user')
        if (!success) {
          throw new Error('License activation failed')
        }
        
        // Verify license status
        await checkLicenseStatus()
        
        setCurrentStep(4)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Identity setup failed')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 4) {
      // Step 4: Complete
      onComplete()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title="Solo Onboarding">
      <div className="p-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : currentStep === step.id
                      ? 'bg-[var(--accent-color)] text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check size={20} />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-center text-gray-600 dark:text-gray-400 max-w-[80px]">
                  {step.title.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-colors ${
                    currentStep > step.id
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-[300px]"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {steps[currentStep - 1].title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {steps[currentStep - 1].description}
              </p>
            </div>

            {/* Step-specific content */}
            {currentStep === 1 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-[var(--accent-color)] bg-opacity-10 rounded-full flex items-center justify-center mb-6">
                  <User size={40} className="text-[var(--accent-color)]" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Solo mode is perfect for individual developers and small projects. You'll get:
                  </p>
                  <ul className="text-left space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start">
                      <Check size={20} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Automatic device provisioning</span>
                    </li>
                    <li className="flex items-start">
                      <Check size={20} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Zero-login operational flow</span>
                    </li>
                    <li className="flex items-start">
                      <Check size={20} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Local audit trail for compliance</span>
                    </li>
                    <li className="flex items-start">
                      <Check size={20} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Full access to logic editor and deployment</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
                  <Monitor size={40} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center max-w-md">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-color)] mx-auto mb-4" />
                      <p className="text-gray-700 dark:text-gray-300">
                        Provisioning your device...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        This will only take a moment
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        We'll create a unique device identity and configure secure operation for this machine.
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <strong>What happens:</strong>
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <li>• Generate device fingerprint</li>
                          <li>• Create device certificate</li>
                          <li>• Map OS user to Pandaura identity</li>
                          <li>• Initialize local security settings</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                  <User size={40} className="text-green-600 dark:text-green-400" />
                </div>
                <div className="text-center max-w-md">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-color)] mx-auto mb-4" />
                      <p className="text-gray-700 dark:text-gray-300">
                        Creating your audit identity...
                      </p>
                    </>
                  ) : deviceInfo.osUser ? (
                    <>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        Your local identity has been created and will be used for all audit trail entries.
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Device:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {deviceInfo.deviceName}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">User:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {deviceInfo.osUser}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Profile:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              Solo
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        Creating your local audit identity for compliance tracking.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                  <Check size={40} className="text-white" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    You're all set! 🎉
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 mb-6">
                    Your Solo workspace is ready. You can now start creating projects, editing logic, and deploying to PLCs.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                      <strong>Next steps:</strong> Create your first project or import logic from an existing PLC.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={currentStep === 1 ? onCancel : handleBack}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <ArrowLeft size={16} className="mr-2" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={handleNext}
            disabled={isProcessing}
            className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent-color)] hover:opacity-90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : currentStep === 4 ? (
              <>
                Get Started
                <Check size={16} className="ml-2" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} className="ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
