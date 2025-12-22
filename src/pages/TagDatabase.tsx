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
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { InputDialog } from '../components/InputDialog'
import { UDTEditor } from '../components/UDTEditor'
import { BulkActionsDialog } from '../components/BulkActionsDialog'
import { DependencyGraph } from '../components/DependencyGraph'
import { TagTreeView } from '../components/TagTreeView'
import { AddressMappingManager } from '../components/AddressMappingManager'
import { ValidationRulesManager } from '../components/ValidationRulesManager'
import { useSyncStore } from '../store/syncStore'
import { useProjectStore } from '../store/projectStore'
import { tagApi } from '../services/api'
import type { Tag, TagScope, TagLifecycle, UserDefinedType, TagRefactoringPreview, BulkTagOperation, TagDependency, TagAlias, TagValidationRule } from '../types'

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
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [tagToRename, setTagToRename] = useState<Tag | null>(null)
  const [showRenameConfirmDialog, setShowRenameConfirmDialog] = useState(false)
  const [pendingRename, setPendingRename] = useState<{ tagId: string; oldName: string; newName: string } | null>(null)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [tagToCopy, setTagToCopy] = useState<Tag | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  const [showAddressMappingDialog, setShowAddressMappingDialog] = useState(false)
  const [showValidationRulesDialog, setShowValidationRulesDialog] = useState(false)
  const [selectedTagForMapping, setSelectedTagForMapping] = useState<Tag | null>(null)
  
  // Selected items
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

  const [refactoringPreview, setRefactoringPreview] = useState<TagRefactoringPreview | null>(null)
  const [bulkOperation, setBulkOperation] = useState<BulkTagOperation | null>(null)
  const [tagDependencies, setTagDependencies] = useState<TagDependency[]>([])

  // Create tag form state
  const [newTagName, setNewTagName] = useState('')
  const [newTagType, setNewTagType] = useState('BOOL')
  const [newTagScope, setNewTagScope] = useState<TagScope>('global')
  const [newTagLifecycle, setNewTagLifecycle] = useState<TagLifecycle>('draft')
  const [newTagAddress, setNewTagAddress] = useState('')
  const [newTagDescription, setNewTagDescription] = useState('')
  const [newTagReadOnly, setNewTagReadOnly] = useState(false)
  const [newTagRequiresApproval, setNewTagRequiresApproval] = useState(false)
  const [newTagLockScope, setNewTagLockScope] = useState(false)

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
      // Ensure result is an array
      if (Array.isArray(result)) {
        setTags(result)
      } else if (result && typeof result === 'object' && 'tags' in result && Array.isArray((result as any).tags)) {
        // Handle case where API returns { tags: [...] }
        setTags((result as any).tags)
      } else {
        console.warn('Unexpected tags response format:', result)
        setTags([])
      }
    } catch (error) {
      console.error('Failed to load tags:', error)
      setTags([])
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


    } catch (error) {
      console.error('Failed to load hierarchy:', error)

    }
  }

  const handleSyncTags = async () => {
    await syncTags()
    await loadTags()
    setSuccessMessage('Tags synced to shadow runtime!')
    setShowSuccessDialog(true)
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
      setSuccessMessage('Tags exported successfully!')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Export failed:', error)
      setSuccessMessage('Failed to export tags')
      setShowSuccessDialog(true)
    }
  }

  const handleImportWithWizard = async (file: File) => {
    setIsLoading(true)
    try {
      // Import tags directly for now
      await tagApi.importTags(file, false)
      await loadTags()
      setSuccessMessage('Tags imported successfully!')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Import failed:', error)
      setSuccessMessage('Failed to import tags: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkOperation = async (operation: string, params: any, dryRun: boolean = true) => {
    if (selectedTags.size === 0) {
      setSuccessMessage('No tags selected')
      setShowSuccessDialog(true)
      return
    }

    setIsLoading(true)
    try {
      const result = await tagApi.bulkOperation({
        operation,
        params,
        tagIds: Array.from(selectedTags),
        dryRun,
        projectId: activeProject?.id
      })
      
      if (dryRun) {
        // Show preview
        setBulkOperation(result)
      } else {
        // Operation executed - refresh tags and show success
        await loadTags()
        setSelectedTags(new Set())
        setSuccessMessage(`Bulk operation completed: ${result.affectedTags} tag(s) ${operation}`)
        setShowSuccessDialog(true)
        setShowBulkActionsDialog(false)
      }
    } catch (error) {
      console.error('Bulk operation failed:', error)
      setSuccessMessage('Bulk operation failed: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRenameTag = async (tagId: string, newName: string) => {
    // Find the tag
    const tag = tags.find(t => t.id === tagId)
    if (!tag) {
      setSuccessMessage('Tag not found')
      setShowSuccessDialog(true)
      return
    }

    // Store pending rename and show confirmation
    setPendingRename({ tagId, oldName: tag.name, newName })
    setShowRenameConfirmDialog(true)
  }

  const executeRename = async () => {
    if (!pendingRename) return
    
    const { tagId, oldName, newName } = pendingRename
    
    setIsLoading(true)
    try {
      // Find the tag
      const tag = tags.find(t => t.id === tagId)
      if (!tag) {
        throw new Error('Tag not found')
      }

      // Try to get refactoring preview, but fallback to direct rename if endpoint doesn't exist
      try {
        const preview = await tagApi.getRefactoringPreview(tagId, newName, activeProject?.id)
        setRefactoringPreview(preview)
        setShowRefactoringPreview(true)
        setShowRenameConfirmDialog(false)
        setPendingRename(null)
      } catch (apiError: any) {
        // If API returns HTML or endpoint doesn't exist, do direct rename
        if (apiError.message?.includes('<!DOCTYPE') || apiError.message?.includes('not valid JSON')) {
          console.warn('Refactoring preview endpoint not available, performing direct rename')
          
          await tagApi.update(tagId, { ...tag, name: newName })
          await loadTags()
          setSuccessMessage(`Tag renamed from "${oldName}" to "${newName}" successfully!`)
          setShowSuccessDialog(true)
          setShowRenameConfirmDialog(false)
          setPendingRename(null)
        } else {
          throw apiError
        }
      }
    } catch (error) {
      console.error('Rename failed:', error)
      setSuccessMessage('Failed to rename tag: ' + (error as Error).message)
      setShowSuccessDialog(true)
      setShowRenameConfirmDialog(false)
      setPendingRename(null)
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
      setSuccessMessage('Tag renamed successfully!')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Refactoring failed:', error)
      setSuccessMessage('Failed to apply refactoring: ' + (error as Error).message)
      setShowSuccessDialog(true)
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
      setSuccessMessage('UDT created successfully!')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('UDT creation failed:', error)
      setSuccessMessage('Failed to create UDT: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTag = async () => {
    // Validate required fields
    if (!newTagName.trim()) {
      setSuccessMessage('Tag name is required')
      setShowSuccessDialog(true)
      return
    }

    setIsLoading(true)
    try {
      // Check if selected type is a UDT
      const basicTypes = ['BOOL', 'INT', 'DINT', 'REAL', 'STRING', 'TIMER', 'COUNTER']
      const isUDT = !basicTypes.includes(newTagType)
      
      const tagData: Partial<Tag> = {
        name: newTagName.trim(),
        type: isUDT ? 'UDT' : (newTagType as any),
        udtType: isUDT ? newTagType : undefined,
        scope: newTagScope,
        lifecycle: newTagLifecycle,
        address: newTagAddress.trim() || undefined,
        readOnly: newTagReadOnly,
        requiresApproval: newTagRequiresApproval,
        scopeLocked: newTagLockScope,
        source: 'shadow',
        lastUpdate: new Date(),
        metadata: {
          ...selectedTag?.metadata,
          description: newTagDescription.trim() || undefined,
        },
      }

      if (selectedTag) {
        // Update existing tag
        await tagApi.update(selectedTag.id, tagData)
        setSuccessMessage(`Tag "${newTagName}" updated successfully!`)
      } else {
        // Create new tag
        await tagApi.create(tagData)
        setSuccessMessage(`Tag "${newTagName}" created successfully!`)
      }
      
      await loadTags()
      
      // Reset form and close dialog
      resetTagForm()
      setShowCreateTagDialog(false)
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Tag operation failed:', error)
      setSuccessMessage(`Failed to ${selectedTag ? 'update' : 'create'} tag: ` + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const resetTagForm = () => {
    setNewTagName('')
    setNewTagType('BOOL')
    setNewTagScope('global')
    setNewTagLifecycle('draft')
    setNewTagAddress('')
    setNewTagDescription('')
    setNewTagReadOnly(false)
    setNewTagRequiresApproval(false)
    setNewTagLockScope(false)
    setSelectedTag(null)
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
    setTagToCopy(tag)
    setShowCopyDialog(true)
  }

  const executeCopy = async (newName: string) => {
    if (!tagToCopy) return
    
    setIsLoading(true)
    try {
      // Create a copy of the tag with new name
      await tagApi.create({
        ...tagToCopy,
        id: '',
        name: newName,
      })
      
      await loadTags()
      setSuccessMessage(`Tag "${newName}" created successfully!`)
      setShowSuccessDialog(true)
      setShowCopyDialog(false)
      setTagToCopy(null)
    } catch (error) {
      console.error('Copy failed:', error)
      setSuccessMessage('Failed to copy tag: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTag = async (tag: Tag) => {
    setTagToDelete(tag)
    setShowDeleteDialog(true)
  }

  const executeDelete = async () => {
    if (!tagToDelete) return
    
    setIsLoading(true)
    try {
      // Update lifecycle to archived instead of deleting
      await tagApi.update(tagToDelete.id, {
        ...tagToDelete,
        lifecycle: 'archived'
      })
      await loadTags()
      setSuccessMessage(`Tag "${tagToDelete.name}" archived successfully!`)
      setShowSuccessDialog(true)
      setShowDeleteDialog(false)
      setTagToDelete(null)
    } catch (error) {
      console.error('Archive failed:', error)
      setSuccessMessage('Failed to archive tag: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag)
    setNewTagName(tag.name)
    // If it's a UDT, show the UDT type name, otherwise show the basic type
    setNewTagType(tag.type === 'UDT' && tag.udtType ? tag.udtType : tag.type)
    setNewTagScope(tag.scope || 'global')
    setNewTagLifecycle(tag.lifecycle || 'draft')
    setNewTagAddress(tag.address || '')
    setNewTagDescription(tag.metadata?.description || '')
    setNewTagReadOnly(tag.readOnly || false)
    setNewTagRequiresApproval(tag.requiresApproval || false)
    setNewTagLockScope(tag.scopeLocked || false)
    setShowCreateTagDialog(true)
  }

  const loadTagDependencies = async (tagId: string) => {
    setIsLoading(true)
    try {
      const deps = await tagApi.getTagDependencies(tagId, activeProject?.id)
      setTagDependencies(deps)
    } catch (error) {
      console.error('Failed to load tag dependencies:', error)
      setTagDependencies([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenAddressMapping = (tag: Tag) => {
    setSelectedTagForMapping(tag)
    setShowAddressMappingDialog(true)
  }

  const handleOpenValidationRules = (tag: Tag) => {
    setSelectedTagForMapping(tag)
    setShowValidationRulesDialog(true)
  }

  const handleSaveAliases = async (aliases: TagAlias[]) => {
    if (!selectedTagForMapping) return
    
    setIsLoading(true)
    try {
      // Save aliases via API
      await tagApi.saveTagAliases(selectedTagForMapping.id, aliases, activeProject?.id)
      setSuccessMessage('Address mappings saved successfully!')
      setShowSuccessDialog(true)
      await loadTags()
    } catch (error) {
      console.error('Failed to save aliases:', error)
      setSuccessMessage('Failed to save address mappings: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveValidationRules = async (rules: TagValidationRule[]) => {
    if (!selectedTagForMapping) return
    
    setIsLoading(true)
    try {
      // Save validation rules via API
      await tagApi.saveTagValidationRules(selectedTagForMapping.id, rules, activeProject?.id)
      setSuccessMessage('Validation rules saved successfully!')
      setShowSuccessDialog(true)
      await loadTags()
    } catch (error) {
      console.error('Failed to save validation rules:', error)
      setSuccessMessage('Failed to save validation rules: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedTags.size === filteredTags.length) {
      setSelectedTags(new Set())
    } else {
      setSelectedTags(new Set(filteredTags.map(t => t.id)))
    }
  }



  // Filtering logic - ensure tags is always an array
  const filteredTags = (Array.isArray(tags) ? tags : []).filter(tag => {
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
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
      case 'deprecated': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
      case 'draft': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
      case 'archived': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
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
          <p className="text-gray-600 dark:text-gray-400">No project selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-panda-surface-dark">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Tag Database</h1>
            <span className="text-sm text-gray-600 dark:text-gray-300">- {activeProject.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'tree' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <TreePine size={16} />
              </button>
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'hierarchy' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Network size={16} />
              </button>
            </div>

            <button
              onClick={() => setShowCreateUDTDialog(true)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
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
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder={regexSearch ? "Regex search (e.g., ^Motor_.*)" : "Search tags by name or address..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
              showFilterPanel ? 'bg-[#FF6A00] text-white border-[#FF6A00]' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <Filter size={16} />
            Filters
          </button>
          <button
            onClick={() => setShowDependencyGraph(true)}
            disabled={!selectedTag}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <GitBranch size={16} />
            Dependencies
          </button>
          <button
            onClick={() => setShowBulkActionsDialog(true)}
            disabled={selectedTags.size === 0}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Settings size={16} />
            Bulk Actions ({selectedTags.size})
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || tags.length === 0}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
          </button>
          <label className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer flex items-center gap-2">
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
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
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
              className="mt-4 p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Filter size={16} />
                  Filter Tags
                </h3>
                <button
                  onClick={() => setFilterOptions({})}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-[#FF6A00] hover:bg-orange-50 dark:hover:bg-orange-900 dark:hover:bg-opacity-20 rounded-md transition-colors"
                >
                  Clear All
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-6">
                {/* Type Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2.5">Data Type</label>
                  <select
                    multiple
                    value={filterOptions.type || []}
                    onChange={(e) => setFilterOptions({ ...filterOptions, type: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    style={{ height: '160px' }}
                  >
                    <option value="BOOL" className="py-1.5">BOOL</option>
                    <option value="INT" className="py-1.5">INT</option>
                    <option value="DINT" className="py-1.5">DINT</option>
                    <option value="REAL" className="py-1.5">REAL</option>
                    <option value="STRING" className="py-1.5">STRING</option>
                    <option value="UDT" className="py-1.5">UDT</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Hold Ctrl/Cmd to select multiple</p>
                </div>

                {/* Scope Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2.5">Scope</label>
                  <select
                    multiple
                    value={filterOptions.scope || []}
                    onChange={(e) => setFilterOptions({ ...filterOptions, scope: Array.from(e.target.selectedOptions, o => o.value) as TagScope[] })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    style={{ height: '160px' }}
                  >
                    <option value="global" className="py-1.5">Global</option>
                    <option value="program" className="py-1.5">Program</option>
                    <option value="task" className="py-1.5">Task</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Select tag scope level</p>
                </div>

                {/* Lifecycle Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2.5">Lifecycle Status</label>
                  <select
                    multiple
                    value={filterOptions.lifecycle || []}
                    onChange={(e) => setFilterOptions({ ...filterOptions, lifecycle: Array.from(e.target.selectedOptions, o => o.value) as TagLifecycle[] })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-[#FF6A00] bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    style={{ height: '160px' }}
                  >
                    <option value="draft" className="py-1.5">Draft</option>
                    <option value="active" className="py-1.5">Active</option>
                    <option value="deprecated" className="py-1.5">Deprecated</option>
                    <option value="archived" className="py-1.5">Archived</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Filter by tag status</p>
                </div>

                {/* Additional Filters */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2.5">Additional Filters</label>
                  <div className="space-y-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3" style={{ height: '160px' }}>
                    <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={filterOptions.hasValidation || false}
                        onChange={(e) => setFilterOptions({ ...filterOptions, hasValidation: e.target.checked })}
                        className="rounded border-gray-300 text-[#FF6A00] focus:ring-[#FF6A00] cursor-pointer"
                      />
                      <span className="group-hover:text-[#FF6A00] transition-colors">Has Validation Rules</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={filterOptions.hasAlias || false}
                        onChange={(e) => setFilterOptions({ ...filterOptions, hasAlias: e.target.checked })}
                        className="rounded border-gray-300 text-[#FF6A00] focus:ring-[#FF6A00] cursor-pointer"
                      />
                      <span className="group-hover:text-[#FF6A00] transition-colors">Has Aliases</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={filterOptions.requiresApproval || false}
                        onChange={(e) => setFilterOptions({ ...filterOptions, requiresApproval: e.target.checked })}
                        className="rounded border-gray-300 text-[#FF6A00] focus:ring-[#FF6A00] cursor-pointer"
                      />
                      <span className="group-hover:text-[#FF6A00] transition-colors">Requires Approval</span>
                    </label>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Special tag properties</p>
                </div>
              </div>

              {/* Active Filters Summary */}
              {(filterOptions.type?.length || filterOptions.scope?.length || filterOptions.lifecycle?.length || 
                filterOptions.hasValidation || filterOptions.hasAlias || filterOptions.requiresApproval) && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Active Filters:</span>
                    {filterOptions.type?.map(t => (
                      <span key={t} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-md">
                        Type: {t}
                      </span>
                    ))}
                    {filterOptions.scope?.map(s => (
                      <span key={s} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded-md">
                        Scope: {s}
                      </span>
                    ))}
                    {filterOptions.lifecycle?.map(l => (
                      <span key={l} className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-md">
                        Status: {l}
                      </span>
                    ))}
                    {filterOptions.hasValidation && (
                      <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 rounded-md">
                        Has Validation
                      </span>
                    )}
                    {filterOptions.hasAlias && (
                      <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 rounded-md">
                        Has Aliases
                      </span>
                    )}
                    {filterOptions.requiresApproval && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-md">
                        Requires Approval
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <Card>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading tags...</div>
          ) : (
            <>
              {viewMode === 'list' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="text-left py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedTags.size === filteredTags.length && filteredTags.length > 0}
                            onChange={handleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Scope</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Lifecycle</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Value</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Address</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Hierarchy</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Flags</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTags.map((tag, index) => (
                        <tr
                          key={tag.id}
                          className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedTags.has(tag.id) ? 'bg-blue-50 dark:bg-blue-900' : index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'
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
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded">
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
                                  <Shield size={14} className="text-green-600 dark:text-green-400" />
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
                                 className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600 dark:text-blue-400"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenAddressMapping(tag)
                                }}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600 dark:text-blue-400"
                                title="Address Mapping"
                              >
                                <MapPin size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenValidationRules(tag)
                                }}
                                className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded text-green-600 dark:text-green-400"
                                title="Validation Rules"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setTagToRename(tag)
                                  setShowRenameDialog(true)
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
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
                  <TagTreeView
                    tags={filteredTags}
                    searchTerm={searchTerm}
                    regexSearch={regexSearch}
                    onTagSelect={(tag) => {
                      setSelectedTag(tag)
                      loadTagDependencies(tag.id)
                    }}
                    onTagEdit={(tag) => {
                      handleEditTag(tag)
                    }}
                    onAddressMapping={handleOpenAddressMapping}
                    onValidationRules={handleOpenValidationRules}
                    selectedTagId={selectedTag?.id}
                  />
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
                        {Array.from(new Set((Array.isArray(tags) ? tags : []).filter(t => t.area).map(t => t.area!))).map(area => (
                          <button
                            key={area}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {area} ({(Array.isArray(tags) ? tags : []).filter(t => t.area === area).length})
                          </button>
                        ))}
                        {(Array.isArray(tags) ? tags : []).filter(t => t.area).length === 0 && (
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
                        {Array.from(new Set((Array.isArray(tags) ? tags : []).filter(t => t.equipment).map(t => t.equipment!))).map(equipment => (
                          <button
                            key={equipment}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {equipment} ({(Array.isArray(tags) ? tags : []).filter(t => t.equipment === equipment).length})
                          </button>
                        ))}
                        {(Array.isArray(tags) ? tags : []).filter(t => t.equipment).length === 0 && (
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
                        {Array.from(new Set((Array.isArray(tags) ? tags : []).filter(t => t.routine).map(t => t.routine!))).map(routine => (
                          <button
                            key={routine}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                          >
                            {routine} ({(Array.isArray(tags) ? tags : []).filter(t => t.routine === routine).length})
                          </button>
                        ))}
                        {(Array.isArray(tags) ? tags : []).filter(t => t.routine).length === 0 && (
                          <p className="text-xs text-gray-500 px-3 py-2">No routines defined</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'list' && (
                <div className="mt-4 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                  <div>
                    Showing {filteredTags.length} of {tags.length} tags
                    {selectedTags.size > 0 && ` • ${selectedTags.size} selected`}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{udts.length} UDTs defined</span>
                    <span>{(Array.isArray(tags) ? tags : []).filter(t => t.lifecycle === 'deprecated').length} deprecated</span>
                    <span>{(Array.isArray(tags) ? tags : []).filter(t => t.requiresApproval).length} protected</span>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Create Tag Dialog */}
      {showCreateTagDialog && (
        <Dialog isOpen={showCreateTagDialog} onClose={() => { setShowCreateTagDialog(false); resetTagForm(); }} title={selectedTag ? 'Edit Tag' : 'Create Tag'} size="large">
          <div className="p-6 space-y-4 bg-white dark:bg-gray-900">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-text-dark mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark"
                  placeholder="Tag_Name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-text-dark mb-1">Type *</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark"
                  value={newTagType}
                  onChange={(e) => setNewTagType(e.target.value)}
                >
                  <optgroup label="Basic Types">
                    <option value="BOOL">BOOL</option>
                    <option value="INT">INT</option>
                    <option value="DINT">DINT</option>
                    <option value="REAL">REAL</option>
                    <option value="STRING">STRING</option>
                    <option value="TIMER">TIMER</option>
                    <option value="COUNTER">COUNTER</option>
                  </optgroup>
                  {udts.length > 0 && (
                    <optgroup label="User Defined Types">
                      {udts.map(udt => (
                        <option key={udt.id} value={udt.name}>{udt.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-text-dark mb-1">Scope</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark"
                  value={newTagScope}
                  onChange={(e) => setNewTagScope(e.target.value as TagScope)}
                >
                  <option value="global">Global</option>
                  <option value="program">Program</option>
                  <option value="task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-text-dark mb-1">Lifecycle</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark"
                  value={newTagLifecycle}
                  onChange={(e) => setNewTagLifecycle(e.target.value as TagLifecycle)}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-text-dark mb-1">Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark"
                  placeholder="DB1.DBX0.0"
                  value={newTagAddress}
                  onChange={(e) => setNewTagAddress(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-text-dark mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-text-dark"
                  rows={2}
                  placeholder="Tag description..."
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                />
              </div>
              <div className="col-span-2 flex gap-3">
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    className="rounded" 
                    checked={newTagReadOnly}
                    onChange={(e) => setNewTagReadOnly(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-text-dark">Read Only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    className="rounded" 
                    checked={newTagRequiresApproval}
                    onChange={(e) => setNewTagRequiresApproval(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-text-dark">Requires Approval</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    className="rounded" 
                    checked={newTagLockScope}
                    onChange={(e) => setNewTagLockScope(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-text-dark">Lock Scope</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreateTagDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-text-dark bg-white dark:bg-gray-800"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTag}
                disabled={isLoading}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (selectedTag ? 'Updating...' : 'Creating...') : (selectedTag ? 'Update Tag' : 'Create Tag')}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create UDT Dialog */}
      {/* Create UDT Dialog */}
      {showCreateUDTDialog && (
        <UDTEditor
          isOpen={showCreateUDTDialog}
          onClose={() => setShowCreateUDTDialog(false)}
          onSave={handleCreateUDT}
        />
      )}

      {/* Bulk Actions Dialog */}
      {showBulkActionsDialog && (
        <BulkActionsDialog
          isOpen={showBulkActionsDialog}
          onClose={() => setShowBulkActionsDialog(false)}
          onExecute={(operation, params, dryRun) => handleBulkOperation(operation, params, dryRun)}
          selectedTagsCount={selectedTags.size}
          previewData={bulkOperation || undefined}
        />
      )}

      {/* Dependency Graph Dialog */}
      {showDependencyGraph && selectedTag && (
        <DependencyGraph
          isOpen={showDependencyGraph}
          onClose={() => setShowDependencyGraph(false)}
          tag={selectedTag}
          dependencies={tagDependencies}
          onNavigate={(type, id) => {
            console.log('Navigate to:', type, id)
            // TODO: Implement navigation
          }}
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

      {/* Success Dialog */}
      {showSuccessDialog && (
        <Dialog 
          isOpen={showSuccessDialog} 
          onClose={() => setShowSuccessDialog(false)} 
          title={successMessage.toLowerCase().includes('fail') || successMessage.toLowerCase().includes('error') ? 'Error' : 'Success'}
          message={successMessage}
          type={successMessage.toLowerCase().includes('fail') || successMessage.toLowerCase().includes('error') ? 'error' : 'success'}
          size="small"
        />
      )}

      {/* Rename Dialog */}
      {showRenameDialog && tagToRename && (
        <InputDialog
          isOpen={showRenameDialog}
          onClose={() => {
            setShowRenameDialog(false)
            setTagToRename(null)
          }}
          onConfirm={(newName) => {
            if (newName && newName !== tagToRename.name) {
              handleRenameTag(tagToRename.id, newName)
            }
            setShowRenameDialog(false)
            setTagToRename(null)
          }}
          title="Rename Tag"
          label="Tag Name"
          placeholder="Enter new tag name"
          defaultValue={tagToRename.name}
          required={true}
          confirmButtonText="Next"
        />
      )}

      {/* Rename Confirmation Dialog */}
      {showRenameConfirmDialog && pendingRename && (
        <InputDialog
          isOpen={showRenameConfirmDialog}
          onClose={() => {
            setShowRenameConfirmDialog(false)
            setPendingRename(null)
          }}
          onConfirm={executeRename}
          title="Confirm Rename"
          label="New Tag Name"
          description={`Rename tag "${pendingRename.oldName}" to "${pendingRename.newName}"? This will update the tag name directly.`}
          defaultValue={pendingRename.newName}
          required={true}
          confirmButtonText="Update"
        />
      )}

      {/* Copy Tag Dialog */}
      {showCopyDialog && tagToCopy && (
        <InputDialog
          isOpen={showCopyDialog}
          onClose={() => {
            setShowCopyDialog(false)
            setTagToCopy(null)
          }}
          onConfirm={(newName) => {
            if (newName) {
              executeCopy(newName)
            }
          }}
          title="Copy Tag"
          label="New Tag Name"
          placeholder="Enter name for the copied tag"
          defaultValue={`${tagToCopy.name}_copy`}
          required={true}
          confirmButtonText="Create"
        />
      )}

      {/* Delete Tag Confirmation Dialog */}
      {showDeleteDialog && tagToDelete && (
        <Dialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false)
            setTagToDelete(null)
          }}
          title="Delete Tag"
          message={`Are you sure you want to delete tag "${tagToDelete.name}"? This will archive the tag and it can be recovered later.`}
          type="warning"
          size="small"
          actions={[
            {
              label: 'Cancel',
              onClick: () => {
                setShowDeleteDialog(false)
                setTagToDelete(null)
              },
              variant: 'secondary'
            },
            {
              label: isLoading ? 'Deleting...' : 'Delete',
              onClick: executeDelete,
              variant: 'danger' as const
            }
          ]}
        />
      )}

      {/* Address Mapping Dialog */}
      {showAddressMappingDialog && selectedTagForMapping && (
        <AddressMappingManager
          isOpen={showAddressMappingDialog}
          onClose={() => {
            setShowAddressMappingDialog(false)
            setSelectedTagForMapping(null)
          }}
          tagId={selectedTagForMapping.id}
          tagName={selectedTagForMapping.name}
          onSave={handleSaveAliases}
        />
      )}

      {/* Validation Rules Dialog */}
      {showValidationRulesDialog && selectedTagForMapping && (
        <ValidationRulesManager
          isOpen={showValidationRulesDialog}
          onClose={() => {
            setShowValidationRulesDialog(false)
            setSelectedTagForMapping(null)
          }}
          tagId={selectedTagForMapping.id}
          tagName={selectedTagForMapping.name}
          tagType={selectedTagForMapping.type}
          onSave={handleSaveValidationRules}
        />
      )}
    </div>
  )
}

// ============ Dialog Components ============

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
