import { useState, useEffect, useMemo, useRef } from 'react'
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
  Archive,
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
import { useDebounce } from '../hooks/useDebounce'
import { useSyncStore } from '../store/syncStore'
import { useProjectStore } from '../store/projectStore'
import { tagApi, tagLifecycleApi, projectApi, tagCleanupApi } from '../services/api'
import { useLicenseStore } from '../store/licenseStore'
import { getPresetsForContext, upsertPreset, deletePreset as deletePresetStorage } from '../utils/csvPresetStorage'
import type {
  Tag,
  TagScope,
  TagLifecycle,
  UserDefinedType,
  TagRefactoringPreview,
  BulkTagOperation,
  TagDependency,
  TagAlias,
  TagValidationRule,
  TagCsvMappingPreset,
  TagCsvFieldMapping,
  TagCsvFieldKey,
  TagCleanupCandidate,
  TagLifecyclePolicy
} from '../types'

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
  const { activeProject, setActiveProject } = useProjectStore()
  const [tags, setTags] = useState<Tag[]>([])
  const [udts, setUdts] = useState<UserDefinedType[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 200)
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
  const [restoreCandidate, setRestoreCandidate] = useState<Tag | null>(null)
  const [showAddressMappingDialog, setShowAddressMappingDialog] = useState(false)
  const [showValidationRulesDialog, setShowValidationRulesDialog] = useState(false)
  const [selectedTagForMapping, setSelectedTagForMapping] = useState<Tag | null>(null)
  const [showPresetPage, setShowPresetPage] = useState(false)
  const [showPolicyPage, setShowPolicyPage] = useState(false)
  const [showCleanupPage, setShowCleanupPage] = useState(false)
  const [showArchivePage, setShowArchivePage] = useState(false)

  // CSV mapping presets
  const [presets, setPresets] = useState<TagCsvMappingPreset[]>([])
  const [editingPreset, setEditingPreset] = useState<TagCsvMappingPreset | null>(null)
  const [showPresetDialog, setShowPresetDialog] = useState(false)
  const [presetToDelete, setPresetToDelete] = useState<TagCsvMappingPreset | null>(null)

  // CSV import/export with presets
  const [pendingCsvImport, setPendingCsvImport] = useState<{ header: string[]; rows: string[][]; fileName: string } | null>(null)
  const [showCsvImportDialog, setShowCsvImportDialog] = useState(false)
  const [selectedImportPresetId, setSelectedImportPresetId] = useState<string | null>(null)
  const [schemaDriftColumns, setSchemaDriftColumns] = useState<string[]>([])
  const [showCsvExportDialog, setShowCsvExportDialog] = useState(false)
  const [selectedExportPresetId, setSelectedExportPresetId] = useState<string | null>(null)
  
  // Selected items
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

  const [refactoringPreview, setRefactoringPreview] = useState<TagRefactoringPreview | null>(null)
  const [bulkOperation, setBulkOperation] = useState<BulkTagOperation | null>(null)
  const [tagDependencies, setTagDependencies] = useState<TagDependency[]>([])

  // Tag lifecycle policies
  const [lifecyclePolicies, setLifecyclePolicies] = useState<TagLifecyclePolicy[]>([])
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)
  const [newPolicyName, setNewPolicyName] = useState('')
  const [newPolicyDescription, setNewPolicyDescription] = useState('')
  const [showPolicyConfirmDialog, setShowPolicyConfirmDialog] = useState(false)
  const [pendingPolicyId, setPendingPolicyId] = useState<string | null>(null)
  const [pendingDeletePolicyId, setPendingDeletePolicyId] = useState<string | null>(null)
  const [showPolicyFormDialog, setShowPolicyFormDialog] = useState(false)
  const [thresholdNormal, setThresholdNormal] = useState(0)
  const [thresholdLow, setThresholdLow] = useState(15)
  const [thresholdReview, setThresholdReview] = useState(30)
  const [thresholdDeprecated, setThresholdDeprecated] = useState(60)
  const [thresholdRemoval, setThresholdRemoval] = useState(90)
  const [confirmNoActiveRefs, setConfirmNoActiveRefs] = useState(false)
  const [confirmDestructive, setConfirmDestructive] = useState(false)

  // Cleanup tags (from lifecycle evaluation)
  const [cleanupCandidates, setCleanupCandidates] = useState<TagCleanupCandidate[]>([])
  const [isLoadingCleanup, setIsLoadingCleanup] = useState(false)

  // Archived tags
  const [archivedTags, setArchivedTags] = useState<Tag[]>([])
  const [isLoadingArchive, setIsLoadingArchive] = useState(false)

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
  const licenseState = useLicenseStore()
  const orgKey = licenseState.licenseInfo ? (licenseState.licenseInfo as any).licenseId || 'default-org' : 'default-org'
  const workspaceKey = activeProject?.id || 'default-workspace'
  const isAdmin = (() => {
    const info = licenseState.licenseInfo as any
    const role = info?.role
    return typeof role === 'string' && role.toLowerCase() === 'admin'
  })()

  useEffect(() => {
    if (activeProject) {
      loadAllData()
    }
  }, [activeProject])

  useEffect(() => {
    // Load CSV mapping presets for current org/workspace
    if (orgKey && workspaceKey) {
      setPresets(getPresetsForContext(orgKey, workspaceKey))
    }
  }, [orgKey, workspaceKey])

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadTags(),
        loadUDTs(),
        loadHierarchy(),
        loadPolicies(),
        loadCleanup()
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

  const loadCleanup = async () => {
    try {
      if (!activeProject) {
        setCleanupCandidates([])
        return
      }
      setIsLoadingCleanup(true)
      const data = await tagCleanupApi.getCandidates(activeProject.id)
      setCleanupCandidates(data || [])
    } catch (error) {
      console.error('Failed to load cleanup tags:', error)
      setCleanupCandidates([])
    } finally {
      setIsLoadingCleanup(false)
    }
  }

  const loadArchive = async () => {
    try {
      setIsLoadingArchive(true)
      // Match main tag list behavior: show archived tags across all projects
      const data = await tagApi.getArchived()
      setArchivedTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load archived tags:', error)
      setArchivedTags([])
    } finally {
      setIsLoadingArchive(false)
    }
  }

  const loadPolicies = async () => {
    try {
      setIsLoadingPolicies(true)
      const policies = await tagLifecycleApi.getPolicies()
      setLifecyclePolicies(policies || [])
      // Initialize selected policy from active project if available
      if (activeProject) {
        const currentId = (activeProject as any).tag_lifecycle_policy_id || 'default'
        setSelectedPolicyId(currentId)
      }
    } catch (error) {
      console.error('Failed to load tag lifecycle policies:', error)
      setLifecyclePolicies([])
    } finally {
      setIsLoadingPolicies(false)
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

  const handleExportCsvWithPreset = () => {
    if (!tags || tags.length === 0) {
      setSuccessMessage('No tags available to export')
      setShowSuccessDialog(true)
      return
    }
    if (!presets || presets.length === 0) {
      setSuccessMessage('No CSV mapping presets defined. Create one first in the Presets view.')
      setShowSuccessDialog(true)
      return
    }
    setSelectedExportPresetId(presets[0]?.id || null)
    setShowCsvExportDialog(true)
  }

  const handleCreatePolicy = async () => {
    if (!newPolicyName.trim()) {
      setSuccessMessage('Please enter a policy name.')
      setShowSuccessDialog(true)
      return
    }

    try {
      const states = [
        {
          id: 'normal',
          label: 'Normal',
          icon: '',
          colorToken: 'status.green.subtle',
          thresholdDays: 0,
          showInCleanup: false,
          requiresConfirmation: false,
          allowRemoval: false,
        },
        {
          id: 'low_activity',
          label: 'Low Activity',
          icon: '⚠️',
          colorToken: 'status.amber.subtle',
          thresholdDays: thresholdLow,
          showInCleanup: false,
          requiresConfirmation: false,
          allowRemoval: false,
        },
        {
          id: 'candidate_for_deprecation',
          label: 'Review Recommended',
          icon: '🟡',
          colorToken: 'status.yellow.subtle',
          thresholdDays: thresholdReview,
          showInCleanup: true,
          requiresConfirmation: false,
          allowRemoval: false,
        },
        {
          id: 'deprecated',
          label: 'Deprecated',
          icon: '🔴',
          colorToken: 'status.red.subtle',
          thresholdDays: thresholdDeprecated,
          showInCleanup: true,
          requiresConfirmation: true,
          allowRemoval: false,
        },
        {
          id: 'eligible_for_removal',
          label: 'Eligible For Removal',
          icon: '🟣',
          colorToken: 'status.purple.subtle',
          thresholdDays: thresholdRemoval,
          showInCleanup: true,
          requiresConfirmation: true,
          allowRemoval: true,
        },
      ]

      const created = await tagLifecycleApi.createPolicy({
        name: newPolicyName.trim(),
        description: newPolicyDescription.trim() || undefined,
        states,
      })

      setLifecyclePolicies((prev) => [...prev, created])
      setNewPolicyName('')
      setNewPolicyDescription('')
      setShowPolicyFormDialog(false)
      setSuccessMessage('Lifecycle policy created.')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Failed to create lifecycle policy:', error)
      setSuccessMessage('Failed to create lifecycle policy: ' + (error as Error).message)
      setShowSuccessDialog(true)
    }
  }

  const handleConfirmPolicyChange = async () => {
    if (!activeProject || !pendingPolicyId) {
      setShowPolicyConfirmDialog(false)
      return
    }
    try {
      const updated = await projectApi.update(activeProject.id, {
        // @ts-expect-error backend field
        tag_lifecycle_policy_id: pendingPolicyId,
      } as any)
      setActiveProject(updated)
      setSelectedPolicyId(pendingPolicyId)
      setSuccessMessage('Lifecycle policy updated for this project. Tag states will refresh based on the new policy.')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Failed to update lifecycle policy for project:', error)
      setSuccessMessage('Failed to update lifecycle policy: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setShowPolicyConfirmDialog(false)
      setPendingPolicyId(null)
    }
  }

  const handleConfirmPolicyDelete = async () => {
    if (!pendingDeletePolicyId) {
      return
    }
    try {
      await tagLifecycleApi.deletePolicy(pendingDeletePolicyId)
      setLifecyclePolicies((prev) => prev.filter((p) => p.id !== pendingDeletePolicyId))
      if (selectedPolicyId === pendingDeletePolicyId) {
        setSelectedPolicyId(activeProject ? (activeProject as any).tag_lifecycle_policy_id || 'default' : 'default')
      }
      setSuccessMessage('Lifecycle policy deleted.')
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Failed to delete lifecycle policy:', error)
      setSuccessMessage('Failed to delete lifecycle policy: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setPendingDeletePolicyId(null)
    }
  }

  const handleImportWithWizard = async (file: File) => {
    setIsLoading(true)
    try {
      const lower = file.name.toLowerCase()
      const isCsv = lower.endsWith('.csv')

      if (!isCsv) {
        // Existing JSON import path
        await tagApi.importTags(file, false)
        await loadTags()
        setSuccessMessage('Tags imported successfully!')
        setShowSuccessDialog(true)
        return
      }

      // CSV import path using presets
      const text = await file.text()
      const rows = text
        .split(/\r?\n/)
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => r.split(','))

      if (rows.length < 2) {
        setSuccessMessage('CSV file appears to be empty or missing data rows')
        setShowSuccessDialog(true)
        return
      }

      const header = rows[0].map(h => h.trim())
      const dataRows = rows.slice(1)

      if (!presets || presets.length === 0) {
        setSuccessMessage('No CSV mapping presets defined. Create one first in the Presets view.')
        setShowSuccessDialog(true)
        return
      }

      setPendingCsvImport({ header, rows: dataRows, fileName: file.name })
      const initialPresetId = presets[0]?.id || null
      setSelectedImportPresetId(initialPresetId)
      if (initialPresetId) {
        const preset = presets.find(p => p.id === initialPresetId)
        if (preset) {
          const missing = preset.fieldMappings
            .map(m => m.columnName)
            .filter(col => !header.includes(col))
          setSchemaDriftColumns(missing)
        }
      } else {
        setSchemaDriftColumns([])
      }
      setShowCsvImportDialog(true)
    } catch (error) {
      console.error('Import failed:', error)
      setSuccessMessage('Failed to import tags: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const executeCsvImportWithPreset = async () => {
    if (!pendingCsvImport || !selectedImportPresetId) return
    const preset = presets.find(p => p.id === selectedImportPresetId)
    if (!preset) return

    const { header, rows } = pendingCsvImport

    const headerIndexMap: Record<string, number> = {}
    header.forEach((col, idx) => {
      headerIndexMap[col] = idx
    })

    const tagsToImport: any[] = []

    for (const row of rows) {
      const tag: any = {
        source: 'shadow',
        metadata: {}
      }

      preset.fieldMappings.forEach(mapping => {
        const idx = headerIndexMap[mapping.columnName]
        if (idx === undefined) {
          return
        }
        const raw = (row[idx] || '').trim()
        if (!raw && mapping.required) {
          return
        }
        switch (mapping.field as TagCsvFieldKey) {
          case 'name':
            tag.name = raw
            break
          case 'type':
            tag.type = raw
            break
          case 'address':
            tag.address = raw
            break
          case 'value':
            tag.value = raw
            break
          case 'area':
            tag.area = raw
            break
          case 'equipment':
            tag.equipment = raw
            break
          case 'routine':
            tag.routine = raw
            break
          case 'description':
            if (!tag.metadata) tag.metadata = {}
            tag.metadata.description = raw
            break
        }
      })

      if (tag.name && tag.type) {
        tagsToImport.push(tag)
      }
    }

    if (tagsToImport.length === 0) {
      setSuccessMessage('No tags could be constructed from the CSV using the selected preset')
      setShowSuccessDialog(true)
      return
    }

    setIsLoading(true)
    try {
      const result = await tagApi.importTagsFromData(tagsToImport, false)
      await loadTags()
      const summary = `Tags imported from CSV: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`
      setSuccessMessage(summary)
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('CSV import failed:', error)
      setSuccessMessage('Failed to import CSV tags: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
      setPendingCsvImport(null)
      setShowCsvImportDialog(false)
      setSelectedImportPresetId(null)
      setSchemaDriftColumns([])
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

    // Optimistic update for existing tag edits
    if (selectedTag) {
      const previousTags = Array.isArray(tags) ? [...tags] : []
      const updatedTag: Tag = { ...selectedTag, ...tagData }

      // Immediately reflect change in UI
      setTags((current) => (Array.isArray(current) ? current.map(t => t.id === selectedTag.id ? updatedTag : t) : []))
      setSelectedTag(updatedTag)
      resetTagForm()
      setShowCreateTagDialog(false)

      try {
        await tagApi.update(selectedTag.id, tagData)
        setSuccessMessage(`Tag "${newTagName}" updated successfully!`)
      } catch (error) {
        console.error('Tag update failed, reverting optimistic change:', error)
        // Revert UI to previous state
        setTags(previousTags)
        setSuccessMessage('Failed to update tag: ' + (error as Error).message)
      } finally {
        setShowSuccessDialog(true)
        setIsLoading(false)
      }
      return
    }

    // Optimistic create for new tags
    const previousTags = Array.isArray(tags) ? [...tags] : []
    const tempId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const optimisticTag: Tag = {
      id: tempId,
      name: tagData.name || 'NewTag',
      type: (tagData.type as any) || 'BOOL',
      value: tagData.value ?? false,
      address: tagData.address || 'DB1.DBX0.0',
      lastUpdate: tagData.lastUpdate || new Date(),
      source: tagData.source || 'shadow',
      scope: tagData.scope,
      lifecycle: tagData.lifecycle,
      udtType: tagData.udtType,
      readOnly: tagData.readOnly,
      requiresApproval: tagData.requiresApproval,
      scopeLocked: tagData.scopeLocked,
      metadata: tagData.metadata,
      aliases: [],
      validationRules: [],
      dependencies: [],
    }

    setTags((current) => (Array.isArray(current) ? [...current, optimisticTag] : [optimisticTag]))
    resetTagForm()
    setShowCreateTagDialog(false)

    try {
      const created = await tagApi.create(tagData)
      // Replace temp tag with real one from backend
      setTags((current) => (Array.isArray(current) ? current.map(t => t.id === tempId ? (created as Tag) : t) : []))
      setSuccessMessage(`Tag "${newTagName}" created successfully!`)
    } catch (error) {
      console.error('Tag create failed, reverting optimistic change:', error)
      // Revert to previous list (remove optimistic tag)
      setTags(previousTags)
      setSuccessMessage('Failed to create tag: ' + (error as Error).message)
    } finally {
      setShowSuccessDialog(true)
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
    // Frontend safety: block delete when tag still has active references
    if (tag.hasActiveReferences) {
      setSuccessMessage('This tag has active references and cannot be deleted. Remove all references first.')
      setShowSuccessDialog(true)
      return
    }
    setConfirmNoActiveRefs(false)
    setConfirmDestructive(false)
    setTagToDelete(tag)
    setShowDeleteDialog(true)
  }

  const executeDelete = async () => {
    if (!tagToDelete) return
    
    setIsLoading(true)
    try {
      // Use backend policy-aware soft delete; backend will also reject
      // if the tag is not eligible for removal under the lifecycle policy.
      await tagApi.delete(tagToDelete.id)
      await loadTags()
      setSuccessMessage(`Tag "${tagToDelete.name}" deleted successfully (soft delete).`)
      setShowSuccessDialog(true)
      setShowDeleteDialog(false)
      setTagToDelete(null)
    } catch (error) {
      console.error('Delete failed:', error)
      setSuccessMessage('Failed to delete tag: ' + (error as Error).message)
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

  const handleRestoreTag = async (tag: Tag) => {
    setIsLoading(true)
    try {
      await tagApi.restore(tag.id)
      await loadTags()
      setSuccessMessage(`Tag "${tag.name}" restored successfully!`)
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Restore failed:', error)
      setSuccessMessage('Failed to restore tag: ' + (error as Error).message)
      setShowSuccessDialog(true)
    } finally {
      setIsLoading(false)
      setRestoreCandidate(null)
    }
  }

  const loadTagDependencies = async (tagId: string) => {
    console.log('🔍 loadTagDependencies called for:', tagId)
    setIsLoading(true)
    try {
      const deps = await tagApi.getTagDependencies(tagId, activeProject?.id)
      console.log('✅ Loaded dependencies:', deps.length, deps)
      setTagDependencies(deps)
    } catch (error) {
      console.error('❌ Failed to load tag dependencies:', error)
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

  const handleOpenPresetDialog = (preset?: TagCsvMappingPreset) => {
    if (!isAdmin) {
      setSuccessMessage('Only Admins can manage CSV mapping presets')
      setShowSuccessDialog(true)
      return
    }

    if (preset) {
      setEditingPreset(preset)
    } else {
      const now = new Date().toISOString()
      const newPreset: TagCsvMappingPreset = {
        id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: 'New CSV Mapping',
        description: '',
        vendor: 'neutral',
        version: 1,
        createdAt: now,
        updatedAt: now,
        orgKey,
        workspaceKey,
        fieldMappings: [
          { id: 'name', columnName: 'TagName', field: 'name', required: true },
          { id: 'type', columnName: 'DataType', field: 'type', required: true },
          { id: 'address', columnName: 'Address', field: 'address', required: false },
          { id: 'description', columnName: 'Description', field: 'description', required: false }
        ]
      }
      setEditingPreset(newPreset)
    }
    setShowPresetDialog(true)
  }

  const handleSavePreset = (updatedPreset: TagCsvMappingPreset) => {
    const next = upsertPreset(updatedPreset)
    setPresets(next.filter(p => p.orgKey === orgKey && p.workspaceKey === workspaceKey))
    setShowPresetDialog(false)
    setEditingPreset(null)
    setSuccessMessage('CSV mapping preset saved successfully')
    setShowSuccessDialog(true)
  }

  const handleRequestDeletePreset = (preset: TagCsvMappingPreset) => {
    if (!isAdmin) {
      setSuccessMessage('Only Admins can manage CSV mapping presets')
      setShowSuccessDialog(true)
      return
    }
    setPresetToDelete(preset)
  }

  const handleConfirmDeletePreset = () => {
    if (!presetToDelete) return
    const nextAll = deletePresetStorage(presetToDelete.id)
    setPresets(nextAll.filter(p => p.orgKey === orgKey && p.workspaceKey === workspaceKey))
    setPresetToDelete(null)
    setSuccessMessage('CSV mapping preset deleted')
    setShowSuccessDialog(true)
  }



  // Filtering logic - ensure tags is always an array
  // Use debounced search term to prevent lag during typing
  const filteredTags = useMemo(() => {
    return (Array.isArray(tags) ? tags : []).filter(tag => {
      // Search filter
      if (debouncedSearchTerm) {
        if (regexSearch) {
          try {
            const regex = new RegExp(debouncedSearchTerm, 'i')
            if (!regex.test(tag.name) && !regex.test(tag.address || '')) {
              return false
            }
          } catch {
            // Invalid regex, fall back to string search
            if (!tag.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) {
              return false
            }
          }
        } else {
          if (!tag.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) &&
              !tag.address?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) {
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
  }, [tags, debouncedSearchTerm, regexSearch, filterOptions])

  // Virtualization settings for the list view
  const ROW_HEIGHT = 40
  const BUFFER_ROWS = 10
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listContainerHeight, setListContainerHeight] = useState(400)
  const [focusedRowIndex, setFocusedRowIndex] = useState(0)

  useEffect(() => {
    const container = listContainerRef.current
    if (!container) return

    const updateHeight = () => {
      setListContainerHeight(container.clientHeight || 400)
    }

    updateHeight()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateHeight())
      observer.observe(container)
      return () => observer.disconnect()
    } else {
      window.addEventListener('resize', updateHeight)
      return () => window.removeEventListener('resize', updateHeight)
    }
  }, [])

  const handleListScroll = (e: any) => {
    setListScrollTop(e.currentTarget.scrollTop || 0)
  }

  const totalRows = filteredTags.length
  const visibleRowCount = Math.ceil(listContainerHeight / ROW_HEIGHT) + BUFFER_ROWS
  const startIndex = Math.max(0, Math.floor(listScrollTop / ROW_HEIGHT) - BUFFER_ROWS)
  const endIndex = Math.min(totalRows, startIndex + visibleRowCount)
  const visibleTags = filteredTags.slice(startIndex, endIndex)
  const topSpacerHeight = startIndex * ROW_HEIGHT
  const bottomSpacerHeight = (totalRows - endIndex) * ROW_HEIGHT

  const focusRow = (index: number) => {
    setFocusedRowIndex(index)
    // Move actual DOM focus to the corresponding row after render
    requestAnimationFrame(() => {
      if (!listContainerRef.current) return
      const row = listContainerRef.current.querySelector<HTMLTableRowElement>(
        `tr[data-row-index="${index}"]`
      )
      row?.focus()
    })
  }

  const handleListKeyDown = (e: any) => {
    if (totalRows === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      const nextIndex = Math.min(totalRows - 1, focusedRowIndex + 1)
      if (nextIndex !== focusedRowIndex) {
        focusRow(nextIndex)
        const nextTag = filteredTags[nextIndex]
        if (nextTag) {
          setSelectedTag(nextTag)
          loadTagDependencies(nextTag.id)
        }
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = nextIndex * ROW_HEIGHT
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      const prevIndex = Math.max(0, focusedRowIndex - 1)
      if (prevIndex !== focusedRowIndex) {
        focusRow(prevIndex)
        const prevTag = filteredTags[prevIndex]
        if (prevTag) {
          setSelectedTag(prevTag)
          loadTagDependencies(prevTag.id)
        }
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = prevIndex * ROW_HEIGHT
        }
      }
    }
  }

  const handleListFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    // When the container itself receives focus (via Tab), move focus to the current row
    if (e.target === e.currentTarget && totalRows > 0) {
      const index = focusedRowIndex < totalRows ? focusedRowIndex : 0
      focusRow(index)
    }
  }

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
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
              {showPresetPage
                ? 'CSV Mapping Presets'
                : showPolicyPage
                  ? 'Tag Lifecycle Policies'
                  : showCleanupPage
                    ? 'Tag Cleanup'
                    : showArchivePage
                      ? 'Tag Archive'
                      : 'Tag Database'}
            </h1>
            <span className="text-sm text-gray-600 dark:text-gray-300">- {activeProject.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {!showPresetPage && !showPolicyPage && !showCleanupPage && !showArchivePage && (
              <>
                <button
                  onClick={() => { setShowPresetPage(true); setShowPolicyPage(false); setShowCleanupPage(false); setShowArchivePage(false) }}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <FileText size={16} />
                  CSV Presets
                </button>
                <button
                  onClick={() => { setShowPolicyPage(true); setShowPresetPage(false); setShowCleanupPage(false); setShowArchivePage(false) }}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Shield size={16} />
                  Lifecycle Policies
                </button>
                <button
                  onClick={() => { setShowCleanupPage(true); setShowPresetPage(false); setShowPolicyPage(false); setShowArchivePage(false); loadCleanup() }}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Cleanup
                </button>
                <button
                  onClick={() => { setShowArchivePage(true); setShowPresetPage(false); setShowPolicyPage(false); setShowCleanupPage(false); loadArchive() }}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Archive size={16} />
                  Tag Archive
                </button>
              </>
            )}
            {(showPresetPage || showPolicyPage || showCleanupPage || showArchivePage) && (
              <button
                onClick={() => { setShowPresetPage(false); setShowPolicyPage(false); setShowCleanupPage(false); setShowArchivePage(false) }}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <List size={16} />
                Back to Tags
              </button>
            )}
            {/* View mode toggle */}
            {!showPresetPage && !showPolicyPage && !showCleanupPage && !showArchivePage && (
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
            )}

            {!showPresetPage && !showPolicyPage && !showCleanupPage && !showArchivePage && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Search and filters */}
        {!showPresetPage && !showPolicyPage && !showCleanupPage && !showArchivePage && (
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
          <button
            onClick={handleExportCsvWithPreset}
            disabled={isLoading || tags.length === 0}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            CSV
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
        )}

        {/* Filter Panel */}
        {!showPresetPage && !showPolicyPage && !showCleanupPage && !showArchivePage && (
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
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        {!showPresetPage && !showPolicyPage && !showCleanupPage && !showArchivePage && (
        <Card>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading tags...</div>
          ) : (
            <>
              {viewMode === 'list' && (
                <div
                  ref={listContainerRef}
                  className="overflow-auto max-h-[calc(100vh-320px)]"
                  onScroll={handleListScroll}
                  tabIndex={0}
                  onKeyDown={handleListKeyDown}
                  onFocus={handleListFocus}
                >
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
                      {topSpacerHeight > 0 && (
                        <tr style={{ height: topSpacerHeight }}>
                          <td colSpan={10}></td>
                        </tr>
                      )}
                      {visibleTags.map((tag, index) => {
                        const rowIndex = startIndex + index
                        return (
                        <tr
                          key={tag.id}
                          data-row-index={rowIndex}
                          className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            rowIndex === focusedRowIndex
                              ? 'bg-orange-50 dark:bg-orange-900 outline-none ring-2 ring-offset-0 ring-[#FF6A00]'
                              : selectedTags.has(tag.id)
                                ? 'bg-blue-50 dark:bg-blue-900'
                                : rowIndex % 2 === 0
                                  ? 'bg-white dark:bg-gray-800'
                                  : 'bg-gray-50 dark:bg-gray-700'
                          }`}
                          style={{ height: ROW_HEIGHT }}
                          tabIndex={rowIndex === focusedRowIndex ? 0 : -1}
                          onFocus={() => {
                            setFocusedRowIndex(rowIndex)
                            setSelectedTag(tag)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleEditTag(tag)
                            } else if (e.key === ' ') {
                              e.preventDefault()
                              handleToggleSelection(tag.id)
                            } else if (e.key === 'Delete') {
                              e.preventDefault()
                              handleDeleteTag(tag)
                            } else if (e.key.toLowerCase && e.key.toLowerCase() === 'a') {
                              e.preventDefault()
                              handleOpenAddressMapping(tag)
                            } else if (e.key.toLowerCase && e.key.toLowerCase() === 'v') {
                              e.preventDefault()
                              handleOpenValidationRules(tag)
                            } else if (e.key.toLowerCase && e.key.toLowerCase() === 'r') {
                              e.preventDefault()
                              setTagToRename(tag)
                              setShowRenameDialog(true)
                            } else if (e.key.toLowerCase && e.key.toLowerCase() === 'c') {
                              e.preventDefault()
                              handleCopyTag(tag)
                            }
                          }}
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
                            className="py-2 px-4 font-mono text-gray-900 dark:text-white cursor-pointer hover:text-[#FF6A00]"
                            onClick={() => {
                              console.log('🏷️ Tag clicked:', tag.name, tag.id)
                              setSelectedTag(tag)
                              console.log('📊 Loading dependencies for:', tag.id)
                              loadTagDependencies(tag.id)
                            }}
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
                          <td className="py-2 px-4 font-mono text-gray-900 dark:text-white">{formatValue(tag.value)}</td>
                          <td className="py-2 px-4 font-mono text-gray-600 dark:text-gray-400 text-xs">{tag.address}</td>
                          <td className="py-2 px-4 text-xs text-gray-600 dark:text-gray-400">
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
                                disabled={!!tag.hasActiveReferences}
                                className={`p-1 rounded text-red-600 ${
                                  tag.hasActiveReferences
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-red-100'
                                }`}
                                title={tag.hasActiveReferences ? 'Cannot delete while tag has active references' : 'Delete'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                      {bottomSpacerHeight > 0 && (
                        <tr style={{ height: bottomSpacerHeight }}>
                          <td colSpan={10}></td>
                        </tr>
                      )}
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
        )}

        {showCleanupPage && (
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Trash2 size={18} />
                    Cleanup Tags
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Tags that are past lifecycle thresholds and safe to review for removal.
                  </p>
                </div>
                <button
                  onClick={loadCleanup}
                  disabled={isLoadingCleanup}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={isLoadingCleanup ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {isLoadingCleanup ? (
                <div className="flex items-center justify-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                  Loading cleanup tags...
                </div>
              ) : !cleanupCandidates || cleanupCandidates.length === 0 ? (
                <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No cleanup tags found for the current project.
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Tag</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Lifecycle State</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Inactivity</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Last Referenced</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Usage Summary</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {cleanupCandidates.map((candidate) => (
                        <tr key={candidate.tagId} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="px-4 py-2 align-top">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{candidate.tagName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">ID: {candidate.tagId}</div>
                          </td>
                          <td className="px-4 py-2 align-top">
                            <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                              <span>{candidate.stateLabel}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 align-top text-sm text-gray-800 dark:text-gray-200">
                            {candidate.inactivityDays != null ? (
                              <>{candidate.inactivityDays} days</>
                            ) : (
                              <span className="text-gray-400">n/a</span>
                            )}
                          </td>
                          <td className="px-4 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                            {candidate.lastReferencedAt ? (
                              new Date(candidate.lastReferencedAt).toLocaleString()
                            ) : (
                              <span className="text-gray-400">No recent references</span>
                            )}
                          </td>
                          <td className="px-4 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                            <div className="flex flex-col gap-0.5">
                              <span>Logic: {candidate.logicUsageCount ?? 0}</span>
                              <span>IO / Tag bindings: {candidate.ioBindingsCount ?? 0}</span>
                              <span>HMI / SCADA: {candidate.hmiBindingsCount ?? 0}</span>
                              <span>Alarms: {candidate.alarmBindingsCount ?? 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  const tag = (Array.isArray(tags) ? tags : []).find((t) => t.id === candidate.tagId)
                                  if (tag) {
                                    setSelectedTag(tag)
                                    loadTagDependencies(tag.id)
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <Eye size={14} />
                                View Tag
                              </button>
                              <button
                                onClick={() => {
                                  const tag = (Array.isArray(tags) ? tags : []).find((t) => t.id === candidate.tagId)
                                  if (tag) {
                                    handleDeleteTag(tag)
                                  }
                                }}
                                disabled={!!candidate.hasActiveReferences}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs text-red-600 dark:text-red-400 ${
                                  candidate.hasActiveReferences
                                    ? 'border-red-200 dark:border-red-800 opacity-40 cursor-not-allowed'
                                    : 'border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/40'
                                }`}
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        {showArchivePage && (
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Archive size={18} />
                    Tag Archive
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Soft-deleted tags retained for audit and potential restore.
                  </p>
                </div>
                <button
                  onClick={loadArchive}
                  disabled={isLoadingArchive}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={isLoadingArchive ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {isLoadingArchive ? (
                <div className="flex items-center justify-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                  Loading archived tags...
                </div>
              ) : !archivedTags || archivedTags.length === 0 ? (
                <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No archived tags found for the current project.
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Type</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Scope</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Deleted At</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Reason</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {archivedTags.map((tag) => (
                        <tr key={tag.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="px-4 py-2 align-top">
                            <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {tag.name}
                              {tag.lifecycle === 'archived' && (
                                <span className="px-2 py-0.5 text-[11px] rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                  Archived
                                </span>
                              )}
                            </div>
                            {tag.address && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{tag.address}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                            {tag.type}
                            {tag.udtType && ` (${tag.udtType})`}
                          </td>
                          <td className="px-4 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-1">
                              {getScopeIcon(tag.scope)}
                              <span className="capitalize text-xs">{tag.scope || 'global'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                            {tag.deletedAt ? new Date(tag.deletedAt).toLocaleString() : <span className="text-gray-400">Unknown</span>}
                          </td>
                          <td className="px-4 py-2 align-top text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={tag.deletedReason || ''}>
                            {tag.deletedReason || <span className="text-gray-400">No reason provided</span>}
                          </td>
                          <td className="px-4 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    await tagApi.restore(tag.id)
                                    await Promise.all([loadTags(), loadArchive()])
                                    setSuccessMessage(`Tag "${tag.name}" restored successfully!`)
                                    setShowSuccessDialog(true)
                                  } catch (error) {
                                    console.error('Failed to restore tag from archive:', error)
                                    setSuccessMessage('Failed to restore tag: ' + (error as Error).message)
                                    setShowSuccessDialog(true)
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/40"
                              >
                                <RefreshCw size={14} />
                                Restore
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        {showPolicyPage && (
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Shield size={16} />
                    Tag Lifecycle Policies
                  </h2>
                  <div className="flex items-center gap-3">
                    {isLoadingPolicies && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPolicyFormDialog(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#FF6A00] text-white hover:bg-[#E55F00]"
                    >
                      <Plus size={12} />
                      Add Policy
                    </button>
                  </div>
                </div>

                {lifecyclePolicies.length === 0 && !isLoadingPolicies && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No lifecycle policies defined yet. Use the button above to create one.
                  </p>
                )}

                {lifecyclePolicies.length > 0 && (
                  <div className="space-y-2">
                    {lifecyclePolicies.map((policy) => {
                      const isSelected = selectedPolicyId === policy.id
                      const isCurrent = (activeProject as any).tag_lifecycle_policy_id
                        ? (activeProject as any).tag_lifecycle_policy_id === policy.id
                        : policy.id === 'default'
                      return (
                        <button
                          key={policy.id}
                          type="button"
                          onClick={() => {
                            if (isCurrent) return
                            setPendingPolicyId(policy.id)
                            setShowPolicyConfirmDialog(true)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? 'bg-orange-50 dark:bg-orange-900/40 border-orange-400 dark:border-orange-500'
                              : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => {
                                if (isCurrent) return
                                setPendingPolicyId(policy.id)
                                setShowPolicyConfirmDialog(true)
                              }}
                              className="h-3 w-3 text-[#FF6A00] border-gray-300"
                            />
                            <div>
                              <div className="text-xs font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] uppercase tracking-wide">
                                  {policy.id}
                                </span>
                                <span>{policy.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                    Current
                                  </span>
                                )}
                              </div>
                              {policy.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                  {policy.description}
                                </p>
                              )}
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                States: {policy.states.map((s) => s.label || s.id).join(', ')}
                              </p>
                              {Array.isArray(policy.states) && policy.states.length > 0 && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                  Thresholds:{' '}
                                  {policy.states
                                    .map((s) => s.thresholdDays)
                                    .filter((d) => typeof d === 'number' && d >= 0)
                                    .sort((a, b) => a - b)
                                    .join(' / ')}{' '}
                                  days
                                </p>
                              )}
                            </div>
                          </div>
                          {policy.id !== 'default' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPendingDeletePolicyId(policy.id)
                              }}
                              className="ml-3 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                              title="Delete policy"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

        {showPresetPage && (
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">CSV Mapping Presets</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Presets are stored per organization and workspace on this device.</p>
                </div>
                <button
                  onClick={() => handleOpenPresetDialog()}
                  disabled={!isAdmin}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-sm font-medium hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus size={16} />
                  New Preset
                </button>
              </div>

              {!isAdmin && (
                <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-xs text-yellow-800 flex items-center gap-2">
                  <Shield size={14} />
                  Only Admins can create, edit, or delete presets. You can still apply existing presets during CSV import/export.
                </div>
              )}

              {presets.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No CSV mapping presets defined yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-200">Name</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-200">Vendor</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-200">Version</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-200">Updated</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-200">Mappings</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presets.map(preset => (
                      <tr key={preset.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-4 text-gray-900 dark:text-gray-100">{preset.name}</td>
                        <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300 capitalize">{preset.vendor || 'neutral'}</td>
                        <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300">v{preset.version}</td>
                        <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300">{new Date(preset.updatedAt).toLocaleString()}</td>
                        <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300">{preset.fieldMappings.length} fields</td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenPresetDialog(preset)}
                              disabled={!isAdmin}
                              className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 disabled:opacity-50"
                              title="Edit preset"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleRequestDeletePreset(preset)}
                              disabled={!isAdmin}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-600 disabled:opacity-50"
                              title="Delete preset"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Lifecycle Policy Change Confirmation Dialog */}
      {showPolicyConfirmDialog && pendingPolicyId && (
        <Dialog
          isOpen={showPolicyConfirmDialog}
          onClose={() => { setShowPolicyConfirmDialog(false); setPendingPolicyId(null) }}
          title="Change Lifecycle Policy?"
        >
          <div className="p-4 space-y-3 bg-white dark:bg-gray-900">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              This will update the lifecycle policy for the current project. Tags may change deprecation state the next time lifecycle evaluation runs.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can always switch policies again later. Existing tags are not deleted automatically; only their lifecycle states and removal eligibility may change.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => { setShowPolicyConfirmDialog(false); setPendingPolicyId(null) }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md bg-[#FF6A00] text-white hover:bg-[#E55F00]"
                onClick={handleConfirmPolicyChange}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Lifecycle Policy Confirmation Dialog */}
      {pendingDeletePolicyId && (
        <Dialog
          isOpen={!!pendingDeletePolicyId}
          onClose={() => setPendingDeletePolicyId(null)}
          title="Delete Lifecycle Policy?"
        >
          <div className="p-4 space-y-3 bg-white dark:bg-gray-900">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              This will permanently remove the selected lifecycle policy. Projects currently using it must first be switched to a different policy.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The built-in default policy cannot be deleted.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setPendingDeletePolicyId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700"
                onClick={handleConfirmPolicyDelete}
              >
                Delete Policy
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Add Lifecycle Policy Dialog */}
      {showPolicyFormDialog && (
        <Dialog
          isOpen={showPolicyFormDialog}
          onClose={() => setShowPolicyFormDialog(false)}
          title="Add Lifecycle Policy"
          size="large"
        >
          <div className="p-6 space-y-4 bg-white dark:bg-gray-900">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Policy Name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Conservative Policy"
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Optional description for this policy"
                  value={newPolicyDescription}
                  onChange={(e) => setNewPolicyDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                <Shield size={14} />
                Inactivity thresholds (days since last reference)
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Normal → Low</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={thresholdLow}
                    onChange={(e) => setThresholdLow(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Low → Review</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={thresholdReview}
                    onChange={(e) => setThresholdReview(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Review → Deprecated</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={thresholdDeprecated}
                    onChange={(e) => setThresholdDeprecated(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Deprecated → Removable</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={thresholdRemoval}
                    onChange={(e) => setThresholdRemoval(Number(e.target.value) || 0)}
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Eligible for removal uses the last threshold as its minimum and has no maximum.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setShowPolicyFormDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md bg-[#FF6A00] text-white hover:bg-[#E55F00]"
                onClick={handleCreatePolicy}
              >
                Save Policy
              </button>
            </div>
          </div>
        </Dialog>
      )}

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

      {/* Delete Tag Confirmation Dialog with safety checkboxes */}
      {showDeleteDialog && tagToDelete && (
        <Dialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false)
            setTagToDelete(null)
            setConfirmNoActiveRefs(false)
            setConfirmDestructive(false)
          }}
          title="Delete Tag"
          type="warning"
          size="small"
        >
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Are you sure you want to delete tag "{tagToDelete.name}"? This will perform a policy-aware soft delete. The tag will no longer be available in the tag database or logic exports.
            </p>
            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-200">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmNoActiveRefs}
                  onChange={(e) => setConfirmNoActiveRefs(e.target.checked)}
                />
                <span>I have verified no active references exist for this tag.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmDestructive}
                  onChange={(e) => setConfirmDestructive(e.target.checked)}
                />
                <span>I understand this will remove the tag from the tag database and future logic exports.</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setTagToDelete(null)
                  setConfirmNoActiveRefs(false)
                  setConfirmDestructive(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmNoActiveRefs || !confirmDestructive || isLoading}
                className={`px-3 py-1.5 text-xs rounded-md bg-red-600 text-white ${
                  !confirmNoActiveRefs || !confirmDestructive || isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-red-700'
                }`}
                onClick={executeDelete}
              >
                {isLoading ? 'Deleting…' : 'Delete Tag'}
              </button>
            </div>
          </div>
        </Dialog>
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

      {/* CSV Import Preset Selection Dialog */}
      {showCsvImportDialog && pendingCsvImport && (
        <Dialog
          isOpen={showCsvImportDialog}
          onClose={() => {
            setShowCsvImportDialog(false)
            setPendingCsvImport(null)
            setSelectedImportPresetId(null)
            setSchemaDriftColumns([])
          }}
          title="Import CSV with Preset"
          size="medium"
        >
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Choose a CSV mapping preset to apply when importing <span className="font-mono">{pendingCsvImport.fileName}</span>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Preset</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={selectedImportPresetId || ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  setSelectedImportPresetId(id)
                  if (id) {
                    const preset = presets.find(p => p.id === id)
                    if (preset) {
                      const missing = preset.fieldMappings
                        .map(m => m.columnName)
                        .filter(col => !pendingCsvImport.header.includes(col))
                      setSchemaDriftColumns(missing)
                    }
                  } else {
                    setSchemaDriftColumns([])
                  }
                }}
              >
                <option value="">Select a preset...</option>
                {presets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} (v{preset.version})
                  </option>
                ))}
              </select>
            </div>

            {schemaDriftColumns.length > 0 && (
              <div className="p-3 rounded border border-yellow-300 bg-yellow-50 text-xs text-yellow-800 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5" />
                <div>
                  <div className="font-semibold mb-1">Schema drift detected</div>
                  <div>The following columns defined in the preset were not found in the CSV header:</div>
                  <ul className="list-disc list-inside mt-1">
                    {schemaDriftColumns.map(col => (
                      <li key={col}>{col}</li>
                    ))}
                  </ul>
                  <div className="mt-1">You can still continue, but those fields will be left empty.</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCsvImportDialog(false)
                  setPendingCsvImport(null)
                  setSelectedImportPresetId(null)
                  setSchemaDriftColumns([])
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={executeCsvImportWithPreset}
                disabled={!selectedImportPresetId}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* CSV Export Preset Selection Dialog */}
      {showCsvExportDialog && (
        <Dialog
          isOpen={showCsvExportDialog}
          onClose={() => {
            setShowCsvExportDialog(false)
            setSelectedExportPresetId(null)
          }}
          title="Export CSV with Preset"
          size="medium"
        >
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Choose a CSV mapping preset to apply when exporting the current tags.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Preset</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={selectedExportPresetId || ''}
                onChange={(e) => setSelectedExportPresetId(e.target.value || null)}
              >
                <option value="">Select a preset...</option>
                {presets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} (v{preset.version})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCsvExportDialog(false)
                  setSelectedExportPresetId(null)
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!selectedExportPresetId) return
                  const preset = presets.find(p => p.id === selectedExportPresetId)
                  if (!preset) return

                  const header = preset.fieldMappings.map(m => m.columnName)
                  const rows = (Array.isArray(tags) ? tags : []).map(tag => {
                    return preset.fieldMappings.map(mapping => {
                      const field = mapping.field as TagCsvFieldKey
                      switch (field) {
                        case 'name':
                          return tag.name || ''
                        case 'type':
                          return (tag.type || '').toString()
                        case 'address':
                          return tag.address || ''
                        case 'value':
                          return tag.value !== null && tag.value !== undefined ? String(tag.value) : ''
                        case 'area':
                          return tag.area || ''
                        case 'equipment':
                          return tag.equipment || ''
                        case 'routine':
                          return tag.routine || ''
                        case 'description':
                          return tag.metadata?.description || ''
                        default:
                          return ''
                      }
                    })
                  })

                  const csv = [header, ...rows]
                    .map(row => row.join(','))
                    .join('\n')

                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `tags-export-${Date.now()}.csv`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  window.URL.revokeObjectURL(url)

                  setShowCsvExportDialog(false)
                  setSelectedExportPresetId(null)
                  setSuccessMessage('Tags exported to CSV successfully')
                  setShowSuccessDialog(true)
                }}
                disabled={!selectedExportPresetId}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* CSV Preset Editor Dialog */}
      {showPresetDialog && editingPreset && (
        <CsvPresetEditorDialog
          preset={editingPreset}
          isOpen={showPresetDialog}
          onClose={() => {
            setShowPresetDialog(false)
            setEditingPreset(null)
          }}
          onSave={handleSavePreset}
        />
      )}

      {/* Delete Preset Confirmation Dialog */}
      {presetToDelete && (
        <Dialog
          isOpen={!!presetToDelete}
          onClose={() => setPresetToDelete(null)}
          title="Delete CSV Preset"
          message={presetToDelete ? `Are you sure you want to delete preset "${presetToDelete.name}"?` : ''}
          type="warning"
          size="small"
          actions={[
            {
              label: 'Cancel',
              onClick: () => setPresetToDelete(null),
              variant: 'secondary'
            },
            {
              label: 'Delete',
              onClick: handleConfirmDeletePreset,
              variant: 'danger' as const
            }
          ]}
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

type CsvPresetEditorDialogProps = {
  isOpen: boolean
  onClose: () => void
  preset: TagCsvMappingPreset
  onSave: (preset: TagCsvMappingPreset) => void
}

function CsvPresetEditorDialog({ isOpen, onClose, preset, onSave }: CsvPresetEditorDialogProps) {
  const [name, setName] = useState(preset.name)
  const [description, setDescription] = useState(preset.description || '')
  const [vendor, setVendor] = useState<TagCsvMappingPreset['vendor']>(preset.vendor || 'neutral')
  const [mappings, setMappings] = useState<TagCsvFieldMapping[]>(preset.fieldMappings)

  const updateMapping = (id: string, updates: Partial<TagCsvFieldMapping>) => {
    setMappings((current) => current.map(m => (m.id === id ? { ...m, ...updates } : m)))
  }

  const addMapping = () => {
    const id = `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    setMappings((current) => [
      ...current,
      { id, columnName: '', field: 'name', required: false }
    ])
  }

  const removeMapping = (id: string) => {
    setMappings((current) => current.filter(m => m.id !== id))
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }
    const cleanedMappings = mappings.filter(m => m.columnName.trim().length > 0)
    const now = new Date().toISOString()
    onSave({
      ...preset,
      name: trimmedName,
      description: description.trim() || undefined,
      vendor,
      fieldMappings: cleanedMappings,
      version: (preset.version || 0) + 1,
      updatedAt: now
    })
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Edit CSV Mapping Preset" size="large">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Rockwell Export Map"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Vendor</label>
            <select
              value={vendor || 'neutral'}
              onChange={(e) => setVendor(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="neutral">Neutral</option>
              <option value="rockwell">Rockwell</option>
              <option value="siemens">Siemens</option>
              <option value="beckhoff">Beckhoff</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Short description of this mapping preset"
          />
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Field Mappings</h3>
            <button
              onClick={addMapping}
              className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
            >
              <Plus size={12} />
              Add Mapping
            </button>
          </div>
          {mappings.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-4">No mappings defined. Add at least one column mapping.</div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
              {mappings.map(mapping => (
                <div key={mapping.id} className="grid grid-cols-12 gap-3 items-center px-3 py-2 bg-white dark:bg-gray-900">
                  <div className="col-span-5">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">CSV Column Name</label>
                    <input
                      type="text"
                      value={mapping.columnName}
                      onChange={(e) => updateMapping(mapping.id, { columnName: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                      placeholder="TagName"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tag Field</label>
                    <select
                      value={mapping.field}
                      onChange={(e) => updateMapping(mapping.id, { field: e.target.value as TagCsvFieldKey })}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="name">Name</option>
                      <option value="type">Type</option>
                      <option value="address">Address</option>
                      <option value="value">Value</option>
                      <option value="area">Area</option>
                      <option value="equipment">Equipment</option>
                      <option value="routine">Routine</option>
                      <option value="description">Description</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!mapping.required}
                      onChange={(e) => updateMapping(mapping.id, { required: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">Required</span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeMapping(mapping.id)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-600"
                      title="Remove mapping"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || mappings.length === 0}
            className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Preset
          </button>
        </div>
      </div>
    </Dialog>
  )
}
