// Device Authentication Utilities for Frontend

interface DeviceAuthResponse {
  success: boolean
  sessionToken?: string
  needsOnboarding?: boolean
  needsLicenseActivation?: boolean
  device?: any
  users?: any[]
  message?: string
}

class DeviceAuthManager {
  private sessionToken: string | null = null
  // @ts-ignore - Used in runtime but not detected by static analysis
  private _deviceInfo: any = null

  constructor() {
    // Load session token from localStorage if available
    this.sessionToken = localStorage.getItem('device_session_token')
  }

  /**
   * Get or create a session token for this device
   */
  async getSessionToken(): Promise<string | null> {
    console.log('getSessionToken called, current token:', this.sessionToken ? 'exists' : 'null')
    
    if (this.sessionToken) {
      // Validate existing token
      console.log('Validating existing token...')
      const isValid = await this.validateSession()
      if (isValid) {
        console.log('Existing token is valid')
        return this.sessionToken
      } else {
        console.log('Existing token is invalid, clearing it')
        this.sessionToken = null
        localStorage.removeItem('device_session_token')
      }
    }

    // Get new session token
    try {
      console.log('Fetching new session token from /api/device/public-info')
      const response = await fetch('/api/device/public-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: DeviceAuthResponse = await response.json()
      console.log('Public info response:', data)

      if (data.success && data.sessionToken) {
        this.sessionToken = data.sessionToken
        this._deviceInfo = data.device
        localStorage.setItem('device_session_token', data.sessionToken)
        // Cache the full device data to avoid unnecessary API call
        if (data.device && data.users) {
          localStorage.setItem('device_info_cache', JSON.stringify({
            device: data.device,
            users: data.users,
            cached_at: Date.now()
          }))
        }
        console.log('Session token acquired successfully')
        return data.sessionToken
      } else if (data.needsOnboarding) {
        // Device needs onboarding first
        console.log('Device needs onboarding, starting onboarding process')
        const onboardingSuccess = await this.performOnboarding()
        if (onboardingSuccess) {
          return await this.getSessionToken() // Retry after onboarding
        } else {
          console.error('Onboarding failed')
          return null
        }
      } else if (data.needsLicenseActivation) {
        // Device exists but needs license activation
        console.log('Device needs license activation')
        throw new Error('License activation required')
      } else {
        console.error('Unexpected response format:', data)
        return null
      }
    } catch (error) {
      console.error('Error getting session token:', error)
    }

    return null
  }

  /**
   * Perform device onboarding
   */
  async performOnboarding(): Promise<boolean> {
    try {
      console.log('Starting device onboarding...')
      const response = await fetch('/api/device/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('Onboarding response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Onboarding response:', data)
      
      const success = data.success || false
      if (success) {
        console.log('Onboarding completed successfully')
      } else {
        console.error('Onboarding failed:', data.error || 'Unknown error')
      }
      
      return success
    } catch (error) {
      console.error('Error during onboarding:', error)
      return false
    }
  }

  /**
   * Validate current session token
   */
  async validateSession(): Promise<boolean> {
    if (!this.sessionToken) return false

    try {
      const response = await fetch('/api/device/validate-session', {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      })

      return response.ok
    } catch (error) {
      console.error('Error validating session:', error)
      return false
    }
  }

  /**
   * Make authenticated API request
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getSessionToken()
    
    if (!token) {
      throw new Error('No valid session token available')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    })

    // Check for license-related errors
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}))
      if (errorData.code === 'LICENSE_REQUIRED') {
        console.warn('License required for this operation:', errorData.message)
        // You might want to trigger license activation modal here
        throw new Error(errorData.message || 'License activation required')
      }
    }

    return response
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<any> {
    try {
      // Check if we have cached device info from public-info call
      const cached = localStorage.getItem('device_info_cache')
      if (cached) {
        const cacheData = JSON.parse(cached)
        const cacheAge = Date.now() - cacheData.cached_at
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          console.log('Using cached device info')
          return cacheData
        }
      }

      // Otherwise fetch from authenticated endpoint
      const response = await this.authenticatedFetch('/api/device/info')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Device info received:', data) // Debug log
      
      // Update cache
      localStorage.setItem('device_info_cache', JSON.stringify({
        ...data,
        cached_at: Date.now()
      }))
      
      return data
    } catch (error) {
      console.error('Error getting device info:', error)
      throw error
    }
  }

  /**
   * Test the public-info endpoint directly
   */
  async testPublicInfo(): Promise<void> {
    try {
      console.log('Testing /api/device/public-info endpoint...')
      const response = await fetch('/api/device/public-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('Public-info response status:', response.status)
      console.log('Public-info response headers:', Object.fromEntries(response.headers.entries()))
      
      const data = await response.json()
      console.log('Public-info response data:', data)
    } catch (error) {
      console.error('Error testing public-info:', error)
    }
  }

  /**
   * Clear session data
   */
  clearSession(): void {
    this.sessionToken = null
    this._deviceInfo = null
    localStorage.removeItem('device_session_token')
  }
}

// Export singleton instance
export const deviceAuth = new DeviceAuthManager()
export default deviceAuth