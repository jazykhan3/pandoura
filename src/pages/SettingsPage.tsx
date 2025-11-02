import { useState } from 'react'
import { Card, CardHeader } from '../components/Card'

export function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mode, setMode] = useState<'simulation' | 'live'>('simulation')
  const [storagePath, setStoragePath] = useState('~/Pandaura/Projects')
  const [autoSave, setAutoSave] = useState(true)
  const [showNotifications, setShowNotifications] = useState(true)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>Theme</CardHeader>
          <div className="space-y-3">
            <div className="text-sm text-neutral-600">Current: {theme}</div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              disabled
            >
              <option value="light">Light</option>
              <option value="dark">Dark (Coming Soon)</option>
            </select>
            <div className="text-xs text-neutral-500">Dark mode will be available in a future update</div>
          </div>
        </Card>

        <Card>
          <CardHeader>Runtime Mode</CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="simulation"
                  checked={mode === 'simulation'}
                  onChange={(e) => setMode(e.target.value as 'simulation' | 'live')}
                  className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                />
                <span className="text-sm">Simulation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="live"
                  checked={mode === 'live'}
                  onChange={(e) => setMode(e.target.value as 'simulation' | 'live')}
                  className="w-4 h-4 text-[#FF6A00] focus:ring-[#FF6A00]"
                />
                <span className="text-sm">Live</span>
              </label>
            </div>
            <div className="text-xs text-neutral-500">
              {mode === 'simulation' ? 'Using simulated PLC data' : 'Connected to live PLC'}
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>Local Storage Path</CardHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            />
            <button className="px-4 py-2 text-sm bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors">
              Browse...
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader>Auto Save</CardHeader>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
            />
            <span className="text-sm">Enable auto-save (every 5 minutes)</span>
          </label>
        </Card>

        <Card>
          <CardHeader>Notifications</CardHeader>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showNotifications}
              onChange={(e) => setShowNotifications(e.target.checked)}
              className="w-4 h-4 text-[#FF6A00] rounded focus:ring-[#FF6A00]"
            />
            <span className="text-sm">Show deployment notifications</span>
          </label>
        </Card>
      </div>

      <Card>
        <CardHeader>About</CardHeader>
        <div className="space-y-2 text-sm text-neutral-600">
          <div className="flex justify-between">
            <span>Version:</span>
            <span className="font-medium">2.1.5</span>
          </div>
          <div className="flex justify-between">
            <span>Build:</span>
            <span className="font-medium">20241101</span>
          </div>
          <div className="flex justify-between">
            <span>License:</span>
            <span className="font-medium">Enterprise</span>
          </div>
        </div>
      </Card>
    </div>
  )
}


