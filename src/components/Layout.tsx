import { useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useUiStore } from '../store/uiStore'
import type { RouteKey } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'
import { useLicenseStore } from '../store/licenseStore'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useTheme } from '../context/ThemeContext'
import { LicenseTypeSelectionModal } from './LicenseTypeSelectionModal'
import { LicenseActivationModal } from './LicenseActivationModal'
import { TeamsEnterpriseConfigModal } from './TeamsEnterpriseConfigModal'
import { PullFromPLCDialog } from './PullFromPLCDialog'
import {
  Home,
  Activity,
  Database,
  Braces,
  Upload,
  GitBranch,
  FolderKanban,
  Settings,
  User,
  Menu,
  X,
  ChevronDown,
  FolderOpen,
  LogOut,
  AlertTriangle,
  Key,
  Download,
} from 'lucide-react'

type NavItem = {
  key: RouteKey
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'projects', label: 'Projects', icon: <FolderKanban size={18} /> },
  { key: 'shadow', label: 'Shadow Runtime', icon: <Activity size={18} /> },
  { key: 'tags', label: 'Tag Database', icon: <Database size={18} /> },
  { key: 'logic', label: 'Logic Editor', icon: <Braces size={18} /> },
  { key: 'deploy', label: 'Deploy', icon: <Upload size={18} /> },
  { key: 'versioning', label: 'Versioning Center', icon: <GitBranch size={18} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={18} /> },
]

