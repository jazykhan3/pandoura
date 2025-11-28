import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, FileText, CheckCircle, Shield, Play } from 'lucide-react'
import { Dialog } from './Dialog'
import type { BulkTagOperation } from '../types'

interface BulkActionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onExecute: (operation: string, params: any, dryRun: boolean) => void
  selectedTagsCount: number
  previewData?: BulkTagOperation
}

export function BulkActionsDialog({
  isOpen,
  onClose,
  onExecute,
  selectedTagsCount,
  previewData
}: BulkActionsDialogProps) {
  const [operationType, setOperationType] = useState<string>('rename')
  const [renamePattern, setRenamePattern] = useState('')
  const [renameReplacement, setRenameReplacement] = useState('')
  const [targetScope, setTargetScope] = useState<string>('global')
  const [targetType, setTargetType] = useState<string>('BOOL')
  const [parentUDT, setParentUDT] = useState<string>('')
  const [showPreview, setShowPreview] = useState(false)

  const handlePreview = () => {
    const params = buildOperationParams()
    onExecute(operationType, params, true)
    setShowPreview(true)
  }

  const handleApply = () => {
    const params = buildOperationParams()
    onExecute(operationType, params, false)
  }

  const buildOperationParams = () => {
    switch (operationType) {
      case 'rename':
        return { pattern: renamePattern, replacement: renameReplacement }
      case 'move':
        return { scope: targetScope }
      case 'convert':
        return { targetType }
      case 'duplicate':
        return { suffix: '_Copy' }
      case 'create-children':
        return { parentUDT }
      default:
        return {}
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Bulk Tag Operations" size="large">
      <div className="p-6 space-y-6">
        {/* Selection Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-blue-900">
              {selectedTagsCount} tag{selectedTagsCount !== 1 ? 's' : ''} selected for bulk operation
            </span>
          </div>
        </div>

        {/* Operation Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Operation
          </label>
          <select
            value={operationType}
            onChange={(e) => {
              setOperationType(e.target.value)
              setShowPreview(false)
            }}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="rename">Bulk Rename (Pattern)</option>
            <option value="move">Move to Scope</option>
            <option value="convert">Type Conversion</option>
            <option value="duplicate">Duplicate Tags</option>
            <option value="create-children">Create Children under UDT</option>
            <option value="delete">Archive Tags</option>
            <option value="export">Export Selection</option>
          </select>
        </div>

        {/* Operation-Specific Parameters */}
        <div className="border-t pt-4">
          {operationType === 'rename' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Find Pattern (Regex supported)
                </label>
                <input
                  type="text"
                  value={renamePattern}
                  onChange={(e) => setRenamePattern(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder="e.g., _PV$ or ^Temp"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use regex patterns to match tag names
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Replace With
                </label>
                <input
                  type="text"
                  value={renameReplacement}
                  onChange={(e) => setRenameReplacement(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder="e.g., _ProcessValue"
                />
              </div>
            </div>
          )}

          {operationType === 'move' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Scope
              </label>
              <select
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="global">Global</option>
                <option value="program">Program</option>
                <option value="task">Task</option>
              </select>
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs text-yellow-800">
                  <Shield size={14} className="inline mr-1" />
                  Moving tags to different scopes may require approval
                </p>
              </div>
            </div>
          )}

          {operationType === 'convert' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Data Type
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="BOOL">BOOL</option>
                <option value="INT">INT</option>
                <option value="DINT">DINT</option>
                <option value="REAL">REAL</option>
                <option value="STRING">STRING</option>
              </select>
              <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-xs text-red-800">
                  <AlertTriangle size={14} className="inline mr-1" />
                  Type conversion may cause data loss. Preview changes carefully.
                </p>
              </div>
            </div>
          )}

          {operationType === 'create-children' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent UDT Name
              </label>
              <input
                type="text"
                value={parentUDT}
                onChange={(e) => setParentUDT(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="MotorUDT"
              />
              <p className="text-xs text-gray-500 mt-1">
                Selected tags will become children of this UDT
              </p>
            </div>
          )}

          {operationType === 'delete' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="text-red-600 mb-2" size={24} />
              <p className="text-sm text-red-900 font-medium mb-2">
                This will archive {selectedTagsCount} tag{selectedTagsCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-800">
                Archived tags can be restored from the lifecycle filter.
              </p>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {showPreview && previewData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t pt-4"
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Dry-Run Preview
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-xs text-gray-600">Operation</p>
                <p className="text-lg font-bold text-blue-900">{previewData.operation}</p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-xs text-gray-600">Affected Tags</p>
                <p className="text-lg font-bold text-green-900">{previewData.affectedTags}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded">
                <p className="text-xs text-gray-600">Status</p>
                <p className="text-lg font-bold text-amber-900">
                  {previewData.dryRun ? 'DRY RUN' : 'READY'}
                </p>
              </div>
            </div>

            {previewData.changes && previewData.changes.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-2">
                <h4 className="text-xs font-medium text-gray-600 mb-2">Changes:</h4>
                {previewData.changes && previewData.changes.slice(0, 20).map((change: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="flex-1">
                      <strong>{change.tagName}</strong>: {change.action}
                    </span>
                  </div>
                ))}
                {previewData.changes.length > 20 && (
                  <p className="text-xs text-gray-500 text-center">
                    ... and {previewData.changes.length - 20} more
                  </p>
                )}
              </div>
            )}

            {previewData.affectedFiles && previewData.affectedFiles.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-600 mb-2">Affected Files:</h4>
                <div className="space-y-1">
                  {previewData.affectedFiles!.map((file: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 rounded text-sm">
                      <FileText size={14} className="text-amber-600" />
                      <span>{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewData.requiresApproval && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded p-3">
                <Shield size={16} className="inline mr-2 text-orange-600" />
                <span className="text-sm text-orange-800">
                  This operation requires approval before execution
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Play size={16} />
              Preview Changes
            </button>
            <button
              onClick={handleApply}
              disabled={!showPreview || !previewData}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} />
              Apply Operation
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
