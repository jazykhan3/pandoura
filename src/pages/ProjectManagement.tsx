import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderPlus,
  Folder,
  Calendar,
  FileCode,
  Database,
  GitBranch,
  Search,
  MoreVertical,
  Trash2,
  Eye,
  Clock,
  X,
  Play,
  Download,
} from 'lucide-react'
import type { Project } from '../types'
import { Dialog } from '../components/Dialog'
import { useProjectStore } from '../store/projectStore'
import { PullFromPLCDialog } from '../components/PullFromPLCDialog'

export function ProjectManagement() {
  const {
    projects,
    activeProject,
    isLoading,
    isCreating,
    setActiveProject,
    loadProjects,
    createProject,
    deleteProject,
  } = useProjectStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
  }>({ isOpen: false, title: '', message: '', type: 'info' })
  const [showPullDialog, setShowPullDialog] = useState(false)
  const [pullEntryPoint, setPullEntryPoint] = useState<'project-wizard' | 'empty-project-cta' | 'topbar-menu'>('manual')
  const [pullProjectId, setPullProjectId] = useState<string | undefined>()
  const [pullProjectName, setPullProjectName] = useState<string | undefined>()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Project name is required.',
        type: 'error',
      })
      return
    }

    try {
      const project = await createProject(newProjectName, newProjectDescription)
      
      setShowCreateDialog(false)
      setNewProjectName('')
      setNewProjectDescription('')
      setDialog({
        isOpen: true,
        title: 'Project Created',
        message: `Project "${project.name}" has been created successfully!\n\nProject ID: ${project.id}\nPath: ${project.file_path}`,
        type: 'success',
      })
    } catch (error) {
      setDialog({
        isOpen: true,
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create project. Please try again.',
        type: 'error',
      })
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await deleteProject(projectId)
        setShowProjectMenu(null)
        setDialog({
          isOpen: true,
          title: 'Project Deleted',
          message: 'Project has been permanently deleted.',
          type: 'success',
        })
      } catch (error) {
        setDialog({
          isOpen: true,
          title: 'Delete Failed',
          message: error instanceof Error ? error.message : 'Failed to delete project.',
          type: 'error',
        })
      }
    }
  }

  const handleOpenProject = (project: Project) => {
    setActiveProject(project)
    setDialog({
      isOpen: true,
      title: 'Project Activated',
      message: `Now working in "${project.name}". All pages will show data for this project.`,
      type: 'success',
    })
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-panda-surface-dark">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Project Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Create and manage your automation projects</p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] transition-colors"
          >
            <FolderPlus size={20} />
            New Project
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Clock className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-5 hover:shadow-lg transition-all cursor-pointer relative group ${
                  activeProject?.id === project.id ? 'border-[#FF6A00] ring-2 ring-[#FF6A00]/20' : 'border-gray-200'
                }`}
                onClick={() => setSelectedProject(project)}
              >
                {/* Active Badge & Menu */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {activeProject?.id === project.id && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-[#FF6A00] text-white rounded-full text-xs font-medium">
                      <Play size={12} />
                      Active
                    </span>
                  )}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowProjectMenu(showProjectMenu === project.id ? null : project.id)
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <MoreVertical size={16} className="text-gray-600 dark:text-gray-300" />
                    </button>
                    {showProjectMenu === project.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[150px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowProjectMenu(null)
                            setSelectedProject(project)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Eye size={14} />
                          View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenProject(project)
                            setShowProjectMenu(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-[#FF6A00]"
                        >
                          <Play size={14} />
                          Set as Active
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProject(project.id)
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Icon */}
                <div className="w-12 h-12 bg-[#FF6A00] bg-opacity-10 rounded-lg flex items-center justify-center mb-4">
                  <Folder size={24} className="text-[#FF6A00]" />
                </div>

                {/* Project Info */}
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 pr-20">{project.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {project.description || 'No description provided'}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <FileCode size={16} className="mx-auto text-gray-500 dark:text-gray-400 mb-1" />
                    <p className="text-xs font-medium text-gray-700 dark:text-white">{project.stats?.logicFiles || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Logic</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <Database size={16} className="mx-auto text-gray-500 dark:text-gray-400 mb-1" />
                    <p className="text-xs font-medium text-gray-700 dark:text-white">{project.stats?.tags || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tags</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <GitBranch size={16} className="mx-auto text-gray-500 dark:text-gray-400 mb-1" />
                    <p className="text-xs font-medium text-gray-700 dark:text-white">{project.stats?.versions || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Versions</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                  {/* <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(project.last_opened).toLocaleDateString()}
                  </div> */}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Folder size={64} className="text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No projects found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first project'}
            </p>
            {!searchTerm && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] transition-colors"
                >
                  <FolderPlus size={20} />
                  Create New Project
                </button>
                <button
                  onClick={() => {
                    setPullEntryPoint('empty-project-cta')
                    setPullProjectId(undefined)
                    setPullProjectName(undefined)
                    setShowPullDialog(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download size={20} />
                  Pull from PLC
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Project Dialog */}
      <AnimatePresence>
        {showCreateDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !isCreating && setShowCreateDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FolderPlus size={24} className="text-[#FF6A00]" />
                  Create New Project
                </h2>
                {!isCreating && (
                  <button
                    onClick={() => setShowCreateDialog(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Production Line Control"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
                    disabled={isCreating}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Brief description of the project..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent resize-none"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => {
                    const tempProjectId = `temp-${Date.now()}`
                    setPullEntryPoint('project-wizard')
                    setPullProjectId(tempProjectId)
                    setPullProjectName(newProjectName || 'New Project')
                    setShowPullDialog(true)
                    setShowCreateDialog(false)
                  }}
                  disabled={isCreating || !newProjectName.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 dark:border-blue-800"
                >
                  <Download size={18} />
                  Pull from PLC
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateDialog(false)}
                    disabled={isCreating}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={isCreating || !newProjectName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? (
                      <>
                        <Clock size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FolderPlus size={18} />
                        Create Project
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Details Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
                    {selectedProject.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">{selectedProject.description || 'No description'}</p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Paths */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Project Path</h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{selectedProject.file_path}</p>
                  </div>
                </div>

                {/* Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Statistics</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-center">
                      <FileCode size={24} className="mx-auto text-blue-600 dark:text-blue-400 mb-2" />
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {selectedProject.stats?.logicFiles || 0}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Logic Files</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg text-center">
                      <Database size={24} className="mx-auto text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {selectedProject.stats?.tags || 0}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">Tags</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg text-center">
                      <GitBranch size={24} className="mx-auto text-purple-600 dark:text-purple-400 mb-2" />
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        {selectedProject.stats?.versions || 0}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Versions</p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Metadata</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Project ID:</span>
                      <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{selectedProject.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {new Date(selectedProject.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Last Opened:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {new Date(selectedProject.last_opened).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleOpenProject(selectedProject)
                    setSelectedProject(null)
                  }}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] transition-colors"
                >
                  Set as Active Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog Component */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={() => setDialog({ ...dialog, isOpen: false })}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
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
        projectId={pullProjectId}
        projectName={pullProjectName}
        entryPoint={pullEntryPoint}
      />
    </div>
  )
}
