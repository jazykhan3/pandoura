import { useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useUiStore } from '../store/uiStore'
import type { RouteKey } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectDropdownOpen) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-project-dropdown]')) {
          setProjectDropdownOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [projectDropdownOpen])

  const breadcrumb = useMemo(() => {
    const current = navItems.find((n) => n.key === active)
    const projectPrefix = activeProject ? `${activeProject.name} — ` : ''
    return `${projectPrefix}${current?.label ?? ''}`
  }, [active, activeProject])

  const handleNavClick = (route: RouteKey) => {
    setRoute(route)
    setMobileMenuOpen(false)
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="h-full grid xl:grid-cols-[240px_1fr] lg:grid-cols-[64px_1fr] md:grid-cols-[64px_1fr] grid-cols-1" style={{ gridTemplateRows: 'auto 1fr auto' }}>
        
        {/* Desktop Sidebar - hidden on mobile */}
        <aside className="hidden md:flex col-start-1 row-span-3 bg-[#FF6A00] text-white flex-col">
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
                className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-[#FF6A00] text-white flex flex-col z-50 shadow-2xl"
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

        {/* Topbar */}
        <header className="md:col-start-2 col-start-1 row-start-1 bg-white shadow-soft border-b border-[#E5E7EB] flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <Menu size={20} className="text-neutral-700" />
            </button>
            <div className="text-sm text-neutral-700 truncate">{breadcrumb}</div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {/* Project Selector Dropdown */}
            <div className="relative" data-project-dropdown>
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
              >
                <FolderOpen size={16} className="text-[#FF6A00]" />
                <span className="hidden sm:inline text-gray-700">
                  {isLoading ? 'Loading...' : activeProject ? activeProject.name : 'Select Project'}
                </span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>

              {projectDropdownOpen && (
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
                            activeProject?.id === project.id ? 'bg-[#FF6A00]/5 border-l-2 border-[#FF6A00]' : ''
                          }`}
                        >
                          <FolderOpen size={14} className={activeProject?.id === project.id ? 'text-[#FF6A00]' : 'text-gray-400'} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${
                              activeProject?.id === project.id ? 'text-[#FF6A00]' : 'text-gray-700'
                            }`}>
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
                      className="w-full px-4 py-2 text-sm text-[#FF6A00] hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <FolderKanban size={14} />
                      Manage Projects
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-neutral-500 hidden sm:block">Connected • Shadow Runtime</div>
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
              <User size={16} className="text-neutral-600" />
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="md:col-start-2 col-start-1 row-start-2 overflow-auto p-4 md:p-6 bg-white">
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
        <footer className="md:col-start-2 col-start-1 row-start-3 bg-[#F3F4F6] text-[11px] md:text-[13px] text-neutral-700 border-t border-[#E5E7EB] px-3 md:px-4 flex items-center gap-2 md:gap-4 h-7 md:h-auto overflow-x-auto">
          <span className="whitespace-nowrap">Connected</span>
          <span className="text-neutral-400 hidden sm:inline">|</span>
          <span className="whitespace-nowrap hidden sm:inline">CPU: --%</span>
          <span className="text-neutral-400 hidden md:inline">|</span>
          <span className="whitespace-nowrap hidden md:inline">{new Date().toLocaleString()}</span>
          <span className="ml-auto whitespace-nowrap">Mode: Simulation</span>
        </footer>
      </div>
    </Tooltip.Provider>
  )
}


