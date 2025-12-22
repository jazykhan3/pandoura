import { create } from 'zustand'
import type { LogicFile, ValidationResult } from '../types'
import { logicApi } from '../services/api'

type EditorTab = {
  id: string
  name: string
  unsaved: boolean
}

type ChangeMarker = {
  line: number
  type: 'added' | 'modified' | 'removed'
}

type LogicState = {
  currentFile: LogicFile | null
  files: LogicFile[]
  openTabs: EditorTab[]
  unsavedChanges: Record<string, string> // fileId -> content
  isModified: boolean
  isSaving: boolean
  isValidating: boolean
  validationResult: ValidationResult | null
  changeMarkers: ChangeMarker[]
  showDiffs: boolean
  vendor: 'neutral' | 'rockwell' | 'siemens' | 'beckhoff'
  autoSave: boolean
  
  // Actions
  loadFile: (id: string) => Promise<void>
  loadAllFiles: () => Promise<void>
  createFile: (name: string) => Promise<void>
  updateContent: (content: string) => void
  saveFile: (fileId?: string) => Promise<void>
  validate: (content?: string) => Promise<void>
  setVendor: (vendor: LogicState['vendor']) => void
  
  // Tab management
  openTab: (file: LogicFile) => void
  closeTab: (fileId: string) => void
  switchTab: (fileId: string) => void
  
  // Change tracking
  getUnsavedContent: (fileId: string) => string | null
  hasUnsavedChanges: (fileId?: string) => boolean
  discardChanges: (fileId: string) => void
  toggleShowDiffs: () => void
  updateChangeMarkers: () => Promise<void>
  
  // Settings
  setAutoSave: (enabled: boolean) => void
  
  // Session management
  loadSession: () => Promise<void>
  saveSession: () => Promise<void>
  
  reset: () => void
}

const STORAGE_KEY = 'pandaura:currentLogic'

export const useLogicStore = create<LogicState>((set, get) => ({
  currentFile: null,
  files: [],
  openTabs: [],
  unsavedChanges: {},
  isModified: false,
  isSaving: false,
  isValidating: false,
  validationResult: null,
  changeMarkers: [],
  showDiffs: false,
  vendor: 'neutral',
  autoSave: false,

  loadFile: async (id: string) => {
    try {
      const file = await logicApi.getById(id)
      set({ currentFile: file, isModified: false })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file))
    } catch (error) {
      console.error('Failed to load file:', error)
    }
  },

  loadAllFiles: async () => {
    try {
      const files = await logicApi.getAll()
      set({ files })
      
      // Load the first file if no current file
      if (!get().currentFile && files.length > 0) {
        await get().loadFile(files[0].id)
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  },

  createFile: async (name: string) => {
    try {
      const newFile = await logicApi.create({
        name,
        content: '(* New Logic File *)\nPROGRAM New_Program\nVAR\n  (* Variables here *)\nEND_VAR\n\n(* Logic here *)\n\nEND_PROGRAM',
        vendor: get().vendor,
        author: 'Engineer',
      })
      set(state => ({ 
        files: [...state.files, newFile],
        currentFile: newFile,
        isModified: false,
      }))
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  },

  updateContent: (content: string) => {
    const current = get().currentFile
    if (current) {
      set({
        currentFile: { ...current, content },
        isModified: true,
      })
    }
  },

  saveFile: async () => {
    const current = get().currentFile
    if (!current) return

    set({ isSaving: true })
    try {
      const updated = await logicApi.update(current.id, current)
      set({ 
        currentFile: updated,
        isModified: false,
        isSaving: false,
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      
      // Update in files list
      set(state => ({
        files: state.files.map(f => f.id === updated.id ? updated : f),
      }))
    } catch (error) {
      console.error('Failed to save file:', error)
      set({ isSaving: false })
    }
  },

  validate: async () => {
    const current = get().currentFile
    if (!current) return

    try {
      const result = await logicApi.validate(current.content)
      set({ validationResult: result })
    } catch (error) {
      console.error('Validation failed:', error)
    }
  },

  setVendor: (vendor) => {
    set({ vendor })
  },

  // Tab management
  openTab: (file) => {
    set(state => ({
      openTabs: state.openTabs.find(t => t.id === file.id)
        ? state.openTabs
        : [...state.openTabs, { id: file.id, name: file.name, unsaved: false }]
    }))
  },

  closeTab: (fileId) => {
    set(state => ({
      openTabs: state.openTabs.filter(t => t.id !== fileId),
      unsavedChanges: Object.fromEntries(
        Object.entries(state.unsavedChanges).filter(([id]) => id !== fileId)
      )
    }))
  },

  switchTab: (fileId) => {
    const file = get().files.find(f => f.id === fileId)
    if (file) {
      set({ currentFile: file })
    }
  },

  // Change tracking
  getUnsavedContent: (fileId) => {
    return get().unsavedChanges[fileId] || null
  },

  hasUnsavedChanges: (fileId) => {
    if (fileId) {
      return fileId in get().unsavedChanges
    }
    return Object.keys(get().unsavedChanges).length > 0
  },

  discardChanges: (fileId) => {
    set(state => ({
      unsavedChanges: Object.fromEntries(
        Object.entries(state.unsavedChanges).filter(([id]) => id !== fileId)
      )
    }))
  },

  toggleShowDiffs: () => set(state => ({ showDiffs: !state.showDiffs })),

  updateChangeMarkers: async () => {
    // Placeholder for change marker logic
    set({ changeMarkers: [] })
  },

  setAutoSave: (enabled) => set({ autoSave: enabled }),

  loadSession: async () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const file = JSON.parse(stored)
        set({ currentFile: file })
      } catch (error) {
        console.error('Failed to restore logic from storage:', error)
      }
    }
  },

  saveSession: async () => {
    const current = get().currentFile
    if (current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    }
  },

  reset: () => {
    set({
      currentFile: null,
      files: [],
      openTabs: [],
      unsavedChanges: {},
      isModified: false,
      changeMarkers: [],
      validationResult: null
    })
  },
}))

// Initialize on app load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const file = JSON.parse(stored)
      useLogicStore.setState({ currentFile: file })
    } catch (error) {
      console.error('Failed to restore logic from storage:', error)
    }
  }
}

