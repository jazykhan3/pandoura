import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Check, ArrowRight, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Dialog } from './Dialog'
import { useLicenseStore } from '../store/licenseStore'

interface TeamsEnterpriseOnboardingWizardProps {
  isOpen: boolean
  licenseType: 'Teams' | 'Enterprise'
  onComplete: () => void
  onCancel: () => void
}

export function TeamsEnterpriseOnboardingWizard({
  isOpen,
  licenseType,
  onComplete,
  onCancel
}: TeamsEnterpriseOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [licenseKey, setLicenseKey] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  
  const [approvalPolicies, setApprovalPolicies] = useState({
    requireTwoPersonApproval: true,
    deployRestrictions: {
      production: { requireApproval: true, approverRoles: ['Admin', 'Approver'] },
      staging: { requireApproval: false, approverRoles: [] },
      development: { requireApproval: false, approverRoles: [] }
    }
  })
  
  const [rbacDefaults, setRbacDefaults] = useState({
    defaultRole: 'Viewer',
    availableRoles: ['Viewer', 'Editor', 'Deployer', 'Approver', 'Admin']
  })

  const { activateLicense, checkLicenseStatus } = useLicenseStore()

  const steps = [
    {
      id: 1,
      title: 'License Activation',
      description: 'Enter your license key and organization details'
    },
    {
      id: 2,
      title: 'Device Certification',
      description: 'Certifying this device as the primary admin workstation'
    },
    {
      id: 3,
      title: 'Security Policies',
      description: 'Configure approval workflows and access controls'
    },
    {
      id: 4,
      title: 'Seat Management',
      description: 'Review your license and prepare to add team members'
    }
  ]

  const handleNext = async () => {
    if (currentStep === 1) {
      // Step 1: License activation
      if (!licenseKey || !adminEmail || !orgName) {
        setError('Please fill in all required fields')
        return
      }
      
      setIsProcessing(true)
      setError(null)
      try {
        const success = await activateLicense(licenseKey, adminEmail)
        if (!success) {
          throw new Error('License activation failed')
        }
        
        await checkLicenseStatus()
        setCurrentStep(2)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'License activation failed')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 2) {
      // Step 2: Device certification (automatic)
      setIsProcessing(true)
      setError(null)
      try {
        // Simulate TPM key generation and device certification
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Call backend to configure license with policies
        const response = await fetch('/api/device/license/teams/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            approvalPolicies,
            rbacDefaults,
            orgIdentity: {
              organizationName: orgName,
              adminEmail,
              primaryDeviceId: 'current-device' // Will be set by backend
            }
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Configuration failed')
        }
        
        setCurrentStep(3)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Device certification failed')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 3) {
      // Step 3: Review policies
      setCurrentStep(4)
    } else if (currentStep === 4) {
      // Step 4: Complete
      onComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 1 && !isProcessing) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onCancel} 
      title={`${licenseType} Onboarding`}
      size="xl"
    >
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
            className="min-h-[400px]"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {steps[currentStep - 1].title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {steps[currentStep - 1].description}
              </p>
            </div>

            {/* Step 1: License Activation */}
            {currentStep === 1 && (
              <div className="max-w-md mx-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      License Key *
                    </label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Manufacturing"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@acme.com"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-900 dark:text-blue-200">
                        This device will be registered as the primary admin workstation. Additional seats can be added after setup.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Device Certification */}
            {currentStep === 2 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
                  <Shield size={40} className="text-blue-600 dark:text-blue-400" />
                </div>
                {isProcessing ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-color)] mb-4" />
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      Certifying device and generating security keys...
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      This may take a few moments
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-md text-center">
                      We'll generate TPM-backed security keys and certify this device.
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-w-md w-full">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Security measures:
                      </p>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Generate device fingerprint</li>
                        <li>• Create TPM-backed keypair</li>
                        <li>• Issue device certificate</li>
                        <li>• Map OS user to admin role</li>
                        <li>• Initialize audit ledger</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Security Policies */}
            {currentStep === 3 && (
              <div className="max-w-2xl mx-auto">
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Approval Policies
                    </h3>
                    
                    <div className="space-y-4">
                      <label className="flex items-start">
                        <input
                          type="checkbox"
                          checked={approvalPolicies.requireTwoPersonApproval}
                          onChange={(e) =>
                            setApprovalPolicies({
                              ...approvalPolicies,
                              requireTwoPersonApproval: e.target.checked
                            })
                          }
                          className="mt-1 w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                        />
                        <div className="ml-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Require two-person approval
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Production deployments must be approved by two different team members
                          </p>
                        </div>
                      </label>

                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Production Deployment Approval
                        </p>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={approvalPolicies.deployRestrictions.production.requireApproval}
                            onChange={(e) =>
                              setApprovalPolicies({
                                ...approvalPolicies,
                                deployRestrictions: {
                                  ...approvalPolicies.deployRestrictions,
                                  production: {
                                    ...approvalPolicies.deployRestrictions.production,
                                    requireApproval: e.target.checked
                                  }
                                }
                              })
                            }
                            className="w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Require approval for production deployments
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Role-Based Access Control
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default Role for New Users
                      </label>
                      <select
                        value={rbacDefaults.defaultRole}
                        onChange={(e) =>
                          setRbacDefaults({ ...rbacDefaults, defaultRole: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                      >
                        <option value="Viewer">Viewer (Read-only)</option>
                        <option value="Editor">Editor (Edit logic)</option>
                        <option value="Deployer">Deployer (Can deploy)</option>
                        <option value="Approver">Approver (Can approve)</option>
                      </select>
                      
                      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p><strong>Viewer:</strong> View projects and deployments</p>
                        <p><strong>Editor:</strong> View + Edit logic and tags</p>
                        <p><strong>Deployer:</strong> Editor + Deploy to dev/staging</p>
                        <p><strong>Approver:</strong> View + Approve production deployments</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-900 dark:text-yellow-200">
                      <strong>Note:</strong> These policies can be modified later in Settings → Security & RBAC
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Seat Management */}
            {currentStep === 4 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                  <Check size={40} className="text-white" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Setup Complete! 🎉
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 mb-6">
                    Your {licenseType} workspace is ready. You can now add team members and start collaborating.
                  </p>
                  
                  <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                      Next steps:
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                      <li>• Add team members in Settings → Licenses & Billing</li>
                      <li>• Create your first project</li>
                      <li>• Configure runtime connections</li>
                      <li>• Set up deployment workflows</li>
                    </ul>
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
            disabled={isProcessing || (currentStep === 1 && (!licenseKey || !adminEmail || !orgName))}
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
            ) : currentStep === 2 ? (
              <>
                Certify Device
                <Shield size={16} className="ml-2" />
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
