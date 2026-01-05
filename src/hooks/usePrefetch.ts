import { useEffect, useRef } from 'react'

type PrefetchOptions = {
  enabled?: boolean
  delay?: number
}

export function usePrefetch(modules: (() => Promise<any>)[], options: PrefetchOptions = {}) {
  const { enabled = true, delay = 1000 } = options
  const hasPrefetched = useRef(false)

  useEffect(() => {
    if (!enabled || hasPrefetched.current) return

    const timer = setTimeout(() => {
      // Prefetch modules in the background
      modules.forEach((module) => {
        module().catch((err) => {
          console.warn('Prefetch failed:', err)
        })
      })
      hasPrefetched.current = true
    }, delay)

    return () => clearTimeout(timer)
  }, [enabled, delay, modules])
}

// Prefetch specific routes
export const prefetchDeploy = () => import('../pages/Deploy')
export const prefetchLogicEditor = () => import('../pages/LogicEditor')
export const prefetchTagDatabase = () => import('../pages/TagDatabase')
export const prefetchVersioning = () => import('../pages/VersioningCenter')
