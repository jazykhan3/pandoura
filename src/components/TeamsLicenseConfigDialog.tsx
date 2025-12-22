import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, 
  Users, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { deviceAuth } from '../utils/deviceAuth'

interface TeamsLicenseConfigDialogProps {
  isOpen: boolean
  onComplete: () => void
  onSkip?: () => void
  onClose?: () => void
}

interface ApprovalPolicies {
  requireTwoPersonApproval: boolean
  deployRestrictions: {
    production: {
      requireApproval: boolean
      approverRoles: string[]
    }
    staging: {
      requireApproval: boolean
      approverRoles: string[]
    }
    development: {
      requireApproval: boolean
      approverRoles: string[]
    }
  }
  criticalChanges: {
    requireApproval: boolean
    approverRoles: string[]
  }
}

interface RbacDefaults {
  defaultRole: string
  availableRoles: string[]
  rolePermissions: {
    [role: string]: string[] | 'all'
  }
}

interface OrgIdentity {
  orgName: string
  department: string
  location: string
  adminContacts: Array<{
    name: string
    email: string
    phone: string
  }>
  localUsers: Array<{
    username: string
    email: string
    role: string
    department: string
  }>
}

export function TeamsLicenseConfigDialog({ 
  isOpen, 
  onComplete,
  onSkip
}: TeamsLicenseConfigDialogProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    production: true,
    staging: false,
    development: false
  })

  // Approval Policies State
  const [approvalPolicies, setApprovalPolicies] = useState<ApprovalPolicies>({
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
    },
    criticalChanges: {
      requireApproval: true,
      approverRoles: ['Admin']
    }
  })

  // RBAC Defaults State
  const [rbacDefaults, setRbacDefaults] = useState<RbacDefaults>({
    defaultRole: 'Viewer',
    availableRoles: ['Viewer', 'Editor', 'Deployer', 'Approver', 'Admin'],
    rolePermissions: {
      Viewer: ['view_projects', 'view_deployments'],
      Editor: ['view_projects', 'view_deployments', 'edit_logic', 'edit_tags'],
      Deployer: ['view_projects', 'view_deployments', 'edit_logic', 'edit_tags', 'deploy_dev', 'deploy_staging'],
      Approver: ['view_projects', 'view_deployments', 'approve_production'],
      Admin: ['all']
    }
  })

  // Organization Identity State
  const [orgIdentity, setOrgIdentity] = useState<OrgIdentity>({
    orgName: '',
    department: '',
    location: '',
    adminContacts: [{ name: '', email: '', phone: '' }],
    localUsers: []
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleAddContact = () => {
    setOrgIdentity(prev => ({
      ...prev,
      adminContacts: [...prev.adminContacts, { name: '', email: '', phone: '' }]
    }))
  }

  const handleRemoveContact = (index: number) => {
    setOrgIdentity(prev => ({
      ...prev,
      adminContacts: prev.adminContacts.filter((_, i) => i !== index)
    }))
  }

  const handleAddUser = () => {
    setOrgIdentity(prev => ({
      ...prev,
      localUsers: [...prev.localUsers, { username: '', email: '', role: 'Viewer', department: '' }]
    }))
  }

  const handleRemoveUser = (index: number) => {
    setOrgIdentity(prev => ({
      ...prev,
      localUsers: prev.localUsers.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!orgIdentity.orgName.trim()) {
      setError('Organization name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const sessionToken = await deviceAuth.getSessionToken()
      
      if (!sessionToken) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/device/license/teams/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          approvalPolicies,
          rbacDefaults,
          orgIdentity
        })
      })

      const data = await response.json()

      if (data.success) {
        onComplete()
      } else {
        setError(data.error || 'Failed to configure license')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to configure license')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield size={32} />
              <div>
                <h2 className="text-2xl font-bold">Configure Teams License</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Set up security policies and organization settings
                </p>
              </div>
            </div>
            <div className="text-sm font-medium bg-white/20 px-4 py-2 rounded-full">
              Step {currentStep} of 3
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-200 dark:bg-gray-700 h-2">
          <motion.div
            className="bg-blue-600 h-full"
            initial={{ width: '33%' }}
            animate={{ width: `${(currentStep / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-medium">Configuration Error</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Approval Policies */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center space-x-3 mb-6">
                  <Shield className="text-blue-600" size={24} />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Approval Policies
                  </h3>
                </div>

                {/* 2-Person Approval */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={approvalPolicies.requireTwoPersonApproval}
                      onChange={(e) => setApprovalPolicies(prev => ({
                        ...prev,
                        requireTwoPersonApproval: e.target.checked
                      }))}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        Require 2-Person Approval
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Production deployments require two separate approvers
                      </div>
                    </div>
                  </label>
                </div>

                {/* Deploy Restrictions */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Environment Deploy Restrictions
                  </h4>

                  {/* Production */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('production')}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="font-medium text-gray-900 dark:text-white">Production</span>
                      </div>
                      {expandedSections.production ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedSections.production && (
                      <div className="p-4 space-y-3">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={approvalPolicies.deployRestrictions.production.requireApproval}
                            onChange={(e) => setApprovalPolicies(prev => ({
                              ...prev,
                              deployRestrictions: {
                                ...prev.deployRestrictions,
                                production: {
                                  ...prev.deployRestrictions.production,
                                  requireApproval: e.target.checked
                                }
                              }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Require approval for production deployments
                          </span>
                        </label>
                        {approvalPolicies.deployRestrictions.production.requireApproval && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Approver Roles
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {['Admin', 'Approver', 'Lead Engineer'].map(role => (
                                <label key={role} className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                                  <input
                                    type="checkbox"
                                    checked={approvalPolicies.deployRestrictions.production.approverRoles.includes(role)}
                                    onChange={(e) => {
                                      const roles = e.target.checked
                                        ? [...approvalPolicies.deployRestrictions.production.approverRoles, role]
                                        : approvalPolicies.deployRestrictions.production.approverRoles.filter(r => r !== role)
                                      setApprovalPolicies(prev => ({
                                        ...prev,
                                        deployRestrictions: {
                                          ...prev.deployRestrictions,
                                          production: { ...prev.deployRestrictions.production, approverRoles: roles }
                                        }
                                      }))
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-sm">{role}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Staging */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('staging')}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="font-medium text-gray-900 dark:text-white">Staging</span>
                      </div>
                      {expandedSections.staging ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedSections.staging && (
                      <div className="p-4">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={approvalPolicies.deployRestrictions.staging.requireApproval}
                            onChange={(e) => setApprovalPolicies(prev => ({
                              ...prev,
                              deployRestrictions: {
                                ...prev.deployRestrictions,
                                staging: {
                                  requireApproval: e.target.checked,
                                  approverRoles: e.target.checked ? ['Admin', 'Deployer'] : []
                                }
                              }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Require approval for staging deployments
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Development */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('development')}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="font-medium text-gray-900 dark:text-white">Development</span>
                      </div>
                      {expandedSections.development ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedSections.development && (
                      <div className="p-4">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={approvalPolicies.deployRestrictions.development.requireApproval}
                            onChange={(e) => setApprovalPolicies(prev => ({
                              ...prev,
                              deployRestrictions: {
                                ...prev.deployRestrictions,
                                development: {
                                  requireApproval: e.target.checked,
                                  approverRoles: []
                                }
                              }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Require approval for development deployments
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: RBAC Defaults */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center space-x-3 mb-6">
                  <Users className="text-blue-600" size={24} />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    RBAC Defaults
                  </h3>
                </div>

                {/* Default Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Role for New Devices
                  </label>
                  <select
                    value={rbacDefaults.defaultRole}
                    onChange={(e) => setRbacDefaults(prev => ({ ...prev, defaultRole: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {rbacDefaults.availableRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    New devices joining the license will be assigned this role by default
                  </p>
                </div>

                {/* Role Permissions Summary */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Role Permissions Overview
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(rbacDefaults.rolePermissions).map(([role, permissions]) => (
                      <div key={role} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="font-medium text-gray-900 dark:text-white mb-2">{role}</div>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(permissions) && permissions.map(perm => (
                            <span key={perm} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                              {perm}
                            </span>
                          ))}
                          {permissions === 'all' && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded">
                              All Permissions
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Organization Identity */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center space-x-3 mb-6">
                  <Building2 className="text-blue-600" size={24} />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Organization Identity
                  </h3>
                </div>

                {/* Organization Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orgIdentity.orgName}
                      onChange={(e) => setOrgIdentity(prev => ({ ...prev, orgName: e.target.value }))}
                      placeholder="Acme Corporation"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Department
                      </label>
                      <input
                        type="text"
                        value={orgIdentity.department}
                        onChange={(e) => setOrgIdentity(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="Manufacturing"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={orgIdentity.location}
                        onChange={(e) => setOrgIdentity(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Plant 1, Building A"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Contacts */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Admin Contacts
                    </label>
                    <button
                      onClick={handleAddContact}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus size={16} />
                      <span>Add Contact</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {orgIdentity.adminContacts.map((contact, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => {
                            const updated = [...orgIdentity.adminContacts]
                            updated[index].name = e.target.value
                            setOrgIdentity(prev => ({ ...prev, adminContacts: updated }))
                          }}
                          placeholder="Name"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                        />
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) => {
                            const updated = [...orgIdentity.adminContacts]
                            updated[index].email = e.target.value
                            setOrgIdentity(prev => ({ ...prev, adminContacts: updated }))
                          }}
                          placeholder="Email"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                        />
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => {
                            const updated = [...orgIdentity.adminContacts]
                            updated[index].phone = e.target.value
                            setOrgIdentity(prev => ({ ...prev, adminContacts: updated }))
                          }}
                          placeholder="Phone"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                        />
                        {orgIdentity.adminContacts.length > 1 && (
                          <button
                            onClick={() => handleRemoveContact(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Local Users */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Local Users (Optional)
                    </label>
                    <button
                      onClick={handleAddUser}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus size={16} />
                      <span>Add User</span>
                    </button>
                  </div>
                  {orgIdentity.localUsers.length > 0 ? (
                    <div className="space-y-3">
                      {orgIdentity.localUsers.map((user, index) => (
                        <div key={index} className="flex gap-2 items-start bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <input
                            type="text"
                            value={user.username}
                            onChange={(e) => {
                              const updated = [...orgIdentity.localUsers]
                              updated[index].username = e.target.value
                              setOrgIdentity(prev => ({ ...prev, localUsers: updated }))
                            }}
                            placeholder="Username"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                          />
                          <input
                            type="email"
                            value={user.email}
                            onChange={(e) => {
                              const updated = [...orgIdentity.localUsers]
                              updated[index].email = e.target.value
                              setOrgIdentity(prev => ({ ...prev, localUsers: updated }))
                            }}
                            placeholder="Email"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                          />
                          <select
                            value={user.role}
                            onChange={(e) => {
                              const updated = [...orgIdentity.localUsers]
                              updated[index].role = e.target.value
                              setOrgIdentity(prev => ({ ...prev, localUsers: updated }))
                            }}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                          >
                            {rbacDefaults.availableRoles.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRemoveUser(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                      No local users added yet. You can add them later.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between">
            <div>
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  disabled={isSubmitting}
                  className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {onSkip && currentStep === 1 && (
                <button
                  onClick={async () => {
                    // Mark onboarding as completed even when skipping
                    try {
                      const sessionToken = await deviceAuth.getSessionToken()
                      if (sessionToken) {
                        await fetch('/api/device/license/teams/skip-configuration', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionToken}`
                          }
                        })
                      }
                    } catch (err) {
                      console.error('Error skipping configuration:', err)
                    }
                    onSkip()
                  }}
                  disabled={isSubmitting}
                  className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Skip for Now
                </button>
              )}
              {currentStep < 3 ? (
                <button
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ChevronDown className="rotate-[-90deg]" size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !orgIdentity.orgName.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Configuring...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Complete Configuration</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
