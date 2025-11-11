import { create } from 'zustand'
import type { LogicFile, ValidationResult } from '../types'
import { logicApi } from '../services/api'

type LogicState = {
  currentFile: LogicFile | null
  files: LogicFile[]
  isModified: boolean
  isSaving: boolean
  validationResult: ValidationResult | null
  vendor: 'neutral' | 'rockwell' | 'siemens' | 'beckhoff'
  
  // Actions
  loadFile: (id: string) => Promise<void>
  loadAllFiles: () => Promise<void>
  createFile: (name: string) => Promise<void>
  updateContent: (content: string) => void
  saveFile: () => Promise<void>
  validate: () => Promise<void>
  setVendor: (vendor: LogicState['vendor']) => void
  reset: () => void
}

const STORAGE_KEY = 'pandaura:currentLogic'

export const useLogicStore = create<LogicState>((set, get) => ({
  currentFile: null,
  files: [],
  isModified: false,
  isSaving: false,
  validationResult: null,
  vendor: 'neutral',

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

  reset: () => {
    set({
      currentFile: null,
      isModified: false,
      validationResult: null,
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

