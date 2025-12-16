import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, UserCheck, UserCog, Users, ArrowRight } from 'lucide-react'

interface EnterpriseFirstRunModalProps {
  isOpen: boolean
  onSelectOption: (option: 'register' | 'provision-admin' | 'team-member') => void
  isFirstDevice: boolean
}

export function EnterpriseFirstRunModal({ 
  isOpen, 
  onSelectOption,
  isFirstDevice 
}: EnterpriseFirstRunModalProps) {
  const [selectedOption, setSelectedOption] = useState<'register' | 'provision-admin' | 'team-member'>('register')

  const handleContinue = () => {
    onSelectOption(selectedOption)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-8 rounded-t-lg">
          <div className="flex items-center space-x-4">
            <Shield size={32} />
            <div>
              <h2 className="text-2xl font-bold">Enterprise License Setup</h2>
              <p className="text-purple-100 text-sm mt-1">First-time device registration</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="space-y-4 mb-8">
            {/* Option 1: Register Device (Regular Employee) */}
            <label className="block cursor-pointer">
              <div className={`border-2 rounded-lg p-5 transition-all ${
                selectedOption === 'register' 
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-lg' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}>
                <div className="flex items-start gap-4">
                  <input
                    type="radio"
                    name="enterpriseOption"
                    value="register"
                    checked={selectedOption === 'register'}
                    onChange={(e) => setSelectedOption(e.target.value as 'register' | 'provision-admin' | 'team-member')}
                    className="mt-1.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck size={20} className="text-green-600 dark:text-green-400" />
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Register This Device to Enterprise License
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      For regular employees/engineers whose company is already set up
                    </p>
                  </div>
                </div>
              </div>
            </label>

            {/* Option 2: Provision Admin Device (First Device Only) */}
            {isFirstDevice && (
              <label className="block cursor-pointer">
                <div className={`border-2 rounded-lg p-5 transition-all ${
                  selectedOption === 'provision-admin' 
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-lg' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}>
                  <div className="flex items-start gap-4">
                    <input
                      type="radio"
                      name="enterpriseOption"
                      value="provision-admin"
                      checked={selectedOption === 'provision-admin'}
                      onChange={(e) => setSelectedOption(e.target.value as 'register' | 'provision-admin' | 'team-member')}
                      className="mt-1.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCog size={20} className="text-orange-600 dark:text-orange-400" />
                        <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Provision Admin Device
                        </span>
                        <span className="text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                          FIRST DEVICE ONLY
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        For IT/Lead Engineer/Admin setting up the organization
                      </p>
                    </div>
                  </div>
                </div>
              </label>
            )}

            {/* Option 3: Add as Team Member */}
            <label className="block cursor-pointer">
              <div className={`border-2 rounded-lg p-5 transition-all ${
                selectedOption === 'team-member' 
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-lg' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}>
                <div className="flex items-start gap-4">
                  <input
                    type="radio"
                    name="enterpriseOption"
                    value="team-member"
                    checked={selectedOption === 'team-member'}
                    onChange={(e) => setSelectedOption(e.target.value as 'register' | 'provision-admin' | 'team-member')}
                    className="mt-1.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={20} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Add as Team Member
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      For users with assigned seats who are not admins
                    </p>
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg text-base font-medium hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg flex items-center gap-2"
            >
              Continue
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
