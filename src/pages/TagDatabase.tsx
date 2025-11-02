import { useState, useEffect } from 'react'
import { Card } from '../components/Card'
import { mockTags } from '../data/mockData'
import type { Tag } from '../types'

export function TagDatabase() {
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setTags(mockTags)
  }, [])

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatValue = (value: string | number | boolean) => {
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return value.toString()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tag Database</h1>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
          />
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-neutral-200 text-neutral-600 rounded-md cursor-not-allowed transition-opacity hover:bg-neutral-300">
              Import
            </button>
            <button className="px-3 py-1.5 text-sm bg-neutral-200 text-neutral-600 rounded-md cursor-not-allowed transition-opacity hover:bg-neutral-300">
              Export
            </button>
            <button className="px-3 py-1.5 text-sm bg-[#FF6A00] text-white rounded-md hover:bg-[#FF8020] transition-colors">
              Sync
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
              {filteredTags.map((tag, index) => (
                <tr key={tag.id} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                  <td className="py-2 px-4 font-mono text-neutral-900">{tag.name}</td>
                  <td className="py-2 px-4">
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                      {tag.type}
                    </span>
                  </td>
                  <td className="py-2 px-4 font-mono text-neutral-900">{formatValue(tag.value)}</td>
                  <td className="py-2 px-4 font-mono text-neutral-600">{tag.address}</td>
                  <td className="py-2 px-4 text-neutral-500">{tag.lastUpdate.toLocaleTimeString()}</td>
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


