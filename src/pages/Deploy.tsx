import { useState, useEffect } from 'react'
import { DeployConsole } from '../components/DeployConsole'
import { useProjectStore } from '../store/projectStore'
import { AlertCircle } from 'lucide-react'

export function Deploy() {
  const { activeProject } = useProjectStore()

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-panda-surface-dark">
        <div className="text-center">
          <AlertCircle size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">No project selected</p>
        </div>
      </div>
    )
  }

  return <DeployConsole environment="production" />
}


