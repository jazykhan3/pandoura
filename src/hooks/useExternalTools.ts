import { useEffect, useState } from 'react'
import * as externalToolsApi from '../services/externalToolsApi'
import type { ExternalTool } from '../services/externalToolsApi'

/**
 * Hook to load and manage external tools for the logic editor
 */
export function useExternalTools() {
  const [tools, setTools] = useState<ExternalTool[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTools()
  }, [])

  async function loadTools() {
    setIsLoading(true)
    setError(null)
    try {
      const loadedTools = await externalToolsApi.fetchExternalTools()
      // Only include enabled tools for the editor
      setTools(loadedTools.filter(t => t.enabled))
    } catch (err) {
      console.error('Failed to load external tools:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tools')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Execute a tool on the current code
   */
  async function executeTool(
    toolId: string,
    context: {
      uri: string
      code: string
      language?: string
      versionId?: string
      projectId?: string
      range?: { start: number; end: number }
    }
  ) {
    try {
      const result = await externalToolsApi.executeToolFromCodeLens(toolId, {
        uri: context.uri,
        range: context.range,
        document: {
          content: context.code,
          language: context.language || 'structured-text'
        },
        versionId: context.versionId,
        projectId: context.projectId
      })

      return result
    } catch (err) {
      console.error('Failed to execute tool:', err)
      throw err
    }
  }

  /**
   * Get tools for context menu
   */
  function getContextMenuTools() {
    return tools.filter(t => t.enabled)
  }

  /**
   * Get tools for CodeLens
   */
  function getCodeLensTools(language: string = 'structured-text') {
    return tools.filter(t => 
      t.enabled && 
      (t.language === language || t.language === 'all')
    )
  }

  return {
    tools,
    isLoading,
    error,
    loadTools,
    executeTool,
    getContextMenuTools,
    getCodeLensTools
  }
}
