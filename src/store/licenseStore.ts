import { create } from 'zustand'

interface LicenseInfo {
  licenseId: string
  licenseType: string
  ownerEmail: string
  features: string[]
  limits: Record<string, any>
  bindingId: string
  boundAt: string
  lastValidated: string
}

interface LicenseState {
  hasValidLicense: boolean
  needsLicenseActivation: boolean
  onboardingCompleted: boolean
  licenseActivated: boolean
  licenseInfo: LicenseInfo | null
  isActivatingLicense: boolean
  activationError: string | null
  showActivationModal: boolean
  
  // Actions
  setLicenseStatus: (status: { hasValidLicense: boolean; needsLicenseActivation: boolean; onboardingCompleted?: boolean; licenseActivated?: boolean; licenseInfo?: LicenseInfo }) => void
  setActivationLoading: (loading: boolean) => void
  setActivationError: (error: string | null) => void
  showLicenseModal: () => void
  hideLicenseModal: () => void
  activateLicense: (licenseKey: string, ownerEmail: string) => Promise<boolean>
  checkLicenseStatus: () => Promise<void>
}

export const useLicenseStore = create<LicenseState>((set) => ({
  hasValidLicense: false,
  needsLicenseActivation: true,
  onboardingCompleted: false,
  licenseActivated: false,
  licenseInfo: null,
  isActivatingLicense: false,
  activationError: null,
  showActivationModal: false,

  setLicenseStatus: (status) => {
    set({
      hasValidLicense: status.hasValidLicense,
      needsLicenseActivation: status.needsLicenseActivation,
      onboardingCompleted: status.onboardingCompleted ?? false,
      licenseActivated: status.licenseActivated ?? false,
      licenseInfo: status.licenseInfo || null
    })
  },

  setActivationLoading: (loading) => {
    set({ isActivatingLicense: loading })
  },

  setActivationError: (error) => {
    set({ activationError: error })
  },

  showLicenseModal: () => {
    set({ showActivationModal: true, activationError: null })
  },

  hideLicenseModal: () => {
    set({ showActivationModal: false, activationError: null })
  },

  activateLicense: async (licenseKey: string, ownerEmail: string) => {
    set({ isActivatingLicense: true, activationError: null })

    try {
      const response = await fetch('/api/device/activate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ licenseKey, ownerEmail })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update license status
        set({
          hasValidLicense: true,
          needsLicenseActivation: false,
          licenseInfo: data.license,
          showActivationModal: false,
          activationError: null
        })
        
        console.log('License activated successfully:', data)
        return true
      } else {
        const errorMessage = data.details || data.error || 'License activation failed'
        set({ activationError: errorMessage })
        console.error('License activation failed:', data)
        return false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error during activation'
      set({ activationError: errorMessage })
      console.error('Error activating license:', error)
      return false
    } finally {
      set({ isActivatingLicense: false })
    }
  },

  checkLicenseStatus: async () => {
    try {
      const response = await fetch('/api/device/license-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        
        console.log('📊 License Status Response:', data)
        
        set({
          hasValidLicense: !data.needsLicenseActivation,
          needsLicenseActivation: data.needsLicenseActivation,
          onboardingCompleted: data.onboardingCompleted || false,
          licenseActivated: data.licenseActivated || false,
          licenseInfo: data.license || null
        })

        // Do NOT auto-show modal - user will see banner and go to profile page
      }
    } catch (error) {
      console.error('Error checking license status:', error)
      // Assume license is needed if we can't check
      set({
        hasValidLicense: false,
        needsLicenseActivation: true,
        onboardingCompleted: false,
        licenseActivated: false,
        showActivationModal: false  // Don't auto-show modal
      })
    }
  }
}))

export default useLicenseStore