export function Layout({ children }: { children: ReactNode }) {
  const active = useUiStore((s) => s.activeRoute)
  const setRoute = useUiStore((s) => s.setActiveRoute)
  const { projects, activeProject, isLoading, setActiveProject, loadProjects } = useProjectStore()
  const { hasValidLicense } = useLicenseStore()
  const { } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [showLicenseTypeModal, setShowLicenseTypeModal] = useState(false)
  const [showSoloActivationModal, setShowSoloActivationModal] = useState(false)
  const [showTeamsActivationModal, setShowTeamsActivationModal] = useState(false)
  const [showPullDialog, setShowPullDialog] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      if (projectDropdownOpen && !target.closest('[data-project-dropdown]')) {
        setProjectDropdownOpen(false)
      }
      
      if (profileDropdownOpen && !target.closest('[data-profile-dropdown]')) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [projectDropdownOpen, profileDropdownOpen])

  const breadcrumb = useMemo(() => {
    const current = navItems.find((n) => n.key === active)
    // Only show project name if user has valid license
    const projectPrefix = (hasValidLicense && activeProject) ? `${activeProject.name} — ` : ''
    return `${projectPrefix}${current?.label ?? ''}`
  }, [active, activeProject, hasValidLicense])

  const handleNavClick = (route: RouteKey) => {
    setRoute(route)
    setMobileMenuOpen(false)
  }

  const handleLicenseTypeSelected = (type: 'solo' | 'teams' | 'enterprise') => {
    setShowLicenseTypeModal(false)
    
    if (type === 'solo') {
      setShowSoloActivationModal(true)
    } else if (type === 'teams' || type === 'enterprise') {
      setShowTeamsActivationModal(true)
    }
  }

  const handleSoloActivationComplete = async () => {
    setShowSoloActivationModal(false)
    const { checkLicenseStatus } = useLicenseStore.getState()
    await checkLicenseStatus()
  }

  const handleTeamsActivationComplete = async () => {
    setShowTeamsActivationModal(false)
    const { checkLicenseStatus } = useLicenseStore.getState()
    await checkLicenseStatus()
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="h-full grid xl:grid-cols-[240px_1fr] lg:grid-cols-[64px_1fr] md:grid-cols-[64px_1fr] grid-cols-1 bg-white dark:bg-panda-surface-dark transition-colors duration-300" style={{ gridTemplateRows: 'auto 1fr auto' }}>
        
        {/* Desktop Sidebar - uses brand color (not accent) */}
        <aside className="hidden md:flex col-start-1 row-span-3 bg-[#FF6A00] dark:bg-gray-900 text-white flex-col transition-colors duration-300">
          <div className="h-14 flex items-center px-4 font-semibold tracking-wide text-base xl:justify-start lg:justify-center md:justify-center justify-start">
            <span className="xl:inline lg:hidden md:hidden inline">Pandaura</span>
            <span className="xl:hidden lg:inline md:inline hidden text-xl">P</span>
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = active === item.key
              return (
                <Tooltip.Root key={item.key}>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setRoute(item.key)}
                      className={`w-full flex items-center gap-3 xl:px-3 lg:px-2 md:px-2 px-3 py-2 xl:justify-start lg:justify-center md:justify-center justify-start rounded-md transition-all duration-200 ${
                        isActive ? 'bg-white/20 shadow-sm' : 'hover:bg-white/10'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="opacity-95">{item.icon}</span>
                      <span className="text-sm xl:inline lg:hidden md:hidden inline">{item.label}</span>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="bg-neutral-900 text-white text-xs px-2 py-1 rounded shadow-lg xl:hidden lg:block md:block hidden"
                      sideOffset={8}
                    >
                      {item.label}
                      <Tooltip.Arrow className="fill-neutral-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )
            })}
          </nav>
        </aside>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden fixed inset-0 bg-black/50 z-40"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-[#FF6A00] dark:bg-gray-900 text-white flex flex-col z-50 shadow-2xl"
              >
                <div className="h-14 flex items-center justify-between px-4">
                  <span className="font-semibold tracking-wide text-base">Pandaura</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-md transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <nav className="flex-1 px-2 space-y-1 py-2">
                  {navItems.map((item) => {
                    const isActive = active === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNavClick(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-md transition-all duration-200 ${
                          isActive ? 'bg-white/20 shadow-sm' : 'hover:bg-white/10'
                        }`}
                      >
                        <span className="opacity-95">{item.icon}</span>
                        <span className="text-sm">{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* License Activation Banner - Shows when no valid license */}
        {!hasValidLicense && (
          <div className="md:col-start-2 col-start-1 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg z-50">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">License Activation Required</p>
                <p className="text-xs opacity-90">Device initialized with TPM security. Activate license to unlock all features.</p>
              </div>
            </div>
            <button
              onClick={() => setShowLicenseTypeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-colors font-medium text-sm whitespace-nowrap flex-shrink-0"
            >
              <Key size={16} />
              Activate License
            </button>
          </div>
        )}

        {/* Topbar */}
        <header className="md:col-start-2 col-start-1 row-start-1 bg-white dark:bg-panda-card-dark shadow-soft dark:shadow-soft-dark border-b border-[#E5E7EB] dark:border-panda-border-dark flex items-center justify-between px-4 md:px-6 h-14 transition-colors duration-300">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors"
            >
              <Menu size={20} className="text-neutral-700 dark:text-neutral-300" />
            </button>
            <div className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{breadcrumb}</div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {/* Pull from PLC Button - Only visible with license */}
            {hasValidLicense && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setShowPullDialog(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Download size={16} />
                    <span className="hidden md:inline">Pull from PLC</span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="bottom"
                    className="bg-neutral-900 text-white text-xs px-2 py-1 rounded shadow-lg md:hidden"
                    sideOffset={5}
                  >
                    Pull from PLC
                    <Tooltip.Arrow className="fill-neutral-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
            
            {/* Project Selector Dropdown - Disabled without license */}
            <div className="relative" data-project-dropdown>
              <button
                onClick={() => hasValidLicense && setProjectDropdownOpen(!projectDropdownOpen)}
                disabled={!hasValidLicense}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors ${
                  hasValidLicense 
                    ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <FolderOpen size={16} style={{ color: 'var(--accent-color)' }} />
                <span className="hidden sm:inline text-gray-700 dark:text-gray-300">
                  {!hasValidLicense 
                    ? 'Activate License' 
                    : isLoading 
                      ? 'Loading...' 
                      : activeProject 
                        ? activeProject.name 
                        : 'Select Project'
                  }
                </span>
                <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
              </button>

              {projectDropdownOpen && hasValidLicense && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {projects.length > 0 ? (
                    <div className="py-1">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setActiveProject(project)
                            setProjectDropdownOpen(false)
                          }}
                          className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                            activeProject?.id === project.id ? 'border-l-2' : ''
                          }`}
                          style={activeProject?.id === project.id ? { 
                            backgroundColor: 'var(--accent-subtle)', 
                            borderLeftColor: 'var(--accent-color)' 
                          } : {}}
                        >
                          <FolderOpen size={14} style={activeProject?.id === project.id ? { color: 'var(--accent-color)' } : { color: '#9ca3af' }} />
                          <div className="flex-1 min-w-0">
                            <div 
                              className="text-sm font-medium truncate"
                              style={{ color: activeProject?.id === project.id ? 'var(--accent-color)' : '#374151' }}
                            >
                              {project.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {new Date(project.last_opened).toLocaleDateString()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No projects available
                    </div>
                  )}
                  <div className="border-t border-gray-200">
                    <button
                      onClick={() => {
                        setRoute('projects')
                        setProjectDropdownOpen(false)
                      }}
                      className="w-full px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      <FolderKanban size={14} />
                      Manage Projects
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-neutral-500 dark:text-gray-400 hidden sm:block">Connected • Shadow Runtime</div>
            
            {/* Profile Dropdown */}
            <div className="relative" data-profile-dropdown>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
                style={{ background: 'linear-gradient(to bottom right, var(--accent-color), var(--accent-dark))' }}
              >
                <User size={16} className="text-white" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
                  {/* Profile Header */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--accent-color), var(--accent-dark))' }}>
                        <User size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">Natasha</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">natasha@pandaura.com</div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setRoute('profile')
                        setProfileDropdownOpen(false)
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      <User size={16} className="text-gray-400 dark:text-gray-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">View Profile</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Manage your account settings</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setRoute('settings')
                        setProfileDropdownOpen(false)
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      <Settings size={16} className="text-gray-400 dark:text-gray-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Settings</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Configure your workspace</div>
                      </div>
                    </button>

                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                    
                    <button
                      onClick={() => {
                        // Handle logout logic here
                        setProfileDropdownOpen(false)
                        alert('Logout functionality would be implemented here')
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      <LogOut size={16} className="text-gray-400 dark:text-gray-500" />
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Sign out</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="md:col-start-2 col-start-1 row-start-2 overflow-auto p-4 md:p-6 bg-white dark:bg-panda-surface-dark transition-colors duration-300">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Status Bar */}
        <footer className="md:col-start-2 col-start-1 row-start-3 bg-[#F3F4F6] dark:bg-panda-bg-secondary-dark text-[11px] md:text-[13px] text-neutral-700 dark:text-neutral-300 border-t border-[#E5E7EB] dark:border-panda-border-dark px-3 md:px-4 flex items-center gap-2 md:gap-4 h-7 md:h-auto overflow-x-auto transition-colors duration-300">
          <span className="whitespace-nowrap">Connected</span>
          <span className="text-neutral-400 hidden sm:inline">|</span>
          <span className="whitespace-nowrap hidden sm:inline">CPU: --%</span>
          <span className="text-neutral-400 hidden md:inline">|</span>
          <span className="whitespace-nowrap hidden md:inline">{new Date().toLocaleString()}</span>
          <span className="ml-auto whitespace-nowrap">Mode: Simulation</span>
        </footer>

        {/* License Modals */}
        <LicenseTypeSelectionModal 
          isOpen={showLicenseTypeModal}
          onSelectType={handleLicenseTypeSelected}
          onClose={() => setShowLicenseTypeModal(false)}
        />
        <LicenseActivationModal 
          isOpen={showSoloActivationModal}
          onClose={handleSoloActivationComplete}
        />
        <TeamsEnterpriseConfigModal 
          isOpen={showTeamsActivationModal}
          onComplete={handleTeamsActivationComplete}
        />

        {/* Pull from PLC Dialog */}
        <PullFromPLCDialog
          isOpen={showPullDialog}
          onClose={() => setShowPullDialog(false)}
          currentUser={{
            userId: '1',
            username: 'developer',
            role: 'engineer'
          }}
          projectId={activeProject?.id}
          projectName={activeProject?.name}
          entryPoint="topbar-menu"
        />
      </div>
    </Tooltip.Provider>
  )
}


