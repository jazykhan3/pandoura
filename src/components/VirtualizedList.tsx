import { useRef, useEffect, useState, useCallback } from 'react'

type VirtualizedListProps<T> = {
  items: T[]
  itemHeight: number
  bufferSize?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  onItemClick?: (item: T, index: number) => void
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  bufferSize = 5,
  renderItem,
  className = '',
  onItemClick,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateHeight = () => {
      setContainerHeight(container.clientHeight)
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight)
  
  // Add buffer to prevent white flashing during scroll
  const start = Math.max(0, visibleStart - bufferSize)
  const end = Math.min(items.length, visibleEnd + bufferSize)
  
  const visibleItems = items.slice(start, end)
  const totalHeight = items.length * itemHeight
  const offsetY = start * itemHeight

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%', position: 'relative' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => {
            const actualIndex = start + idx
            return (
              <div
                key={actualIndex}
                style={{ height: `${itemHeight}px` }}
                onClick={() => onItemClick?.(item, actualIndex)}
              >
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
