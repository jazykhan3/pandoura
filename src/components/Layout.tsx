import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useUiStore } from '../store/uiStore'
import type { RouteKey } from '../store/uiStore'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  Home,
  Activity,
  Database,
  Braces,
  Upload,
  Settings,
  User,
} from 'lucide-react'

type NavItem = {
  key: RouteKey
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'shadow', label: 'Shadow Runtime', icon: <Activity size={18} /> },
  { key: 'tags', label: 'Tag Database', icon: <Database size={18} /> },
  { key: 'logic', label: 'Logic Editor', icon: <Braces size={18} /> },
  { key: 'deploy', label: 'Deploy', icon: <Upload size={18} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={18} /> },
]

export function Layout({ children }: { children: ReactNode }) {
  const active = useUiStore((s) => s.activeRoute)
  const setRoute = useUiStore((s) => s.setActiveRoute)

  const breadcrumb = useMemo(() => {
    const current = navItems.find((n) => n.key === active)
    return `Pandaura > ${current?.label ?? ''}`
  }, [active])

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="h-full grid xl:grid-cols-[240px_1fr] lg:grid-cols-[64px_1fr] grid-cols-[240px_1fr]" style={{ gridTemplateRows: '56px 1fr 28px' }}>
        {/* Sidebar */}
        <aside className="col-start-1 row-span-3 bg-[#FF6A00] text-white flex flex-col">
          <div className="h-14 flex items-center px-4 font-semibold tracking-wide text-base xl:justify-start lg:justify-center justify-start">
            <span className="xl:inline lg:hidden inline">Pandaura</span>
            <span className="xl:hidden lg:inline hidden text-xl">P</span>
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = active === item.key
              return (
                <Tooltip.Root key={item.key}>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setRoute(item.key)}
                      className={`w-full flex items-center gap-3 xl:px-3 lg:px-2 px-3 py-2 xl:justify-start lg:justify-center justify-start rounded-md transition-all duration-200 ${
                        isActive ? 'bg-white/20 shadow-sm' : 'hover:bg-white/10'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="opacity-95">{item.icon}</span>
                      <span className="text-sm xl:inline lg:hidden inline">{item.label}</span>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="bg-neutral-900 text-white text-xs px-2 py-1 rounded shadow-lg xl:hidden lg:block hidden"
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

        {/* Topbar */}
        <header className="col-start-2 row-start-1 bg-white shadow-soft border-b border-[#E5E7EB] flex items-center justify-between px-6">
          <div className="text-sm text-neutral-700">{breadcrumb}</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-neutral-500">Connected • Shadow Runtime</div>
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
              <User size={16} className="text-neutral-600" />
            </div>
          </div>
        </header>

      {/* Workspace */}
      <main className="col-start-2 row-start-2 overflow-auto p-6 bg-white">
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
        <footer className="col-start-2 row-start-3 bg-[#F3F4F6] text-[13px] text-neutral-700 border-t border-[#E5E7EB] px-4 flex items-center gap-4">
          <span>Connected</span>
          <span className="text-neutral-400">|</span>
          <span>CPU: --%</span>
          <span className="text-neutral-400">|</span>
          <span>{new Date().toLocaleString()}</span>
          <span className="ml-auto">Mode: Simulation</span>
        </footer>
      </div>
    </Tooltip.Provider>
  )
}


