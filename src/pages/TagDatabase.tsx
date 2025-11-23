import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag as TagIcon,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  GitBranch,
  Shield,
  AlertTriangle,
  Check,
  ChevronRight,
  ChevronDown,
  Code,
  Box,
  Grid3x3,
  Settings,
  Eye,
  FileText,
  Link as LinkIcon,
  Network,
  List,
  TreePine,
} from 'lucide-react'
import { Card } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { useSyncStore } from '../store/syncStore'
import { useProjectStore } from '../store/projectStore'
import { tagApi } from '../services/api'
import type { Tag, TagScope, TagLifecycle, UserDefinedType, UDTMember, TagHierarchyNode, TagRefactoringPreview, BulkTagOperation } from '../types'

type ViewMode = 'list' | 'tree' | 'hierarchy'
type FilterOptions = {
  type?: string[]
  scope?: TagScope[]
  lifecycle?: TagLifecycle[]
  area?: string
  equipment?: string
  hasValidation?: boolean
  hasAlias?: boolean
  requiresApproval?: boolean
}

export function TagDatabase() {
  const { activeProject } = useProjectStore()
  const [tags, setTags] = useState<Tag[]>([])
  const [udts, setUdts] = useState<UserDefinedType[]>([])
  const [hierarchyNodes, setHierarchyNodes] = useState<TagHierarchyNode[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [regexSearch, setRegexSearch] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({})
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  
  // Dialogs
  const [showCreateTagDialog, setShowCreateTagDialog] = useState(false)
  const [showCreateUDTDialog, setShowCreateUDTDialog] = useState(false)
  const [showBulkActionsDialog, setShowBulkActionsDialog] = useState(false)
  const [showDependencyGraph, setShowDependencyGraph] = useState(false)
  const [showRefactoringPreview, setShowRefactoringPreview] = useState(false)
  
  // Selected items
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [refactoringPreview, setRefactoringPreview] = useState<TagRefactoringPreview | null>(null)
  const [bulkOperation, setBulkOperation] = useState<BulkTagOperation | null>(null)

  const syncTags = useSyncStore((s) => s.syncTags)

  useEffect(() => {
    if (activeProject) {
      loadAllData()
    }
  }, [activeProject])

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadTags(),
        loadUDTs(),
        loadHierarchy()
      ])
    } catch (error) {
      console.error('Failed to load tag data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTags = async () => {
    try {
      const result = await tagApi.getAll()
      setTags(result || [])
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const loadUDTs = async () => {
    try {
      const result = await tagApi.getUDTs(activeProject?.id)
      setUdts(result || [])
    } catch (error) {
      console.error('Failed to load UDTs:', error)
      setUdts([])
    }
  }

  const loadHierarchy = async () => {
    try {
      const result = await tagApi.getHierarchy(activeProject?.id)
      setHierarchyNodes(result || [])
    } catch (error) {
      console.error('Failed to load hierarchy:', error)
      setHierarchyNodes([])
    }
  }

  const handleSyncTags = async () => {
    await syncTags()
    await loadTags()
    alert('Tags synced to shadow runtime!')
  }

  const handleExport = async () => {
    try {
      const blob = await tagApi.exportTags()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tags-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export tags')
    }
  }

  const handleImportWithWizard = async (file: File) => {
    setIsLoading(true)
    try {
      // Import tags directly for now
      await tagApi.importTags(file, false)
      await loadTags()
      alert('Tags imported successfully!')
    } catch (error) {
      console.error('Import failed:', error)
      alert('Failed to import tags: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkOperation = async (operation: string, dryRun: boolean = true) => {
    if (selectedTags.size === 0) {
      alert('No tags selected')
      return
    }

    setIsLoading(true)
    try {
      const result = await tagApi.bulkOperation({
        operation,
        tagIds: Array.from(selectedTags),
        dryRun,
        projectId: activeProject?.id
      })
      
      setBulkOperation(result)
      setShowBulkActionsDialog(true)
    } catch (error) {
      console.error('Bulk operation failed:', error)
      alert('Bulk operation failed: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRenameTag = async (tagId: string, newName: string) => {
    setIsLoading(true)
    try {
      // Get refactoring preview
      const preview = await tagApi.getRefactoringPreview(tagId, newName, activeProject?.id)
      setRefactoringPreview(preview)
      setShowRefactoringPreview(true)
    } catch (error) {
      console.error('Rename failed:', error)
      alert('Failed to preview rename: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyRefactoring = async () => {
    if (!refactoringPreview) return
    
    setIsLoading(true)
    try {
      await tagApi.applyRefactoring(refactoringPreview, activeProject?.id)
      setShowRefactoringPreview(false)
      setRefactoringPreview(null)
      await loadTags()
      alert('Tag renamed successfully!')
    } catch (error) {
      console.error('Refactoring failed:', error)
      alert('Failed to apply refactoring: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUDT = async (udtData: UserDefinedType) => {
    setIsLoading(true)
    try {
      await tagApi.createUDT(udtData, activeProject?.id)
      await loadUDTs()
      setShowCreateUDTDialog(false)
      alert('UDT created successfully!')
    } catch (error) {
      console.error('UDT creation failed:', error)
      alert('Failed to create UDT: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleSelection = (tagId: string) => {
    const newSelection = new Set(selectedTags)
    if (newSelection.has(tagId)) {
      newSelection.delete(tagId)
    } else {
      newSelection.add(tagId)
    }
    setSelectedTags(newSelection)
  }

  const handleCopyTag = async (tag: Tag) => {
    try {
      const newName = prompt(`Enter name for the copied tag:`, `${tag.name}_copy`)
      if (!newName) return
      
      // Create a copy of the tag with new name
      await tagApi.create({
        ...tag,
        id: '',
        name: newName,
      })
      
      await loadTags()
      alert(`Tag "${newName}" created successfully!`)
    } catch (error) {
      console.error('Copy failed:', error)
      alert('Failed to copy tag: ' + (error as Error).message)
    }
  }

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`Are you sure you want to delete tag "${tag.name}"? This action cannot be undone.`)) {
      return
    }
    
    setIsLoading(true)
    try {
      // Since delete API doesn't exist, we'll update lifecycle to archived
      await tagApi.updateLifecycle(tag.id, 'archived')
      await loadTags()
      alert(`Tag "${tag.name}" archived successfully!`)
    } catch (error) {
      console.error('Archive failed:', error)
      alert('Failed to archive tag: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag)
    setShowCreateTagDialog(true)
  }

  const handleSelectAll = () => {
    if (selectedTags.size === filteredTags.length) {
      setSelectedTags(new Set())
    } else {
      setSelectedTags(new Set(filteredTags.map(t => t.id)))
    }
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // Filtering logic
  const filteredTags = tags.filter(tag => {
    // Search filter
    if (searchTerm) {
      if (regexSearch) {
        try {
          const regex = new RegExp(searchTerm, 'i')
          if (!regex.test(tag.name) && !regex.test(tag.address || '')) {
            return false
          }
        } catch {
          // Invalid regex, fall back to string search
          if (!tag.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false
          }
        }
      } else {
        if (!tag.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !tag.address?.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false
        }
      }
    }

    // Type filter
    if (filterOptions.type && filterOptions.type.length > 0) {
      if (!filterOptions.type.includes(tag.type)) {
        return false
      }
    }

    // Scope filter
    if (filterOptions.scope && filterOptions.scope.length > 0) {
      if (!tag.scope || !filterOptions.scope.includes(tag.scope)) {
        return false
      }
    }

    // Lifecycle filter
    if (filterOptions.lifecycle && filterOptions.lifecycle.length > 0) {
      if (!tag.lifecycle || !filterOptions.lifecycle.includes(tag.lifecycle)) {
        return false
      }
    }

    // Area filter
    if (filterOptions.area && tag.area !== filterOptions.area) {
      return false
    }

    // Equipment filter
    if (filterOptions.equipment && tag.equipment !== filterOptions.equipment) {
      return false
    }

    // Validation filter
    if (filterOptions.hasValidation) {
      if (!tag.validationRules || tag.validationRules.length === 0) {
        return false
      }
    }

    // Alias filter
    if (filterOptions.hasAlias) {
      if (!tag.aliases || tag.aliases.length === 0) {
        return false
      }
    }

    // Approval filter
    if (filterOptions.requiresApproval !== undefined) {
      if (tag.requiresApproval !== filterOptions.requiresApproval) {
        return false
      }
    }

    return true
  })

  const formatValue = (value: string | number | boolean | null) => {
    if (value === null) return 'NULL'
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return value.toString()
  }

  const getLifecycleColor = (lifecycle?: TagLifecycle) => {
    switch (lifecycle) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'deprecated': return 'bg-yellow-100 text-yellow-700'
      case 'draft': return 'bg-gray-100 text-gray-700'
      case 'archived': return 'bg-red-100 text-red-700'
      default: return 'bg-blue-100 text-blue-700'
    }
  }

  const getScopeIcon = (scope?: TagScope) => {
    switch (scope) {
      case 'global': return <Grid3x3 size={14} className="text-purple-600" />
      case 'program': return <Code size={14} className="text-blue-600" />
      case 'task': return <FileText size={14} className="text-orange-600" />
      default: return <TagIcon size={14} className="text-gray-600" />
    }
  }

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertTriangle size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No project selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">Tag Database</h1>
            <span className="text-sm text-gray-600">- {activeProject.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'tree' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <TreePine size={16} />
              </button>
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'hierarchy' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <Network size={16} />
              </button>
            </div>

            <button
              onClick={() => setShowCreateUDTDialog(true)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Box size={16} />
              Create UDT
            </button>
            <button
              onClick={() => setShowCreateTagDialog(true)}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-sm font-medium hover:bg-[#E55F00] transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Create Tag
            </button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={regexSearch ? "Regex search (e.g., ^Motor_.*)" : "Search tags by name or address..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={regexSearch}
              onChange={(e) => setRegexSearch(e.target.checked)}
              className="rounded border-gray-300"
            />
            Regex
          </label>
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              showFilterPanel ? 'bg-[#FF6A00] text-white border-[#FF6A00]' : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter size={16} />
            Filters
          </button>
          <button
            onClick={() => setShowDependencyGraph(true)}
            disabled={!selectedTag}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <GitBranch size={16} />
            Dependencies
          </button>
          <button
            onClick={() => setShowBulkActionsDialog(true)}
            disabled={selectedTags.size === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Settings size={16} />
            Bulk Actions ({selectedTags.size})
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || tags.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
          </button>
          <label className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".json,.xml,.csv"
              onChange={(e) => e.target.files?.[0] && handleImportWithWizard(e.target.files[0])}
              className="hidden"
            />
          </label>
          <button
            onClick={handleSyncTags}
            disabled={isLoading}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Type</label>
                  <select
                    multiple
                    value={filterOptions.type || []}
                    onChange={(e) => setFilterOptions({ ...filterOptions, type: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="BOOL">BOOL</option>
                    <option value="INT">INT</option>
                    <option value="DINT">DINT</option>
                    <option value="REAL">REAL</option>
                    <option value="STRING">STRING</option>
                    <option value="UDT">UDT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Scope</label>
                  <select
                    multiple
                    value={filterOptions.scope || []}
                    onChange={(e) => setFilterOptions({ ...filterOptions, scope: Array.from(e.target.selectedOptions, o => o.value) as TagScope[] })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="global">Global</option>
                    <option value="program">Program</option>
                    <option value="task">Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Lifecycle</label>
                  <select
                    multiple
                    value={filterOptions.lifecycle || []}
                    onChange={(e) => setFilterOptions({ ...filterOptions, lifecycle: Array.from(e.target.selectedOptions, o => o.value) as TagLifecycle[] })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterOptions.hasValidation || false}
                      onChange={(e) => setFilterOptions({ ...filterOptions, hasValidation: e.target.checked })}
                      className="rounded"
                    />
                    Has Validation Rules
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterOptions.hasAlias || false}
                      onChange={(e) => setFilterOptions({ ...filterOptions, hasAlias: e.target.checked })}
                      className="rounded"
                    />
                    Has Aliases
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterOptions.requiresApproval || false}
                      onChange={(e) => setFilterOptions({ ...filterOptions, requiresApproval: e.target.checked })}
                      className="rounded"
                    />
                    Requires Approval
                  </label>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setFilterOptions({})}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <Card>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading tags...</div>
          ) : (
            <>
              {viewMode === 'list' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedTags.size === filteredTags.length && filteredTags.length > 0}
                            onChange={handleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Scope</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Lifecycle</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Value</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Address</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Hierarchy</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Flags</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTags.map((tag, index) => (
                        <tr
                          key={tag.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            selectedTags.has(tag.id) ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="py-2 px-4">
                            <input
                              type="checkbox"
                              checked={selectedTags.has(tag.id)}
                              onChange={() => handleToggleSelection(tag.id)}
                              className="rounded"
                            />
                          </td>
                          <td
                            className="py-2 px-4 font-mono text-gray-900 cursor-pointer hover:text-[#FF6A00]"
                            onClick={() => setSelectedTag(tag)}
                          >
                            {tag.name}
                            {tag.lifecycle === 'deprecated' && (
                              <AlertTriangle size={14} className="inline ml-2 text-yellow-600" />
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              {tag.type}
                              {tag.udtType && ` (${tag.udtType})`}
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1">
                              {getScopeIcon(tag.scope)}
                              <span className="text-xs capitalize">{tag.scope || 'global'}</span>
                              {tag.scopeLocked && <Shield size={12} className="text-gray-600" />}
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <span className={`px-2 py-0.5 text-xs rounded ${getLifecycleColor(tag.lifecycle)}`}>
                              {tag.lifecycle || 'active'}
                            </span>
                          </td>
                          <td className="py-2 px-4 font-mono text-gray-900">{formatValue(tag.value)}</td>
                          <td className="py-2 px-4 font-mono text-gray-600 text-xs">{tag.address}</td>
                          <td className="py-2 px-4 text-xs text-gray-600">
                            {tag.hierarchyPath || '-'}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1">
                              {tag.validationRules && tag.validationRules.length > 0 && (
                                <span title="Has validation rules">
                                  <Check size={14} className="text-green-600" />
                                </span>
                              )}
                              {tag.aliases && tag.aliases.length > 0 && (
                                <span title="Has aliases">
                                  <LinkIcon size={14} className="text-blue-600" />
                                </span>
                              )}
                              {tag.requiresApproval && (
                                <span title="Requires approval">
                                  <Shield size={14} className="text-orange-600" />
                                </span>
                              )}
                              {tag.readOnly && (
                                <span title="Read only">
                                  <Eye size={14} className="text-gray-600" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditTag(tag)
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newName = prompt(`Enter new name for "${tag.name}":`, tag.name)
                                  if (newName && newName !== tag.name) {
                                    handleRenameTag(tag.id, newName)
                                  }
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Rename"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopyTag(tag)
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Copy"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteTag(tag)
                                }}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {viewMode === 'tree' && (
                <div className="p-4">
                  <div className="space-y-1">
                    {hierarchyNodes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <TreePine size={48} className="mx-auto mb-2 text-gray-300" />
                        <p>No hierarchy defined</p>
                        <button className="mt-3 text-sm text-[#FF6A00] hover:underline">
                          Create hierarchy structure
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {renderHierarchyTree(hierarchyNodes.filter(n => !n.parentId))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewMode === 'hierarchy' && (
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* Areas */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Grid3x3 size={16} />
                        Areas
                      </h3>
                      <div className="space-y-1">
                        {Array.from(new Set(tags.filter(t => t.area).map(t => t.area!))).map(area => (
                          <button
                            key={area}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {area} ({tags.filter(t => t.area === area).length})
                          </button>
                        ))}
                        {tags.filter(t => t.area).length === 0 && (
                          <p className="text-xs text-gray-500 px-3 py-2">No areas defined</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Equipment */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Box size={16} />
                        Equipment
                      </h3>
                      <div className="space-y-1">
                        {Array.from(new Set(tags.filter(t => t.equipment).map(t => t.equipment!))).map(equipment => (
                          <button
                            key={equipment}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {equipment} ({tags.filter(t => t.equipment === equipment).length})
                          </button>
                        ))}
                        {tags.filter(t => t.equipment).length === 0 && (
                          <p className="text-xs text-gray-500 px-3 py-2">No equipment defined</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Routines */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Code size={16} />
                        Routines
                      </h3>
                      <div className="space-y-1">
                        {Array.from(new Set(tags.filter(t => t.routine).map(t => t.routine!))).map(routine => (
                          <button
                            key={routine}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {routine} ({tags.filter(t => t.routine === routine).length})
                          </button>
                        ))}
                        {tags.filter(t => t.routine).length === 0 && (
                          <p className="text-xs text-gray-500 px-3 py-2">No routines defined</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                <div>
                  Showing {filteredTags.length} of {tags.length} tags
                  {selectedTags.size > 0 && ` • ${selectedTags.size} selected`}
                </div>
                <div className="flex items-center gap-4">
                  <span>{udts.length} UDTs defined</span>
                  <span>{tags.filter(t => t.lifecycle === 'deprecated').length} deprecated</span>
                  <span>{tags.filter(t => t.requiresApproval).length} protected</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Create Tag Dialog */}
      {showCreateTagDialog && (
        <Dialog isOpen={showCreateTagDialog} onClose={() => setShowCreateTagDialog(false)} title="Create Tag">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Tag_Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option value="BOOL">BOOL</option>
                  <option value="INT">INT</option>
                  <option value="DINT">DINT</option>
                  <option value="REAL">REAL</option>
                  <option value="STRING">STRING</option>
                  <option value="UDT">UDT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option value="global">Global</option>
                  <option value="program">Program</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lifecycle</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="DB1.DBX0.0"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Tag description..."
                />
              </div>
              <div className="col-span-2 flex gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Read Only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Requires Approval</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Lock Scope</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setShowCreateTagDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]">
                Create Tag
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create UDT Dialog */}
      {showCreateUDTDialog && (
        <CreateUDTDialog
          isOpen={showCreateUDTDialog}
          onClose={() => setShowCreateUDTDialog(false)}
          onConfirm={handleCreateUDT}
        />
      )}

      {/* Bulk Actions Dialog */}
      {showBulkActionsDialog && (
        <BulkActionsDialog
          isOpen={showBulkActionsDialog}
          onClose={() => setShowBulkActionsDialog(false)}
          selectedTags={Array.from(selectedTags)}
          onExecute={handleBulkOperation}
          bulkOperation={bulkOperation}
        />
      )}

      {/* Dependency Graph Dialog */}
      {showDependencyGraph && selectedTag && (
        <DependencyGraphDialog
          isOpen={showDependencyGraph}
          onClose={() => setShowDependencyGraph(false)}
          tag={selectedTag}
        />
      )}

      {/* Refactoring Preview Dialog */}
      {showRefactoringPreview && refactoringPreview && (
        <RefactoringPreviewDialog
          isOpen={showRefactoringPreview}
          onClose={() => setShowRefactoringPreview(false)}
          preview={refactoringPreview}
          onApply={handleApplyRefactoring}
        />
      )}
    </div>
  )

  // Helper function to render hierarchy tree recursively
  function renderHierarchyTree(nodes: TagHierarchyNode[], level: number = 0): React.ReactElement[] {
    return nodes.map(node => {
      const hasChildren = hierarchyNodes.some(n => n.parentId === node.id)
      const isExpanded = expandedNodes.has(node.id)
      const nodeTag = node.tagId ? tags.find(t => t.id === node.tagId) : null

      return (
        <div key={node.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 cursor-pointer ${
              level > 0 ? `ml-${level * 6}` : ''
            }`}
            onClick={() => hasChildren && toggleNode(node.id)}
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <span className="w-4" />
            )}
            {node.type === 'area' && <Grid3x3 size={16} className="text-purple-600" />}
            {node.type === 'equipment' && <Box size={16} className="text-blue-600" />}
            {node.type === 'routine' && <Code size={16} className="text-orange-600" />}
            {node.type === 'tag' && <TagIcon size={16} className="text-green-600" />}
            <span className="text-sm font-medium">{node.name}</span>
            {nodeTag && (
              <span className="text-xs text-gray-500 ml-2">
                ({nodeTag.type})
              </span>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div>
              {renderHierarchyTree(
                hierarchyNodes.filter(n => n.parentId === node.id),
                level + 1
              )}
            </div>
          )}
        </div>
      )
    })
  }
}

// ============ Dialog Components ============

function CreateUDTDialog({ isOpen, onClose, onConfirm }: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (udt: UserDefinedType) => void
}) {
  const [udtName, setUdtName] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState<UDTMember[]>([
    { name: '', type: 'BOOL', description: '' }
  ])

  const addMember = () => {
    setMembers([...members, { name: '', type: 'BOOL', description: '' }])
  }

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
  }

  const updateMember = (index: number, field: string, value: any) => {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    setMembers(updated)
  }

  const handleSubmit = () => {
    if (!udtName || members.some(m => !m.name)) {
      alert('Please fill all required fields')
      return
    }

    onConfirm({
      id: '',
      name: udtName,
      description,
      members,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User'
    })
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create User Defined Type (UDT)" size="large">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UDT Name *</label>
            <input
              type="text"
              value={udtName}
              onChange={(e) => setUdtName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="MotorControl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Motor control structure"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Members</h3>
            <button
              onClick={addMember}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              <Plus size={14} />
              Add Member
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {members.map((member, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => updateMember(index, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  placeholder="memberName"
                />
                <select
                  value={member.type}
                  onChange={(e) => updateMember(index, 'type', e.target.value)}
                  className="px-2 py-1 text-sm border rounded"
                >
                  <option value="BOOL">BOOL</option>
                  <option value="INT">INT</option>
                  <option value="DINT">DINT</option>
                  <option value="REAL">REAL</option>
                  <option value="LREAL">LREAL</option>
                  <option value="STRING">STRING</option>
                  <option value="ARRAY">ARRAY</option>
                  <option value="UDT">UDT</option>
                </select>
                {member.type === 'ARRAY' && (
                  <input
                    type="number"
                    value={member.arraySize || 10}
                    onChange={(e) => updateMember(index, 'arraySize', parseInt(e.target.value))}
                    className="w-20 px-2 py-1 text-sm border rounded"
                    placeholder="Size"
                  />
                )}
                <input
                  type="text"
                  value={member.description || ''}
                  onChange={(e) => updateMember(index, 'description', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  placeholder="Description"
                />
                <button
                  onClick={() => removeMember(index)}
                  className="p-1 hover:bg-red-100 rounded text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
          >
            Create UDT
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function BulkActionsDialog({ isOpen, onClose, selectedTags, onExecute, bulkOperation }: {
  isOpen: boolean
  onClose: () => void
  selectedTags: string[]
  onExecute: (operation: string, dryRun: boolean) => void
  bulkOperation: BulkTagOperation | null
}) {
  const [operation, setOperation] = useState<string>('update')
  const [changes, setChanges] = useState<Record<string, any>>({})
  const [dryRun, setDryRun] = useState(true)

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Bulk Tag Operations" size="large">
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>{selectedTags.length}</strong> tags selected for bulk operation
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Operation</label>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="update">Update Properties</option>
            <option value="delete">Delete Tags</option>
            <option value="copy">Copy Tags</option>
            <option value="rename">Rename (Batch)</option>
          </select>
        </div>

        {operation === 'update' && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">Update Fields</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Lifecycle</label>
                <select
                  onChange={(e) => setChanges({ ...changes, lifecycle: e.target.value })}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value="">- No change -</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="deprecated">Deprecated</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Scope</label>
                <select
                  onChange={(e) => setChanges({ ...changes, scope: e.target.value })}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value="">- No change -</option>
                  <option value="global">Global</option>
                  <option value="program">Program</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Area</label>
                <input
                  type="text"
                  onChange={(e) => setChanges({ ...changes, area: e.target.value })}
                  className="w-full px-2 py-1 text-sm border rounded"
                  placeholder="Area name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Equipment</label>
                <input
                  type="text"
                  onChange={(e) => setChanges({ ...changes, equipment: e.target.value })}
                  className="w-full px-2 py-1 text-sm border rounded"
                  placeholder="Equipment name"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  onChange={(e) => setChanges({ ...changes, readOnly: e.target.checked })}
                  className="rounded"
                />
                Set Read Only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  onChange={(e) => setChanges({ ...changes, requiresApproval: e.target.checked })}
                  className="rounded"
                />
                Require Approval
              </label>
            </div>
          </div>
        )}

        {operation === 'delete' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="text-sm text-red-800">
              <AlertTriangle size={16} className="inline mr-2" />
              <strong>Warning:</strong> This will permanently delete {selectedTags.length} tags. This action cannot be undone.
            </p>
          </div>
        )}

        {bulkOperation && bulkOperation.preview && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview Results</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Successful:</span>
                <span className="font-semibold text-green-600">{bulkOperation.preview.successful}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Failed:</span>
                <span className="font-semibold text-red-600">{bulkOperation.preview.failed}</span>
              </div>
              {bulkOperation.preview.warnings && bulkOperation.preview.warnings.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-gray-600 mb-2">Warnings:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {bulkOperation.preview.warnings.map((warning, i) => (
                      <p key={i} className="text-xs text-yellow-700">{warning}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Dry Run (Preview Only)</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onExecute(operation, dryRun)}
              className={`px-4 py-2 rounded-lg ${
                dryRun
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-[#FF6A00] hover:bg-[#E55F00] text-white'
              }`}
            >
              {dryRun ? 'Preview' : 'Execute'}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function DependencyGraphDialog({ isOpen, onClose, tag }: {
  isOpen: boolean
  onClose: () => void
  tag: Tag
}) {
  const dependencies = tag.dependencies || []

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Dependencies: ${tag.name}`} size="large">
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Network size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 mb-2">Dependency Graph Visualization</p>
            <p className="text-sm text-gray-500">
              This tag is used in <strong>{dependencies.length}</strong> locations
            </p>
            
            {dependencies.length > 0 && (
              <div className="mt-6 text-left max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Usage Locations:</h3>
                <div className="space-y-2">
                  {dependencies.slice(0, 10).map((dep, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                      <FileText size={14} className="text-blue-600" />
                      <span className="flex-1">{dep.location.fileName}</span>
                      <span className="text-xs text-gray-500">
                        {dep.usageType} • Line {dep.location.lineNumber}
                      </span>
                    </div>
                  ))}
                  {dependencies.length > 10 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      ... and {dependencies.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function RefactoringPreviewDialog({ isOpen, onClose, preview, onApply }: {
  isOpen: boolean
  onClose: () => void
  preview: TagRefactoringPreview
  onApply: () => void
}) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Refactoring Preview" size="large">
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Rename Tag</h3>
          <p className="text-sm text-blue-800">
            <code className="bg-blue-100 px-2 py-1 rounded">{preview.oldName}</code>
            {' → '}
            <code className="bg-blue-100 px-2 py-1 rounded">{preview.newName}</code>
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Impact Analysis</h3>
            <span className={`px-3 py-1 rounded text-xs font-medium ${
              preview.estimatedImpact === 'high' ? 'bg-red-100 text-red-700' :
              preview.estimatedImpact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {preview.estimatedImpact.toUpperCase()} IMPACT
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600">Affected Files</p>
              <p className="text-2xl font-bold text-gray-900">{preview.affectedFiles.length}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600">Total Occurrences</p>
              <p className="text-2xl font-bold text-gray-900">
                {preview.affectedFiles.reduce((sum, f) => sum + f.occurrences, 0)}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600">Requires Approval</p>
              <p className="text-2xl font-bold text-gray-900">
                {preview.requiresApproval ? 'YES' : 'NO'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Affected Files</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {preview.affectedFiles.map((file, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <span className="text-sm font-medium">{file.fileName}</span>
                  </div>
                  <span className="text-xs text-gray-500">{file.occurrences} occurrence(s)</span>
                </div>
                <div className="space-y-1 pl-6">
                  {file.changes.slice(0, 3).map((change, j) => (
                    <div key={j} className="text-xs font-mono bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">Line {change.line}:</span>
                      <div className="mt-1">
                        <div className="text-red-600">- {change.oldText}</div>
                        <div className="text-green-600">+ {change.newText}</div>
                      </div>
                    </div>
                  ))}
                  {file.changes.length > 3 && (
                    <p className="text-xs text-gray-500 pl-2">... and {file.changes.length - 3} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {preview.requiresApproval && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <Shield size={16} className="inline mr-2" />
              This refactoring requires approval before it can be applied.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
          >
            {preview.requiresApproval ? 'Request Approval' : 'Apply Refactoring'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
