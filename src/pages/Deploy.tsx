import { useState, useEffect } from 'react'
import { DeployConsole } from '../components/DeployConsole'
import { useProjectStore } from '../store/projectStore'
import { AlertCircle } from 'lucide-react'

export function Deploy() {
  const { activeProject } = useProjectStore()

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No project selected</p>
        </div>
      </div>
    )
  }

  return <DeployConsole />
}


