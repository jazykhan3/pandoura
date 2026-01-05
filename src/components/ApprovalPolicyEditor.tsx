import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, X, Save, AlertTriangle } from 'lucide-react'
import { Card } from './Card'

interface ApprovalPolicy {
  requireTwoPersonApproval: boolean
  deployRestrictions: {
    [environment: string]: {
      requireApproval: boolean
      approverRoles: string[]
    }
  }
}

interface ApprovalPolicyEditorProps {
  initialPolicies?: ApprovalPolicy
  onSave: (policies: ApprovalPolicy) => Promise<void>
  availableRoles?: string[]
}

const DEFAULT_POLICIES: ApprovalPolicy = {
  requireTwoPersonApproval: true,
  deployRestrictions: {
    production: {
      requireApproval: true,
      approverRoles: ['Admin', 'Approver']
    },
    staging: {
      requireApproval: false,
      approverRoles: []
    },
    development: {
      requireApproval: false,
      approverRoles: []
    }
  }
}

const DEFAULT_ROLES = ['Admin', 'Approver', 'Deployer', 'Editor', 'Viewer']

export function ApprovalPolicyEditor({
  initialPolicies,
  onSave,
  availableRoles = DEFAULT_ROLES
}: ApprovalPolicyEditorProps) {
  const [policies, setPolicies] = useState<ApprovalPolicy>(initialPolicies || DEFAULT_POLICIES)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (initialPolicies) {
      setPolicies(initialPolicies)
    }
  }, [initialPolicies])

  const handleToggleTwoPersonApproval = (enabled: boolean) => {
    setPolicies(prev => ({
      ...prev,
      requireTwoPersonApproval: enabled
    }))
    setHasChanges(true)
  }

  const handleToggleEnvironmentApproval = (environment: string, requireApproval: boolean) => {
    setPolicies(prev => ({
      ...prev,
      deployRestrictions: {
        ...prev.deployRestrictions,
        [environment]: {
          ...prev.deployRestrictions[environment],
          requireApproval
        }
      }
    }))
    setHasChanges(true)
  }

  const handleAddApproverRole = (environment: string, role: string) => {
    setPolicies(prev => {
      const currentRoles = prev.deployRestrictions[environment]?.approverRoles || []
      if (currentRoles.includes(role)) {
        return prev
      }

      return {
        ...prev,
        deployRestrictions: {
          ...prev.deployRestrictions,
          [environment]: {
            ...prev.deployRestrictions[environment],
            approverRoles: [...currentRoles, role]
          }
        }
      }
    })
    setHasChanges(true)
  }

  const handleRemoveApproverRole = (environment: string, roleToRemove: string) => {
    setPolicies(prev => ({
      ...prev,
      deployRestrictions: {
        ...prev.deployRestrictions,
        [environment]: {
          ...prev.deployRestrictions[environment],
          approverRoles: prev.deployRestrictions[environment].approverRoles.filter(r => r !== roleToRemove)
        }
      }
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await onSave(policies)
      setSuccess(true)
      setHasChanges(false)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save approval policies')
    } finally {
      setIsSaving(false)
    }
  }

  const environments = Object.keys(policies.deployRestrictions)

  return (
    <div className="space-y-6">
      {/* Two-Person Approval */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start flex-1">
              <Shield className="w-6 h-6 text-[var(--accent-color)] mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Two-Person Approval Rule
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Require two different team members to approve critical deployments. The person who initiates a deployment cannot also approve it.
                </p>
                
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policies.requireTwoPersonApproval}
                    onChange={(e) => handleToggleTwoPersonApproval(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)] rounded"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Enable two-person approval for production deployments
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Recommended for critical environments to prevent unauthorized changes
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {policies.requireTwoPersonApproval && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
            >
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-200">
                  With this policy enabled, production deployments will require approval from two separate team members with designated approver roles.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </Card>

      {/* Environment-Specific Policies */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Environment-Specific Approval Policies
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Configure which environments require approval and which roles can approve deployments.
          </p>

          <div className="space-y-4">
            {environments.map((environment) => {
              const policy = policies.deployRestrictions[environment]
              const availableRolesToAdd = availableRoles.filter(
                role => !policy.approverRoles.includes(role)
              )

              return (
                <div
                  key={environment}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                        {environment}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {environment === 'production' && 'Live production systems'}
                        {environment === 'staging' && 'Pre-production testing environment'}
                        {environment === 'development' && 'Development and testing'}
                      </p>
                    </div>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policy.requireApproval}
                        onChange={(e) =>
                          handleToggleEnvironmentApproval(environment, e.target.checked)
                        }
                        className="w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)] rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Require Approval
                      </span>
                    </label>
                  </div>

                  {policy.requireApproval && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Approver Roles
                        </label>
                        
                        {/* Selected Roles */}
                        {policy.approverRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {policy.approverRoles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-[var(--accent-color)] bg-opacity-10 text-[var(--accent-color)]"
                              >
                                {role}
                                <button
                                  onClick={() => handleRemoveApproverRole(environment, role)}
                                  className="ml-2 hover:bg-[var(--accent-color)] hover:bg-opacity-20 rounded-full p-0.5"
                                >
                                  <X size={14} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 italic">
                            No approver roles selected
                          </p>
                        )}

                        {/* Add Role Dropdown */}
                        {availableRolesToAdd.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddApproverRole(environment, e.target.value)
                                e.target.value = ''
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                          >
                            <option value="">Add approver role...</option>
                            {availableRolesToAdd.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {policy.approverRoles.length === 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-xs text-red-800 dark:text-red-200">
                            <strong>Warning:</strong> At least one approver role should be selected when approval is required.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Save/Error Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border border-green-200 dark:border-green-800 rounded-lg"
        >
          <p className="text-sm text-green-800 dark:text-green-200">
            ✓ Approval policies saved successfully
          </p>
        </motion.div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-end space-x-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent-color)] hover:opacity-90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center"
        >
          {isSaving ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"
              />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" />
              Save Policies
            </>
          )}
        </button>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          How Approval Policies Work
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Users with designated approver roles can approve deployments to restricted environments</li>
          <li>• Two-person approval requires a different user than the one who initiated the deployment</li>
          <li>• Approval requests are tracked in the audit log for compliance</li>
          <li>• Users without proper approver roles cannot approve deployments even if they have deploy permissions</li>
        </ul>
      </div>
    </div>
  )
}
