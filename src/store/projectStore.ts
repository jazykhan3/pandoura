import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '../types'

type ProjectState = {
  // Active project
  activeProject: Project | null
  
  // All projects
  projects: Project[]
  
  // Loading states
  isLoading: boolean
  isCreating: boolean
  
  // Actions
  setActiveProject: (project: Project | null) => void
  loadProjects: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<Project>
  deleteProject: (projectId: string) => Promise<void>
  updateLastOpened: (projectId: string) => Promise<void>
  getProjectById: (projectId: string) => Project | undefined
}

const API_BASE = 'http://localhost:8000/api'

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      activeProject: null,
      projects: [],
      isLoading: false,
      isCreating: false,

      setActiveProject: (project) => {
        set({ activeProject: project })
        
        // Update last opened on backend
        if (project) {
          fetch(`${API_BASE}/projects/${project.id}/last-opened`, {
            method: 'PUT',
          }).catch(console.error)
        }
      },

      loadProjects: async () => {
        set({ isLoading: true })
        try {
          const response = await fetch(`${API_BASE}/projects`)
          const data = await response.json()
          
          if (data.success) {
            set({ projects: data.projects })
            
            // If no active project, set the most recently opened one
            const current = get().activeProject
            if (!current && data.projects.length > 0) {
              set({ activeProject: data.projects[0] })
            }
          }
        } catch (error) {
          console.error('Failed to load projects:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      createProject: async (name, description) => {
        set({ isCreating: true })
        try {
          const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
          })
          
          const data = await response.json()
          
          if (!data.success) {
            throw new Error(data.error || 'Failed to create project')
          }
          
          // Add to projects list
          set((state) => ({
            projects: [data.project, ...state.projects],
          }))
          
          return data.project
        } catch (error) {
          console.error('Failed to create project:', error)
          throw error
        } finally {
          set({ isCreating: false })
        }
      },

      deleteProject: async (projectId) => {
        try {
          const response = await fetch(`${API_BASE}/projects/${projectId}`, {
            method: 'DELETE',
          })
          
          const data = await response.json()
          
          if (!data.success) {
            throw new Error(data.error || 'Failed to delete project')
          }
          
          // Remove from projects list
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== projectId),
            activeProject:
              state.activeProject?.id === projectId ? null : state.activeProject,
          }))
        } catch (error) {
          console.error('Failed to delete project:', error)
          throw error
        }
      },

      updateLastOpened: async (projectId) => {
        try {
          await fetch(`${API_BASE}/projects/${projectId}/last-opened`, {
            method: 'PUT',
          })
          
          // Reload projects to get updated order
          await get().loadProjects()
        } catch (error) {
          console.error('Failed to update last opened:', error)
        }
      },

      getProjectById: (projectId) => {
        return get().projects.find((p) => p.id === projectId)
      },
    }),
    {
      name: 'pandaura-active-project',
      partialize: (state) => ({ activeProject: state.activeProject }),
    }
  )
)
