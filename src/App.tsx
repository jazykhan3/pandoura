import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { useUiStore } from './store/uiStore'
import { useLicenseStore } from './store/licenseStore'
import { Dashboard } from './pages/Dashboard'
import { ShadowRuntime } from './pages/ShadowRuntime'
import { TagDatabase } from './pages/TagDatabase'
import { LogicEditor } from './pages/LogicEditor'
import { Deploy } from './pages/Deploy'
import { VersioningCenter } from './pages/VersioningCenter'
import { ProjectManagement } from './pages/ProjectManagement'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ThemeProvider } from './context/ThemeContext'
import { LicenseTypeSelectionModal } from './components/LicenseTypeSelectionModal'
import { LicenseActivationModal } from './components/LicenseActivationModal'
import { TeamsLicenseModal } from './components/TeamsLicenseModal'
import { EnterpriseLicenseModal } from './components/EnterpriseLicenseModal'
import deviceAuth from './utils/deviceAuth'

function App() {
  const active = useUiStore((s) => s.activeRoute)
  const setRoute = useUiStore((s) => s.setActiveRoute)
  const { 
    hasValidLicense, 
    checkLicenseStatus 
  } = useLicenseStore()

  const [currentModal, setCurrentModal] = useState<'type-selection' | 'solo' | 'teams' | 'enterprise' | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize device and check license status on app startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing app...')
        
        // Step 1: Initialize device (this will trigger TPM generation if first run)
        console.log('📱 Getting session token (will initialize device if needed)...')
        await deviceAuth.getSessionToken()
        
        // Step 2: Check license status
        console.log('🔑 Checking license status...')
        await checkLicenseStatus()
        
        console.log('✅ App initialization complete')
      } catch (error) {
        console.error('❌ Error during app initialization:', error)
      } finally {
        setIsInitializing(false)
      }
    }
    
    initializeApp()
  }, [checkLicenseStatus])

  // Navigate to profile if no license
  useEffect(() => {
    if (!isInitializing && !hasValidLicense) {
      // Auto-navigate to profile page for license activation
      setRoute('profile')
    }
  }, [isInitializing, hasValidLicense, setRoute])

  const handleLicenseTypeSelect = (type: 'solo' | 'teams' | 'enterprise') => {
    setCurrentModal(type)
  }

  const handleBackToTypeSelection = () => {
    setCurrentModal('type-selection')
  }

  // Hide modals if license becomes valid
  useEffect(() => {
    if (hasValidLicense && currentModal) {
      setCurrentModal(null)
    }
  }, [hasValidLicense, currentModal])

  if (isInitializing) {
    return (
      <ThemeProvider>
        <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Loading Application...</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Validating device session</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <Layout>
        {/* Main Application Content */}
        {hasValidLicense ? (
          /* Full access with valid license */
          <>
            {active === 'dashboard' && <Dashboard />}
            {active === 'projects' && <ProjectManagement />}
            {active === 'shadow' && <ShadowRuntime />}
            {active === 'tags' && <TagDatabase />}
            {active === 'logic' && <LogicEditor />}
            {active === 'deploy' && <Deploy />}
            {active === 'versioning' && <VersioningCenter />}
            {active === 'settings' && <SettingsPage />}
            {active === 'profile' && <ProfilePage />}
          </>
        ) : (
          /* Limited access without license - Allow Profile page for license activation */
          <>
            {active === 'dashboard' && (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center p-8">
                  <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">🔒</div>
                  <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Dashboard Locked
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    Activate your license to view dashboard analytics.
                  </p>
                </div>
              </div>
            )}
            {active === 'projects' && (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center p-8">
                  <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">🚫</div>
                  <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Projects Restricted
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    License required to create or access projects.
                  </p>
                </div>
              </div>
            )}
            {(active === 'shadow' || active === 'tags' || active === 'logic' || active === 'deploy' || active === 'versioning') && (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center p-8">
                  <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">⚠️</div>
                  <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Premium Feature
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    This feature requires an active license to access.
                  </p>
                </div>
              </div>
            )}
            {/* Allow access to settings and profile even without license */}
            {active === 'settings' && <SettingsPage />}
            {/* Profile page is accessible WITHOUT license for license activation */}
            {active === 'profile' && <ProfilePage />}
          </>
        )}
      </Layout>

      {/* License Modals */}
      <LicenseTypeSelectionModal
        isOpen={currentModal === 'type-selection'}
        onSelectType={handleLicenseTypeSelect}
      />
      
      <LicenseActivationModal 
        isOpen={currentModal === 'solo'}
        onClose={() => {/* Don't allow closing for solo users without license */}}
      />

      <TeamsLicenseModal
        isOpen={currentModal === 'teams'}
        onBack={handleBackToTypeSelection}
      />

      <EnterpriseLicenseModal
        isOpen={currentModal === 'enterprise'}
        onBack={handleBackToTypeSelection}
      />
    </ThemeProvider>
  )
}

export default App
