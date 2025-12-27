import { Menu } from 'lucide-react'
import type { ExternalTool } from '../services/externalToolsApi'

interface ExternalToolsMenuProps {
  tools: ExternalTool[]
  onExecuteTool: (toolId: string) => void
  position?: { x: number; y: number }
  onClose: () => void
}

export function ExternalToolsMenu({ tools, onExecuteTool, position, onClose }: ExternalToolsMenuProps) {
  if (!position || tools.length === 0) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      >
        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Menu className="w-3 h-3" />
          External Tools
        </div>
        
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              if (tool.id) {
                onExecuteTool(tool.id)
                onClose()
              }
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                tool.mode === 'http' 
                  ? 'bg-blue-500' 
                  : 'bg-green-500'
              }`} />
              <span className="text-gray-900 dark:text-gray-100">{tool.name}</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {tool.type}
            </span>
          </button>
        ))}
        
        {tools.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            No external tools available
          </div>
        )}
      </div>
    </>
  )
}
