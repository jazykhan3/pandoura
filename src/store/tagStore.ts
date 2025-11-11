import { create } from 'zustand'
import type { Tag } from '../types'
import { tagApi } from '../services/api'

type TagState = {
  tags: Tag[]
  isLoading: boolean
  
  // Actions
  loadTags: () => Promise<void>
  getTagNames: () => string[]
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  isLoading: false,

  loadTags: async () => {
    set({ isLoading: true })
    try {
      const tags = await tagApi.getAll()
      set({ tags, isLoading: false })
    } catch (error) {
      console.error('Failed to load tags:', error)
      set({ isLoading: false })
    }
  },

  getTagNames: () => {
    return get().tags.map(t => t.name)
  },
}))

// Auto-load tags on app start
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useTagStore.getState().loadTags()
  }, 500)
}

