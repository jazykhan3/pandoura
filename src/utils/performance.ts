// Performance monitoring utilities

export class PerformanceMonitor {
  private static marks = new Map<string, number>()
  private static measures = new Map<string, number>()

  // Start a performance measurement
  static mark(name: string) {
    if (typeof performance !== 'undefined') {
      performance.mark(name)
      this.marks.set(name, performance.now())
    }
  }

  // End a performance measurement and log duration
  static measure(name: string, startMark: string) {
    if (typeof performance !== 'undefined' && this.marks.has(startMark)) {
      const duration = performance.now() - this.marks.get(startMark)!
      this.measures.set(name, duration)
      
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)
      
      // Warn if operation takes too long
      if (duration > 100) {
        console.warn(`⚠️ Performance warning: ${name} took ${duration.toFixed(2)}ms (>100ms)`)
      }
      
      return duration
    }
    return 0
  }

  // Check if main thread is blocked
  static isBlocked(): boolean {
    const start = performance.now()
    // Busy wait for 5ms
    while (performance.now() - start < 5) {
      // Do nothing
    }
    const duration = performance.now() - start
    return duration > 10 // If it took more than 10ms, thread was blocked
  }

  // Monitor frame rate
  static monitorFPS(callback: (fps: number) => void, duration = 1000) {
    let frames = 0
    let lastTime = performance.now()
    
    const countFrame = () => {
      frames++
      const currentTime = performance.now()
      
      if (currentTime - lastTime >= duration) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime))
        callback(fps)
        
        if (fps < 30) {
          console.warn(`⚠️ Low FPS detected: ${fps} FPS`)
        }
        
        frames = 0
        lastTime = currentTime
      }
      
      requestAnimationFrame(countFrame)
    }
    
    requestAnimationFrame(countFrame)
  }

  // Get all measurements
  static getMeasures() {
    return Object.fromEntries(this.measures)
  }

  // Clear all measurements
  static clear() {
    this.marks.clear()
    this.measures.clear()
  }
}

// React Hook for performance monitoring
export function usePerformanceMonitor(name: string, enabled = true) {
  if (!enabled || typeof performance === 'undefined') return

  const startMark = `${name}-start`
  const endMark = `${name}-end`
  const measureName = name

  // Mark start on mount
  PerformanceMonitor.mark(startMark)

  return {
    end: () => {
      PerformanceMonitor.mark(endMark)
      PerformanceMonitor.measure(measureName, startMark)
    },
  }
}

// Detect long tasks (>50ms)
export function detectLongTasks(callback: (duration: number) => void) {
  if (typeof PerformanceObserver === 'undefined') return

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) {
        console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`)
        callback(entry.duration)
      }
    }
  })

  try {
    observer.observe({ entryTypes: ['longtask'] })
  } catch (e) {
    console.warn('Long task API not supported')
  }

  return () => observer.disconnect()
}
