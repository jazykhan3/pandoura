import { useState } from 'react'
import { Card } from '../components/Card'
import { mockLogicCode } from '../data/mockData'

export function LogicEditor() {
  const [code, setCode] = useState(mockLogicCode)
  const [isModified, setIsModified] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle')

  const handleSave = () => {
    console.log('Saving logic...')
    setIsModified(false)
    // Simulate save
    setTimeout(() => {
      alert('Logic saved successfully!')
    }, 300)
  }

  const handleValidate = () => {
    setValidationStatus('validating')
    // Simulate validation
    setTimeout(() => {
      setValidationStatus('success')
      setTimeout(() => setValidationStatus('idle'), 3000)
    }, 1000)
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    setIsModified(true)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logic Editor</h1>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-[#E5E7EB] bg-neutral-50">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSave}
              disabled={!isModified}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                isModified 
                  ? 'bg-[#FF6A00] text-white hover:bg-[#FF8020]' 
                  : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
              }`}
            >
              Save
            </button>
            <button 
              onClick={() => setCode(mockLogicCode)}
              className="px-4 py-2 text-sm font-medium bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors duration-150"
            >
              Undo
            </button>
            <button 
              onClick={handleValidate}
              disabled={validationStatus === 'validating'}
              className="px-4 py-2 text-sm font-medium bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors duration-150 disabled:opacity-50"
            >
              {validationStatus === 'validating' ? 'Validating...' : 'Validate'}
            </button>
          </div>

          {validationStatus === 'success' && (
            <div className="text-sm text-green-600 flex items-center gap-1">
              <span>✓</span> Validation passed
            </div>
          )}

          {isModified && (
            <div className="text-xs text-neutral-500">
              • Unsaved changes
            </div>
          )}
        </div>
        <textarea 
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="w-full h-96 p-6 outline-none resize-none font-mono text-sm leading-relaxed bg-white"
          spellCheck={false}
        />
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <div>Lines: {code.split('\n').length}</div>
          <div>Characters: {code.length}</div>
        </div>
      </Card>
    </div>
  )
}


