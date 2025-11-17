import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type InputDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value: string) => void
  title: string
  label: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
}

export function InputDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  label, 
  placeholder = '', 
  defaultValue = '',
  required = false
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      setError('')
      // Focus the input after the dialog opens
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [isOpen, defaultValue])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (required && !value.trim()) {
      setError('This field is required')
      return
    }

    // Basic filename validation
    if (value.trim()) {
      const filename = value.trim()
      const invalidChars = /[<>:"/\\|?*]/
      if (invalidChars.test(filename)) {
        setError('Filename contains invalid characters: < > : " / \\ | ? *')
        return
      }
    }

    onConfirm(value.trim())
    onClose()
  }

  const handleCancel = () => {
    setValue(defaultValue)
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <h2 className="font-semibold text-lg text-neutral-900">{title}</h2>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError('')
              }}
              placeholder={placeholder}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent ${
                error ? 'border-red-300 bg-red-50' : 'border-neutral-300'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e)
                }
              }}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-md font-medium bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md font-medium bg-[#FF6A00] text-white hover:bg-[#FF8020] transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}