import { create } from 'zustand'
import type { LogicFile, ValidationResult } from '../types'
import { logicApi } from '../services/api'
import { sessionService } from '../services/session'

type EditorTab = {
  id: string
  name: string
  unsaved?: boolean
}

type ChangeMarker = {
  line: number
  type: 'added' | 'modified' | 'removed'
}

type UndoRedoStack = {
  undoStack: string[]
  redoStack: string[]
  maxStackSize: number
}

type LogicState = {
  currentFile: LogicFile | null
  files: LogicFile[]
  openTabs: EditorTab[]
  unsavedChanges: Record<string, string | undefined> // fileId -> content
  undoRedoStacks: Record<string, UndoRedoStack> // fileId -> undo/redo stack
  isModified: boolean
  isSaving: boolean
  isValidating: boolean
  validationResult: ValidationResult | null
  validationTimeout: ReturnType<typeof setTimeout> | null
  changeMarkers: ChangeMarker[]
  showDiffs: boolean
  vendor: 'neutral' | 'rockwell' | 'siemens' | 'beckhoff'
  autoSave: boolean
  
  // Actions
  loadFile: (id: string) => Promise<void>
  loadAllFiles: (projectId?: string) => Promise<void>
  createFile: (name: string, projectId?: string) => Promise<void>
  updateContent: (content: string) => void
  saveFile: (fileId?: string) => Promise<void>
  validate: (content?: string) => Promise<void>
  clearValidation: () => void
  setVendor: (vendor: LogicState['vendor']) => void
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  
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

let autoSaveInterval: ReturnType<typeof setTimeout> | null = null

export const useLogicStore = create<LogicState>((set, get) => ({
  currentFile: null,
  files: [],
  openTabs: [],
  unsavedChanges: {},
  undoRedoStacks: {},
  isModified: false,
  isSaving: false,
  isValidating: false,
  validationResult: null,
  validationTimeout: null,
  changeMarkers: [],
  showDiffs: false,
  vendor: 'neutral',
  autoSave: false,

  loadFile: async (id: string) => {
    try {
      const file = await logicApi.getById(id)
      set({ currentFile: file })
      
      // Add to tabs if not already open
      const state = get()
      if (!state.openTabs.find(tab => tab.id === file.id)) {
        get().openTab(file)
      } else {
        get().switchTab(file.id)
      }
      
      await get().saveSession()
    } catch (error) {
      console.error('Failed to load file:', error)
    }
  },

  loadAllFiles: async (projectId?: string) => {
    try {
      const files = await logicApi.getAll(projectId)
      set({ files })
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  },

  createFile: async (name: string, projectId?: string) => {
    try {
      const newFile = await logicApi.create({
        name,
        content: '(* New Logic File *)\nPROGRAM New_Program\nVAR\n  (* Variables here *)\nEND_VAR\n\n(* Logic here *)\n\nEND_PROGRAM',
        vendor: get().vendor,
        author: 'Engineer',
        projectId,
      })
      
      set(state => ({ 
        files: [...state.files, newFile],
        currentFile: newFile,
      }))
      
      get().openTab(newFile)
      await get().saveSession()
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  },

  updateContent: (content: string) => {
    const current = get().currentFile
    if (!current) return

    const state = get()
    const previousContent = state.unsavedChanges[current.id] || current.content

    // Initialize undo/redo stack if it doesn't exist
    let undoStack = state.undoRedoStacks[current.id]
    if (!undoStack) {
      undoStack = {
        undoStack: [],
        redoStack: [],
        maxStackSize: 50
      }
    }

    // Push previous content to undo stack (only if different)
    if (previousContent !== content) {
      undoStack.undoStack.push(previousContent)
      undoStack.redoStack = [] // Clear redo stack on new change
      
      // Limit stack size
      if (undoStack.undoStack.length > undoStack.maxStackSize) {
        undoStack.undoStack.shift()
      }
    }

    // Update state
    set(state => ({
      currentFile: current, // Keep original file content unchanged
      unsavedChanges: {
        ...state.unsavedChanges,
        [current.id]: content
      },
      undoRedoStacks: {
        ...state.undoRedoStacks,
        [current.id]: undoStack
      },
      isModified: true,
      validationResult: null // Clear validation results when content changes
    }))

    // Update tab to show unsaved state
    set(state => ({
      openTabs: state.openTabs.map(tab =>
        tab.id === current.id ? { ...tab, unsaved: true } : tab
      )
    }))

    // Clear validation result when content changes
    set({ validationResult: null })

    // Update change markers
    get().updateChangeMarkers()
    
    // Auto-save session state
    sessionService.debouncedSaveEditorState({
      activeFileId: current.id,
      openTabs: get().openTabs,
      unsavedChanges: get().unsavedChanges
    })
  },

  saveFile: async (fileId?: string) => {
    const targetId = fileId || get().currentFile?.id
    if (!targetId) return

    const state = get()
    const fileToSave = state.files.find(f => f.id === targetId)
    if (!fileToSave) return

    const contentToSave = state.unsavedChanges[targetId] || fileToSave.content

    set({ isSaving: true })
    try {
      const updated = await logicApi.update(targetId, {
        ...fileToSave,
        content: contentToSave
      })
      
      // Update state
      set(state => ({
        files: state.files.map(f => f.id === targetId ? updated : f),
        currentFile: state.currentFile?.id === targetId ? updated : state.currentFile,
        unsavedChanges: {
          ...state.unsavedChanges,
          [targetId]: undefined
        },
        openTabs: state.openTabs.map(tab =>
          tab.id === targetId ? { ...tab, unsaved: false } : tab
        ),
        isModified: state.currentFile?.id === targetId ? false : state.isModified,
        isSaving: false,
        changeMarkers: state.currentFile?.id === targetId ? [] : state.changeMarkers
      }))

      await get().saveSession()
    } catch (error) {
      console.error('Failed to save file:', error)
      set({ isSaving: false })
    }
  },

  validate: async (content?: string) => {
    const current = get().currentFile
    if (!current) return

    const state = get()
    const contentToValidate = content || state.unsavedChanges[current.id] || current.content

    set({ isValidating: true })
    try {
      const result = await logicApi.validate(contentToValidate, state.vendor)
      set({ validationResult: result, isValidating: false, validationTimeout: null })
    } catch (error) {
      console.error('Failed to validate:', error)
      set({ isValidating: false, validationTimeout: null })
    }
  },

  setVendor: (vendor: LogicState['vendor']) => {
    set({ vendor })
    get().saveSession()
  },

  clearValidation: () => {
    set({ validationResult: null, isValidating: false })
  },

  // Tab management
  openTab: (file: LogicFile) => {
    set(state => {
      const existingTab = state.openTabs.find(tab => tab.id === file.id)
      if (existingTab) {
        return { currentFile: file }
      }
      
      return {
        openTabs: [...state.openTabs, {
          id: file.id,
          name: file.name,
          unsaved: Boolean(state.unsavedChanges[file.id])
        }],
        currentFile: file
      }
    })
  },

  closeTab: (fileId: string) => {
    set(state => {
      const newTabs = state.openTabs.filter(tab => tab.id !== fileId)
      let newCurrentFile = state.currentFile
      
      // If closing current file, switch to another tab
      if (state.currentFile?.id === fileId) {
        if (newTabs.length > 0) {
          const nextTab = newTabs[newTabs.length - 1]
          newCurrentFile = state.files.find(f => f.id === nextTab.id) || null
        } else {
          newCurrentFile = null
        }
      }
      
      return {
        openTabs: newTabs,
        currentFile: newCurrentFile
      }
    })
    get().saveSession()
  },

  switchTab: (fileId: string) => {
    const state = get()
    const file = state.files.find(f => f.id === fileId)
    if (file) {
      set({ currentFile: file })
      get().saveSession()
    }
  },

  // Change tracking
  getUnsavedContent: (fileId: string) => {
    return get().unsavedChanges[fileId] || null
  },

  hasUnsavedChanges: (fileId?: string) => {
    const state = get()
    if (fileId) {
      return Boolean(state.unsavedChanges[fileId])
    }
    return Object.keys(state.unsavedChanges).some(id => state.unsavedChanges[id])
  },

  discardChanges: (fileId: string) => {
    set(state => ({
      unsavedChanges: {
        ...state.unsavedChanges,
        [fileId]: undefined
      },
      openTabs: state.openTabs.map(tab =>
        tab.id === fileId ? { ...tab, unsaved: false } : tab
      ),
      isModified: state.currentFile?.id === fileId ? false : state.isModified,
      changeMarkers: state.currentFile?.id === fileId ? [] : state.changeMarkers
    }))
  },

  toggleShowDiffs: () => {
    set(state => ({ showDiffs: !state.showDiffs }))
  },

  updateChangeMarkers: async () => {
    const current = get().currentFile
    if (!current) return

    const currentContent = get().unsavedChanges[current.id]
    if (!currentContent) {
      set({ changeMarkers: [] })
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/api/logic/${current.id}/diff?currentContent=${encodeURIComponent(currentContent)}`)
      if (response.ok) {
        const diffResult = await response.json()
        set({ changeMarkers: diffResult.changes || [] })
      }
    } catch (error) {
      console.error('Failed to get diff:', error)
    }
  },

  // Settings
  setAutoSave: (enabled: boolean) => {
    set({ autoSave: enabled })
    
    if (enabled && !autoSaveInterval) {
      autoSaveInterval = setInterval(() => {
        const state = get()
        if (state.hasUnsavedChanges()) {
          // Auto-save all unsaved files
          Object.keys(state.unsavedChanges).forEach(fileId => {
            if (state.unsavedChanges[fileId]) {
              state.saveFile(fileId)
            }
          })
        }
      }, 5 * 60 * 1000) // 5 minutes
    } else if (!enabled && autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
    
    get().saveSession()
  },

  // Session management
  loadSession: async () => {
    try {
      const session = await sessionService.getSession()
      
      set({
        vendor: session.settings.vendor,
        autoSave: session.settings.autoSave,
        openTabs: (session.editor_state.openTabs || []).map(tab => ({
          ...tab,
          unsaved: tab.unsaved || false
        })),
        unsavedChanges: session.editor_state.unsavedChanges || {}
      })

      // Restore active file if exists
      if (session.editor_state.activeFileId) {
        const files = get().files
        const activeFile = files.find(f => f.id === session.editor_state.activeFileId)
        if (activeFile) {
          set({ currentFile: activeFile })
        }
      }

      // Setup auto-save if enabled
      if (session.settings.autoSave) {
        get().setAutoSave(true)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  },

  saveSession: async () => {
    const state = get()
    try {
      await sessionService.updateSession({
        editor_state: {
          activeFileId: state.currentFile?.id || null,
          openTabs: state.openTabs,
          unsavedChanges: Object.fromEntries(
            Object.entries(state.unsavedChanges).filter(([_, v]) => v !== undefined)
          ) as Record<string, string>,
        },
        settings: {
          autoSave: state.autoSave,
          vendor: state.vendor,
          theme: 'light' // Will be dynamic later
        }
      })
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  },

  // Undo/Redo functionality
  undo: () => {
    const state = get()
    const currentFile = state.currentFile
    if (!currentFile) return

    const stack = state.undoRedoStacks[currentFile.id]
    if (!stack || stack.undoStack.length === 0) return

    const currentContent = state.unsavedChanges[currentFile.id] || currentFile.content
    const previousContent = stack.undoStack.pop()!

    // Push current content to redo stack
    stack.redoStack.push(currentContent)

    // Update content
    set(state => ({
      unsavedChanges: {
        ...state.unsavedChanges,
        [currentFile.id]: previousContent
      },
      undoRedoStacks: {
        ...state.undoRedoStacks,
        [currentFile.id]: stack
      },
      isModified: true
    }))

    // Update tab state
    get().updateContent(previousContent)
  },

  redo: () => {
    const state = get()
    const currentFile = state.currentFile
    if (!currentFile) return

    const stack = state.undoRedoStacks[currentFile.id]
    if (!stack || stack.redoStack.length === 0) return

    const currentContent = state.unsavedChanges[currentFile.id] || currentFile.content
    const nextContent = stack.redoStack.pop()!

    // Push current content to undo stack
    stack.undoStack.push(currentContent)

    // Update content
    set(state => ({
      unsavedChanges: {
        ...state.unsavedChanges,
        [currentFile.id]: nextContent
      },
      undoRedoStacks: {
        ...state.undoRedoStacks,
        [currentFile.id]: stack
      },
      isModified: true
    }))

    // Update tab state
    get().updateContent(nextContent)
  },

  canUndo: () => {
    const state = get()
    const currentFile = state.currentFile
    if (!currentFile) return false
    
    const stack = state.undoRedoStacks[currentFile.id]
    return Boolean(stack && stack.undoStack.length > 0)
  },

  canRedo: () => {
    const state = get()
    const currentFile = state.currentFile
    if (!currentFile) return false
    
    const stack = state.undoRedoStacks[currentFile.id]
    return Boolean(stack && stack.redoStack.length > 0)
  },

  reset: () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
    
    set({
      currentFile: null,
      files: [],
      openTabs: [],
      unsavedChanges: {},
      undoRedoStacks: {},
      isModified: false,
      isSaving: false,
      isValidating: false,
      validationResult: null,
      changeMarkers: [],
      showDiffs: false,
      vendor: 'neutral',
      autoSave: false,
    })
  },
}))

// Initialize session on load
if (typeof window !== 'undefined') {
  const store = useLogicStore.getState()
  store.loadAllFiles().then(() => {
    store.loadSession()
  })
}