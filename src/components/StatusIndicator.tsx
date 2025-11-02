type StatusIndicatorProps = {
  status: 'online' | 'warning' | 'offline'
  size?: 'sm' | 'md'
}

export function StatusIndicator({ status, size = 'sm' }: StatusIndicatorProps) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
  const colorClass = {
    online: 'bg-green-500',
    warning: 'bg-yellow-500',
    offline: 'bg-red-500',
  }[status]

  return <div className={`${sizeClass} rounded-full ${colorClass}`} />
}

