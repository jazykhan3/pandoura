import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, FileCode, Check, ArrowRight, ArrowLeft, Loader2, AlertCircle, TestTube } from 'lucide-react'
import { Dialog } from './Dialog'
import { useProjectStore } from '../store/projectStore'

interface POCOnboardingWizardProps {
  isOpen: boolean
  onComplete: (projectId: string) => void
  onCancel: () => void
}

export function POCOnboardingWizard({ isOpen, onComplete, onCancel }: POCOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  
  const [plcConnection, setPlcConnection] = useState<{
    ipAddress: string
    port: string
    vendor: 'rockwell' | 'siemens' | 'beckhoff'
    username: string
    password: string
  }>({
    ipAddress: '',
    port: '44818',
    vendor: 'rockwell',
    username: '',
    password: ''
  })
  
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  
  const [importProgress, setImportProgress] = useState<{
    stage: string
    progress: number
  } | null>(null)
  
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const { createProject, loadProjects } = useProjectStore()

  const steps = [
    {
      id: 1,
      title: 'Create Project',
      description: 'Name your proof-of-concept project'
    },
    {
      id: 2,
      title: 'PLC Connection',
      description: 'Configure connection to your PLC'
    },
    {
      id: 3,
      title: 'Test Connection',
      description: 'Verify connectivity and adapter functionality'
    },
    {
      id: 4,
      title: 'Import Logic',
      description: 'Pull logic and tags from the PLC'
    },
    {
      id: 5,
      title: 'Ready!',
      description: 'Your POC project is ready for testing'
    }
  ]

  const handleNext = async () => {
    if (currentStep === 1) {
      // Step 1: Create project
      if (!projectName.trim()) {
        setError('Please enter a project name')
        return
      }
      
      setIsProcessing(true)
      setError(null)
      try {
        const newProject = await createProject(
          projectName,
          projectDescription || `POC project for ${plcConnection.vendor} PLC`
        )
        
        if (!newProject || !newProject.id) {
          throw new Error('Failed to create project')
        }
        
        setCreatedProjectId(newProject.id.toString())
        await loadProjects()
        setCurrentStep(2)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create project')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 2) {
      // Step 2: PLC connection setup
      if (!plcConnection.ipAddress.trim()) {
        setError('Please enter PLC IP address')
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      // Step 3: Test connection
      setIsProcessing(true)
      setError(null)
      setConnectionTestResult(null)
      
      try {
        const response = await fetch('/api/runtimes/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            vendor: plcConnection.vendor,
            ipAddress: plcConnection.ipAddress,
            port: parseInt(plcConnection.port),
            username: plcConnection.username || undefined,
            password: plcConnection.password || undefined
          })
        })
        
        const data = await response.json()
        
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Connection test failed')
        }
        
        setConnectionTestResult({
          success: true,
          message: 'Connection successful! PLC is reachable.'
        })
        
        // Auto-advance after 1 second
        setTimeout(() => setCurrentStep(4), 1000)
      } catch (err) {
        setConnectionTestResult({
          success: false,
          message: err instanceof Error ? err.message : 'Connection test failed'
        })
        setError(err instanceof Error ? err.message : 'Connection test failed')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 4) {
      // Step 4: Import logic from PLC
      if (!createdProjectId) {
        setError('Project not created')
        return
      }
      
      setIsProcessing(true)
      setError(null)
      setImportProgress({ stage: 'Connecting to PLC', progress: 10 })
      
      try {
        // Create runtime configuration
        const runtimeResponse = await fetch('/api/runtimes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: `${projectName} - PLC`,
            environment: 'development',
            vendor: plcConnection.vendor,
            ipAddress: plcConnection.ipAddress,
            port: parseInt(plcConnection.port),
            username: plcConnection.username || undefined,
            password: plcConnection.password || undefined,
            projectId: createdProjectId
          })
        })
        
        if (!runtimeResponse.ok) {
          throw new Error('Failed to create runtime configuration')
        }
        
        const runtimeData = await runtimeResponse.json()
        const runtimeId = runtimeData.runtime?.id
        
        if (!runtimeId) {
          throw new Error('Runtime ID not returned')
        }
        
        setImportProgress({ stage: 'Reading logic from PLC', progress: 30 })
        
        // Pull logic from PLC
        const pullResponse = await fetch(`/api/runtimes/${runtimeId}/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            scope: {
              includePrograms: true,
              includeTags: true,
              includeDataTypes: true,
              includeRoutines: true,
              includeAOIs: true
            },
            reason: 'Initial import for POC onboarding'
          })
        })
        
        if (!pullResponse.ok) {
          const errorData = await pullResponse.json()
          throw new Error(errorData.error || 'Failed to pull logic from PLC')
        }
        
        await pullResponse.json()
        
        setImportProgress({ stage: 'Creating baseline snapshot', progress: 60 })
        
        // Create Version 0.0.0 (baseline version)
        const versionResponse = await fetch(`/api/projects/${createdProjectId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            versionNumber: '0.0.0',
            description: 'Initial baseline version from PLC import',
            isBaseline: true,
            changes: [
              {
                type: 'import',
                description: 'Imported logic and tags from PLC',
                details: {
                  source: plcConnection.ipAddress,
                  vendor: plcConnection.vendor,
                  timestamp: new Date().toISOString()
                }
              }
            ]
          })
        })
        
        if (!versionResponse.ok) {
          const errorData = await versionResponse.json()
          throw new Error(errorData.error || 'Failed to create baseline version')
        }
        
        setImportProgress({ stage: 'Initializing shadow runtime', progress: 80 })
        
        // Initialize shadow runtime
        const shadowResponse = await fetch(`/api/projects/${createdProjectId}/shadow-runtime/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            versionId: '0.0.0'
          })
        })
        
        if (!shadowResponse.ok) {
          console.warn('Shadow runtime initialization warning (non-blocking)')
          // Don't fail the entire flow if shadow runtime fails
        }
        
        setImportProgress({ stage: 'Complete!', progress: 100 })
        
        // Wait a moment to show completion
        setTimeout(() => setCurrentStep(5), 500)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed')
      } finally {
        setIsProcessing(false)
      }
    } else if (currentStep === 5) {
      // Step 5: Complete
      if (createdProjectId) {
        onComplete(createdProjectId)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1 && !isProcessing) {
      setCurrentStep(currentStep - 1)
      setError(null)
      setConnectionTestResult(null)
    }
  }

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onCancel} 
      title="POC Project Setup - Pull from PLC"
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
                <div className="mt-2 text-xs text-center text-gray-600 dark:text-gray-400 max-w-[70px]">
                  {step.title}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-1 transition-colors ${
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

            {/* Step 1: Create Project */}
            {currentStep === 1 && (
              <div className="max-w-md mx-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="My POC Project"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Brief description of your POC project"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] resize-none"
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-900 dark:text-blue-200">
                        This wizard will connect to your PLC, import existing logic, and create a baseline Version 0.0.0 with shadow runtime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: PLC Connection */}
            {currentStep === 2 && (
              <div className="max-w-md mx-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      PLC Vendor
                    </label>
                    <select
                      value={plcConnection.vendor}
                      onChange={(e) =>
                        setPlcConnection({
                          ...plcConnection,
                          vendor: e.target.value as 'rockwell' | 'siemens' | 'beckhoff'
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    >
                      <option value="rockwell">Rockwell Automation (ControlLogix/CompactLogix)</option>
                      <option value="siemens">Siemens (TIA Portal)</option>
                      <option value="beckhoff">Beckhoff (TwinCAT)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        IP Address *
                      </label>
                      <input
                        type="text"
                        value={plcConnection.ipAddress}
                        onChange={(e) =>
                          setPlcConnection({ ...plcConnection, ipAddress: e.target.value })
                        }
                        placeholder="192.168.1.10"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Port
                      </label>
                      <input
                        type="text"
                        value={plcConnection.port}
                        onChange={(e) =>
                          setPlcConnection({ ...plcConnection, port: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username (if required)
                    </label>
                    <input
                      type="text"
                      value={plcConnection.username}
                      onChange={(e) =>
                        setPlcConnection({ ...plcConnection, username: e.target.value })
                      }
                      placeholder="Optional"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password (if required)
                    </label>
                    <input
                      type="password"
                      value={plcConnection.password}
                      onChange={(e) =>
                        setPlcConnection({ ...plcConnection, password: e.target.value })
                      }
                      placeholder="Optional"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Test Connection */}
            {currentStep === 3 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
                  <TestTube size={40} className="text-blue-600 dark:text-blue-400" />
                </div>
                
                {isProcessing ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-color)] mb-4" />
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      Testing connection to PLC...
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {plcConnection.ipAddress}:{plcConnection.port}
                    </p>
                  </>
                ) : connectionTestResult ? (
                  <>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                      connectionTestResult.success
                        ? 'bg-green-100 dark:bg-green-900'
                        : 'bg-red-100 dark:bg-red-900'
                    }`}>
                      {connectionTestResult.success ? (
                        <Check size={40} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle size={40} className="text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <p className={`text-lg font-semibold mb-2 ${
                      connectionTestResult.success
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {connectionTestResult.success ? 'Connection Successful!' : 'Connection Failed'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {connectionTestResult.message}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-md text-center">
                      Click "Test Connection" to verify that we can reach your PLC and the adapter is functioning correctly.
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-w-md w-full">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">
                            {plcConnection.vendor}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Target:</span>
                          <span className="ml-2 font-mono text-gray-900 dark:text-white">
                            {plcConnection.ipAddress}:{plcConnection.port}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 4: Import Logic */}
            {currentStep === 4 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-6">
                  <FileCode size={40} className="text-purple-600 dark:text-purple-400" />
                </div>
                
                {isProcessing && importProgress ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-color)] mb-4" />
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      {importProgress.stage}
                    </p>
                    <div className="w-full max-w-md mt-4">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[var(--accent-color)] h-full transition-all duration-500"
                          style={{ width: `${importProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                        {importProgress.progress}% complete
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-md text-center">
                      Ready to import logic, tags, and programs from your PLC. This will create Version 0.0.0 and initialize the shadow runtime.
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-w-md w-full">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        What will be imported:
                      </p>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• All programs and routines</li>
                        <li>• Tag definitions and values</li>
                        <li>• Data types and structures</li>
                        <li>• Add-On Instructions (AOIs)</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 5: Complete */}
            {currentStep === 5 && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                  <Check size={40} className="text-white" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    POC Project Ready! 🎉
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 mb-6">
                    Your project has been created with baseline Version 0.0.0. You can now edit logic, test in shadow runtime, and deploy changes.
                  </p>
                  
                  <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                      What's next:
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                      <li>• Review imported logic in Logic Editor</li>
                      <li>• Test changes in Shadow Runtime</li>
                      <li>• Create new versions as you modify logic</li>
                      <li>• Deploy validated changes to your PLC</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && currentStep !== 3 && (
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
            disabled={
              isProcessing ||
              (currentStep === 1 && !projectName.trim()) ||
              (currentStep === 2 && !plcConnection.ipAddress.trim()) ||
              (currentStep === 3 && !connectionTestResult?.success)
            }
            className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent-color)] hover:opacity-90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {currentStep === 3 ? 'Testing...' : currentStep === 4 ? 'Importing...' : 'Processing...'}
              </>
            ) : currentStep === 5 ? (
              <>
                Open Project
                <ArrowRight size={16} className="ml-2" />
              </>
            ) : currentStep === 3 ? (
              connectionTestResult ? (
                <>
                  Continue
                  <ArrowRight size={16} className="ml-2" />
                </>
              ) : (
                <>
                  Test Connection
                  <TestTube size={16} className="ml-2" />
                </>
              )
            ) : currentStep === 4 ? (
              <>
                Import from PLC
                <Database size={16} className="ml-2" />
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
