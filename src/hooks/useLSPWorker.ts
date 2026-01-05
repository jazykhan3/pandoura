import { useEffect, useRef, useCallback } from 'react'
import type { ParseRequest, ParseResult } from '../workers/lspParser.worker'

type UseLSPWorkerOptions = {
  onParseComplete?: (result: ParseResult) => void
  onError?: (error: string) => void
}

export function useLSPWorker({ onParseComplete, onError }: UseLSPWorkerOptions = {}) {
  const workerRef = useRef<Worker | null>(null)
  const pendingRequests = useRef<Map<string, (result: ParseResult) => void>>(new Map())

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../workers/lspParser.worker.ts', import.meta.url),
      { type: 'module' }
    )

    // Handle messages from worker
    workerRef.current.onmessage = (e: MessageEvent<ParseResult>) => {
      const result = e.data
      const callback = pendingRequests.current.get(result.id)

      if (callback) {
        callback(result)
        pendingRequests.current.delete(result.id)
      }

      onParseComplete?.(result)
    }

    // Handle errors
    workerRef.current.onerror = (error) => {
      console.error('LSP Worker error:', error)
      onError?.(error.message)
    }

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [onParseComplete, onError])

  const parse = useCallback(
    (code: string, fileUri: string, parseType: 'full' | 'lazy' = 'full'): Promise<ParseResult> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'))
          return
        }

        const id = `${fileUri}-${Date.now()}-${Math.random()}`
        pendingRequests.current.set(id, resolve)

        const request: ParseRequest = {
          id,
          code,
          fileUri,
          parseType,
        }

        workerRef.current.postMessage(request)

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequests.current.has(id)) {
            pendingRequests.current.delete(id)
            reject(new Error('Parse request timeout'))
          }
        }, 30000)
      })
    },
    []
  )

  return { parse }
}
