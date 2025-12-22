import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  type?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  const getDialogType = () => {
    switch (type) {
      case 'danger':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'info'
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      message={message}
      type={getDialogType()}
      actions={[
        {
          label: cancelLabel,
          onClick: onClose,
          variant: 'secondary'
        },
        {
          label: isLoading ? 'Processing...' : confirmLabel,
          onClick: onConfirm,
          variant: 'danger'
        }
      ]}
    />
  )
}
