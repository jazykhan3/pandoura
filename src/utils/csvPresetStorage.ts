import type { TagCsvMappingPreset } from '../types'

const STORAGE_KEY = 'tagCsvMappingPresets'

function safeParse(value: string | null): TagCsvMappingPreset[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}

function saveAll(presets: TagCsvMappingPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // Ignore storage failures (e.g., private mode)
  }
}

export function getPresetsForContext(orgKey: string, workspaceKey: string): TagCsvMappingPreset[] {
  const all = safeParse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
  return all.filter(p => p.orgKey === orgKey && p.workspaceKey === workspaceKey)
}

export function upsertPreset(preset: TagCsvMappingPreset): TagCsvMappingPreset[] {
  const all = safeParse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
  const index = all.findIndex(p => p.id === preset.id)
  if (index >= 0) {
    all[index] = preset
  } else {
    all.push(preset)
  }
  saveAll(all)
  return all
}

export function deletePreset(id: string): TagCsvMappingPreset[] {
  const all = safeParse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
  const filtered = all.filter(p => p.id !== id)
  saveAll(filtered)
  return filtered
}
