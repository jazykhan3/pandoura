import { deviceAuth } from '../utils/deviceAuth'

const API_BASE_URL = 'http://localhost:8000/api'

export interface ExternalTool {
  id?: string
  name: string
  urlOrCommand: string
  mode: 'http' | 'cli'
  enabled: boolean
  type?: string
  language?: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface ExternalToolsResponse {
  success: boolean
  tools: ExternalTool[]
  count: number
}

export interface SingleToolResponse {
  success: boolean
  tool: ExternalTool
  message?: string
}

export interface ErrorResponse {
  success: false
  error: string
}

/**
 * Helper to get authenticated headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const sessionToken = await deviceAuth.getSessionToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }
  return headers
}

/**
 * Fetch all external tools
 */
export async function fetchExternalTools(): Promise<ExternalTool[]> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/tools`, {
      method: 'GET',
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.statusText}`)
    }

    const data: ExternalToolsResponse = await response.json()
    return data.tools || []
  } catch (error) {
    console.error('Error fetching external tools:', error)
    throw error
  }
}

/**
 * Create a new external tool
 */
export async function createExternalTool(tool: Omit<ExternalTool, 'id'>): Promise<ExternalTool> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/tools`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(tool),
    })

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json()
      throw new Error(errorData.error || `Failed to create tool: ${response.statusText}`)
    }

    const data: SingleToolResponse = await response.json()
    return data.tool
  } catch (error) {
    console.error('Error creating external tool:', error)
    throw error
  }
}

/**
 * Update an existing external tool
 */
export async function updateExternalTool(id: string, updates: Partial<ExternalTool>): Promise<ExternalTool> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/tools/${id}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json()
      throw new Error(errorData.error || `Failed to update tool: ${response.statusText}`)
    }

    const data: SingleToolResponse = await response.json()
    return data.tool
  } catch (error) {
    console.error('Error updating external tool:', error)
    throw error
  }
}

/**
 * Delete an external tool
 */
export async function deleteExternalTool(id: string): Promise<void> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/tools/${id}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json()
      throw new Error(errorData.error || `Failed to delete tool: ${response.statusText}`)
    }
  } catch (error) {
    console.error('Error deleting external tool:', error)
    throw error
  }
}

/**
 * Toggle tool enabled status
 */
export async function toggleExternalTool(id: string, enabled: boolean): Promise<ExternalTool> {
  return updateExternalTool(id, { enabled })
}

/**
 * Execute a tool from CodeLens
 */
export async function executeToolFromCodeLens(
  toolId: string,
  context: {
    uri: string
    range?: { start: number; end: number }
    document: { content: string; language: string }
    versionId?: string
    projectId?: string
  }
): Promise<any> {
  try {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/tools/execute/code-lens`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        toolId,
        ...context,
      }),
    })

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json()
      throw new Error(errorData.error || `Failed to execute tool: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error executing tool from CodeLens:', error)
    throw error
  }
}
