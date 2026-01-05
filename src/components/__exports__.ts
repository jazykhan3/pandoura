/**
 * Export all new components for easy importing
 * 
 * Add these exports to your existing frontend/src/components/index.ts file
 */

// Onboarding Wizards
export { SoloOnboardingWizard } from './SoloOnboardingWizard'
export { TeamsEnterpriseOnboardingWizard } from './TeamsEnterpriseOnboardingWizard'
export { POCOnboardingWizard } from './POCOnboardingWizard'

// Onboarding Manager (wrapper)
export { OnboardingManager } from './OnboardingManager'

// Security & Policies
export { ApprovalPolicyEditor } from './ApprovalPolicyEditor'

// License Management
export { LicenseExpirationBanner } from './LicenseExpirationBanner'

// Now you can import like this:
// import { SoloOnboardingWizard, ApprovalPolicyEditor } from './components'
