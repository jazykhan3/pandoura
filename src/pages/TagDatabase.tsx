import { useState, useEffect } from 'react'
import { Card } from '../components/Card'
import { mockTags } from '../data/mockData'
import { useSyncStore } from '../store/syncStore'
import { tagApi } from '../services/api'
import type { Tag } from '../types'

export function TagDatabase() {
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const syncTags = useSyncStore((s) => s.syncTags)

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    setIsLoading(true)
    try {
      const loadedTags = await tagApi.getAll()
      setTags(loadedTags)
    } catch (error) {
      console.error('Failed to load tags:', error)
      setTags(mockTags)
    } finally {
      setIsLoading(false)
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const result = await tagApi.importTags(file, replaceExisting)
      await loadTags()
      alert(`Import complete!\nCreated: ${result.created}\nUpdated: ${result.updated}\nSkipped: ${result.skipped}`)
      setShowImportDialog(false)
    } catch (error) {
      console.error('Import failed:', error)
      alert('Failed to import tags: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatValue = (value: string | number | boolean | null) => {
    if (value === null) return 'NULL'
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return value.toString()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tag Database</h1>
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:flex-initial sm:w-64 px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
          />
          <div className="flex gap-2">
            <label className="flex-1 sm:flex-initial px-3 py-1.5 text-sm bg-[#FF6A00] text-white rounded-md hover:bg-[#FF8020] transition-colors cursor-pointer text-center">
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button 
              onClick={handleExport}
              disabled={isLoading || tags.length === 0}
              className="flex-1 sm:flex-initial px-3 py-1.5 text-sm bg-[#FF6A00] text-white rounded-md hover:bg-[#FF8020] transition-colors disabled:opacity-50"
            >
              Export
            </button>
            <button 
              onClick={handleSyncTags}
              disabled={isLoading}
              className="flex-1 sm:flex-initial px-3 py-1.5 text-sm bg-[#FF6A00] text-white rounded-md hover:bg-[#FF8020] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Syncing...' : 'Sync to Shadow'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-neutral-700">Name</th>
                <th className="text-left py-3 px-4 font-medium text-neutral-700">Type</th>
                <th className="text-left py-3 px-4 font-medium text-neutral-700">Value</th>
                <th className="text-left py-3 px-4 font-medium text-neutral-700">Address</th>
                <th className="text-left py-3 px-4 font-medium text-neutral-700">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags?.map((tag, index) => (
                <tr key={tag.id} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                  <td className="py-2 px-4 font-mono text-neutral-900">{tag.name}</td>
                  <td className="py-2 px-4">
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                      {tag.type}
                    </span>
                  </td>
                  <td className="py-2 px-4 font-mono text-neutral-900">{formatValue(tag.value)}</td>
                  <td className="py-2 px-4 font-mono text-neutral-600">{tag.address}</td>
                  <td className="py-2 px-4 text-neutral-500">{tag.lastUpdate?.toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-neutral-500 text-right">
          Showing {filteredTags.length} of {tags.length} tags
        </div>
      </Card>
    </div>
  )
}


