import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface ExternalTool {
  id?: string
  name: string
  urlOrCommand: string
  mode: 'http' | 'cli'
  enabled: boolean
  type?: string
  language?: string
  description?: string
}

interface ExternalToolModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (tool: ExternalTool) => void
  editingTool?: ExternalTool | null
}

export function ExternalToolModal({ isOpen, onClose, onSave, editingTool }: ExternalToolModalProps) {
  const [formData, setFormData] = useState<ExternalTool>({
    name: '',
    urlOrCommand: '',
    mode: 'http',
    enabled: true,
    type: 'linter',
    language: 'structured-text',
    description: ''
  })

  useEffect(() => {
    if (editingTool) {
      setFormData(editingTool)
    } else {
      setFormData({
        name: '',
        urlOrCommand: '',
        mode: 'http',
        enabled: true,
        type: 'linter',
        language: 'structured-text',
        description: ''
      })
    }
  }, [editingTool, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {editingTool ? 'Edit External Tool' : 'Add External Tool'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tool Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tool Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="ESLint Analyzer"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
            />
          </div>

          {/* URL / Command */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL / Command <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.urlOrCommand}
              onChange={(e) => setFormData(prev => ({ ...prev, urlOrCommand: e.target.value }))}
              placeholder="http://localhost:5000/analyze or ./tools/script.sh"
              required
              className="w-full px-4 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              For HTTP: Full URL endpoint. For CLI: Path to executable script.
            </p>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mode <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="http"
                  checked={formData.mode === 'http'}
                  onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value as 'http' | 'cli' }))}
                  className="w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">HTTP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="cli"
                  checked={formData.mode === 'cli'}
                  onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value as 'http' | 'cli' }))}
                  className="w-4 h-4 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">CLI</span>
              </label>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tool Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
            >
              <option value="linter">Linter</option>
              <option value="analyzer">Analyzer</option>
              <option value="formatter">Formatter</option>
              <option value="ai-assistant">AI Assistant</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
            >
              <option value="structured-text">Structured Text (ST)</option>
              <option value="ladder-logic">Ladder Logic (LD)</option>
              <option value="function-block">Function Block (FBD)</option>
              <option value="all">All Languages</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this tool do?"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent resize-none"
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="tool-enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 text-[var(--accent-color)] rounded focus:ring-[var(--accent-color)]"
            />
            <label htmlFor="tool-enabled" className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
              Enable this tool
            </label>
          </div>

          {/* Info Box */}
          {/* <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-900 dark:text-blue-100">
            <div className="font-medium mb-1">Tool Integration:</div>
            <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-200">
              <li><strong>HTTP Mode:</strong> POST request with code, returns diagnostics JSON</li>
              <li><strong>CLI Mode:</strong> Executes command with code as stdin, parses stdout</li>
              <li><strong>CodeLens:</strong> Appears inline above functions/programs</li>
              <li><strong>Context Menu:</strong> Right-click in editor to access tools</li>
            </ul>
          </div> */}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.name || !formData.urlOrCommand}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-color)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {editingTool ? 'Update Tool' : 'Add Tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
