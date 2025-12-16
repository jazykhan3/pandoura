import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { Dialog } from './Dialog'
import type { TagValidationRule } from '../types'

interface ValidationRulesManagerProps {
  isOpen: boolean
  onClose: () => void
  tagId?: string
  tagName?: string
  tagType?: string
  onSave: (rules: TagValidationRule[]) => void
}


export function ValidationRulesManager({
  isOpen,
  onClose,
  tagId,
  tagName,
  tagType,
  onSave
}: ValidationRulesManagerProps) {
  const [rules, setRules] = useState<TagValidationRule[]>([])
  const [showAddForm, setShowAddForm] = useState(false)

  // New rule form state
  const [newRuleType, setNewRuleType] = useState<'min' | 'max' | 'range' | 'regex' | 'custom'>('range')
  const [newRuleValue, setNewRuleValue] = useState<any>({ min: 0, max: 100 })
  const [newRuleMessage, setNewRuleMessage] = useState('')
  const [newRuleSeverity, setNewRuleSeverity] = useState<'error' | 'warning' | 'info'>('error')
  const [engineeringUnits, setEngineeringUnits] = useState('')
  const [alarmMin, setAlarmMin] = useState<number | ''>('')
  const [alarmMax, setAlarmMax] = useState<number | ''>('')

  useEffect(() => {
    if (isOpen && tagId) {
      loadRules()
    }
  }, [isOpen, tagId])

  const loadRules = async () => {
    // Mock data - replace with actual API call
    const mockRules: TagValidationRule[] = [
      {
        id: '1',
        type: 'range',
        value: { min: 0, max: 100 },
        message: 'Value must be between 0 and 100',
        severity: 'error'
      },
      {
        id: '2',
        type: 'min',
        value: 0,
        message: 'Value cannot be negative',
        severity: 'warning'
      }
    ]
    setRules(mockRules)
  }

  const handleAddRule = () => {
    const newRule: TagValidationRule = {
      id: `rule_${Date.now()}`,
      type: newRuleType,
      value: newRuleValue,
      message: newRuleMessage.trim() || getDefaultMessage(newRuleType, newRuleValue),
      severity: newRuleSeverity
    }

    setRules([...rules, newRule])
    resetForm()
    setShowAddForm(false)
  }

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id))
  }

  const handleSave = () => {
    onSave(rules)
    onClose()
  }

  const resetForm = () => {
    setNewRuleType('range')
    setNewRuleValue({ min: 0, max: 100 })
    setNewRuleMessage('')
    setNewRuleSeverity('error')
  }

  const getDefaultMessage = (type: string, value: any): string => {
    switch (type) {
      case 'min':
        return `Value must be at least ${value}`
      case 'max':
        return `Value must not exceed ${value}`
      case 'range':
        return `Value must be between ${value.min} and ${value.max}`
      case 'regex':
        return `Value must match pattern: ${value}`
      case 'custom':
        return 'Custom validation failed'
      default:
        return 'Validation failed'
    }
  }

  const renderRuleValue = (rule: TagValidationRule) => {
    switch (rule.type) {
      case 'range':
        return `${rule.value.min} - ${rule.value.max}`
      case 'regex':
        return <code className="text-xs">{rule.value}</code>
      case 'custom':
        return <code className="text-xs">{rule.value.substring(0, 30)}...</code>
      default:
        return String(rule.value)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      case 'info':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700'
    }
  }

  const isNumericType = () => {
    return tagType && ['INT', 'DINT', 'REAL', 'LREAL'].includes(tagType)
  }

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Validation Rules: ${tagName || 'Tag'}`} 
      size="large"
    >
      <div className="p-6 space-y-4">
        {/* Type Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-900 dark:text-blue-200">
              Tag Type: <strong>{tagType || 'Unknown'}</strong>
              {isNumericType() && ' (Numeric validations available)'}
            </span>
          </div>
        </div>

        {/* Engineering Units & Alarms (for numeric types) */}
        {isNumericType() && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Engineering Settings</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Engineering Units</label>
                <input
                  type="text"
                  value={engineeringUnits}
                  onChange={(e) => setEngineeringUnits(e.target.value)}
                  placeholder="e.g., °C, PSI, m/s"
                   className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Alarm Min Threshold</label>
                <input
                  type="number"
                  value={alarmMin}
                  onChange={(e) => setAlarmMin(e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="Low alarm"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Alarm Max Threshold</label>
                <input
                  type="number"
                  value={alarmMax}
                  onChange={(e) => setAlarmMax(e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="High alarm"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Add Rule Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm"
          >
            <Plus size={16} />
            Add Validation Rule
          </button>
        </div>

        {/* Add Rule Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Validation Rule</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    resetForm()
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Rule Type</label>
                    <select
                      value={newRuleType}
                      onChange={(e) => {
                        setNewRuleType(e.target.value as any)
                        // Reset value based on type
                        if (e.target.value === 'range') {
                          setNewRuleValue({ min: 0, max: 100 })
                        } else if (e.target.value === 'custom') {
                          setNewRuleValue('// Custom validation code\nreturn value > 0;')
                        } else {
                          setNewRuleValue('')
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="min">Minimum Value</option>
                      <option value="max">Maximum Value</option>
                      <option value="range">Range (Min-Max)</option>
                      <option value="regex">Regex Pattern</option>
                      <option value="custom">Custom Script</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Severity</label>
                    <select
                      value={newRuleSeverity}
                      onChange={(e) => setNewRuleSeverity(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="error">Error (Block)</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                </div>

                {/* Value Input */}
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Value/Constraint</label>
                  {newRuleType === 'range' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={newRuleValue.min}
                        onChange={(e) => setNewRuleValue({ ...newRuleValue, min: parseFloat(e.target.value) || 0 })}
                        placeholder="Min"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        value={newRuleValue.max}
                        onChange={(e) => setNewRuleValue({ ...newRuleValue, max: parseFloat(e.target.value) || 0 })}
                        placeholder="Max"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  ) : newRuleType === 'custom' ? (
                    <textarea
                      value={newRuleValue}
                      onChange={(e) => setNewRuleValue(e.target.value)}
                      placeholder="// JavaScript expression\n// 'value' is the tag value\nreturn value > 0 && value < 100;"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono h-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  ) : newRuleType === 'regex' ? (
                    <input
                      type="text"
                      value={newRuleValue}
                      onChange={(e) => setNewRuleValue(e.target.value)}
                      placeholder="^[A-Z0-9]+$"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  ) : (
                    <input
                      type="number"
                      value={newRuleValue}
                      onChange={(e) => setNewRuleValue(parseFloat(e.target.value) || 0)}
                      placeholder="Enter value"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Error Message (Optional)</label>
                  <input
                    type="text"
                    value={newRuleMessage}
                    onChange={(e) => setNewRuleMessage(e.target.value)}
                    placeholder={getDefaultMessage(newRuleType, newRuleValue)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <button
                  onClick={handleAddRule}
                  className="w-full px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm"
                >
                  Add Rule
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rules List */}
        <div className="border rounded-lg">
          <div className="max-h-[400px] overflow-y-auto">
            {rules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle size={48} className="mx-auto mb-2 text-gray-300" />
                <p>No validation rules defined</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-2 text-sm text-[#FF6A00] hover:underline"
                >
                  Add your first rule
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase ">
                            {rule.type}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(rule.severity!)}`}>
                            {rule.severity}
                          </span>
                        </div>
                        <div className="mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Value: </span>
                          <span className="text-sm text-gray-900">{renderRuleValue(rule)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{rule.message}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Validation on Operations */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Validation Applies To:</p>
              <ul className="text-xs text-amber-800 dark:text-amber-300 mt-1 space-y-1">
                <li>• Manual tag value updates</li>
                <li>• CSV/JSON imports</li>
                <li>• Bulk operations</li>
                <li>• PLC writes (if configured)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-gray-600">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
            >
              <Save size={16} />
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
