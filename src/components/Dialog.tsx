import { useEffect, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type DialogProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  message?: string
  children?: ReactNode
  type?: 'success' | 'error' | 'info' | 'warning'
  size?: 'small' | 'medium' | 'large' | 'xl'
  actions?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }[]
}

export function Dialog({ isOpen, onClose, title, message, children, type = 'info', size = 'medium', actions }: DialogProps) {
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

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />
      default:
        return <Info className="w-6 h-6 text-blue-600" />
    }
  }

  const getHeaderColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-amber-50 border-amber-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'max-w-sm'
      case 'medium':
        return 'max-w-md'
      case 'large':
        return 'max-w-3xl'
      case 'xl':
        return 'max-w-6xl'
      default:
        return 'max-w-md'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className={`relative bg-white rounded-lg shadow-xl ${getSizeClass()} w-full mx-4 animate-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`flex items-center gap-3 p-4 border-b border-neutral-200 rounded-t-lg ${message ? getHeaderColor() : 'bg-gray-50'}`}>
          {message && getIcon()}
          <h2 className="font-semibold text-lg text-neutral-900">{title}</h2>
          <button
            onClick={onClose}
            className="ml-auto p-1 hover:bg-black hover:bg-opacity-10 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {message ? (
          <div className="p-4">
            <p className="text-neutral-700 whitespace-pre-line">{message}</p>
          </div>
        ) : (
          <div>
            {children}
          </div>
        )}

        {/* Actions - Only show for message dialogs */}
        {message && (
          <div className="flex gap-3 p-4 border-t border-neutral-200">
            {actions && actions.length > 0 ? (
              actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick()
                    onClose()
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-[#FF6A00] text-white hover:bg-[#FF8020]'
                      : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
                  }`}
                >
                  {action.label}
                </button>
              ))
            ) : (
              <button
                onClick={onClose}
                className="ml-auto px-4 py-2 rounded-md font-medium bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors"
              >
                OK
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}