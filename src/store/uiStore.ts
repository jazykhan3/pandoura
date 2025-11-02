import { create } from 'zustand'

export type RouteKey =
  | 'dashboard'
  | 'shadow'
  | 'tags'
  | 'logic'
  | 'deploy'
  | 'settings'

type UiState = {
  activeRoute: RouteKey
  setActiveRoute: (route: RouteKey) => void
}

const LAST_ROUTE_KEY = 'pandaura:lastRoute'

export const useUiStore = create<UiState>((set) => ({
  activeRoute: (localStorage.getItem(LAST_ROUTE_KEY) as RouteKey) || 'dashboard',
  setActiveRoute: (route) => {
    localStorage.setItem(LAST_ROUTE_KEY, route)
    set({ activeRoute: route })
  },
}))


