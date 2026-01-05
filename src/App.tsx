import { useEffect, useState, lazy, Suspense } from 'react'
import { Layout } from './components/Layout'
import { useUiStore } from './store/uiStore'
import { useLicenseStore } from './store/licenseStore'
import { Dashboard } from './pages/Dashboard'
import { ThemeProvider } from './context/ThemeContext'
import { LicenseTypeSelectionModal } from './components/LicenseTypeSelectionModal'
import { LicenseActivationModal } from './components/LicenseActivationModal'
import { TeamsLicenseModal } from './components/TeamsLicenseModal'
import { EnterpriseLicenseModal } from './components/EnterpriseLicenseModal'
import { PerformanceMonitorWidget } from './components/PerformanceMonitorWidget'
import { usePrefetch, prefetchDeploy, prefetchLogicEditor } from './hooks/usePrefetch'
import deviceAuth from './utils/deviceAuth'

// Code-split heavy pages for better initial load performance
const ShadowRuntime = lazy(() => import('./pages/ShadowRuntime').then(m => ({ default: m.ShadowRuntime })))
const TagDatabase = lazy(() => import('./pages/TagDatabase').then(m => ({ default: m.TagDatabase })))
const LogicEditor = lazy(() => import('./pages/LogicEditor').then(m => ({ default: m.LogicEditor })))
const Deploy = lazy(() => import('./pages/Deploy').then(m => ({ default: m.Deploy })))
const VersioningCenter = lazy(() => import('./pages/VersioningCenter').then(m => ({ default: m.VersioningCenter })))
const ProjectManagement = lazy(() => import('./pages/ProjectManagement').then(m => ({ default: m.ProjectManagement })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))

// Loading fallback component
const PageLoader = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }}></div>
      <p className="text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
)

function App() {
  const active = useUiStore((s) => s.activeRoute)
  const setRoute = useUiStore((s) => s.setActiveRoute)
  const { 
    hasValidLicense, 
    checkLicenseStatus 
  } = useLicenseStore()

  const [currentModal, setCurrentModal] = useState<'type-selection' | 'solo' | 'teams' | 'enterprise' | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Prefetch commonly accessed pages in the background
  usePrefetch([prefetchDeploy, prefetchLogicEditor], {
    enabled: hasValidLicense && !isInitializing,
    delay: 2000, // Wait 2 seconds after app loads
  })

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
          <Suspense fallback={<PageLoader />}>
            {active === 'dashboard' && <Dashboard />}
            {active === 'projects' && <ProjectManagement />}
            {active === 'shadow' && <ShadowRuntime />}
            {active === 'tags' && <TagDatabase />}
            {active === 'logic' && <LogicEditor />}
            {active === 'deploy' && <Deploy />}
            {active === 'versioning' && <VersioningCenter />}
            {active === 'settings' && <SettingsPage />}
            {active === 'profile' && <ProfilePage />}
          </Suspense>
        ) : (
          /* Limited access without license - Allow Profile page for license activation */
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
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

      {/* Performance Monitor (Development Only - Toggle with Ctrl+Shift+P) */}
      {import.meta.env.DEV && <PerformanceMonitorWidget />}
    </ThemeProvider>
  )
}

export default App
