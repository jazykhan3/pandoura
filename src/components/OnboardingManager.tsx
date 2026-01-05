import { useState, useEffect } from 'react'
import { useLicenseStore } from '../store/licenseStore'
import { SoloOnboardingWizard } from '../components/SoloOnboardingWizard'
import { TeamsEnterpriseOnboardingWizard } from '../components/TeamsEnterpriseOnboardingWizard'
import { POCOnboardingWizard } from '../components/POCOnboardingWizard'

/**
 * Onboarding Manager Component
 * 
 * Detects first-run scenarios and launches appropriate onboarding wizard
 * 
 * Usage: Add to your main App.tsx before rendering the main application
 * 
 * <OnboardingManager>
 *   <App />
 * </OnboardingManager>
 */

interface OnboardingManagerProps {
  children: React.ReactNode
}

export function OnboardingManager({ children }: OnboardingManagerProps) {
  const [onboardingState, setOnboardingState] = useState<{
    type: 'solo' | 'teams' | 'enterprise' | 'poc' | null
    isOpen: boolean
  }>({
    type: null,
    isOpen: false
  })

  const { checkLicenseStatus } = useLicenseStore()

  useEffect(() => {
    checkOnboardingNeeded()
  }, [])

  const checkOnboardingNeeded = async () => {
    try {
      // Check device status
      const response = await fetch('/api/device/status', {
        credentials: 'include'
      })
      
      const data = await response.json()

      // First-run detection
      if (data.needsOnboarding) {
        // Show Solo onboarding by default
        setOnboardingState({
          type: 'solo',
          isOpen: true
        })
        return
      }

      // License activation needed
      if (data.needsLicenseActivation) {
        // Check if user wants Teams/Enterprise (could come from query param)
        const urlParams = new URLSearchParams(window.location.search)
        const licenseType = urlParams.get('licenseType')

        if (licenseType === 'teams' || licenseType === 'enterprise') {
          setOnboardingState({
            type: licenseType as 'teams' | 'enterprise',
            isOpen: true
          })
        }
        return
      }

      // POC flow - triggered by specific route
      const isPOCFlow = window.location.hash.includes('create-poc') || 
                        window.location.hash.includes('import-from-plc')
      
      if (isPOCFlow) {
        setOnboardingState({
          type: 'poc',
          isOpen: true
        })
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error)
    }
  }

  const handleOnboardingComplete = async () => {
    // Refresh license status
    await checkLicenseStatus()
    
    // Close wizard
    setOnboardingState({
      type: null,
      isOpen: false
    })

    // Redirect to appropriate page
    if (onboardingState.type === 'poc') {
      // POC wizard handles its own navigation
      return
    }

    // Navigate to dashboard
    window.location.hash = '#/dashboard'
  }

  const handleOnboardingCancel = () => {
    setOnboardingState({
      type: null,
      isOpen: false
    })

    // Redirect to landing page or login
    window.location.hash = '#/'
  }

  return (
    <>
      {/* Solo Onboarding */}
      <SoloOnboardingWizard
        isOpen={onboardingState.type === 'solo' && onboardingState.isOpen}
        onComplete={handleOnboardingComplete}
        onCancel={handleOnboardingCancel}
      />

      {/* Teams Onboarding */}
      <TeamsEnterpriseOnboardingWizard
        isOpen={onboardingState.type === 'teams' && onboardingState.isOpen}
        licenseType="Teams"
        onComplete={handleOnboardingComplete}
        onCancel={handleOnboardingCancel}
      />

      {/* Enterprise Onboarding */}
      <TeamsEnterpriseOnboardingWizard
        isOpen={onboardingState.type === 'enterprise' && onboardingState.isOpen}
        licenseType="Enterprise"
        onComplete={handleOnboardingComplete}
        onCancel={handleOnboardingCancel}
      />

      {/* POC/Pull-from-PLC Onboarding */}
      <POCOnboardingWizard
        isOpen={onboardingState.type === 'poc' && onboardingState.isOpen}
        onComplete={(projectId) => {
          // Navigate to Logic Editor with new project
          window.location.hash = `#/logic-editor?project=${projectId}`
          setOnboardingState({ type: null, isOpen: false })
        }}
        onCancel={handleOnboardingCancel}
      />

      {/* Render children (main app) */}
      {children}
    </>
  )
}
